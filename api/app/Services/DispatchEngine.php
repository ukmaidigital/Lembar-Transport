<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\DriverStatus;
use App\Enums\OfferResponse;
use App\Enums\OrderStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\DispatchOffer;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Setting;
use App\Models\TripIssue;
use App\Models\User;
use App\Support\Wita;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Wave-based dispatch (PRD Bab 6.3): eligibility, fairness score (rating 40 %, acceptance 20 %,
 * on-time 20 %, idle 20 %), waves of 5 / 10 / all with timeouts, first-accept-wins under a row lock,
 * and `needs_attention` for Ops after the last wave.
 */
class DispatchEngine
{
    public function __construct(private OrderStateMachine $stateMachine, private NotificationService $notifications, private LedgerService $ledger) {}

    /** Schedule dispatch for a confirmed order: start now when close to pickup, else at T-lead_hours. */
    public function schedule(Order $order): Order
    {
        $lead = (int) Setting::value('dispatch.lead_hours');
        if ($order->pickup_at->lte(now()->addHours($lead))) {
            return $this->start($order);
        }
        $order->dispatch_next_at = $order->pickup_at->copy()->subHours($lead);
        $order->save();

        return $order;
    }

    public function start(Order $order): Order
    {
        if ($order->status === OrderStatus::Confirmed) {
            $this->stateMachine->transition($order, OrderStatus::Dispatching, ActorType::System, null, 'dispatch dimulai');
        }
        $order->dispatch_wave = 0;
        $order->needs_attention = false;
        $order->save();

        return $this->runWave($order);
    }

    /** Candidate drivers for admin assignment: every active driver with the right class plus eligibility reasons. */
    public function candidates(Order $order): Collection
    {
        $instant = $order->channel === 'qr';
        $drivers = Driver::query()->with(['user', 'primaryVehicle', 'documents'])
            ->where('status', DriverStatus::Active->value)->get();

        return $drivers->map(function (Driver $driver) use ($order, $instant) {
            $reasons = $this->ineligibilityReasons($driver, $order, $instant);

            return [
                'driver' => $driver,
                'eligible' => $reasons === [],
                'reasons' => $reasons,
                'score' => $this->score($driver),
            ];
        })->sortByDesc(fn ($c) => ($c['eligible'] ? 1000 : 0) + $c['score'])->values();
    }

    public function eligibleDrivers(Order $order, bool $instant = false): Collection
    {
        return $this->candidates($order)->filter(fn ($c) => $c['eligible'])->values();
    }

    /** @return string[] empty when eligible */
    public function ineligibilityReasons(Driver $driver, Order $order, bool $instant = false): array
    {
        $reasons = [];
        if ($driver->status !== DriverStatus::Active) {
            $reasons[] = 'status driver bukan active';
        }
        $vehicle = $driver->primaryVehicle;
        if (! $vehicle || $vehicle->status !== 'active') {
            $reasons[] = 'tidak ada kendaraan aktif';
        } elseif ($vehicle->vehicle_class_id !== $order->vehicle_class_id) {
            $reasons[] = 'kelas kendaraan tidak sesuai';
        }
        if ($vehicle && $order->needs_roof_rack && ! $vehicle->has_roof_rack) {
            $reasons[] = 'kendaraan tanpa roof rack';
        }
        if ($vehicle && $order->child_seats > 0 && ! $vehicle->has_child_seat) {
            $reasons[] = 'kendaraan tanpa child seat';
        }
        if ($driver->hasExpiredRequiredDocument()) {
            $reasons[] = 'dokumen wajib kedaluwarsa';
        }
        if ($this->ledger->isBelowThreshold($driver)) {
            $reasons[] = 'saldo di bawah ambang';
        }
        $pickupDate = Wita::of($order->pickup_at)->toDateString();
        if ($driver->availability()->whereDate('date', $pickupDate)->where('is_blocked', true)->exists()) {
            $reasons[] = 'tanggal diblokir di kalender';
        }
        $buffer = (int) config('lembar.dispatch.overlap_buffer_minutes');
        $duration = $order->destination?->duration_min_est ?? 90;
        $start = $order->pickup_at->copy()->subMinutes($buffer);
        $end = $order->pickup_at->copy()->addMinutes($duration + $buffer);
        $overlap = Order::query()->where('driver_id', $driver->id)->where('id', '!=', $order->id)
            ->whereIn('status', [OrderStatus::Assigned->value, OrderStatus::EnRoute->value, OrderStatus::Arrived->value, OrderStatus::OnTrip->value])
            ->whereBetween('pickup_at', [$start->copy()->subMinutes($duration + $buffer), $end])
            ->first();
        if ($overlap) {
            $reasons[] = "trip {$overlap->code} bentrok (buffer {$buffer} mnt)";
        }
        if ($instant) {
            if (! $driver->is_online || ! $driver->last_seen_at || $driver->last_seen_at->lt(now()->subMinutes((int) config('lembar.dispatch.instant_online_minutes')))) {
                $reasons[] = 'tidak online';
            }
            if ($driver->last_lat && $driver->last_lng && $order->origin) {
                $km = $this->haversine((float) $driver->last_lat, (float) $driver->last_lng, (float) $order->origin->lat, (float) $order->origin->lng);
                if ($km > (float) config('lembar.dispatch.instant_radius_km')) {
                    $reasons[] = sprintf('%.1f km dari pelabuhan', $km);
                }
            }
        }

        return $reasons;
    }

    public function score(Driver $driver): float
    {
        $w = config('lembar.dispatch.score_weights');
        $lastTrip = $driver->orders()->whereNotNull('completed_at')->max('completed_at');
        $idleHours = $lastTrip ? now()->diffInHours(Carbon::parse($lastTrip), true) : 48;
        $idle = min(100, $idleHours / 24 * 100);

        return round(
            $w['rating'] * ((float) $driver->rating_avg / 5 * 100)
            + $w['acceptance'] * (float) $driver->acceptance_rate_30d
            + $w['on_time'] * (float) $driver->on_time_rate_90d
            + $w['idle'] * $idle,
            2
        );
    }

    /** Send the next wave; marks needs_attention when every wave is exhausted. */
    public function runWave(Order $order): Order
    {
        $order->refresh();
        if ($order->status !== OrderStatus::Dispatching) {
            return $order;
        }
        $instant = $order->channel === 'qr';
        $waves = $instant ? config('lembar.dispatch.instant_waves') : Setting::value('dispatch.waves');
        // Drivers already offered in this dispatch cycle, plus anyone who declined or withdrew from this order.
        $alreadyOffered = $order->offers()->where(fn ($q) => $q->where('cycle', $order->dispatch_cycle)->orWhere('response', OfferResponse::Declined->value))->pluck('driver_id')->unique()->all();

        while (true) {
            $waveIndex = $order->dispatch_wave; // 0-based index of the next wave
            if ($waveIndex >= count($waves)) {
                return $this->exhaust($order);
            }
            [$count, $timeout] = $waves[$waveIndex];
            $candidates = $this->eligibleDrivers($order, $instant)->reject(fn ($c) => in_array($c['driver']->id, $alreadyOffered, true))->values();
            if ($count !== null) {
                $candidates = $candidates->take($count);
            }
            $order->dispatch_wave = $waveIndex + 1;
            if ($candidates->isEmpty()) {
                $order->save();

                continue; // nothing to offer in this wave, fall through to the next one
            }
            $expires = now()->addSeconds((int) $timeout);
            foreach ($candidates as $c) {
                DispatchOffer::create([
                    'order_id' => $order->id, 'driver_id' => $c['driver']->id, 'wave' => $order->dispatch_wave, 'cycle' => $order->dispatch_cycle,
                    'score' => $c['score'], 'offered_at' => now(), 'expires_at' => $expires, 'response' => OfferResponse::Pending,
                ]);
                $this->notifications->offerCreated($order, $c['driver'], (int) $timeout);
            }
            $order->dispatch_next_at = $expires;
            $order->save();

            return $order;
        }
    }

    private function exhaust(Order $order): Order
    {
        $retryMinutes = (int) Setting::value('dispatch.retry_minutes');
        $untilHours = (int) config('lembar.dispatch.retry_until_hours');
        $wasFlagged = $order->needs_attention;
        $order->needs_attention = true;
        $order->dispatch_next_at = $order->pickup_at->gt(now()->addHours($untilHours)) ? now()->addMinutes($retryMinutes) : null;
        $order->save();
        if (! $wasFlagged) {
            $this->notifications->needsAttention($order);
        }

        return $order;
    }

    /** Expire stale offers and advance orders whose current wave timed out; retry flagged orders. */
    public function tick(): void
    {
        DispatchOffer::query()->where('response', OfferResponse::Pending->value)->where('expires_at', '<=', now())
            ->update(['response' => OfferResponse::Expired->value, 'responded_at' => now()]);

        Order::query()->where('status', OrderStatus::Confirmed->value)->whereNotNull('dispatch_next_at')->where('dispatch_next_at', '<=', now())
            ->each(fn (Order $o) => $this->start($o));

        Order::query()->where('status', OrderStatus::Dispatching->value)->whereNotNull('dispatch_next_at')->where('dispatch_next_at', '<=', now())
            ->each(function (Order $o) {
                if ($o->offers()->where('response', OfferResponse::Pending->value)->exists()) {
                    return;
                }
                if ($o->needs_attention) {
                    $o->dispatch_wave = 0;
                    $o->dispatch_cycle++; // new cycle: previously offered drivers may be offered again
                    $o->save();
                }
                $this->runWave($o);
            });
    }

    public function accept(DispatchOffer $offer, Driver $driver): Order
    {
        return DB::transaction(function () use ($offer, $driver) {
            $order = Order::query()->lockForUpdate()->findOrFail($offer->order_id);
            $offer = DispatchOffer::query()->lockForUpdate()->findOrFail($offer->id);
            if ($offer->driver_id !== $driver->id) {
                throw new BusinessRuleException('OFFER_FORBIDDEN', 'Tawaran ini bukan untuk Anda.', 403);
            }
            if ($offer->response === OfferResponse::Superseded || ($order->status !== OrderStatus::Dispatching && $offer->response !== OfferResponse::Accepted)) {
                if ($offer->response === OfferResponse::Pending) {
                    $offer->update(['response' => OfferResponse::Superseded, 'responded_at' => now()]);
                }
                throw new BusinessRuleException('OFFER_TAKEN', 'Sudah diambil driver lain.', 409);
            }
            if ($offer->response !== OfferResponse::Pending || $offer->expires_at->isPast()) {
                throw new BusinessRuleException('OFFER_EXPIRED', 'Tawaran sudah kedaluwarsa.', 409);
            }
            $reasons = $this->ineligibilityReasons($driver, $order, $order->channel === 'qr');
            if ($reasons !== []) {
                throw new BusinessRuleException('DRIVER_INELIGIBLE', 'Tidak dapat menerima: '.implode(', ', $reasons), 409);
            }
            $this->assign($order, $driver, ActorType::Driver, $driver->user_id, 'driver menerima tawaran');
            $offer->update(['response' => OfferResponse::Accepted, 'responded_at' => now()]);

            return $order->fresh();
        });
    }

    public function decline(DispatchOffer $offer, Driver $driver): void
    {
        if ($offer->driver_id !== $driver->id) {
            throw new BusinessRuleException('OFFER_FORBIDDEN', 'Tawaran ini bukan untuk Anda.', 403);
        }
        if ($offer->response === OfferResponse::Pending) {
            $offer->update(['response' => OfferResponse::Declined, 'responded_at' => now()]);
            $order = $offer->order;
            if (! $order->offers()->where('response', OfferResponse::Pending->value)->exists()) {
                $this->runWave($order);
            }
        }
    }

    /** Admin assignment; ineligible drivers require an override reason (audited). */
    public function assignManually(Order $order, Driver $driver, User $admin, ?string $overrideReason = null): Order
    {
        return DB::transaction(function () use ($order, $driver, $admin, $overrideReason) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            if ($order->status === OrderStatus::Confirmed) {
                $this->stateMachine->transition($order, OrderStatus::Dispatching, ActorType::Admin, $admin->id, 'assign manual');
            }
            if ($order->status !== OrderStatus::Dispatching) {
                throw new BusinessRuleException('ORDER_NOT_DISPATCHING', 'Pesanan tidak dalam status mencari driver.', 409);
            }
            $reasons = $this->ineligibilityReasons($driver, $order, $order->channel === 'qr');
            if ($reasons !== [] && ! $overrideReason) {
                throw new BusinessRuleException('DRIVER_INELIGIBLE', 'Driver tidak layak: '.implode(', ', $reasons).'. Berikan alasan override.', 422, $reasons);
            }
            $this->assign($order, $driver, ActorType::Admin, $admin->id, $overrideReason ? 'override: '.$overrideReason : 'assign manual oleh Ops', $reasons);
            activity('dispatch')->causedBy($admin)->performedOn($order)->withProperties(['driver_id' => $driver->id, 'override' => $overrideReason, 'reasons' => $reasons])->log('assign_manual');

            return $order->fresh();
        });
    }

    private function assign(Order $order, Driver $driver, ActorType $actor, ?int $actorId, string $reason, array $meta = []): void
    {
        $hadDriverBefore = $order->getOriginal('driver_id') !== null || $order->histories()->where('to_status', OrderStatus::Assigned->value)->exists();
        $order->driver_id = $driver->id;
        $order->vehicle_id = $driver->primaryVehicle?->id;
        $order->assigned_by = $actor === ActorType::Admin ? $actorId : null;
        $order->needs_attention = false;
        $order->dispatch_next_at = null;
        $this->stateMachine->transition($order, OrderStatus::Assigned, $actor, $actorId, $reason, $meta);
        $order->offers()->where('response', OfferResponse::Pending->value)->where('driver_id', '!=', $driver->id)
            ->update(['response' => OfferResponse::Superseded->value, 'responded_at' => now()]);
        $hadDriverBefore ? $this->notifications->driverChanged($order) : $this->notifications->driverAssigned($order);
    }

    /** Driver withdraws or Ops unassigns: back to dispatching with high priority. */
    public function unassign(Order $order, ActorType $actor, ?int $actorId, string $reason): Order
    {
        return DB::transaction(function () use ($order, $actor, $actorId, $reason) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            if (! in_array($order->status, [OrderStatus::Assigned, OrderStatus::EnRoute], true)) {
                throw new BusinessRuleException('ORDER_NOT_ASSIGNED', 'Pesanan tidak sedang ditugaskan.', 409);
            }
            $previousDriver = $order->driver;
            if ($actor === ActorType::Driver && $previousDriver) {
                TripIssue::create(['order_id' => $order->id, 'driver_id' => $previousDriver->id, 'type' => 'withdrawal', 'message' => $reason, 'status' => 'logged']);
                $withdrawals = TripIssue::query()->where('driver_id', $previousDriver->id)->where('type', 'withdrawal')->where('created_at', '>=', now()->subDays(30))->count();
                if ($withdrawals >= 2) {
                    $previousDriver->notes = trim(($previousDriver->notes ?? '')."\nReview: {$withdrawals} penarikan diri dalam 30 hari (".now()->toDateString().')');
                    $previousDriver->save();
                }
            }
            if ($previousDriver) {
                $order->offers()->where('driver_id', $previousDriver->id)->where('response', OfferResponse::Accepted->value)->update(['response' => OfferResponse::Declined->value, 'responded_at' => now()]);
            }
            $order->driver_id = null;
            $order->vehicle_id = null;
            $order->assigned_by = null;
            $order->dispatch_wave = 0;
            $order->dispatch_cycle++;
            $this->stateMachine->transition($order, OrderStatus::Dispatching, $actor, $actorId, $reason);

            return $this->runWave($order);
        });
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $r * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
