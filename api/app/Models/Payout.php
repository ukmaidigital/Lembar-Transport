<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payout extends Model
{
    protected $guarded = [];

    protected $casts = ['period_start' => 'date', 'period_end' => 'date', 'paid_at' => 'datetime', 'bank_account_snapshot' => 'array', 'amount' => 'integer'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
