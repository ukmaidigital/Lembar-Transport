<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverBankAccount extends Model
{
    protected $guarded = [];

    protected $casts = ['account_number' => 'encrypted', 'verified_at' => 'datetime'];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function maskedNumber(): string
    {
        $n = (string) $this->account_number;

        return strlen($n) > 4 ? str_repeat('•', max(0, strlen($n) - 4)).substr($n, -4) : $n;
    }
}
