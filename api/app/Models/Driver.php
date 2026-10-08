<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\DriverStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Driver extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => DriverStatus::class,
            'nik' => 'encrypted',
            'birth_date' => 'date',
            'is_online' => 'boolean',
            'last_seen_at' => 'datetime',
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'rating_avg' => 'float',
            'acceptance_rate_30d' => 'float',
            'on_time_rate_90d' => 'float',
            'balance' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function partnerOrganization(): BelongsTo
    {
        return $this->belongsTo(PartnerOrganization::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function primaryVehicle(): HasOne
    {
        return $this->hasOne(Vehicle::class)->where('is_primary', true)->latestOfMany();
    }

    public function documents(): HasMany
    {
        return $this->hasMany(DriverDocument::class);
    }

    public function bankAccount(): HasOne
    {
        return $this->hasOne(DriverBankAccount::class)->latestOfMany();
    }

    public function availability(): HasMany
    {
        return $this->hasMany(DriverAvailability::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function offers(): HasMany
    {
        return $this->hasMany(DispatchOffer::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function topUps(): HasMany
    {
        return $this->hasMany(TopUpRequest::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(Rating::class);
    }

    public function isActive(): bool
    {
        return $this->status === DriverStatus::Active;
    }

    /** Latest document per type (highest version). */
    public function latestDocuments()
    {
        return $this->documents()->orderByDesc('version')->orderByDesc('id')->get()->unique('type')->values();
    }

    /** @return DocumentType[] required document types that are missing or not approved */
    public function missingRequiredDocuments(): array
    {
        $latest = $this->latestDocuments()->keyBy(fn (DriverDocument $d) => $d->type->value);

        return array_values(array_filter(DocumentType::required(), function (DocumentType $type) use ($latest) {
            /** @var DriverDocument|null $doc */
            $doc = $latest->get($type->value);

            return $doc === null;
        }));
    }

    public function hasExpiredRequiredDocument(): bool
    {
        return $this->latestDocuments()->contains(function (DriverDocument $doc) {
            return in_array($doc->type, DocumentType::required(), true)
                && ($doc->status === DocumentStatus::Expired || ($doc->expires_at && $doc->expires_at->isPast()));
        });
    }

    public function allRequiredDocumentsApproved(): bool
    {
        $latest = $this->latestDocuments()->keyBy(fn (DriverDocument $d) => $d->type->value);
        foreach (DocumentType::required() as $type) {
            $doc = $latest->get($type->value);
            if (! $doc || $doc->status !== DocumentStatus::Approved) {
                return false;
            }
        }

        return true;
    }
}
