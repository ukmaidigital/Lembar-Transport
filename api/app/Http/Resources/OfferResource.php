<?php

namespace App\Http\Resources;

use App\Models\DispatchOffer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DispatchOffer */
class OfferResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $o = $this->order;

        return [
            'id' => $this->id,
            'wave' => $this->wave,
            'response' => $this->response->value,
            'offered_at' => $this->offered_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'seconds_left' => max(0, (int) now()->diffInSeconds($this->expires_at, false)),
            'order' => [
                'code' => $o->code,
                'destination' => $o->destination?->name_id ?? $o->destination_text,
                'zone' => $o->zone?->name,
                'duration_min_est' => $o->destination?->duration_min_est,
                'pickup_at' => $o->pickup_at?->toIso8601String(),
                'ferry_eta_min_at' => $o->ferry_eta_min_at?->toIso8601String(),
                'ferry_eta_max_at' => $o->ferry_eta_max_at?->toIso8601String(),
                'ferry_route' => $o->ferryRoute?->name,
                'vehicle_class' => $o->vehicleClass?->name_id,
                'passengers' => $o->passengers,
                'luggage_units' => $o->luggage_units,
                'child_seats' => $o->child_seats,
                'needs_roof_rack' => $o->needs_roof_rack,
                'payment_method' => $o->payment_method->value,
                'total' => $o->total,
                'commission_amount' => $o->commission_amount,
                'driver_net' => $o->driver_payout_amount,
                'notes' => $o->notes,
                'channel' => $o->channel,
            ],
        ];
    }
}
