<?php

namespace App\Http\Controllers\Driver;

use App\Enums\ActorType;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\DispatchEngine;
use App\Services\TripService;
use App\Support\Wita;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TripController extends Controller
{
    private const WITH = ['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle', 'histories', 'issues'];

    public function __construct(private TripService $trips, private DispatchEngine $dispatch) {}

    public function index(Request $request)
    {
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        $scope = $request->query('scope', 'upcoming');
        $q = Order::query()->where('driver_id', $driver->id)->with(['destination', 'zone', 'vehicleClass', 'ferryRoute', 'meetingPoint', 'origin', 'driver.user', 'vehicle']);
        if ($request->query('date')) {
            $start = Wita::of($request->query('date'))->startOfDay()->utc();
            $q->whereBetween('pickup_at', [$start, $start->copy()->addDay()]);
        } elseif ($scope === 'today') {
            $start = Wita::of(now())->startOfDay()->utc();
            $q->whereBetween('pickup_at', [$start, $start->copy()->addDay()])->whereNotIn('status', ['cancelled', 'expired']);
        } elseif ($scope === 'history') {
            $q->whereIn('status', ['completed', 'no_show', 'cancelled'])->latest('pickup_at');
        } else {
            $q->whereIn('status', ['assigned', 'en_route', 'arrived', 'on_trip'])->orderBy('pickup_at');
        }
        $items = $q->paginate(30);

        return OrderResource::collection($items);
    }

    public function show(Request $request, string $code)
    {
        $order = Order::query()->where('code', $code)->with(self::WITH)->firstOrFail();
        abort_unless($order->driver_id === $request->user()->driver?->id, 403);

        return (new OrderResource($order))->additional(['meta' => ['waiting' => $this->trips->waitingInfo($order)]]);
    }

    public function status(Request $request, string $code)
    {
        $data = $request->validate([
            'status' => ['required', 'in:en_route,arrived,on_trip,completed'],
            'client_timestamp' => ['nullable', 'date'],
            'cash_collected' => ['nullable', 'integer', 'min:0'],
            'cash_note' => ['nullable', 'string', 'max:200'],
        ]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $this->trips->setStatus($order, $request->user()->driver, OrderStatus::from($data['status']),
            isset($data['client_timestamp']) ? Carbon::parse($data['client_timestamp']) : null, $data['cash_collected'] ?? null, $data['cash_note'] ?? null);

        return (new OrderResource($order->load(self::WITH)))->additional(['meta' => ['waiting' => $this->trips->waitingInfo($order)]]);
    }

    public function noShow(Request $request, string $code)
    {
        $data = $request->validate(['contact_attempts' => ['required', 'integer', 'min:0', 'max:20'], 'note' => ['nullable', 'string', 'max:300']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $issue = $this->trips->requestNoShow($order, $request->user()->driver, $data['contact_attempts'], $data['note'] ?? null);

        return response()->json(['data' => $issue], 201);
    }

    public function withdraw(Request $request, string $code)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        abort_unless($order->driver_id === $request->user()->driver?->id, 403);
        $this->dispatch->unassign($order, ActorType::Driver, $request->user()->id, $data['reason']);

        return response()->json(['data' => ['ok' => true]]);
    }

    public function issue(Request $request, string $code)
    {
        $data = $request->validate(['type' => ['required', 'in:sos,breakdown,customer_unreachable,other'], 'message' => ['nullable', 'string', 'max:500']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $issue = $this->trips->reportIssue($order, $request->user()->driver, $data['type'], $data['message'] ?? null);

        return response()->json(['data' => $issue], 201);
    }
}
