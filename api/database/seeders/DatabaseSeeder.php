<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            VehicleClassSeeder::class,
            GeographySeeder::class,
            TariffSeeder::class,
            SettingsSeeder::class,
            AdminUserSeeder::class,
        ]);

        if (app()->environment('local') || env('SEED_DEMO')) {
            $this->call(DemoSeeder::class);
        }
    }
}
