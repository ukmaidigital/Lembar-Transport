<?php

namespace Database\Seeders;

use App\Models\HolidayDate;
use App\Models\Surcharge;
use App\Models\Tariff;
use App\Models\VehicleClass;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class TariffSeeder extends Seeder
{
    public function run(): void
    {
        // Lampiran B (indikatif) — zona => [mpv_standard, mpv_premium, minibus_12, minibus_16]
        $matrix = [
            'Z1' => [200000, 275000, 450000, 550000],
            'Z2' => [225000, 300000, 475000, 575000],
            'Z3' => [300000, 375000, 550000, 650000],
            'Z4' => [300000, 375000, 550000, 650000],
            'Z5' => [375000, 450000, 650000, 750000],
            'Z6' => [400000, 475000, 700000, 800000],
            'Z7' => [500000, 600000, 850000, 950000],
            'Z8' => [650000, 750000, 1000000, 1150000],
        ];
        $classes = VehicleClass::query()->orderBy('sort_order')->pluck('id', 'code');
        $codes = ['mpv_standard', 'mpv_premium', 'minibus_12', 'minibus_16'];
        $validFrom = now()->startOfYear();
        foreach ($matrix as $zoneCode => $prices) {
            $zone = Zone::where('code', $zoneCode)->firstOrFail();
            foreach ($codes as $i => $classCode) {
                Tariff::updateOrCreate(
                    ['zone_id' => $zone->id, 'vehicle_class_id' => $classes[$classCode], 'service_type' => 'transfer_oneway', 'valid_from' => $validFrom],
                    ['base_price' => $prices[$i]]
                );
            }
        }

        $night = ['mpv_standard' => 50000, 'mpv_premium' => 75000, 'minibus_12' => 100000, 'minibus_16' => 100000];
        foreach ($night as $classCode => $amount) {
            Surcharge::updateOrCreate(['code' => 'night', 'vehicle_class_id' => $classes[$classCode]], [
                'name_id' => 'Surcharge malam (22.00–06.00)', 'name_en' => 'Night surcharge (22:00–06:00)',
                'calc_type' => 'flat', 'amount' => $amount, 'applies_from' => '22:00', 'applies_to' => '06:00', 'is_active' => true,
            ]);
        }
        Surcharge::updateOrCreate(['code' => 'holiday', 'vehicle_class_id' => null], [
            'name_id' => 'Surcharge hari raya', 'name_en' => 'Holiday surcharge', 'calc_type' => 'percent', 'amount' => 15, 'is_active' => true,
        ]);
        Surcharge::updateOrCreate(['code' => 'waiting', 'vehicle_class_id' => null], [
            'name_id' => 'Biaya tunggu per 30 menit (MPV)', 'name_en' => 'Waiting fee per 30 minutes (MPV)', 'calc_type' => 'per_unit', 'amount' => 25000, 'unit_minutes' => 30, 'is_active' => true,
        ]);
        foreach (['minibus_12', 'minibus_16'] as $classCode) {
            Surcharge::updateOrCreate(['code' => 'waiting', 'vehicle_class_id' => $classes[$classCode]], [
                'name_id' => 'Biaya tunggu per 30 menit (Minibus)', 'name_en' => 'Waiting fee per 30 minutes (Minibus)', 'calc_type' => 'per_unit', 'amount' => 40000, 'unit_minutes' => 30, 'is_active' => true,
            ]);
        }
        Surcharge::updateOrCreate(['code' => 'child_seat', 'vehicle_class_id' => null], [
            'name_id' => 'Child seat (atas permintaan)', 'name_en' => 'Child seat (on request)', 'calc_type' => 'flat', 'amount' => 50000, 'is_active' => true,
        ]);
        Surcharge::updateOrCreate(['code' => 'roof_rack', 'vehicle_class_id' => null], [
            'name_id' => 'Roof rack / papan selancar', 'name_en' => 'Roof rack / surfboard', 'calc_type' => 'flat', 'amount' => 50000, 'is_active' => true,
        ]);

        $holidays = [];
        foreach (range(24, 31) as $d) {
            $holidays[] = ['date' => sprintf('%d-12-%02d', now()->year, $d), 'name' => 'Libur Natal dan Tahun Baru'];
        }
        $holidays[] = ['date' => sprintf('%d-01-01', now()->year + 1), 'name' => 'Tahun Baru'];
        $holidays[] = ['date' => sprintf('%d-01-02', now()->year + 1), 'name' => 'Libur Tahun Baru'];
        foreach ($holidays as $h) {
            HolidayDate::updateOrCreate(['date' => $h['date']], ['name' => $h['name']]);
        }
    }
}
