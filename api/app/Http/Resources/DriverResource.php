<?php

namespace App\Http\Resources;

use App\Enums\DocumentType;
use App\Http\Controllers\FileController;
use App\Models\Driver;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Driver */
class DriverResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user('sanctum');
        $isAdmin = $viewer?->isAdmin() ?? false;
        $isSelf = $viewer?->id === $this->user_id;
        $canSeeNik = $isSelf || ($isAdmin && $viewer->can('drivers.verify'));
        $latest = $this->latestDocuments();
        $missing = $this->missingRequiredDocuments();

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->user?->name,
            'phone' => $this->when($isAdmin || $isSelf, $this->user?->phone),
            'status' => $this->status->value,
            'is_online' => $this->is_online,
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'nik' => $this->when($canSeeNik, $this->nik),
            'nik_masked' => $this->nik ? substr($this->nik, 0, 4).str_repeat('•', max(0, strlen($this->nik) - 7)).substr($this->nik, -3) : null,
            'birth_date' => $this->birth_date?->toDateString(),
            'address' => $this->address,
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'partner_organization' => $this->partnerOrganization?->name,
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'trips_completed' => $this->trips_completed,
            'acceptance_rate_30d' => $this->acceptance_rate_30d,
            'on_time_rate_90d' => $this->on_time_rate_90d,
            'balance' => $this->when($isAdmin || $isSelf, $this->balance),
            'balance_threshold' => $this->when($isAdmin || $isSelf, (int) Setting::value('ledger.balance_threshold')),
            'below_threshold' => $this->balance < (int) Setting::value('ledger.balance_threshold'),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'verified_at' => $this->verified_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'suspension_reason' => $this->suspension_reason,
            'notes' => $this->when($isAdmin, $this->notes),
            'sla_deadline_at' => $this->submitted_at && $this->status->value === 'submitted' ? $this->submitted_at->copy()->addHours((int) Setting::value('verification_sla_hours'))->toIso8601String() : null,
            'vehicle' => $this->primaryVehicle ? [
                'id' => $this->primaryVehicle->id, 'vehicle_class' => $this->primaryVehicle->vehicleClass?->code, 'vehicle_class_name' => $this->primaryVehicle->vehicleClass?->name_id,
                'brand' => $this->primaryVehicle->brand, 'model' => $this->primaryVehicle->model, 'year' => $this->primaryVehicle->year, 'plate_number' => $this->primaryVehicle->plate_number,
                'color' => $this->primaryVehicle->color, 'seats' => $this->primaryVehicle->seats, 'luggage_capacity' => $this->primaryVehicle->luggage_capacity,
                'has_child_seat' => $this->primaryVehicle->has_child_seat, 'has_roof_rack' => $this->primaryVehicle->has_roof_rack,
                'stnk_expires_at' => $this->primaryVehicle->stnk_expires_at?->toDateString(), 'status' => $this->primaryVehicle->status,
            ] : null,
            'bank_account' => $this->when($isAdmin || $isSelf, fn () => $this->bankAccount ? [
                'bank_code' => $this->bankAccount->bank_code, 'account_number' => $isSelf || $viewer?->can('ledger.manage') || $viewer?->can('drivers.verify') ? $this->bankAccount->account_number : $this->bankAccount->maskedNumber(),
                'account_name' => $this->bankAccount->account_name, 'verified_at' => $this->bankAccount->verified_at?->toIso8601String(),
            ] : null),
            'documents' => $latest->map(fn ($d) => [
                'id' => $d->id, 'type' => $d->type->value, 'label' => $d->type->label(), 'status' => $d->status->value, 'version' => $d->version,
                'expires_at' => $d->expires_at?->toDateString(), 'issued_at' => $d->issued_at?->toDateString(),
                'rejection_reason_code' => $d->rejection_reason_code, 'rejection_note' => $d->rejection_note, 'reviewed_at' => $d->reviewed_at?->toIso8601String(),
                'required' => in_array($d->type, DocumentType::required(), true),
                'file_url' => $this->when($isAdmin || $isSelf, FileController::signedUrl($d->file_path)),
            ])->values(),
            'missing_documents' => array_map(fn (DocumentType $t) => ['type' => $t->value, 'label' => $t->label()], $missing),
            'required_documents' => array_map(fn (DocumentType $t) => ['type' => $t->value, 'label' => $t->label(), 'has_expiry' => $t->hasExpiry()], DocumentType::required()),
            'all_required_approved' => $this->allRequiredDocumentsApproved(),
            'has_expired_document' => $this->hasExpiredRequiredDocument(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
