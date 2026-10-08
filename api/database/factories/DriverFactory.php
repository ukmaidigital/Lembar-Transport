<?php

namespace Database\Factories;

use App\Enums\DriverStatus;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Driver> */
class DriverFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->driver(),
            'status' => DriverStatus::Active,
            'nik' => fake()->numerify('5201############'),
            'birth_date' => fake()->dateTimeBetween('-50 years', '-22 years'),
            'address' => fake()->address(),
            'emergency_contact_name' => fake()->name(),
            'emergency_contact_phone' => '+62813'.fake()->numerify('#######'),
            'is_online' => true,
            'last_seen_at' => now(),
            'rating_avg' => fake()->randomFloat(2, 4.2, 5),
            'rating_count' => fake()->numberBetween(5, 300),
            'trips_completed' => fake()->numberBetween(5, 400),
            'acceptance_rate_30d' => fake()->randomFloat(2, 60, 100),
            'on_time_rate_90d' => fake()->randomFloat(2, 80, 100),
            'balance' => 0,
            'submitted_at' => now()->subDays(30),
            'verified_at' => now()->subDays(29),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => DriverStatus::Submitted, 'verified_at' => null, 'is_online' => false]);
    }
}
