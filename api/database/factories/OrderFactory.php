<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Location;
use App\Models\Order;
use App\Models\VehicleClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Order> */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        $origin = Location::query()->where('is_origin', true)->first();
        $destination = Location::query()->where('type', 'poi')->inRandomOrder()->first();
        $class = VehicleClass::query()->where('code', 'mpv_standard')->first();
        $pickup = now()->addDays(2)->setTime(5, 30);
        $total = 300000;
        $rate = 0.15;

        return [
            'code' => Order::generateCode(),
            'guest_name' => fake()->name(),
            'guest_phone' => '+62812'.fake()->numerify('#######'),
            'guest_email' => fake()->safeEmail(),
            'locale' => 'id',
            'channel' => 'web',
            'service_type' => 'transfer_oneway',
            'status' => OrderStatus::Confirmed,
            'payment_status' => PaymentStatus::Unpaid,
            'payment_method' => PaymentMethod::Cash,
            'origin_location_id' => $origin?->id,
            'meeting_point_id' => $origin?->children()->first()?->id,
            'destination_location_id' => $destination?->id,
            'zone_id' => $destination?->zone_id,
            'vehicle_class_id' => $class?->id,
            'pickup_at' => $pickup,
            'ferry_eta_min_at' => $pickup->copy()->subMinutes(30),
            'ferry_eta_max_at' => $pickup->copy()->addMinutes(60),
            'passengers' => 3,
            'luggage_units' => 2,
            'price_breakdown' => ['base' => $total, 'surcharges' => [], 'total' => $total, 'currency' => 'IDR'],
            'subtotal' => $total,
            'total' => $total,
            'commission_rate' => $rate,
            'commission_amount' => (int) round($total * $rate),
            'driver_payout_amount' => $total - (int) round($total * $rate),
        ];
    }
}
