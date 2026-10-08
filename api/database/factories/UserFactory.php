<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected static ?string $password = null;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+62812'.fake()->unique()->numerify('#######'),
            'phone_verified_at' => now(),
            'email_verified_at' => now(),
            'password' => static::$password ??= 'password',
            'role' => UserRole::Customer,
            'locale' => 'id',
            'status' => 'active',
            'remember_token' => Str::random(10),
        ];
    }

    public function driver(): static
    {
        return $this->state(fn () => ['role' => UserRole::Driver, 'email' => null]);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => UserRole::Admin]);
    }
}
