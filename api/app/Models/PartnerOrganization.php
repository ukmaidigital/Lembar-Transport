<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PartnerOrganization extends Model
{
    protected $guarded = [];

    protected $casts = ['is_active' => 'boolean'];

    public function drivers(): HasMany
    {
        return $this->hasMany(Driver::class);
    }
}
