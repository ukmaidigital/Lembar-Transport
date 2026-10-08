<?php

namespace App\Http\Controllers\Driver;

use App\Enums\OfferResponse;
use App\Http\Controllers\Controller;
use App\Http\Resources\OfferResource;
use App\Http\Resources\OrderResource;
use App\Models\DispatchOffer;
use App\Services\DispatchEngine;
use Illuminate\Http\Request;

class OfferController extends Controller
{
    public function __construct(private DispatchEngine $dispatch) {}

    public function index(Request $request)
    {
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        $driver->update(['last_seen_at' => now()]);
        $offers = DispatchOffer::query()->where('driver_id', $driver->id)->where('response', OfferResponse::Pending->value)->where('expires_at', '>', now())
            ->with(['order.destination', 'order.zone', 'order.vehicleClass', 'order.ferryRoute'])->orderBy('expires_at')->get();

        return OfferResource::collection($offers);
    }

    public function accept(Request $request, DispatchOffer $offer)
    {
        $order = $this->dispatch->accept($offer, $request->user()->driver);

        return new OrderResource($order->load(['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle']));
    }

    public function decline(Request $request, DispatchOffer $offer)
    {
        $this->dispatch->decline($offer, $request->user()->driver);

        return response()->json(['data' => ['ok' => true]]);
    }
}
