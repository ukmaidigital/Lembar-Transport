<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\LedgerType;
use App\Enums\OfferResponse;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Order;
use App\Models\Refund;
use App\Models\Setting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Cancellation tiers, refunds and driver compensation (PRD Bab 6.6, 9.4). */
class CancellationPolicy
{
    public function __construct(private OrderStateMachine $stateMachine, private LedgerService $ledger, private NotificationService $notifications) {}

    public function preview(Order $order, ?Carbon $at = null): array
    {
        $at = $at ?? now();
        $hoursBefore = $at->diffInMinutes($order->pickup_at, false) / 60;
        $percent = 100;
        foreach (Setting::value('cancellation.tiers') as [$minHours, $pct]) {
            if ($hoursBefore >= $minHours) {
                $percent = $pct;
                break;
            }
        }
        if (in_array($order->status, [OrderStatus::EnRoute, OrderStatus::Arrived], true)) {
            $percent = 100;
        }
        if ($order->status === OrderStatus::PendingPayment) {
            $percent = 0;
        }
        $fee = (int) round($order->total * $percent / 100);
        $paid = $order->payment_status === PaymentStatus::Paid ? $order->total : 0;
        $refund = max(0, $paid - $fee);
        $compensation = 0;
        if ($order->driver_id && $percent > 0 && $paid > 0) {
            $compPct = $percent >= 100 ? 100 : (int) config('lembar.cancellation.driver_compensation_percent');
            $compensation = (int) round($order->driver_payout_amount * $compPct / 100);
        }

        return [
            'cancellable' => ! $order->status->isTerminal() && $order->status !== OrderStatus::OnTrip,
            'hours_before_pickup' => round($hoursBefore, 1),
            'fee_percent' => $percent,
            'fee' => $fee,
            'paid' => $paid,
            'refund' => $refund,
            'driver_compensation' => $compensation,
        ];
    }

    public function cancel(Order $order, ActorType $actor, ?int $actorId, string $reason, bool $waiveFee = false): Order
    {
        return DB::transaction(function () use ($order, $actor, $actorId, $reason, $waiveFee) {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);
            $preview = $this->preview($order);
            if (! $preview['cancellable']) {
                throw new BusinessRuleException('ORDER_NOT_CANCELLABLE', 'Pesanan tidak dapat dibatalkan pada status ini.', 409);
            }
            if ($waiveFee) {
                $preview['fee'] = 0;
                $preview['refund'] = $preview['paid'];
                $preview['driver_compensation'] = 0;
            }
            $order->cancelled_by_type = $actor->value;
            $order->cancellation_reason = $reason;
            $order->cancellation_fee = $preview['fee'];
            $order->needs_attention = false;
            $driver = $order->driver;
            $this->stateMachine->transition($order, OrderStatus::Cancelled, $actor, $actorId, $reason, ['fee' => $preview['fee'], 'refund' => $preview['refund']]);
            $order->offers()->where('response', OfferResponse::Pending->value)->update(['response' => OfferResponse::Superseded->value, 'responded_at' => now()]);

            if ($preview['refund'] > 0) {
                Refund::create(['order_id' => $order->id, 'payment_id' => $order->latestPayment?->id, 'amount' => $preview['refund'], 'method' => 'bank_transfer', 'status' => 'pending', 'reason' => $reason]);
                $order->payment_status = PaymentStatus::Refunded;
                $order->save();
            }
            if ($driver && $preview['driver_compensation'] > 0) {
                $this->ledger->record($driver, LedgerType::CancellationCompensation, $preview['driver_compensation'], $order, 'Kompensasi pembatalan '.$order->code);
            }
            $this->notifications->orderCancelled($order, $actor);

            return $order->fresh();
        });
    }
}
