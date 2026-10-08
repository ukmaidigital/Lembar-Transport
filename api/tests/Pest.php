<?php

use App\Enums\DocumentType;
use App\Models\Driver;
use App\Models\DriverBankAccount;
use App\Models\DriverDocument;
use App\Models\Location;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleClass;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature', 'Unit');

/** Seed reference data (roles, classes, geography, tariffs, settings, admins). */
function seedReference(): void
{
    test()->seed();
}

function adminUser(string $role = 'super_admin'): User
{
    $user = User::factory()->admin()->create();
    $user->syncRoles([$role]);

    return $user;
}

function activeDriver(string $classCode = 'mpv_standard', array $attrs = []): Driver
{
    $driver = Driver::factory()->create($attrs);
    $class = VehicleClass::where('code', $classCode)->firstOrFail();
    Vehicle::factory()->create(['driver_id' => $driver->id, 'vehicle_class_id' => $class->id, 'seats' => $class->max_passengers, 'luggage_capacity' => $class->max_luggage, 'has_roof_rack' => true]);
    foreach (DocumentType::required() as $type) {
        DriverDocument::create(['driver_id' => $driver->id, 'type' => $type->value, 'file_path' => 'test/'.$type->value.'.jpg', 'status' => 'approved', 'expires_at' => $type->hasExpiry() ? now()->addYear() : null]);
    }
    DriverBankAccount::create(['driver_id' => $driver->id, 'bank_code' => 'BCA', 'account_number' => '1234567890', 'account_name' => $driver->user->name, 'verified_at' => now()]);

    return $driver->fresh(['user', 'primaryVehicle']);
}

function destination(string $name = 'Senggigi'): Location
{
    return Location::where('name_id', $name)->firstOrFail();
}

/** Create a quote and return [token, option] for a class. */
function makeQuote(array $overrides = [], string $class = 'mpv_standard'): array
{
    $payload = array_merge(['destination_location_id' => destination()->id, 'pickup_at' => now()->addDays(2)->setTime(1, 30)->toIso8601String(), 'passengers' => 3, 'luggage_units' => 2], $overrides);
    $res = test()->postJson('/api/v1/public/quotes', $payload)->assertOk()->json('data');
    $option = collect($res['options'])->firstWhere('vehicle_class', $class);

    return [$res['quote_token'], $option, $res];
}

function customerToken(string $phone = '+628123456789', string $name = 'Rina'): string
{
    $req = test()->postJson('/api/v1/auth/otp/request', ['phone' => $phone])->assertOk()->json('data');
    $res = test()->postJson('/api/v1/auth/otp/verify', ['phone' => $phone, 'code' => $req['debug_code'], 'name' => $name])->assertOk()->json('data');

    return $res['token'];
}

function driverToken(Driver $driver): string
{
    return $driver->user->createToken('test', ['driver'])->plainTextToken;
}

function adminToken(User $admin): string
{
    return $admin->createToken('test', ['admin'])->plainTextToken;
}

function createCashOrder(string $token, array $overrides = [], array $quoteOverrides = []): array
{
    [$quoteToken] = makeQuote($quoteOverrides);
    $payload = array_merge([
        'quote_token' => $quoteToken, 'vehicle_class' => 'mpv_standard',
        'contact' => ['name' => 'Rina Puspita', 'phone' => '+628123456789', 'email' => 'rina@example.com'],
        'payment_method' => 'cash', 'notes' => 'Dua koper besar',
    ], $overrides);

    return test()->withToken($token)->postJson('/api/v1/orders', $payload)->assertCreated()->json();
}
