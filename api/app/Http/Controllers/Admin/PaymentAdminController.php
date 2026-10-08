<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\FileController;
use App\Http\Resources\OrderResource;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\PaymentService;
use Illuminate\Http\Request;

class PaymentAdminController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    public function index(Request $request)
    {
        $status = $request->query('status', 'pending_review');
        $items = Payment::query()->with(['order.destination', 'order.vehicleClass'])->when($status !== 'all', fn ($q) => $q->where('status', $status))->latest('updated_at')->paginate(50);
        $data = collect($items->items())->map(fn (Payment $p) => [
            'id' => $p->id, 'order_code' => $p->order->code, 'order_id' => $p->order_id, 'customer' => $p->order->guest_name, 'phone' => $p->order->guest_phone,
            'method' => $p->method, 'amount' => $p->amount, 'order_total' => $p->order->total, 'status' => $p->status, 'proof_url' => FileController::signedUrl($p->proof_path),
            'pickup_at' => $p->order->pickup_at?->toIso8601String(), 'destination' => $p->order->destination?->name_id, 'payment_expires_at' => $p->order->payment_expires_at?->toIso8601String(),
            'rejection_reason' => $p->rejection_reason, 'updated_at' => $p->updated_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $data, 'meta' => ['total' => $items->total(), 'current_page' => $items->currentPage(), 'last_page' => $items->lastPage()]]);
    }

    public function proofUrl(Payment $payment)
    {
        return response()->json(['data' => ['url' => FileController::signedUrl($payment->proof_path)]]);
    }

    public function confirm(Request $request, Payment $payment)
    {
        $data = $request->validate(['reference' => ['nullable', 'string', 'max:100']]);
        $order = $this->payments->confirm($payment, $request->user(), $data['reference'] ?? null);

        return new OrderResource($order->load(['origin', 'meetingPoint', 'destination', 'zone', 'vehicleClass', 'ferryRoute', 'driver.user', 'vehicle', 'payments']));
    }

    public function reject(Request $request, Payment $payment)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']]);

        return response()->json(['data' => $this->payments->reject($payment, $request->user(), $data['reason'])]);
    }

    public function refunds(Request $request)
    {
        return response()->json(['data' => Refund::query()->with('order:id,code,guest_name,guest_phone,total')->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))->latest('id')->paginate(50)]);
    }

    public function storeRefund(Request $request)
    {
        $data = $request->validate(['order_id' => ['required', 'integer', 'exists:orders,id'], 'amount' => ['required', 'integer', 'min:1'], 'method' => ['nullable', 'string', 'max:20'], 'reason' => ['nullable', 'string', 'max:200']]);
        $refund = Refund::create($data + ['status' => 'pending']);
        activity('payments')->causedBy($request->user())->performedOn($refund)->log('create_refund');

        return response()->json(['data' => $refund], 201);
    }

    public function updateRefund(Request $request, Refund $refund)
    {
        $data = $request->validate(['status' => ['required', 'in:pending,processed,failed'], 'reference' => ['nullable', 'string', 'max:100']]);
        $refund->update($data + ['processed_by' => $request->user()->id, 'processed_at' => $data['status'] === 'processed' ? now() : null]);
        activity('payments')->causedBy($request->user())->performedOn($refund)->withProperties($data)->log('update_refund');

        return response()->json(['data' => $refund]);
    }
}
