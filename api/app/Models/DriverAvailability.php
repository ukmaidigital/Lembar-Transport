<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverAvailability extends Model
{
    protected $table = 'driver_availability';

    protected $guarded = [];

    protected $casts = ['date' => 'date', 'is_blocked' => 'boolean'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
