<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Order extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'payment_method' => PaymentMethod::class,
            'needs_attention' => 'boolean',
            'needs_roof_rack' => 'boolean',
            'price_breakdown' => 'array',
            'pickup_at' => 'datetime',
            'ferry_departure_at' => 'datetime',
            'ferry_eta_min_at' => 'datetime',
            'ferry_eta_max_at' => 'datetime',
            'ferry_docked_at' => 'datetime',
            'assigned_at' => 'datetime',
            'en_route_at' => 'datetime',
            'arrived_at' => 'datetime',
            'on_trip_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'dispatch_started_at' => 'datetime',
            'dispatch_next_at' => 'datetime',
            'payment_expires_at' => 'datetime',
            'luggage_units' => 'float',
            'commission_rate' => 'float',
        ];
    }

    public static function generateCode(): string
    {
        do {
            $code = 'LT-'.now()->format('ymd').'-'.Str::upper(Str::random(4));
            $code = preg_replace('/[^A-Z0-9-]/', 'X', $code);
        } while (static::where('code', $code)->exists());

        return $code;
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function vehicleClass(): BelongsTo
    {
        return $this->belongsTo(VehicleClass::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function origin(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'origin_location_id');
    }

    public function meetingPoint(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'meeting_point_id');
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'destination_location_id');
    }

    public function ferryRoute(): BelongsTo
    {
        return $this->belongsTo(FerryRoute::class);
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(DispatchOffer::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function rating(): HasOne
    {
        return $this->hasOne(Rating::class);
    }

    public function issues(): HasMany
    {
        return $this->hasMany(TripIssue::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    public function isCash(): bool
    {
        return $this->payment_method === PaymentMethod::Cash;
    }

    /** Anchor for the free waiting timer: docked tap → ops update → eta_max + buffer. */
    public function waitingAnchor(): ?Carbon
    {
        if ($this->ferry_docked_at) {
            return $this->ferry_docked_at;
        }
        $base = $this->ferry_eta_max_at ?? $this->pickup_at;

        return $base?->copy()->addMinutes((int) config('lembar.waiting.estimate_buffer_minutes'));
    }

    public function maskedPhone(): string
    {
        $p = $this->guest_phone;

        return strlen($p) > 4 ? str_repeat('•', max(0, strlen($p) - 4)).substr($p, -4) : $p;
    }
}
