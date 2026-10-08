<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\OrderStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use Illuminate\Support\Carbon;

/** The only path for changing orders.status (PRD Lampiran C). Writes append-only history. */
class OrderStateMachine
{
    public function transition(Order $order, OrderStatus $to, ActorType $actor, ?int $actorId = null, ?string $reason = null, array $metadata = [], ?Carbon $clientTimestamp = null): Order
    {
        $from = $order->status;
        if (! $from->canTransitionTo($to)) {
            throw new BusinessRuleException('INVALID_TRANSITION', "Transisi status {$from->value} → {$to->value} tidak diizinkan.", 409);
        }
        $now = now();
        $order->status = $to;
        match ($to) {
            OrderStatus::Assigned => $order->assigned_at = $now,
            OrderStatus::EnRoute => $order->en_route_at = $clientTimestamp ?? $now,
            OrderStatus::Arrived => $order->arrived_at = $clientTimestamp ?? $now,
            OrderStatus::OnTrip => $order->on_trip_at = $clientTimestamp ?? $now,
            OrderStatus::Completed => $order->completed_at = $clientTimestamp ?? $now,
            OrderStatus::Cancelled, OrderStatus::Expired, OrderStatus::NoShow => $order->cancelled_at = $now,
            default => null,
        };
        if ($to === OrderStatus::Dispatching && $from !== OrderStatus::Dispatching) {
            $order->dispatch_started_at = $order->dispatch_started_at ?? $now;
        }
        $order->save();

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => $from->value,
            'to_status' => $to->value,
            'actor_type' => $actor->value,
            'actor_id' => $actorId,
            'reason' => $reason,
            'metadata' => $metadata ?: null,
            'client_timestamp' => $clientTimestamp,
            'created_at' => $now,
        ]);

        return $order;
    }
}
