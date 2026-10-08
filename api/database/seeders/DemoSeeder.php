<?php

namespace Database\Seeders;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\DriverStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\UserRole;
use App\Models\Driver;
use App\Models\DriverBankAccount;
use App\Models\DriverDocument;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleClass;
use Illuminate\Database\Seeder;

/** Demo data for local development and e2e tests (not for production). */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $classes = VehicleClass::query()->pluck('id', 'code');
        $drivers = [
            ['Lalu Hadi Saputra', '+628120000001', 'mpv_standard', 'Toyota', 'Avanza', 'DR 1234 AB', 'Putih', 4.9],
            ['Wayan Sudira', '+628120000002', 'mpv_standard', 'Daihatsu', 'Xenia', 'DR 2345 CD', 'Silver', 4.7],
            ['Rizal Ahmad', '+628120000003', 'mpv_premium', 'Toyota', 'Innova Reborn', 'DR 3456 EF', 'Hitam', 4.8],
            ['Sahrul Munir', '+628120000004', 'minibus_12', 'Toyota', 'Hiace Commuter', 'DR 4567 GH', 'Putih', 4.8],
            ['Komang Arta', '+628120000005', 'minibus_12', 'Isuzu', 'Elf', 'DR 5678 IJ', 'Putih', 4.6],
            ['Made Wirawan', '+628120000006', 'minibus_16', 'Toyota', 'Hiace Premio', 'DR 6789 KL', 'Silver', 4.6],
        ];
        foreach ($drivers as [$name, $phone, $classCode, $brand, $model, $plate, $color, $rating]) {
            $user = User::updateOrCreate(['phone' => $phone], ['name' => $name, 'role' => UserRole::Driver, 'phone_verified_at' => now(), 'locale' => 'id']);
            $driver = Driver::updateOrCreate(['user_id' => $user->id], [
                'status' => DriverStatus::Active, 'nik' => '5201'.str_pad((string) random_int(0, 999999999999), 12, '0', STR_PAD_LEFT),
                'birth_date' => '1985-03-12', 'address' => 'Lembar, Lombok Barat', 'emergency_contact_name' => 'Keluarga', 'emergency_contact_phone' => '+628130000000',
                'is_online' => true, 'last_seen_at' => now(), 'last_lat' => -8.7262, 'last_lng' => 116.0751,
                'rating_avg' => $rating, 'rating_count' => 120, 'trips_completed' => 150, 'acceptance_rate_30d' => 85, 'on_time_rate_90d' => 95,
                'balance' => 120000, 'submitted_at' => now()->subMonths(2), 'verified_at' => now()->subMonths(2),
            ]);
            $class = VehicleClass::find($classes[$classCode]);
            $vehicle = Vehicle::updateOrCreate(['plate_number' => $plate], [
                'driver_id' => $driver->id, 'vehicle_class_id' => $class->id, 'brand' => $brand, 'model' => $model, 'year' => 2020,
                'color' => $color, 'seats' => $class->max_passengers, 'luggage_capacity' => $class->max_luggage,
                'has_roof_rack' => str_starts_with($classCode, 'minibus') || $classCode === 'mpv_premium', 'stnk_expires_at' => now()->addMonths(8), 'status' => 'active', 'is_primary' => true,
            ]);
            foreach (DocumentType::required() as $type) {
                DriverDocument::firstOrCreate(['driver_id' => $driver->id, 'type' => $type->value, 'version' => 1], [
                    'vehicle_id' => in_array($type, [DocumentType::Stnk, DocumentType::VehiclePhoto], true) ? $vehicle->id : null,
                    'file_path' => 'demo/'.$type->value.'.jpg', 'status' => DocumentStatus::Approved, 'reviewed_at' => now()->subMonths(2),
                    'expires_at' => $type->hasExpiry() ? now()->addMonths($type === DocumentType::Sim ? 13 : 8) : null,
                ]);
            }
            DriverBankAccount::firstOrCreate(['driver_id' => $driver->id], ['bank_code' => 'BCA', 'account_number' => '12345'.random_int(10000, 99999), 'account_name' => $name, 'verified_at' => now()]);
        }

        // One applicant awaiting verification
        $applicant = User::updateOrCreate(['phone' => '+628120000010'], ['name' => 'Agus Pratama', 'role' => UserRole::Driver, 'phone_verified_at' => now()]);
        $pending = Driver::updateOrCreate(['user_id' => $applicant->id], [
            'status' => DriverStatus::Submitted, 'nik' => '5201000000000010', 'birth_date' => '1990-07-01', 'address' => 'Gerung, Lombok Barat',
            'emergency_contact_name' => 'Istri', 'emergency_contact_phone' => '+628130000010', 'submitted_at' => now()->subHours(6),
        ]);
        $pv = Vehicle::updateOrCreate(['plate_number' => 'DR 7890 MN'], [
            'driver_id' => $pending->id, 'vehicle_class_id' => $classes['mpv_standard'], 'brand' => 'Suzuki', 'model' => 'Ertiga', 'year' => 2021,
            'color' => 'Abu-abu', 'seats' => 4, 'luggage_capacity' => 3, 'stnk_expires_at' => now()->addMonths(5), 'status' => 'pending',
        ]);
        foreach (DocumentType::required() as $type) {
            DriverDocument::firstOrCreate(['driver_id' => $pending->id, 'type' => $type->value, 'version' => 1], [
                'vehicle_id' => in_array($type, [DocumentType::Stnk, DocumentType::VehiclePhoto], true) ? $pv->id : null,
                'file_path' => 'demo/'.$type->value.'.jpg', 'status' => DocumentStatus::Pending,
                'expires_at' => $type->hasExpiry() ? now()->addMonths(10) : null,
            ]);
        }

        // Customers and orders in a few states
        $rina = User::updateOrCreate(['phone' => '+628123456789'], ['name' => 'Rina Puspita', 'email' => 'rina@example.com', 'role' => UserRole::Customer, 'phone_verified_at' => now()]);
        $origin = Location::where('is_origin', true)->first();
        $gate = Location::where('type', 'meeting_point')->first();
        $senggigi = Location::where('name_id', 'Senggigi')->first();
        $bandara = Location::where('type', 'airport')->first();
        $bangsal = Location::where('name_id', 'Pelabuhan Bangsal')->first();
        $hadi = Driver::whereHas('user', fn ($q) => $q->where('phone', '+628120000001'))->first();

        $mk = function (array $attrs) use ($origin, $gate, $rina) {
            $total = $attrs['total'];
            $rate = 0.15;
            $defaults = [
                'code' => Order::generateCode(), 'customer_id' => $rina->id, 'guest_name' => $rina->name, 'guest_phone' => $rina->phone, 'guest_email' => $rina->email,
                'locale' => 'id', 'channel' => 'web', 'service_type' => 'transfer_oneway', 'origin_location_id' => $origin->id, 'meeting_point_id' => $gate->id,
                'passengers' => 4, 'luggage_units' => 3, 'price_breakdown' => ['base' => $attrs['base'], 'surcharges' => $attrs['surcharges'] ?? [], 'total' => $total, 'currency' => 'IDR'],
                'subtotal' => $attrs['base'], 'surcharge_total' => $total - $attrs['base'], 'total' => $total,
                'commission_rate' => $rate, 'commission_amount' => (int) round($total * $rate), 'driver_payout_amount' => $total - (int) round($total * $rate),
            ];
            unset($attrs['base'], $attrs['surcharges']);
            $order = Order::firstOrCreate(['idempotency_key' => $attrs['idempotency_key']], array_merge($defaults, $attrs));
            if ($order->wasRecentlyCreated) {
                OrderStatusHistory::create(['order_id' => $order->id, 'from_status' => null, 'to_status' => $order->status->value, 'actor_type' => 'system', 'reason' => 'seed']);
            }

            return $order;
        };

        $tomorrow = now()->addDay()->setTime(5, 30);
        $mk([
            'idempotency_key' => 'demo-assigned', 'status' => OrderStatus::Assigned, 'payment_status' => PaymentStatus::Unpaid, 'payment_method' => PaymentMethod::Cash,
            'destination_location_id' => $senggigi->id, 'zone_id' => $senggigi->zone_id, 'vehicle_class_id' => $classes['mpv_standard'],
            'pickup_at' => $tomorrow, 'ferry_departure_at' => $tomorrow->copy()->subHours(6)->subMinutes(30), 'ferry_eta_min_at' => $tomorrow->copy()->subHour(), 'ferry_eta_max_at' => $tomorrow->copy()->addMinutes(30),
            'base' => 300000, 'surcharges' => [['code' => 'night', 'amount' => 50000]], 'total' => 350000, 'driver_id' => $hadi->id, 'vehicle_id' => $hadi->primaryVehicle->id, 'assigned_at' => now(),
            'notes' => 'Dua koper besar dan satu stroller',
        ]);
        $pendingOrder = $mk([
            'idempotency_key' => 'demo-pending-payment', 'status' => OrderStatus::PendingPayment, 'payment_status' => PaymentStatus::PendingReview, 'payment_method' => PaymentMethod::BankTransfer,
            'destination_location_id' => $bandara->id, 'zone_id' => $bandara->zone_id, 'vehicle_class_id' => $classes['mpv_premium'],
            'pickup_at' => now()->addDays(3)->setTime(14, 0), 'ferry_eta_min_at' => now()->addDays(3)->setTime(13, 30), 'ferry_eta_max_at' => now()->addDays(3)->setTime(15, 0),
            'payment_expires_at' => now()->addHours(2), 'base' => 375000, 'total' => 375000, 'passengers' => 2, 'luggage_units' => 2,
        ]);
        Payment::firstOrCreate(['order_id' => $pendingOrder->id], ['method' => 'bank_transfer', 'provider' => 'manual', 'amount' => 375000, 'status' => 'pending_review', 'proof_path' => 'demo/bukti-transfer.jpg']);
        $mk([
            'idempotency_key' => 'demo-dispatching', 'status' => OrderStatus::Dispatching, 'payment_status' => PaymentStatus::Paid, 'payment_method' => PaymentMethod::BankTransfer, 'needs_attention' => true,
            'destination_location_id' => $bangsal->id, 'zone_id' => $bangsal->zone_id, 'vehicle_class_id' => $classes['minibus_12'],
            'pickup_at' => now()->addDay()->setTime(5, 30), 'ferry_eta_min_at' => now()->addDay()->setTime(4, 30), 'ferry_eta_max_at' => now()->addDay()->setTime(6, 0),
            'passengers' => 11, 'luggage_units' => 11, 'base' => 700000, 'total' => 700000, 'dispatch_wave' => 3, 'dispatch_started_at' => now()->subMinutes(20), 'guest_name' => 'Ibu Sari (rombongan)',
        ]);
        $mk([
            'idempotency_key' => 'demo-completed', 'status' => OrderStatus::Completed, 'payment_status' => PaymentStatus::Paid, 'payment_method' => PaymentMethod::Cash,
            'destination_location_id' => $senggigi->id, 'zone_id' => $senggigi->zone_id, 'vehicle_class_id' => $classes['mpv_standard'],
            'pickup_at' => now()->subDays(2)->setTime(6, 0), 'ferry_docked_at' => now()->subDays(2)->setTime(6, 5), 'docked_source' => 'customer',
            'base' => 300000, 'total' => 300000, 'driver_id' => $hadi->id, 'vehicle_id' => $hadi->primaryVehicle->id, 'assigned_at' => now()->subDays(3),
            'en_route_at' => now()->subDays(2)->setTime(5, 0), 'arrived_at' => now()->subDays(2)->setTime(5, 40), 'on_trip_at' => now()->subDays(2)->setTime(6, 20), 'completed_at' => now()->subDays(2)->setTime(7, 30), 'cash_collected' => 300000,
        ]);
    }
}
