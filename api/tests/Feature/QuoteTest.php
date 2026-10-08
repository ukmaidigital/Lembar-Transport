<?php

use App\Models\Setting;

beforeEach(fn () => seedReference());

it('returns a locked quote per vehicle class with night surcharge', function () {
    // 01:30 UTC = 09:30 WITA → no night surcharge; 20:30 UTC = 04:30 WITA → night surcharge.
    [, $day] = makeQuote(['pickup_at' => now()->addDays(2)->setTime(1, 30)->toIso8601String()]);
    [, $night, $res] = makeQuote(['pickup_at' => now()->addDays(2)->setTime(20, 30)->toIso8601String()]);

    expect($day['total'])->toBe(300000)
        ->and($night['total'])->toBe(350000)
        ->and(collect($night['price_breakdown']['surcharges'])->pluck('code'))->toContain('night')
        ->and($res['quote_token'])->toStartWith('qt_')
        ->and($night['driver_net'])->toBe(350000 - 52500);
});

it('flags classes that do not fit and suggests two vehicles', function () {
    [, $mpv, $res] = makeQuote(['passengers' => 7]);
    $minibus = collect($res['options'])->firstWhere('vehicle_class', 'minibus_12');

    expect($mpv['fits'])->toBeFalse()->and($mpv['suggest_two_vehicles'])->toBeTrue()->and($minibus['fits'])->toBeTrue();
});

it('adds child seat and roof rack surcharges and rounds up to Rp 1.000', function () {
    [, $o] = makeQuote(['child_seats' => 1, 'needs_roof_rack' => true]);
    expect($o['total'])->toBe(400000)->and(collect($o['price_breakdown']['surcharges'])->pluck('code')->all())->toBe(['child_seat', 'roof_rack']);
});

it('uses the commission rate from settings', function () {
    Setting::put('commission_rate', 0.2);
    [, $o] = makeQuote();
    expect($o['commission_amount'])->toBe(60000);
});

it('rejects pickups in the past and unknown destinations', function () {
    $this->postJson('/api/v1/public/quotes', ['destination_location_id' => destination()->id, 'pickup_at' => now()->subDay()->toIso8601String(), 'passengers' => 2])->assertStatus(422)->assertJsonPath('error.code', 'PICKUP_IN_PAST');
    $this->postJson('/api/v1/public/quotes', ['destination_location_id' => 99999, 'pickup_at' => now()->addDay()->toIso8601String(), 'passengers' => 2])->assertStatus(422)->assertJsonPath('error.code', 'DESTINATION_NOT_FOUND');
});

it('publishes the public price list', function () {
    $res = $this->getJson('/api/v1/public/tariffs')->assertOk()->json('data');
    expect($res['rows'])->toHaveCount(8)->and($res['rows'][2]['prices']['mpv_standard'])->toBe(300000);
});
