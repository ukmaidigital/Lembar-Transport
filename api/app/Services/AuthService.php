<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Laravel\Sanctum\NewAccessToken;

/** Sanctum tokens with abilities and lifetimes per role (PRD Bab 12.5). */
class AuthService
{
    public function issueToken(User $user, string $device = 'web'): NewAccessToken
    {
        $expires = match ($user->role) {
            UserRole::Admin => now()->addHours((int) config('lembar.tokens.admin_hours')),
            UserRole::Driver => now()->addDays((int) config('lembar.tokens.driver_days')),
            default => now()->addDays((int) config('lembar.tokens.customer_days')),
        };
        $user->forceFill(['last_login_at' => now()])->save();

        return $user->createToken($device, [$user->role->value], $expires);
    }

    public function findOrCreateByPhone(string $phone, UserRole $role, ?string $name = null, ?string $locale = null): User
    {
        $user = User::query()->where('phone', $phone)->first();
        if (! $user) {
            $user = User::create([
                'name' => $name ?: 'Pengguna '.substr($phone, -4),
                'phone' => $phone,
                'phone_verified_at' => now(),
                'role' => $role,
                'locale' => $locale ?: 'id',
                'status' => 'active',
            ]);
        } elseif (! $user->phone_verified_at) {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }

        return $user;
    }
}
