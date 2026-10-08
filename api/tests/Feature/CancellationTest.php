<?php

use App\Models\Order;

beforeEach(fn () => seedReference());

it('applies cancellation tiers by hours before pickup', function () {
    activeDriver();
    $token = customerToken();
    $pickup = now()->addHours(30);
    $code = createCashOrder($token, [], ['pickup_at' => $pickup->toIso8601String()])['data']['code'];
    $total = Order::where('code', $code)->first()->total;
    $preview = $this->getJson("/api/v1/orders/{$code}/cancellation-preview?phone_last4=6789")->assertOk()->json('data');
    expect($preview['fee_percent'])->toBe(0)->and($preview['fee'])->toBe(0);

    $this->travelTo($pickup->copy()->subHours(10)); // 10h before → 50 %
    $preview = $this->getJson("/api/v1/orders/{$code}/cancellation-preview?phone_last4=6789")->json('data');
    expect($preview['fee_percent'])->toBe(50)->and($preview['fee'])->toBe((int) round($total / 2));

    $this->travelTo($pickup->copy()->subHours(4)); // 4h before → 100 %
    $preview = $this->getJson("/api/v1/orders/{$code}/cancellation-preview?phone_last4=6789")->json('data');
    expect($preview['fee_percent'])->toBe(100);

    $res = $this->postJson("/api/v1/orders/{$code}/cancel?phone_last4=6789", ['reason' => 'Berubah rencana'])->assertOk()->json('data');
    expect($res['status'])->toBe('cancelled')->and($res['cancellation_fee'])->toBe($total)->and($res['cancelled_by'])->toBe('customer');
    $this->postJson("/api/v1/orders/{$code}/cancel?phone_last4=6789", ['reason' => 'lagi'])->assertStatus(409);
});

it('creates a refund and driver compensation when a paid order is cancelled late', function () {
    $driver = activeDriver();
    $token = customerToken();
    $code = createCashOrder($token, [], ['pickup_at' => now()->addHours(10)->toIso8601String()])['data']['code'];
    $order = Order::where('code', $code)->first();
    $order->update(['payment_status' => 'paid', 'payment_method' => 'bank_transfer']);
    $offer = $order->offers()->first();
    $this->withToken(driverToken($driver))->postJson("/api/v1/driver/offers/{$offer->id}/accept")->assertOk();

    $admin = adminUser('ops');
    $this->withToken(adminToken($admin))->postJson("/api/v1/admin/orders/{$code}/cancel", ['reason' => 'Customer minta batal via WA'])->assertOk()->assertJsonPath('data.status', 'cancelled');
    $order->refresh();
    $half = (int) round($order->total / 2);
    expect($order->cancellation_fee)->toBe($half)->and((int) $order->refunds()->sum('amount'))->toBe($order->total - $half)->and($order->payment_status->value)->toBe('refunded')
        ->and($driver->fresh()->balance)->toBe((int) round($order->driver_payout_amount * 0.5));
});

it('lets admin waive the fee for force majeure', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token, [], ['pickup_at' => now()->addHours(3)->toIso8601String()])['data']['code'];
    $admin = adminUser('ops');
    $res = $this->withToken(adminToken($admin))->postJson("/api/v1/admin/orders/{$code}/cancel", ['reason' => 'Pelayaran dibatalkan', 'waive_fee' => true])->assertOk()->json('data');
    expect($res['cancellation_fee'])->toBe(0);
});
