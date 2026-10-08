<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['commission_rate', 'waiting.free_minutes', 'cancellation.tiers', 'ledger.balance_threshold'] as $key) {
            if (! Setting::find($key)) {
                Setting::put($key, config('lembar.'.$key));
            }
        }
    }
}
