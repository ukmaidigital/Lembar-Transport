<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopUpRequest extends Model
{
    protected $guarded = [];

    protected $casts = ['reviewed_at' => 'datetime', 'amount' => 'integer'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
