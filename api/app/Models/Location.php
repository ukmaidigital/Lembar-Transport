<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    protected $guarded = [];

    protected $casts = [
        'aliases' => 'array',
        'is_origin' => 'boolean',
        'is_active' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
        'distance_km_est' => 'float',
    ];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Location::class, 'parent_id');
    }

    public function name(string $locale = 'id'): string
    {
        return $locale === 'en' && $this->name_en ? $this->name_en : $this->name_id;
    }
}
