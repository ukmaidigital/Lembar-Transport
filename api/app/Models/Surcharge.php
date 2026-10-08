<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Surcharge extends Model
{
    protected $guarded = [];

    protected $casts = ['is_active' => 'boolean', 'amount' => 'integer'];

    public function vehicleClass(): BelongsTo
    {
        return $this->belongsTo(VehicleClass::class);
    }
}
