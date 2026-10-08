<?php

namespace App\Services;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\DriverStatus;
use App\Enums\UserRole;
use App\Exceptions\BusinessRuleException;
use App\Models\Driver;
use App\Models\DriverBankAccount;
use App\Models\DriverDocument;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleClass;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/** Driver registration, documents, verification decisions, suspension (PRD Bab 6.2). */
class DriverOnboardingService
{
    public function __construct(private NotificationService $notifications) {}

    public function startApplication(User $user): Driver
    {
        if ($user->role !== UserRole::Driver) {
            $user->update(['role' => UserRole::Driver]);
        }

        return Driver::firstOrCreate(['user_id' => $user->id], ['status' => DriverStatus::Draft]);
    }

    /** Save wizard steps (personal data + vehicle + bank account). */
    public function updateApplication(Driver $driver, array $data, bool $byAdmin = false): Driver
    {
        if (! $byAdmin && ! in_array($driver->status, [DriverStatus::Draft, DriverStatus::RevisionRequired], true)) {
            throw new BusinessRuleException('APPLICATION_LOCKED', 'Data tidak dapat diubah pada status ini.', 409);
        }
        DB::transaction(function () use ($driver, $data) {
            if (isset($data['name'])) {
                $driver->user->update(['name' => $data['name']]);
            }
            $driver->fill(array_intersect_key($data, array_flip(['nik', 'birth_date', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'partner_organization_id'])))->save();
            if (! empty($data['vehicle'])) {
                $v = $data['vehicle'];
                $class = VehicleClass::where('code', $v['vehicle_class'] ?? '')->orWhere('id', $v['vehicle_class_id'] ?? 0)->firstOrFail();
                $maxAge = (int) config('lembar.vehicle_max_age_years');
                if ((int) $v['year'] < now()->year - $maxAge) {
                    throw new BusinessRuleException('VEHICLE_TOO_OLD', "Usia kendaraan maksimal {$maxAge} tahun.", 422);
                }
                $vehicle = $driver->primaryVehicle ?: new Vehicle(['driver_id' => $driver->id, 'is_primary' => true]);
                $plateChanged = $vehicle->exists && $vehicle->plate_number !== $v['plate_number'];
                $vehicle->fill([
                    'vehicle_class_id' => $class->id, 'brand' => $v['brand'], 'model' => $v['model'], 'year' => $v['year'], 'plate_number' => $v['plate_number'],
                    'color' => $v['color'] ?? null, 'seats' => $v['seats'] ?? $class->max_passengers, 'luggage_capacity' => $v['luggage_capacity'] ?? $class->max_luggage,
                    'has_child_seat' => (bool) ($v['has_child_seat'] ?? false), 'has_roof_rack' => (bool) ($v['has_roof_rack'] ?? false),
                    'stnk_expires_at' => $v['stnk_expires_at'] ?? null,
                ]);
                if (! $vehicle->exists || $plateChanged) {
                    $vehicle->status = 'pending';
                }
                $vehicle->save();
            }
            if (! empty($data['bank_account'])) {
                $b = $data['bank_account'];
                DriverBankAccount::updateOrCreate(['driver_id' => $driver->id], ['bank_code' => $b['bank_code'], 'account_number' => $b['account_number'], 'account_name' => $b['account_name']]);
            }
        });

        return $driver->fresh(['user', 'primaryVehicle', 'bankAccount']);
    }

    public function uploadDocument(Driver $driver, DocumentType $type, UploadedFile $file, ?string $expiresAt = null, ?string $number = null, ?int $vehicleId = null): DriverDocument
    {
        $latest = $driver->documents()->where('type', $type->value)->orderByDesc('version')->first();
        if ($latest && $latest->status === DocumentStatus::Approved && $driver->status === DriverStatus::Active && ! $type->hasExpiry()) {
            throw new BusinessRuleException('DOCUMENT_LOCKED', 'Dokumen yang sudah disetujui terkunci.', 409);
        }
        if ($latest && $latest->status === DocumentStatus::Approved && in_array($driver->status, [DriverStatus::RevisionRequired, DriverStatus::Submitted], true)) {
            throw new BusinessRuleException('DOCUMENT_LOCKED', 'Dokumen ini sudah disetujui; hanya dokumen yang ditolak yang dapat diunggah ulang.', 409);
        }
        if ($type->hasExpiry() && ! $expiresAt) {
            throw new BusinessRuleException('EXPIRY_REQUIRED', 'Tanggal kedaluwarsa wajib untuk '.$type->label().'.', 422);
        }
        $path = $file->store("drivers/{$driver->id}/documents/{$type->value}");

        return DriverDocument::create([
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicleId ?? (in_array($type, [DocumentType::Stnk, DocumentType::VehiclePhoto, DocumentType::Kir], true) ? $driver->primaryVehicle?->id : null),
            'type' => $type,
            'file_path' => $path,
            'file_hash' => hash_file('sha256', $file->getRealPath()),
            'document_number' => $number,
            'expires_at' => $expiresAt,
            'status' => DocumentStatus::Pending,
            'version' => ($latest?->version ?? 0) + 1,
        ]);
    }

    public function submit(Driver $driver): Driver
    {
        if (! in_array($driver->status, [DriverStatus::Draft, DriverStatus::RevisionRequired], true)) {
            throw new BusinessRuleException('APPLICATION_LOCKED', 'Pendaftaran sudah diajukan.', 409);
        }
        $missing = $driver->missingRequiredDocuments();
        if ($missing !== []) {
            throw new BusinessRuleException('DOCUMENTS_INCOMPLETE', 'Dokumen wajib belum lengkap: '.implode(', ', array_map(fn (DocumentType $t) => $t->label(), $missing)), 422, array_map(fn ($t) => $t->value, $missing));
        }
        if (! $driver->primaryVehicle) {
            throw new BusinessRuleException('VEHICLE_REQUIRED', 'Data kendaraan belum diisi.', 422);
        }
        if (! $driver->nik || ! $driver->birth_date || ! $driver->address) {
            throw new BusinessRuleException('PROFILE_INCOMPLETE', 'Data diri belum lengkap.', 422);
        }
        $driver->update(['status' => DriverStatus::Submitted, 'submitted_at' => now()]);
        $this->notifications->driverApplicationSubmitted($driver);

        return $driver->fresh();
    }

    public function reviewDocument(DriverDocument $document, User $admin, bool $approve, ?string $reasonCode = null, ?string $note = null, ?string $expiresAt = null): DriverDocument
    {
        if (! $approve && ! $reasonCode) {
            throw new BusinessRuleException('REASON_REQUIRED', 'Pilih alasan penolakan.', 422);
        }
        $document->update([
            'status' => $approve ? DocumentStatus::Approved : DocumentStatus::Rejected,
            'reviewed_by' => $admin->id, 'reviewed_at' => now(),
            'rejection_reason_code' => $approve ? null : $reasonCode, 'rejection_note' => $approve ? null : $note,
            'expires_at' => $expiresAt ?? $document->expires_at,
        ]);
        activity('verification')->causedBy($admin)->performedOn($document)->withProperties(['approve' => $approve, 'reason' => $reasonCode])->log('review_document');

        return $document->fresh();
    }

    /** @param  'activate'|'request_revision'|'reject'  $decision */
    public function decide(Driver $driver, User $admin, string $decision, ?string $note = null): Driver
    {
        if (! in_array($driver->status, [DriverStatus::Submitted, DriverStatus::RevisionRequired, DriverStatus::Draft], true)) {
            throw new BusinessRuleException('DECISION_NOT_ALLOWED', 'Driver tidak sedang dalam proses verifikasi.', 409);
        }
        DB::transaction(function () use ($driver, $admin, $decision, $note) {
            switch ($decision) {
                case 'activate':
                    if (! $driver->allRequiredDocumentsApproved()) {
                        throw new BusinessRuleException('DOCUMENTS_NOT_APPROVED', 'Semua dokumen wajib harus disetujui sebelum aktivasi.', 422);
                    }
                    $driver->update(['status' => DriverStatus::Active, 'verified_at' => now(), 'verified_by' => $admin->id, 'notes' => $note ? trim(($driver->notes ?? '')."\n".$note) : $driver->notes]);
                    $driver->vehicles()->update(['status' => 'active']);
                    $driver->bankAccount?->update(['verified_at' => now()]);
                    break;
                case 'request_revision':
                    $driver->update(['status' => DriverStatus::RevisionRequired]);
                    break;
                case 'reject':
                    $driver->update(['status' => DriverStatus::Rejected, 'notes' => trim(($driver->notes ?? '')."\nDitolak: ".($note ?? '-'))]);
                    break;
                default:
                    throw new BusinessRuleException('INVALID_DECISION', 'Keputusan tidak dikenal.', 422);
            }
            activity('verification')->causedBy($admin)->performedOn($driver)->withProperties(['decision' => $decision, 'note' => $note])->log('decision');
        });
        $this->notifications->driverDecision($driver->fresh(), $decision, $note);

        return $driver->fresh();
    }

    public function suspend(Driver $driver, User $admin, string $reason): Driver
    {
        $driver->update(['status' => DriverStatus::Suspended, 'suspended_at' => now(), 'suspension_reason' => $reason, 'is_online' => false]);
        activity('drivers')->causedBy($admin)->performedOn($driver)->withProperties(['reason' => $reason])->log('suspend');
        $this->notifications->driverSuspension($driver, true, $reason);

        return $driver->fresh();
    }

    public function reactivate(Driver $driver, User $admin, string $reason): Driver
    {
        if ($driver->status !== DriverStatus::Suspended) {
            throw new BusinessRuleException('NOT_SUSPENDED', 'Driver tidak sedang ditangguhkan.', 409);
        }
        $driver->update(['status' => DriverStatus::Active, 'suspended_at' => null, 'suspension_reason' => null]);
        activity('drivers')->causedBy($admin)->performedOn($driver)->withProperties(['reason' => $reason])->log('reactivate');
        $this->notifications->driverSuspension($driver, false, $reason);

        return $driver->fresh();
    }

    /** Scheduler: remind drivers about expiring documents and mark expired ones. */
    public function checkDocumentExpiry(): array
    {
        $reminded = 0;
        $expired = 0;
        $days = config('lembar.document_expiry_reminders_days');
        foreach (Driver::query()->where('status', DriverStatus::Active->value)->with('user')->cursor() as $driver) {
            foreach ($driver->latestDocuments() as $doc) {
                if (! $doc->expires_at) {
                    continue;
                }
                $left = (int) now()->startOfDay()->diffInDays($doc->expires_at->startOfDay(), false);
                if ($left < 0 && $doc->status !== DocumentStatus::Expired) {
                    $doc->update(['status' => DocumentStatus::Expired]);
                    $expired++;
                } elseif (in_array($left, $days, true)) {
                    $this->notifications->documentExpiring($driver, $doc->type->label(), $left);
                    $reminded++;
                }
            }
        }

        return ['reminded' => $reminded, 'expired' => $expired];
    }
}
