<?php

use App\Models\DispatchOffer;
use App\Models\Order;
use App\Models\Setting;
use App\Services\DispatchEngine;
use App\Support\Wita;
use Spatie\Activitylog\Models\Activity;

beforeEach(fn () => seedReference());

it('lets only the first driver win and supersedes the others', function () {
    $d1 = activeDriver();
    $d2 = activeDriver();
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $order = Order::where('code', $code)->first();
    expect($order->offers()->count())->toBe(2);
    $o1 = $order->offers()->where('driver_id', $d1->id)->first();
    $o2 = $order->offers()->where('driver_id', $d2->id)->first();

    $this->withToken(driverToken($d1))->postJson("/api/v1/driver/offers/{$o1->id}/accept")->assertOk();
    $this->withToken(driverToken($d2))->postJson("/api/v1/driver/offers/{$o2->id}/accept")->assertStatus(409)->assertJsonPath('error.code', 'OFFER_TAKEN');
    expect($o2->fresh()->response->value)->toBe('superseded')->and($this->withToken(driverToken($d2))->getJson('/api/v1/driver/offers')->json('data'))->toHaveCount(0);
});

it('advances waves on timeout and flags needs_attention when exhausted', function () {
    $d1 = activeDriver();
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $order = Order::where('code', $code)->first();
    expect($order->dispatch_wave)->toBe(1);

    $this->travel(3)->minutes();
    app(DispatchEngine::class)->tick();
    $order->refresh();
    // wave 1 expired; waves 2 and 3 have nobody new → flagged
    expect(DispatchOffer::first()->response->value)->toBe('expired')->and($order->needs_attention)->toBeTrue()->and($order->status->value)->toBe('dispatching');

    $ops = adminUser('ops');
    $this->withToken(adminToken($ops))->getJson('/api/v1/admin/orders/needs-attention')->assertOk()->assertJsonCount(1, 'data');
    expect($d1->fresh()->acceptance_rate_30d)->toBeFloat();
});

it('starts dispatch only at T-48h for far bookings', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token, [], ['pickup_at' => now()->addDays(5)->toIso8601String()])['data']['code'];
    $order = Order::where('code', $code)->first();
    expect($order->status->value)->toBe('confirmed')->and($order->dispatch_next_at->toDateTimeString())->toBe($order->pickup_at->copy()->subHours(48)->toDateTimeString());
    $this->travelTo(now()->addDays(3)->addHour());
    app(DispatchEngine::class)->tick();
    expect($order->fresh()->status->value)->toBe('dispatching');
});

it('requires an override reason to assign an ineligible driver and lists eligibility reasons', function () {
    $mpv = activeDriver();
    $minibus = activeDriver('minibus_12');
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $ops = adminUser('ops');
    $candidates = $this->withToken(adminToken($ops))->getJson("/api/v1/admin/orders/{$code}/eligible-drivers")->assertOk()->json('data');
    $ineligible = collect($candidates)->firstWhere('driver.id', $minibus->id);
    expect($ineligible['eligible'])->toBeFalse()->and($ineligible['reasons'])->toContain('kelas kendaraan tidak sesuai');

    $this->withToken(adminToken($ops))->postJson("/api/v1/admin/orders/{$code}/assign", ['driver_id' => $minibus->id])->assertStatus(422)->assertJsonPath('error.code', 'DRIVER_INELIGIBLE');
    $this->withToken(adminToken($ops))->postJson("/api/v1/admin/orders/{$code}/assign", ['driver_id' => $minibus->id, 'override_reason' => 'Rombongan setuju minibus'])->assertOk()->assertJsonPath('data.driver.id', $minibus->id);
    expect(Activity::where('description', 'assign_manual')->count())->toBe(1);
});

it('returns the order to dispatching when the driver withdraws', function () {
    $d1 = activeDriver();
    $d2 = activeDriver();
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $order = Order::where('code', $code)->first();
    $o1 = $order->offers()->where('driver_id', $d1->id)->first();
    $this->withToken(driverToken($d1))->postJson("/api/v1/driver/offers/{$o1->id}/accept")->assertOk();
    $this->withToken(driverToken($d1))->postJson("/api/v1/driver/trips/{$code}/withdraw", ['reason' => 'Mobil mogok'])->assertOk();
    $order->refresh();
    expect($order->status->value)->toBe('dispatching')->and($order->driver_id)->toBeNull()
        ->and($order->offers()->where('response', 'pending')->where('driver_id', $d2->id)->exists())->toBeTrue();
});

it('skips drivers below the balance threshold and blocked dates', function () {
    $poor = activeDriver('mpv_standard', ['balance' => -200000]);
    $blocked = activeDriver();
    $pickup = now()->addDays(2)->setTime(1, 30);
    $blocked->availability()->create(['date' => Wita::of($pickup)->toDateString(), 'is_blocked' => true]);
    $token = customerToken();
    $code = createCashOrder($token, [], ['pickup_at' => $pickup->toIso8601String()])['data']['code'];
    $order = Order::where('code', $code)->first();
    expect($order->offers()->count())->toBe(0)->and($order->needs_attention)->toBeTrue();
    Setting::put('ledger.balance_threshold', -300000);
    $this->travel(31)->minutes();
    app(DispatchEngine::class)->tick();
    expect($order->fresh()->offers()->where('driver_id', $poor->id)->exists())->toBeTrue();
});
