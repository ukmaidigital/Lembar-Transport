<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Refund extends Model
{
    protected $guarded = [];

    protected $casts = ['processed_at' => 'datetime', 'amount' => 'integer'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
