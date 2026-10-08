<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\HolidayDate;
use App\Models\Location;
use App\Models\Setting;
use App\Models\Surcharge;
use App\Models\Tariff;
use App\Models\VehicleClass;
use App\Models\Zone;
use App\Support\Wita;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Deterministic pricing (PRD Bab 9.2): base tariff active at pickup time + surcharges,
 * rounded up to Rp 1.000. Quotes are locked for 30 minutes behind a quote token.
 */
class QuoteService
{
    /**
     * @param  array{destination_location_id?:int, zone_id?:int, pickup_at:string|Carbon, passengers:int, luggage_units?:float, child_seats?:int, needs_roof_rack?:bool, service_type?:string, locale?:string}  $input
     */
    public function quote(array $input): array
    {
        $destination = null;
        if (! empty($input['destination_location_id'])) {
            $destination = Location::query()->where('is_active', true)->find($input['destination_location_id']);
            if (! $destination || ! $destination->zone_id) {
                throw new BusinessRuleException('DESTINATION_NOT_FOUND', 'Tujuan tidak ditemukan atau di luar zona layanan. Hubungi Ops untuk quote manual.', 422);
            }
            $zone = $destination->zone;
        } else {
            $zone = Zone::query()->where('is_active', true)->find($input['zone_id'] ?? 0);
            if (! $zone) {
                throw new BusinessRuleException('ZONE_NOT_FOUND', 'Zona tujuan tidak ditemukan.', 422);
            }
        }

        $pickupAt = Carbon::parse($input['pickup_at'])->utc();
        if ($pickupAt->isPast()) {
            throw new BusinessRuleException('PICKUP_IN_PAST', 'Waktu penjemputan sudah lewat.', 422);
        }
        $serviceType = $input['service_type'] ?? 'transfer_oneway';
        $passengers = (int) $input['passengers'];
        $luggage = (float) ($input['luggage_units'] ?? 0);
        $childSeats = (int) ($input['child_seats'] ?? 0);
        $roofRack = (bool) ($input['needs_roof_rack'] ?? false);
        $locale = $input['locale'] ?? 'id';

        $classes = VehicleClass::query()->where('is_active', true)->orderBy('sort_order')->get();
        $tariffs = Tariff::query()->where('zone_id', $zone->id)->where('service_type', $serviceType)->activeAt($pickupAt)
            ->orderByDesc('valid_from')->get()->unique('vehicle_class_id')->keyBy('vehicle_class_id');
        $surcharges = Surcharge::query()->where('is_active', true)->get();
        $isHoliday = HolidayDate::query()->whereDate('date', Wita::of($pickupAt)->toDateString())->exists();
        $rate = (float) Setting::value('commission_rate');

        $options = [];
        foreach ($classes as $class) {
            $tariff = $tariffs->get($class->id);
            if (! $tariff) {
                continue;
            }
            $breakdown = $this->breakdown($tariff->base_price, $class, $pickupAt, $surcharges, $isHoliday, $childSeats, $roofRack);
            $reasons = [];
            if ($passengers > $class->max_passengers) {
                $reasons[] = $locale === 'en'
                    ? "Does not fit {$passengers} passengers (max {$class->max_passengers})"
                    : "Tidak muat untuk {$passengers} penumpang (maks. {$class->max_passengers})";
            }
            if ($luggage > $class->max_luggage) {
                $reasons[] = $locale === 'en'
                    ? "Luggage exceeds capacity (max {$class->max_luggage})"
                    : "Bagasi melebihi kapasitas (maks. {$class->max_luggage})";
            }
            $options[] = [
                'vehicle_class' => $class->code,
                'vehicle_class_id' => $class->id,
                'name' => $class->name($locale),
                'example_vehicles' => $class->example_vehicles,
                'max_passengers' => $class->max_passengers,
                'max_luggage' => $class->max_luggage,
                'fits' => $reasons === [],
                'reasons' => $reasons,
                'suggest_two_vehicles' => $passengers > $class->max_passengers && $passengers <= $class->max_passengers * 2,
                'price_breakdown' => $breakdown,
                'total' => $breakdown['total'],
                'commission_rate' => $rate,
                'commission_amount' => (int) round($breakdown['total'] * $rate),
                'driver_net' => $breakdown['total'] - (int) round($breakdown['total'] * $rate),
            ];
        }
        if ($options === []) {
            throw new BusinessRuleException('NO_TARIFF', 'Belum ada tarif untuk zona ini. Hubungi Ops untuk quote manual.', 422);
        }

        $token = 'qt_'.Str::random(40);
        $expiresAt = now()->addMinutes((int) config('lembar.quote_ttl_minutes'));
        $payload = [
            'input' => [
                'destination_location_id' => $destination?->id,
                'zone_id' => $zone->id,
                'pickup_at' => $pickupAt->toIso8601String(),
                'passengers' => $passengers,
                'luggage_units' => $luggage,
                'child_seats' => $childSeats,
                'needs_roof_rack' => $roofRack,
                'service_type' => $serviceType,
            ],
            'options' => collect($options)->keyBy('vehicle_class')->all(),
            'expires_at' => $expiresAt->toIso8601String(),
        ];
        Cache::put('quote:'.$token, $payload, $expiresAt);

        return [
            'quote_token' => $token,
            'expires_at' => $expiresAt->toIso8601String(),
            'zone' => ['id' => $zone->id, 'code' => $zone->code, 'name' => $zone->name],
            'destination' => $destination ? [
                'id' => $destination->id, 'name' => $destination->name($locale),
                'distance_km_est' => $destination->distance_km_est, 'duration_min_est' => $destination->duration_min_est,
            ] : null,
            'pickup_at' => $pickupAt->toIso8601String(),
            'is_holiday' => $isHoliday,
            'options' => $options,
        ];
    }

    /** Resolve a locked quote; throws when the token expired or the class is unknown. */
    public function resolve(string $token, string $vehicleClassCode): array
    {
        $payload = Cache::get('quote:'.$token);
        if (! $payload) {
            throw new BusinessRuleException('QUOTE_EXPIRED', 'Harga sudah kedaluwarsa, silakan hitung ulang.', 409);
        }
        $option = $payload['options'][$vehicleClassCode] ?? null;
        if (! $option) {
            throw new BusinessRuleException('VEHICLE_CLASS_INVALID', 'Kelas kendaraan tidak ada dalam quote ini.', 422);
        }

        return ['input' => $payload['input'], 'option' => $option];
    }

    /** Public tariff table for /harga. */
    public function priceList(string $serviceType = 'transfer_oneway'): array
    {
        $classes = VehicleClass::query()->where('is_active', true)->orderBy('sort_order')->get();
        $now = now();
        $rows = [];
        foreach (Zone::query()->where('is_active', true)->orderBy('sort_order')->get() as $zone) {
            $tariffs = Tariff::query()->where('zone_id', $zone->id)->where('service_type', $serviceType)->activeAt($now)
                ->orderByDesc('valid_from')->get()->unique('vehicle_class_id')->keyBy('vehicle_class_id');
            $rows[] = [
                'zone' => ['id' => $zone->id, 'code' => $zone->code, 'name' => $zone->name, 'description' => $zone->description],
                'prices' => $classes->mapWithKeys(fn (VehicleClass $c) => [$c->code => $tariffs->get($c->id)?->base_price])->all(),
            ];
        }

        return ['classes' => $classes, 'rows' => $rows];
    }

    /** @param  Collection<int, Surcharge>  $surcharges */
    public function breakdown(int $base, VehicleClass $class, Carbon $pickupAt, $surcharges, bool $isHoliday, int $childSeats, bool $roofRack): array
    {
        $items = [];
        $localHour = (int) Wita::of($pickupAt)->format('G');
        $isNight = $localHour >= 22 || $localHour < 6;
        if ($isNight) {
            $night = $surcharges->first(fn (Surcharge $s) => $s->code === 'night' && $s->vehicle_class_id === $class->id)
                ?? $surcharges->first(fn (Surcharge $s) => $s->code === 'night' && $s->vehicle_class_id === null);
            if ($night) {
                $items[] = ['code' => 'night', 'label_id' => $night->name_id, 'label_en' => $night->name_en, 'amount' => $night->amount];
            }
        }
        if ($isHoliday) {
            $holiday = $surcharges->first(fn (Surcharge $s) => $s->code === 'holiday');
            if ($holiday) {
                $amount = $holiday->calc_type === 'percent' ? (int) round($base * $holiday->amount / 100) : $holiday->amount;
                $items[] = ['code' => 'holiday', 'label_id' => $holiday->name_id, 'label_en' => $holiday->name_en, 'amount' => $amount];
            }
        }
        if ($childSeats > 0) {
            $cs = $surcharges->first(fn (Surcharge $s) => $s->code === 'child_seat');
            if ($cs) {
                $items[] = ['code' => 'child_seat', 'label_id' => $cs->name_id, 'label_en' => $cs->name_en, 'amount' => $cs->amount * $childSeats, 'qty' => $childSeats];
            }
        }
        if ($roofRack) {
            $rr = $surcharges->first(fn (Surcharge $s) => $s->code === 'roof_rack');
            if ($rr) {
                $items[] = ['code' => 'roof_rack', 'label_id' => $rr->name_id, 'label_en' => $rr->name_en, 'amount' => $rr->amount];
            }
        }
        $surchargeTotal = array_sum(array_column($items, 'amount'));
        $total = Wita::roundUp($base + $surchargeTotal);

        return [
            'base' => $base,
            'surcharges' => $items,
            'surcharge_total' => $surchargeTotal,
            'discount' => 0,
            'total' => $total,
            'currency' => 'IDR',
            'includes' => ['bbm', 'driver', 'pas_pelabuhan'],
        ];
    }

    /** Waiting fee for minutes beyond the free window (PRD 9.2). */
    public function waitingFee(VehicleClass $class, int $minutesBeyondFree): int
    {
        if ($minutesBeyondFree <= 0) {
            return 0;
        }
        $rule = Surcharge::query()->where('code', 'waiting')->where('is_active', true)
            ->where(fn ($q) => $q->where('vehicle_class_id', $class->id)->orWhereNull('vehicle_class_id'))
            ->orderByRaw('vehicle_class_id is null')->first();
        if (! $rule) {
            return 0;
        }
        $units = (int) ceil($minutesBeyondFree / max(1, $rule->unit_minutes ?? 30));

        return $units * $rule->amount;
    }
}
