<?php

namespace Database\Seeders;

use App\Models\VehicleClass;
use Illuminate\Database\Seeder;

class VehicleClassSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['mpv_standard', 'MPV Standar', 'Standard MPV', 'Avanza, Xenia, Ertiga', 4, 3, 1],
            ['mpv_premium', 'MPV Premium', 'Premium MPV', 'Innova Reborn, Innova Zenix', 5, 4, 2],
            ['minibus_12', 'Minibus 12', 'Minibus 12 seats', 'Hiace Commuter, Elf short', 12, 12, 3],
            ['minibus_16', 'Minibus 16', 'Minibus 16 seats', 'Hiace Premio, Elf long', 16, 14, 4],
        ];
        foreach ($rows as [$code, $id, $en, $ex, $pax, $bags, $sort]) {
            VehicleClass::updateOrCreate(['code' => $code], [
                'name_id' => $id, 'name_en' => $en, 'example_vehicles' => $ex,
                'max_passengers' => $pax, 'max_luggage' => $bags, 'sort_order' => $sort, 'is_active' => true,
            ]);
        }
    }
}
