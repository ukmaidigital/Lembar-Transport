<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'locale' => $this->locale,
            'status' => $this->status,
            'roles' => $this->when($this->isAdmin(), fn () => $this->getRoleNames()),
            'permissions' => $this->when($this->isAdmin(), fn () => $this->getAllPermissions()->pluck('name')),
            'two_factor_enabled' => $this->when($this->isAdmin(), $this->hasTwoFactorEnabled()),
            'driver_id' => $this->when($this->isDriver(), fn () => $this->driver?->id),
            'driver_status' => $this->when($this->isDriver(), fn () => $this->driver?->status->value),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
        ];
    }
}
