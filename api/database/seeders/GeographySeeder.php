<?php

namespace Database\Seeders;

use App\Models\FerryRoute;
use App\Models\Location;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class GeographySeeder extends Seeder
{
    public function run(): void
    {
        $zones = [
            ['Z1', 'Sekotong', 'Sekotong, Pelangan, Bangko-Bangko, penyeberangan Gili Nanggu/Gede', [
                ['Sekotong', 'Sekotong', 'area', -8.75, 116.02, 25, 50],
                ['Pelangan', 'Pelangan', 'area', -8.78, 115.95, 35, 70],
                ['Bangko-Bangko (Desert Point)', 'Bangko-Bangko (Desert Point)', 'poi', -8.74, 115.87, 45, 90],
                ['Pelabuhan Tawun (Gili Nanggu)', 'Tawun Harbour (Gili Nanggu)', 'harbor', -8.73, 116.0, 30, 60],
            ]],
            ['Z2', 'Mataram Raya', 'Mataram, Cakranegara, Ampenan, Terminal Mandalika', [
                ['Mataram (pusat kota)', 'Mataram (city centre)', 'area', -8.5833, 116.1167, 25, 50],
                ['Cakranegara', 'Cakranegara', 'area', -8.59, 116.13, 28, 55],
                ['Ampenan', 'Ampenan', 'area', -8.57, 116.08, 25, 50],
                ['Terminal Mandalika (Bertais)', 'Mandalika Bus Terminal (Bertais)', 'poi', -8.6, 116.15, 30, 60],
            ]],
            ['Z3', 'Senggigi', 'Batu Layar, Senggigi, Mangsit, Klui', [
                ['Senggigi', 'Senggigi', 'area', -8.49, 116.04, 40, 70],
                ['Batu Layar', 'Batu Layar', 'area', -8.52, 116.06, 35, 60],
                ['Mangsit', 'Mangsit', 'area', -8.47, 116.04, 43, 75],
                ['Klui', 'Klui', 'area', -8.46, 116.04, 45, 80],
            ]],
            ['Z4', 'Bandara', 'Bandara Internasional Lombok (Praya), Praya kota', [
                ['Bandara Internasional Lombok (LOP)', 'Lombok International Airport (LOP)', 'airport', -8.7573, 116.2767, 38, 65],
                ['Praya', 'Praya', 'area', -8.71, 116.27, 36, 60],
            ]],
            ['Z5', 'Mandalika', 'Kuta Mandalika, Gerupuk, Selong Belanak, Mawun', [
                ['Kuta Mandalika', 'Kuta Mandalika', 'area', -8.8936, 116.2814, 55, 85],
                ['Gerupuk', 'Gerupuk', 'area', -8.9, 116.35, 60, 95],
                ['Selong Belanak', 'Selong Belanak', 'area', -8.87, 116.16, 50, 80],
                ['Mawun', 'Mawun', 'area', -8.89, 116.2, 55, 90],
            ]],
            ['Z6', 'Bangsal / Gili', 'Bangsal, Teluk Nare, Teluk Kodek (penyeberangan Gili)', [
                ['Pelabuhan Bangsal', 'Bangsal Harbour', 'harbor', -8.3996, 116.0984, 58, 105],
                ['Teluk Nare', 'Teluk Nare', 'harbor', -8.4098, 116.0847, 56, 100],
                ['Teluk Kodek', 'Teluk Kodek', 'harbor', -8.41, 116.09, 56, 100],
            ]],
            ['Z7', 'Lombok Timur', 'Tetebatu, Selong, Labuhan Lombok / Kayangan', [
                ['Tetebatu', 'Tetebatu', 'area', -8.55, 116.37, 65, 110],
                ['Selong', 'Selong', 'area', -8.65, 116.53, 80, 140],
                ['Pelabuhan Kayangan (Labuhan Lombok)', 'Kayangan Harbour (Labuhan Lombok)', 'harbor', -8.5, 116.68, 100, 180],
            ]],
            ['Z8', 'Rinjani', 'Senaru, Sembalun', [
                ['Senaru', 'Senaru', 'area', -8.3, 116.4, 95, 190],
                ['Sembalun', 'Sembalun', 'area', -8.37, 116.53, 125, 230],
            ]],
        ];

        foreach ($zones as $i => [$code, $name, $desc, $locations]) {
            $zone = Zone::updateOrCreate(['code' => $code], ['name' => $name, 'description' => $desc, 'sort_order' => $i + 1, 'is_active' => true]);
            foreach ($locations as $j => [$nameId, $nameEn, $type, $lat, $lng, $km, $min]) {
                Location::updateOrCreate(['name_id' => $nameId, 'zone_id' => $zone->id], [
                    'name_en' => $nameEn, 'type' => $type, 'lat' => $lat, 'lng' => $lng,
                    'distance_km_est' => $km, 'duration_min_est' => $min, 'is_active' => true, 'sort_order' => $j,
                ]);
            }
        }

        $port = Location::updateOrCreate(['name_id' => 'Pelabuhan Lembar', 'type' => 'port'], [
            'name_en' => 'Lembar Harbour (ferry port)', 'lat' => -8.7262, 'lng' => 116.0751, 'is_origin' => true, 'is_active' => true,
            'instructions_id' => 'Pelabuhan penyeberangan Lembar, Lombok Barat.', 'instructions_en' => 'Lembar ferry port, West Lombok.',
        ]);
        $meetingPoints = [
            ['Pintu keluar Terminal Penumpang (Gate A)', 'Passenger terminal exit (Gate A)', 'Keluar dari terminal penumpang, belok kanan; driver menunggu di sebelah loket informasi dengan papan nama.', 'Exit the passenger terminal and turn right; your driver waits next to the information desk holding a name board.'],
            ['Area parkir kendaraan pribadi', 'Private vehicle parking area', 'Untuk rombongan dengan bagasi banyak: driver menunggu di area parkir di depan terminal.', 'For groups with lots of luggage: the driver waits at the parking area in front of the terminal.'],
        ];
        foreach ($meetingPoints as $k => [$id, $en, $insId, $insEn]) {
            Location::updateOrCreate(['name_id' => $id, 'type' => 'meeting_point'], [
                'name_en' => $en, 'parent_id' => $port->id, 'lat' => -8.7262, 'lng' => 116.0751,
                'instructions_id' => $insId, 'instructions_en' => $insEn, 'is_active' => true, 'sort_order' => $k,
            ]);
        }

        FerryRoute::updateOrCreate(['name' => 'Padangbai → Lembar'], [
            'operator' => 'ASDP dan operator swasta', 'origin_port' => 'Padangbai (Bali)',
            'crossing_min_min' => 270, 'crossing_min_max' => 420, 'schedule_timezone' => 'WITA', 'is_active' => true,
        ]);
        FerryRoute::updateOrCreate(['name' => 'Surabaya (Tanjung Perak) → Lembar'], [
            'operator' => 'Dharma Lautan Utama / ASDP', 'origin_port' => 'Surabaya (Tanjung Perak)',
            'crossing_min_min' => 1200, 'crossing_min_max' => 1500, 'schedule_timezone' => 'WIB', 'is_active' => true,
        ]);
    }
}
