<?php

namespace Database\Factories;

use App\Models\VehicleClass;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<VehicleClass> */
class VehicleClassFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => 'mpv_standard',
            'name_id' => 'MPV Standar',
            'name_en' => 'Standard MPV',
            'example_vehicles' => 'Avanza, Xenia, Ertiga',
            'max_passengers' => 4,
            'max_luggage' => 3,
            'sort_order' => 1,
            'is_active' => true,
        ];
    }
}
