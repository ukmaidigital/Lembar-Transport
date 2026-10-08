<?php

use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    seedReference();
    Storage::fake('local');
});

it('handles a bank transfer: proof upload, finance confirmation, dispatch', function () {
    activeDriver();
    $token = customerToken();
    $res = createCashOrder($token, ['payment_method' => 'bank_transfer']);
    $code = $res['data']['code'];
    expect($res['data']['status'])->toBe('pending_payment')->and($res['meta']['payment']['transfer_note'])->toBe($code)->and($res['data']['payment_expires_at'])->not->toBeNull();

    $this->postJson("/api/v1/orders/{$code}/payment-proof?phone_last4=6789", ['file' => UploadedFile::fake()->image('bukti.jpg')])->assertCreated();
    expect(Order::where('code', $code)->first()->payment_status->value)->toBe('pending_review');

    $finance = adminUser('finance');
    $list = $this->withToken(adminToken($finance))->getJson('/api/v1/admin/payments')->assertOk()->json('data');
    expect($list)->toHaveCount(1)->and($list[0]['order_code'])->toBe($code);

    $this->withToken(adminToken($finance))->postJson("/api/v1/admin/payments/{$list[0]['id']}/confirm", ['reference' => 'TRX-1'])->assertOk()
        ->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.status', 'dispatching');
});

it('rejects a proof and lets the customer upload again', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token, ['payment_method' => 'bank_transfer'])['data']['code'];
    $this->postJson("/api/v1/orders/{$code}/payment-proof?phone_last4=6789", ['file' => UploadedFile::fake()->image('bukti.jpg')])->assertCreated();
    $payment = Payment::where('status', 'pending_review')->first();
    $finance = adminUser('finance');
    $this->withToken(adminToken($finance))->postJson("/api/v1/admin/payments/{$payment->id}/reject", ['reason' => 'Jumlah tidak sesuai'])->assertOk();
    expect(Order::where('code', $code)->first()->payment_status->value)->toBe('unpaid');
    $this->postJson("/api/v1/orders/{$code}/payment-proof?phone_last4=6789", ['file' => UploadedFile::fake()->image('bukti2.jpg')])->assertCreated();
});

it('expires unpaid orders after the deadline and blocks manual transfer when pickup is too close', function () {
    activeDriver();
    $token = customerToken();
    $code = createCashOrder($token, ['payment_method' => 'bank_transfer'])['data']['code'];
    $this->travel(3)->hours();
    app(PaymentService::class)->expireOverdue();
    expect(Order::where('code', $code)->first()->status->value)->toBe('expired');

    [$quoteToken] = makeQuote(['pickup_at' => now()->addHours(5)->toIso8601String()]);
    $this->withToken($token)->postJson('/api/v1/orders', ['quote_token' => $quoteToken, 'vehicle_class' => 'mpv_standard', 'contact' => ['name' => 'A', 'phone' => '+628123456789'], 'payment_method' => 'bank_transfer'])
        ->assertStatus(422)->assertJsonPath('error.code', 'PAYMENT_METHOD_NOT_ALLOWED');
});

it('does not let finance verify drivers (RBAC)', function () {
    $finance = adminUser('finance');
    $this->withToken(adminToken($finance))->getJson('/api/v1/admin/driver-applications')->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
    $this->withToken(customerToken())->getJson('/api/v1/admin/dashboard')->assertStatus(403);
});
