<?php

use App\Enums\LedgerType;
use App\Models\DispatchOffer;
use App\Models\FerryRoute;
use App\Models\Order;

beforeEach(fn () => seedReference());

it('runs a cash order from booking to completion with ledger settlement', function () {
    $driver = activeDriver();
    $token = customerToken();

    $res = createCashOrder($token);
    $code = $res['data']['code'];
    $order = Order::where('code', $code)->firstOrFail();

    // cash → confirmed immediately; pickup within 48h → dispatching with an offer for the eligible driver
    expect($order->status->value)->toBe('dispatching')
        ->and($order->total)->toBe(300000)
        ->and($order->offers()->count())->toBe(1)
        ->and($order->histories()->pluck('to_status')->all())->toBe(['confirmed', 'dispatching']);

    $offer = DispatchOffer::first();
    $dt = driverToken($driver);
    $offers = $this->withToken($dt)->getJson('/api/v1/driver/offers')->assertOk()->json('data');
    expect($offers)->toHaveCount(1)->and($offers[0]['order']['driver_net'])->toBe(255000);

    $this->withToken($dt)->postJson("/api/v1/driver/offers/{$offer->id}/accept")->assertOk()->assertJsonPath('data.status', 'assigned');

    // customer sees driver card with phone (contact window open)
    $ticket = $this->getJson("/api/v1/orders/{$code}?phone_last4=6789")->assertOk()->json();
    expect($ticket['data']['driver']['name'])->toBe($driver->user->name)->and($ticket['data']['driver']['phone'])->toBe($driver->user->phone);

    $this->travelTo($order->fresh()->ferry_eta_min_at->copy()->subHour()); // day of travel, within the docking window
    $this->withToken($dt)->postJson("/api/v1/driver/trips/{$code}/status", ['status' => 'en_route'])->assertOk()->assertJsonPath('data.status', 'en_route');
    $this->postJson("/api/v1/orders/{$code}/docked?phone_last4=6789")->assertOk()->assertJsonPath('data.ferry.docked_source', 'customer');
    $this->withToken($dt)->postJson("/api/v1/driver/trips/{$code}/status", ['status' => 'arrived'])->assertOk();
    $this->withToken($dt)->postJson("/api/v1/driver/trips/{$code}/status", ['status' => 'on_trip'])->assertOk();

    // completion requires the cash amount
    $this->withToken($dt)->postJson("/api/v1/driver/trips/{$code}/status", ['status' => 'completed'])->assertStatus(422)->assertJsonPath('error.code', 'CASH_AMOUNT_REQUIRED');
    $this->withToken($dt)->postJson("/api/v1/driver/trips/{$code}/status", ['status' => 'completed', 'cash_collected' => 300000])->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.payment_status', 'paid');

    $driver->refresh();
    expect($driver->balance)->toBe(-45000)->and($driver->trips_completed)->toBe($driver->trips_completed)
        ->and($driver->ledgerEntries()->where('type', LedgerType::Commission->value)->count())->toBe(1);

    // rating within 7 days
    $this->postJson("/api/v1/orders/{$code}/rating?phone_last4=6789", ['score' => 5, 'comment' => 'Mantap'])->assertCreated();
    $this->postJson("/api/v1/orders/{$code}/rating?phone_last4=6789", ['score' => 4])->assertStatus(409);
    expect($driver->fresh()->rating_avg)->toBe(5.0);
});

it('is idempotent on order creation', function () {
    activeDriver();
    $token = customerToken();
    [$quoteToken] = makeQuote();
    $payload = ['quote_token' => $quoteToken, 'vehicle_class' => 'mpv_standard', 'contact' => ['name' => 'Rina', 'phone' => '+628123456789'], 'payment_method' => 'cash'];
    $a = $this->withToken($token)->withHeader('Idempotency-Key', 'abc-1')->postJson('/api/v1/orders', $payload)->assertCreated()->json('data.code');
    $b = $this->withToken($token)->withHeader('Idempotency-Key', 'abc-1')->postJson('/api/v1/orders', $payload)->assertCreated()->json('data.code');
    expect($a)->toBe($b)->and(Order::count())->toBe(1);
});

it('rejects over-capacity bookings and expired quotes', function () {
    $token = customerToken();
    [$quoteToken] = makeQuote(['passengers' => 7]);
    $this->withToken($token)->postJson('/api/v1/orders', ['quote_token' => $quoteToken, 'vehicle_class' => 'mpv_standard', 'contact' => ['name' => 'A', 'phone' => '+628123456789'], 'payment_method' => 'cash'])
        ->assertStatus(422)->assertJsonPath('error.code', 'CAPACITY_EXCEEDED');
    $this->withToken($token)->postJson('/api/v1/orders', ['quote_token' => 'qt_nope', 'vehicle_class' => 'mpv_standard', 'contact' => ['name' => 'A', 'phone' => '+628123456789'], 'payment_method' => 'cash'])
        ->assertStatus(409)->assertJsonPath('error.code', 'QUOTE_EXPIRED');
});

it('couples the pickup time to the ferry departure and crossing time', function () {
    activeDriver();
    $token = customerToken();
    $route = FerryRoute::where('name', 'like', 'Padangbai%')->first();
    $departure = now()->addDay()->setTime(15, 0); // 23.00 WITA
    $res = createCashOrder($token, ['ferry' => ['route_id' => $route->id, 'departure_at' => $departure->toIso8601String()]]);
    expect($res['data']['ferry']['eta_min_at'])->toBe($departure->copy()->addMinutes(270)->toIso8601String())
        ->and($res['data']['pickup_at'])->toBe($departure->copy()->addMinutes(270)->toIso8601String())
        ->and($res['data']['ferry']['eta_max_at'])->toBe($departure->copy()->addMinutes(420)->toIso8601String());
});

it('protects the ticket page behind the phone suffix or ownership', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token)['data']['code'];
    $this->flushHeaders();
    $this->getJson("/api/v1/orders/{$code}")->assertStatus(403);
    $this->getJson("/api/v1/orders/{$code}?phone_last4=0000")->assertStatus(403);
    $this->withToken($token)->getJson("/api/v1/orders/{$code}")->assertOk();
    $this->withToken($token)->getJson('/api/v1/orders')->assertOk()->assertJsonCount(1, 'data');
});
