<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ActorType;
use App\Enums\DriverStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\DriverResource;
use App\Http\Resources\OrderResource;
use App\Models\Driver;
use App\Models\FerryRoute;
use App\Models\Order;
use App\Models\TripIssue;
use App\Services\CancellationPolicy;
use App\Services\DispatchEngine;
use App\Services\OrderService;
use App\Services\QuoteService;
use App\Services\TripService;
use App\Support\Wita;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class OrderAdminController extends Controller
{
    private const WITH = ['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle', 'rating', 'histories', 'offers.driver.user', 'payments', 'issues'];

    public function __construct(private OrderService $orders, private DispatchEngine $dispatch, private CancellationPolicy $cancellation, private TripService $trips) {}

    public function index(Request $request)
    {
        $q = Order::query()->with(['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle']);
        if ($request->query('date')) {
            $start = Wita::of($request->query('date'))->startOfDay()->utc();
            $q->whereBetween('pickup_at', [$start, $start->copy()->addDay()]);
        }
        if ($request->query('from')) {
            $q->where('pickup_at', '>=', Wita::of($request->query('from'))->startOfDay()->utc());
        }
        if ($request->query('to')) {
            $q->where('pickup_at', '<', Wita::of($request->query('to'))->endOfDay()->utc());
        }
        $q->when($request->query('status'), fn ($b, $s) => $b->whereIn('status', explode(',', $s)))
            ->when($request->query('zone_id'), fn ($b, $z) => $b->where('zone_id', $z))
            ->when($request->query('driver_id'), fn ($b, $d) => $b->where('driver_id', $d))
            ->when($request->query('payment_method'), fn ($b, $m) => $b->where('payment_method', $m))
            ->when($request->query('needs_attention'), fn ($b) => $b->where('needs_attention', true))
            ->when($request->query('q'), fn ($b, $s) => $b->where(fn ($w) => $w->where('code', 'like', "%{$s}%")->orWhere('guest_name', 'like', "%{$s}%")->orWhere('guest_phone', 'like', "%{$s}%")));
        $q->orderBy($request->query('sort', 'pickup_at'), $request->query('dir', 'asc') === 'desc' ? 'desc' : 'asc');

        return OrderResource::collection($q->paginate((int) $request->integer('per_page', 50)));
    }

    public function needsAttention()
    {
        $orders = Order::query()->with(['destination', 'vehicleClass', 'zone', 'driver.user', 'vehicle', 'origin', 'meetingPoint'])->where('needs_attention', true)->whereNotIn('status', ['completed', 'cancelled', 'expired', 'no_show'])->orderBy('pickup_at')->get();
        $issues = TripIssue::query()->with(['order:id,code,status', 'driver.user:id,name'])->where('status', 'open')->latest('id')->get();

        return response()->json(['data' => OrderResource::collection($orders)->resolve(), 'meta' => ['open_issues' => $issues]]);
    }

    public function driversOnline()
    {
        $drivers = Driver::query()->with(['user', 'primaryVehicle.vehicleClass'])->where('status', DriverStatus::Active->value)->where('is_online', true)->orderByDesc('last_seen_at')->get();

        return DriverResource::collection($drivers);
    }

    public function show(string $code)
    {
        $order = Order::query()->where('code', $code)->with(self::WITH)->firstOrFail();

        return (new OrderResource($order))->additional(['meta' => ['cancellation' => $this->cancellation->preview($order), 'waiting' => $this->trips->waitingInfo($order)]]);
    }

    /** Manual order (FR-ADM-11): admin quotes and books on behalf of a customer. */
    public function store(Request $request, QuoteService $quotes)
    {
        $data = $request->validate([
            'destination_location_id' => ['required', 'integer', 'exists:locations,id'],
            'pickup_at' => ['required_without:ferry.departure_at', 'nullable', 'date'],
            'passengers' => ['required', 'integer', 'min:1', 'max:40'], 'luggage_units' => ['nullable', 'numeric'], 'child_seats' => ['nullable', 'integer'], 'needs_roof_rack' => ['nullable', 'boolean'],
            'vehicle_class' => ['required', 'string', 'exists:vehicle_classes,code'],
            'ferry.route_id' => ['nullable', 'integer', 'exists:ferry_routes,id'], 'ferry.departure_at' => ['nullable', 'date'],
            'meeting_point_id' => ['nullable', 'integer'],
            'contact.name' => ['required', 'string', 'max:120'], 'contact.phone' => ['required', 'string', 'max:20'], 'contact.email' => ['nullable', 'email'], 'contact.locale' => ['nullable', 'in:id,en'],
            'payment_method' => ['required', 'in:cash,bank_transfer'], 'notes' => ['nullable', 'string', 'max:500'],
            'price_override' => ['nullable', 'integer', 'min:0'], 'override_reason' => ['required_with:price_override', 'nullable', 'string', 'max:200'],
            'force_capacity' => ['nullable', 'boolean'],
        ]);
        $pickup = $data['pickup_at'] ?? null;
        if (! $pickup && ! empty($data['ferry']['departure_at'])) {
            $route = FerryRoute::findOrFail($data['ferry']['route_id']);
            $pickup = Carbon::parse($data['ferry']['departure_at'])->addMinutes($route->crossing_min_min)->toIso8601String();
        }
        $quote = $quotes->quote(['destination_location_id' => $data['destination_location_id'], 'pickup_at' => $pickup, 'passengers' => $data['passengers'], 'luggage_units' => $data['luggage_units'] ?? 0, 'child_seats' => $data['child_seats'] ?? 0, 'needs_roof_rack' => $data['needs_roof_rack'] ?? false]);
        $order = $this->orders->create($data + ['quote_token' => $quote['quote_token'], 'channel' => 'admin'], null, $request->header('Idempotency-Key'), $request->user());
        activity('orders')->causedBy($request->user())->performedOn($order)->withProperties(['override' => $data['price_override'] ?? null])->log('manual_order');

        return (new OrderResource($order->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function eligibleDrivers(string $code)
    {
        $order = Order::query()->where('code', $code)->firstOrFail();
        $candidates = $this->dispatch->candidates($order)->map(fn ($c) => [
            'driver' => (new DriverResource($c['driver']))->resolve(), 'eligible' => $c['eligible'], 'reasons' => $c['reasons'], 'score' => $c['score'],
        ]);

        return response()->json(['data' => $candidates->values()]);
    }

    public function assign(Request $request, string $code)
    {
        $data = $request->validate(['driver_id' => ['required', 'integer', 'exists:drivers,id'], 'override_reason' => ['nullable', 'string', 'max:300']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $this->dispatch->assignManually($order, Driver::findOrFail($data['driver_id']), $request->user(), $data['override_reason'] ?? null);

        return new OrderResource($order->load(self::WITH));
    }

    public function unassign(Request $request, string $code)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:300']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $this->dispatch->unassign($order, ActorType::Admin, $request->user()->id, $data['reason']);
        activity('dispatch')->causedBy($request->user())->performedOn($order)->withProperties(['reason' => $data['reason']])->log('unassign');

        return new OrderResource($order->load(self::WITH));
    }

    public function redispatch(Request $request, string $code)
    {
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $order->status->value === 'confirmed' ? $this->dispatch->start($order) : tap($order, function (Order $o) {
            $o->update(['dispatch_wave' => 0, 'needs_attention' => false, 'dispatch_cycle' => $o->dispatch_cycle + 1]);
            $this->dispatch->runWave($o);
        });
        activity('dispatch')->causedBy($request->user())->performedOn($order)->log('redispatch');

        return new OrderResource($order->fresh(self::WITH));
    }

    public function cancel(Request $request, string $code)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:300'], 'waive_fee' => ['nullable', 'boolean']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $this->cancellation->cancel($order, ActorType::Admin, $request->user()->id, $data['reason'], (bool) ($data['waive_fee'] ?? false));
        activity('orders')->causedBy($request->user())->performedOn($order)->withProperties($data)->log('cancel');

        return new OrderResource($order->load(self::WITH));
    }

    public function confirmNoShow(Request $request, string $code)
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']]);
        $order = Order::query()->where('code', $code)->firstOrFail();

        return new OrderResource($this->trips->confirmNoShow($order, $request->user(), $data['note'] ?? null)->load(self::WITH));
    }

    public function docked(Request $request, string $code)
    {
        $data = $request->validate(['docked_at' => ['nullable', 'date'], 'reason' => ['nullable', 'string', 'max:200']]);
        $order = Order::query()->where('code', $code)->firstOrFail();
        $order = $this->orders->markDocked($order, ActorType::Admin, isset($data['docked_at']) ? Carbon::parse($data['docked_at']) : null, true);
        activity('orders')->causedBy($request->user())->performedOn($order)->withProperties($data)->log('update_docked');

        return new OrderResource($order->load(self::WITH));
    }

    public function approveWaitingFee(Request $request, string $code)
    {
        $data = $request->validate(['minutes_beyond_free' => ['required', 'integer', 'min:0', 'max:600']]);
        $order = Order::query()->where('code', $code)->firstOrFail();

        return new OrderResource($this->trips->approveWaitingFee($order, $request->user(), $data['minutes_beyond_free'])->load(self::WITH));
    }

    public function resolveIssue(Request $request, string $code, TripIssue $issue)
    {
        $issue->update(['status' => 'resolved', 'handled_by' => $request->user()->id]);

        return response()->json(['data' => $issue]);
    }
}
