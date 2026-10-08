<?php

namespace Database\Factories;

use App\Models\Driver;
use App\Models\Vehicle;
use App\Models\VehicleClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Vehicle> */
class VehicleFactory extends Factory
{
    public function definition(): array
    {
        $class = VehicleClass::query()->where('code', 'mpv_standard')->first() ?? VehicleClass::factory()->create();

        return [
            'driver_id' => Driver::factory(),
            'vehicle_class_id' => $class->id,
            'brand' => 'Toyota',
            'model' => 'Avanza',
            'year' => fake()->numberBetween(2017, 2025),
            'plate_number' => 'DR '.fake()->unique()->numberBetween(1000, 9999).' '.strtoupper(fake()->lexify('??')),
            'color' => fake()->randomElement(['Putih', 'Hitam', 'Silver']),
            'seats' => $class->max_passengers,
            'luggage_capacity' => $class->max_luggage,
            'has_child_seat' => false,
            'has_roof_rack' => false,
            'stnk_expires_at' => now()->addMonths(fake()->numberBetween(2, 11)),
            'status' => 'active',
            'is_primary' => true,
        ];
    }
}
