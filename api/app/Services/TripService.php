<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\LedgerType;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Setting;
use App\Models\TripIssue;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Day-of trip execution by the driver (PRD Bab 6.4): status taps, waiting timer, no-show, completion. */
class TripService
{
    public function __construct(
        private OrderStateMachine $stateMachine,
        private PaymentService $payments,
        private LedgerService $ledger,
        private NotificationService $notifications,
        private QuoteService $quotes,
    ) {}

    public function setStatus(Order $order, Driver $driver, OrderStatus $target, ?Carbon $clientTimestamp = null, ?int $cashCollected = null, ?string $cashNote = null): Order
    {
        if ($order->driver_id !== $driver->id) {
            throw new BusinessRuleException('TRIP_FORBIDDEN', 'Trip ini bukan milik Anda.', 403);
        }
        if (! in_array($target, [OrderStatus::EnRoute, OrderStatus::Arrived, OrderStatus::OnTrip, OrderStatus::Completed], true)) {
            throw new BusinessRuleException('INVALID_TARGET', 'Status tujuan tidak valid.', 422);
        }
        $syncedLate = $clientTimestamp && $clientTimestamp->lt(now()->subMinutes(10));

        return DB::transaction(function () use ($order, $driver, $target, $clientTimestamp, $cashCollected, $cashNote, $syncedLate) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $meta = $syncedLate ? ['synced_late' => true] : [];
            if ($target === OrderStatus::Completed) {
                if ($order->isCash()) {
                    if ($cashCollected === null) {
                        throw new BusinessRuleException('CASH_AMOUNT_REQUIRED', 'Isi jumlah tunai yang diterima.', 422);
                    }
                    if ($cashCollected !== $order->total + $order->waiting_fee && ! $cashNote) {
                        throw new BusinessRuleException('CASH_NOTE_REQUIRED', 'Jumlah berbeda dari tarif; tuliskan alasannya.', 422);
                    }
                }
                $this->stateMachine->transition($order, OrderStatus::Completed, ActorType::Driver, $driver->user_id, 'driver menyelesaikan trip', $meta, $clientTimestamp);
                if ($order->isCash()) {
                    $this->payments->recordCash($order, $cashCollected, $cashNote);
                }
                $this->ledger->settleTrip($order);
                $driver->increment('trips_completed');
                $this->recomputeOnTime($driver);
                $this->notifications->tripCompleted($order);
                if ($this->ledger->isBelowThreshold($driver->fresh())) {
                    $this->notifications->balanceBelowThreshold($driver->fresh());
                }

                return $order->fresh();
            }
            $this->stateMachine->transition($order, $target, ActorType::Driver, $driver->user_id, null, $meta, $clientTimestamp);
            if ($target === OrderStatus::Arrived) {
                $this->notifications->driverArrived($order);
            }

            return $order->fresh();
        });
    }

    /** Waiting state for the trip screen: anchor, free window, fee so far. */
    public function waitingInfo(Order $order): array
    {
        $anchor = $order->waitingAnchor();
        $free = (int) Setting::value('waiting.free_minutes');
        $grace = (int) Setting::value('waiting.no_show_grace_minutes');
        $freeUntil = $anchor?->copy()->addMinutes($free);
        $beyond = $freeUntil && now()->gt($freeUntil) ? (int) now()->diffInMinutes($freeUntil, true) : 0;
        $fee = $beyond > 0 ? $this->quotes->waitingFee($order->vehicleClass, $beyond) : 0;

        return [
            'anchor_at' => $anchor?->toIso8601String(),
            'anchor_source' => $order->docked_source ?? 'estimate',
            'free_until' => $freeUntil?->toIso8601String(),
            'free_minutes_left' => $freeUntil ? max(0, (int) now()->diffInMinutes($freeUntil, false)) : null,
            'minutes_beyond_free' => $beyond,
            'waiting_fee_estimate' => $fee,
            'no_show_available_at' => $freeUntil?->copy()->addMinutes($grace)->toIso8601String(),
            'no_show_available' => $freeUntil ? now()->gte($freeUntil->copy()->addMinutes($grace)) : false,
        ];
    }

    public function requestNoShow(Order $order, Driver $driver, int $contactAttempts, ?string $note): TripIssue
    {
        if ($order->driver_id !== $driver->id || $order->status !== OrderStatus::Arrived) {
            throw new BusinessRuleException('NO_SHOW_NOT_ALLOWED', 'No-show hanya bisa diajukan setelah tiba di titik temu.', 409);
        }
        $info = $this->waitingInfo($order);
        if (! $info['no_show_available']) {
            throw new BusinessRuleException('NO_SHOW_TOO_EARLY', 'Tunggu gratis dan masa tenggang belum berakhir.', 409);
        }
        if ($contactAttempts < (int) config('lembar.waiting.min_contact_attempts')) {
            throw new BusinessRuleException('NO_SHOW_CONTACT_ATTEMPTS', 'Catat minimal 3 upaya kontak terlebih dahulu.', 422);
        }
        $issue = TripIssue::create(['order_id' => $order->id, 'driver_id' => $driver->id, 'type' => 'no_show_request', 'message' => "Upaya kontak: {$contactAttempts}. ".($note ?? ''), 'status' => 'open']);
        $this->notifications->needsAttention($order);

        return $issue;
    }

    public function confirmNoShow(Order $order, User $admin, ?string $note = null): Order
    {
        return DB::transaction(function () use ($order, $admin, $note) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $order->cancellation_fee = $order->total;
            $order->cancelled_by_type = ActorType::Admin->value;
            $order->cancellation_reason = $note ?? 'no-show dikonfirmasi Ops';
            $this->stateMachine->transition($order, OrderStatus::NoShow, ActorType::Admin, $admin->id, $note);
            $order->issues()->where('type', 'no_show_request')->update(['status' => 'resolved', 'handled_by' => $admin->id]);
            if ($order->payment_status === PaymentStatus::Paid && $order->driver) {
                $this->ledger->record($order->driver, LedgerType::CancellationCompensation, $order->driver_payout_amount, $order, 'Kompensasi no-show '.$order->code, $admin->id);
            }
            activity('orders')->causedBy($admin)->performedOn($order)->log('confirm_no_show');

            return $order->fresh();
        });
    }

    public function approveWaitingFee(Order $order, User $admin, int $minutesBeyondFree): Order
    {
        $fee = $this->quotes->waitingFee($order->vehicleClass, $minutesBeyondFree);
        $order->update(['waiting_fee' => $fee]);
        activity('orders')->causedBy($admin)->performedOn($order)->withProperties(['minutes' => $minutesBeyondFree, 'fee' => $fee])->log('approve_waiting_fee');

        return $order->fresh();
    }

    public function reportIssue(Order $order, Driver $driver, string $type, ?string $message): TripIssue
    {
        if ($order->driver_id !== $driver->id) {
            throw new BusinessRuleException('TRIP_FORBIDDEN', 'Trip ini bukan milik Anda.', 403);
        }
        $issue = TripIssue::create(['order_id' => $order->id, 'driver_id' => $driver->id, 'type' => $type, 'message' => $message, 'status' => 'open']);
        $this->notifications->needsAttention($order);

        return $issue;
    }

    /** Scheduler: auto-complete trips stuck in on_trip for 6 hours and flag them. */
    public function autoCompleteStale(): int
    {
        $hours = (int) config('lembar.waiting.auto_complete_hours');
        $count = 0;
        Order::query()->where('status', OrderStatus::OnTrip->value)->where('on_trip_at', '<=', now()->subHours($hours))->each(function (Order $order) use (&$count) {
            $this->stateMachine->transition($order, OrderStatus::Completed, ActorType::System, null, 'auto-complete setelah 6 jam', ['auto_complete' => true]);
            $order->update(['needs_attention' => true]);
            if ($order->isCash()) {
                $order->update(['cash_collected' => null]);
            } else {
                $this->ledger->settleTrip($order);
            }
            $count++;
        });

        return $count;
    }

    private function recomputeOnTime(Driver $driver): void
    {
        $recent = Order::query()->where('driver_id', $driver->id)->where('status', OrderStatus::Completed->value)->where('completed_at', '>=', now()->subDays(90))->get();
        if ($recent->isEmpty()) {
            return;
        }
        $onTime = $recent->filter(function (Order $o) {
            $anchor = $o->ferry_docked_at ?? $o->ferry_eta_max_at ?? $o->pickup_at;

            return $o->arrived_at && $o->arrived_at->lte($anchor->copy()->addMinutes(15));
        })->count();
        $driver->update(['on_time_rate_90d' => round($onTime / $recent->count() * 100, 2)]);
    }
}
