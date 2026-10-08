<?php

namespace App\Http\Resources;

use App\Http\Controllers\FileController;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user('sanctum');
        $isAdmin = $viewer?->isAdmin() ?? false;
        $isDriver = $viewer?->isDriver() && $this->driver_id && $viewer->driver?->id === $this->driver_id;
        $contactOpen = $this->assigned_at !== null && ! in_array($this->status->value, ['cancelled', 'expired'], true)
            && (! $this->completed_at || $this->completed_at->gt(now()->subHours((int) config('lembar.contact_window_hours'))));
        $locale = $request->header('Accept-Language') ? substr($request->header('Accept-Language'), 0, 2) : ($this->locale ?: 'id');
        $driver = $this->driver;

        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status->value,
            'status_label' => $this->status->label($locale),
            'payment_status' => $this->payment_status->value,
            'payment_method' => $this->payment_method->value,
            'needs_attention' => $this->needs_attention,
            'channel' => $this->channel,
            'service_type' => $this->service_type,
            'locale' => $this->locale,
            'customer' => [
                'id' => $this->customer_id,
                'name' => $this->guest_name,
                'phone' => ($isAdmin || ($isDriver && $contactOpen)) ? $this->guest_phone : $this->maskedPhone(),
                'email' => $isAdmin ? $this->guest_email : null,
            ],
            'origin' => $this->whenLoaded('origin', fn () => ['id' => $this->origin->id, 'name' => $this->origin->name($locale)]),
            'meeting_point' => $this->whenLoaded('meetingPoint', fn () => $this->meetingPoint ? [
                'id' => $this->meetingPoint->id, 'name' => $this->meetingPoint->name($locale),
                'instructions' => $locale === 'en' ? ($this->meetingPoint->instructions_en ?? $this->meetingPoint->instructions_id) : $this->meetingPoint->instructions_id,
                'photo_url' => FileController::signedUrl($this->meetingPoint->photo_path),
            ] : null),
            'destination' => $this->whenLoaded('destination', fn () => $this->destination ? [
                'id' => $this->destination->id, 'name' => $this->destination->name($locale), 'zone' => $this->zone?->name,
                'duration_min_est' => $this->destination->duration_min_est, 'distance_km_est' => $this->destination->distance_km_est,
            ] : ['name' => $this->destination_text, 'zone' => $this->zone?->name]),
            'vehicle_class' => $this->whenLoaded('vehicleClass', fn () => ['code' => $this->vehicleClass->code, 'name' => $this->vehicleClass->name($locale)]),
            'pickup_at' => $this->pickup_at?->toIso8601String(),
            'ferry' => [
                'route' => $this->whenLoaded('ferryRoute', fn () => $this->ferryRoute?->name),
                'operator' => $this->whenLoaded('ferryRoute', fn () => $this->ferryRoute?->operator),
                'departure_at' => $this->ferry_departure_at?->toIso8601String(),
                'eta_min_at' => $this->ferry_eta_min_at?->toIso8601String(),
                'eta_max_at' => $this->ferry_eta_max_at?->toIso8601String(),
                'docked_at' => $this->ferry_docked_at?->toIso8601String(),
                'docked_source' => $this->docked_source,
            ],
            'passengers' => $this->passengers,
            'luggage_units' => $this->luggage_units,
            'child_seats' => $this->child_seats,
            'needs_roof_rack' => $this->needs_roof_rack,
            'notes' => $this->notes,
            'price_breakdown' => $this->price_breakdown,
            'total' => $this->total,
            'waiting_fee' => $this->waiting_fee,
            'cancellation_fee' => $this->cancellation_fee,
            'cancellation_reason' => $this->cancellation_reason,
            'cancelled_by' => $this->cancelled_by_type,
            'cash_collected' => $this->when($isAdmin || $isDriver, $this->cash_collected),
            'commission' => $this->when($isAdmin || $isDriver, ['rate' => $this->commission_rate, 'amount' => $this->commission_amount, 'driver_net' => $this->driver_payout_amount]),
            'payment_expires_at' => $this->payment_expires_at?->toIso8601String(),
            'driver' => $driver ? [
                'id' => $driver->id,
                'name' => $driver->user?->name,
                'rating_avg' => $driver->rating_avg,
                'trips_completed' => $driver->trips_completed,
                'phone' => ($isAdmin || $contactOpen) ? $driver->user?->phone : null,
                'vehicle' => $this->vehicle ? ['brand' => $this->vehicle->brand, 'model' => $this->vehicle->model, 'color' => $this->vehicle->color, 'plate_number' => $this->vehicle->plate_number] : null,
            ] : null,
            'timeline' => [
                'created_at' => $this->created_at?->toIso8601String(),
                'assigned_at' => $this->assigned_at?->toIso8601String(),
                'en_route_at' => $this->en_route_at?->toIso8601String(),
                'arrived_at' => $this->arrived_at?->toIso8601String(),
                'on_trip_at' => $this->on_trip_at?->toIso8601String(),
                'completed_at' => $this->completed_at?->toIso8601String(),
                'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            ],
            'rating' => $this->whenLoaded('rating', fn () => $this->rating ? ['score' => $this->rating->score, 'comment' => $this->rating->comment] : null),
            'histories' => $this->when($isAdmin || $isDriver, fn () => $this->whenLoaded('histories', fn () => $this->histories->map(fn ($h) => [
                'from' => $h->from_status, 'to' => $h->to_status, 'actor_type' => $h->actor_type, 'reason' => $h->reason, 'metadata' => $h->metadata, 'at' => $h->created_at?->toIso8601String(),
            ]))),
            'offers' => $this->when($isAdmin, fn () => $this->whenLoaded('offers', fn () => $this->offers->map(fn ($o) => [
                'id' => $o->id, 'driver_id' => $o->driver_id, 'driver_name' => $o->driver?->user?->name, 'wave' => $o->wave, 'score' => $o->score, 'response' => $o->response->value,
                'offered_at' => $o->offered_at?->toIso8601String(), 'expires_at' => $o->expires_at?->toIso8601String(), 'responded_at' => $o->responded_at?->toIso8601String(),
            ]))),
            'payments' => $this->when($isAdmin, fn () => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($p) => [
                'id' => $p->id, 'method' => $p->method, 'provider' => $p->provider, 'amount' => $p->amount, 'status' => $p->status, 'proof_url' => FileController::signedUrl($p->proof_path),
                'paid_at' => $p->paid_at?->toIso8601String(), 'rejection_reason' => $p->rejection_reason,
            ]))),
            'issues' => $this->when($isAdmin, fn () => $this->whenLoaded('issues', fn () => $this->issues)),
            'dispatch' => $this->when($isAdmin, ['wave' => $this->dispatch_wave, 'cycle' => $this->dispatch_cycle, 'started_at' => $this->dispatch_started_at?->toIso8601String(), 'next_at' => $this->dispatch_next_at?->toIso8601String()]),
            'ticket_url' => rtrim(config('lembar.web_url'), '/').'/pesanan/'.$this->code,
        ];
    }
}
