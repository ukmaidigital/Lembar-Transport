<?php

namespace App\Http\Controllers\Customer;

use App\Enums\ActorType;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\CancellationPolicy;
use App\Services\OrderService;
use App\Services\PaymentService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private OrderService $orders, private PaymentService $payments, private CancellationPolicy $cancellation) {}

    private const WITH = ['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle', 'rating'];

    public function store(Request $request)
    {
        $data = $request->validate([
            'quote_token' => ['required', 'string'],
            'vehicle_class' => ['required', 'string'],
            'ferry.route_id' => ['nullable', 'integer', 'exists:ferry_routes,id'],
            'ferry.departure_at' => ['nullable', 'date'],
            'ferry.arrival_date' => ['nullable', 'date'],
            'meeting_point_id' => ['nullable', 'integer', 'exists:locations,id'],
            'contact.name' => ['required', 'string', 'max:120'],
            'contact.phone' => ['required', 'string', 'max:20'],
            'contact.email' => ['nullable', 'email', 'max:190'],
            'contact.locale' => ['nullable', 'in:id,en'],
            'payment_method' => ['required', 'in:cash,bank_transfer,gateway'],
            'notes' => ['nullable', 'string', 'max:500'],
            'channel' => ['nullable', 'in:web,qr'],
        ]);
        $order = $this->orders->create($data, $request->user(), $request->header('Idempotency-Key'));

        return (new OrderResource($order->load(self::WITH)))->additional(['meta' => ['payment' => $order->payment_method->value !== 'cash' ? $this->payments->instructions($order) : null]])->response()->setStatusCode(201);
    }

    public function index(Request $request)
    {
        $orders = Order::query()->where('customer_id', $request->user()->id)->with(self::WITH)->latest('pickup_at')->paginate(20);

        return OrderResource::collection($orders);
    }

    private function resolve(Request $request, string $code): Order
    {
        return $this->orders->findForTicket($code, $request->query('phone_last4') ?? $request->input('phone_last4'), $request->user('sanctum'))->load(self::WITH);
    }

    public function show(Request $request, string $code)
    {
        $order = $this->resolve($request, $code);

        return (new OrderResource($order))->additional(['meta' => [
            'cancellation' => $this->cancellation->preview($order),
            'payment' => $order->payment_method->value !== 'cash' && $order->status->value === 'pending_payment' ? $this->payments->instructions($order) : null,
            'docked_available' => now()->gte(($order->ferry_eta_min_at ?? $order->pickup_at)->copy()->subHours(2)) && ! $order->ferry_docked_at && ! $order->status->isTerminal() && $order->status->value !== 'on_trip',
        ]]);
    }

    public function paymentInstructions(Request $request, string $code)
    {
        $order = $this->resolve($request, $code);

        return response()->json(['data' => $this->payments->instructions($order)]);
    }

    public function paymentProof(Request $request, string $code)
    {
        $request->validate(['file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120']]);
        $order = $this->resolve($request, $code);
        $payment = $this->payments->uploadProof($order, $request->file('file'));

        return response()->json(['data' => ['payment_id' => $payment->id, 'status' => $payment->status, 'order' => new OrderResource($order->fresh(self::WITH))]], 201);
    }

    public function docked(Request $request, string $code)
    {
        $order = $this->resolve($request, $code);
        $order = $this->orders->markDocked($order, ActorType::Customer);

        return new OrderResource($order->load(self::WITH));
    }

    public function cancellationPreview(Request $request, string $code)
    {
        return response()->json(['data' => $this->cancellation->preview($this->resolve($request, $code))]);
    }

    public function cancel(Request $request, string $code)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']]);
        $order = $this->resolve($request, $code);
        $order = $this->cancellation->cancel($order, ActorType::Customer, $request->user('sanctum')?->id, $data['reason']);

        return new OrderResource($order->load(self::WITH));
    }

    public function rating(Request $request, string $code)
    {
        $data = $request->validate(['score' => ['required', 'integer', 'min:1', 'max:5'], 'comment' => ['nullable', 'string', 'max:500']]);
        $order = $this->resolve($request, $code);
        $rating = $this->orders->rate($order, $data['score'], $data['comment'] ?? null, $request->user('sanctum'));

        return response()->json(['data' => $rating], 201);
    }
}
