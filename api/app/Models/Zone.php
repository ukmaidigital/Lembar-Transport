<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    protected $guarded = [];

    protected $casts = ['is_active' => 'boolean', 'polygon' => 'array'];

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    public function tariffs(): HasMany
    {
        return $this->hasMany(Tariff::class);
    }
}
