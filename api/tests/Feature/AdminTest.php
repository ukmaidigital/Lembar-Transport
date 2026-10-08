<?php

use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use App\Models\Zone;
use PragmaRX\Google2FA\Google2FA;

beforeEach(fn () => seedReference());

it('logs an admin in with email and password and exposes permissions', function () {
    $res = $this->postJson('/api/v1/auth/admin/login', ['email' => 'finance@lembartransport.test', 'password' => 'password'])->assertOk()->json('data');
    expect($res['token'])->toBeString()->and($res['user']['roles'])->toBe(['finance'])->and($res['user']['permissions'])->toContain('payments.confirm');
    $this->postJson('/api/v1/auth/admin/login', ['email' => 'finance@lembartransport.test', 'password' => 'salah'])->assertStatus(401);
});

it('enforces TOTP when enabled', function () {
    $admin = User::where('email', 'super@lembartransport.test')->first();
    $token = adminToken($admin);
    $secret = $this->withToken($token)->postJson('/api/v1/auth/totp/enable')->assertOk()->json('data.secret');
    $code = (new Google2FA)->getCurrentOtp($secret);
    $this->withToken($token)->postJson('/api/v1/auth/totp/confirm', ['code' => $code])->assertOk()->assertJsonPath('data.two_factor_enabled', true);
    $login = $this->postJson('/api/v1/auth/admin/login', ['email' => 'super@lembartransport.test', 'password' => 'password'])->assertOk()->json('data');
    expect($login['requires_totp'])->toBeTrue();
    $this->postJson('/api/v1/auth/admin/totp', ['challenge' => $login['challenge'], 'code' => '000000'])->assertStatus(401);
    $this->postJson('/api/v1/auth/admin/totp', ['challenge' => $login['challenge'], 'code' => (new Google2FA)->getCurrentOtp($secret)])->assertOk()->assertJsonStructure(['data' => ['token']]);
});

it('publishes future tariffs without changing existing orders or current quotes', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $super = adminToken(User::where('email', 'super@lembartransport.test')->first());
    $zone = Zone::where('code', 'Z3')->first();
    $this->withToken($super)->postJson('/api/v1/admin/tariffs', ['valid_from' => now()->addDays(10)->toIso8601String(), 'rules' => [['zone_id' => $zone->id, 'vehicle_class' => 'mpv_standard', 'base_price' => 320000]]])->assertCreated();
    [, $now] = makeQuote();
    [, $later] = makeQuote(['pickup_at' => now()->addDays(12)->setTime(1, 30)->toIso8601String()]);
    expect($now['total'])->toBe(300000)->and($later['total'])->toBe(320000)->and(Order::where('code', $code)->first()->total)->toBe(300000);
    $matrix = $this->withToken($super)->getJson('/api/v1/admin/tariffs')->assertOk()->json('data');
    expect($matrix['upcoming'])->toHaveCount(1);
});

it('creates a manual order with price override and shows it on the dashboard', function () {
    activeDriver();
    $ops = adminUser('ops');
    $res = $this->withToken(adminToken($ops))->postJson('/api/v1/admin/orders', [
        'destination_location_id' => destination()->id, 'pickup_at' => now()->addHours(5)->toIso8601String(), 'passengers' => 2, 'vehicle_class' => 'mpv_standard',
        'contact' => ['name' => 'Pak Hendra', 'phone' => '08123330001'], 'payment_method' => 'cash', 'price_override' => 280000, 'override_reason' => 'Pelanggan tetap',
    ])->assertCreated()->json('data');
    expect($res['channel'])->toBe('admin')->and($res['total'])->toBe(280000)->and($res['customer']['phone'])->toBe('+628123330001');
    $dash = $this->withToken(adminToken($ops))->getJson('/api/v1/admin/dashboard')->assertOk()->json('data');
    expect($dash['orders_today'])->toBeGreaterThanOrEqual(0)->and($dash['series_14d'])->toHaveCount(14);
});

it('updates settings and reports in csv', function () {
    $super = adminToken(User::where('email', 'super@lembartransport.test')->first());
    $this->withToken($super)->putJson('/api/v1/admin/settings', ['settings' => ['waiting.free_minutes' => 45, 'commission_rate' => 0.12]])->assertOk();
    expect(Setting::value('commission_rate'))->toBe(0.12)->and(Setting::value('waiting.free_minutes'))->toBe(45);
    $this->withToken($super)->get('/api/v1/admin/reports/revenue?format=csv')->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
    $this->withToken($super)->getJson('/api/v1/admin/reports/drivers')->assertOk();
    $this->withToken($super)->getJson('/api/v1/admin/reports/nope')->assertNotFound();
});
