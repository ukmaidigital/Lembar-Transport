<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/** Manual (cash / bank transfer) payments and their review by Finance (PRD Bab 6.5). */
class PaymentService
{
    public function __construct(private OrderStateMachine $stateMachine, private DispatchEngine $dispatch, private NotificationService $notifications) {}

    /** @return PaymentMethod[] methods allowed for a pickup time */
    public function allowedMethods(\DateTimeInterface $pickupAt): array
    {
        $methods = [PaymentMethod::Cash];
        $minLead = (int) Setting::value('payment.manual_min_lead_hours');
        if (now()->addHours($minLead)->lte($pickupAt)) {
            $methods[] = PaymentMethod::BankTransfer;
        }
        if (Setting::value('payment.gateway_enabled')) {
            $methods[] = PaymentMethod::Gateway;
        }

        return $methods;
    }

    /** Called right after an order is created. */
    public function initialize(Order $order): Order
    {
        if (! in_array($order->payment_method, $this->allowedMethods($order->pickup_at), true)) {
            throw new BusinessRuleException('PAYMENT_METHOD_NOT_ALLOWED', 'Metode pembayaran ini tidak tersedia untuk waktu penjemputan tersebut.', 422);
        }
        if ($order->payment_method === PaymentMethod::Cash) {
            $order->status = OrderStatus::Confirmed;
            $order->payment_status = PaymentStatus::Unpaid;
            $order->save();
            $order->histories()->create(['from_status' => null, 'to_status' => OrderStatus::Confirmed->value, 'actor_type' => ActorType::System->value, 'reason' => 'pesanan tunai', 'created_at' => now()]);
            $this->dispatch->schedule($order);

            return $order;
        }
        $expiry = now()->addHours((int) Setting::value('payment.manual_expiry_hours'));
        $cutoff = $order->pickup_at->copy()->subHours((int) Setting::value('payment.manual_cutoff_hours'));
        $order->status = OrderStatus::PendingPayment;
        $order->payment_status = PaymentStatus::Unpaid;
        $order->payment_expires_at = $expiry->min($cutoff);
        $order->save();
        $order->histories()->create(['from_status' => null, 'to_status' => OrderStatus::PendingPayment->value, 'actor_type' => ActorType::System->value, 'reason' => 'menunggu pembayaran', 'created_at' => now()]);
        Payment::create(['order_id' => $order->id, 'method' => $order->payment_method->value, 'provider' => 'manual', 'amount' => $order->total, 'status' => 'pending']);

        return $order;
    }

    public function instructions(Order $order): array
    {
        $bank = config('lembar.payment.bank_account');

        return [
            'method' => $order->payment_method->value,
            'amount' => $order->total,
            'expires_at' => $order->payment_expires_at?->toIso8601String(),
            'bank' => $bank['bank'],
            'account_number' => $bank['number'],
            'account_holder' => $bank['holder'],
            'transfer_note' => $order->code,
            'qris_available' => true,
        ];
    }

    public function uploadProof(Order $order, UploadedFile $file): Payment
    {
        if ($order->status !== OrderStatus::PendingPayment) {
            throw new BusinessRuleException('ORDER_NOT_AWAITING_PAYMENT', 'Pesanan tidak sedang menunggu pembayaran.', 409);
        }
        $path = $file->store("orders/{$order->id}/payment-proofs");
        $payment = $order->payments()->where('status', '!=', 'rejected')->latest('id')->first()
            ?? Payment::create(['order_id' => $order->id, 'method' => $order->payment_method->value, 'provider' => 'manual', 'amount' => $order->total, 'status' => 'pending']);
        $payment->update(['proof_path' => $path, 'status' => 'pending_review']);
        $order->update(['payment_status' => PaymentStatus::PendingReview]);
        $this->notifications->paymentProofUploaded($order);

        return $payment;
    }

    public function confirm(Payment $payment, User $admin, ?string $reference = null): Order
    {
        return DB::transaction(function () use ($payment, $admin, $reference) {
            $order = Order::query()->lockForUpdate()->findOrFail($payment->order_id);
            $payment->update(['status' => 'paid', 'paid_at' => now(), 'confirmed_by' => $admin->id, 'confirmed_at' => now(), 'external_id' => $reference]);
            $order->payment_status = PaymentStatus::Paid;
            $order->payment_expires_at = null;
            if ($order->status === OrderStatus::PendingPayment) {
                $this->stateMachine->transition($order, OrderStatus::Confirmed, ActorType::Admin, $admin->id, 'pembayaran dikonfirmasi Finance');
                $this->dispatch->schedule($order);
                $this->notifications->orderConfirmed($order);
            } else {
                $order->save();
            }
            activity('payments')->causedBy($admin)->performedOn($payment)->log('confirm');

            return $order->fresh();
        });
    }

    public function reject(Payment $payment, User $admin, string $reason): Payment
    {
        $payment->update(['status' => 'rejected', 'rejection_reason' => $reason, 'confirmed_by' => $admin->id, 'confirmed_at' => now()]);
        $order = $payment->order;
        $order->update(['payment_status' => PaymentStatus::Unpaid]);
        Payment::create(['order_id' => $order->id, 'method' => $order->payment_method->value, 'provider' => 'manual', 'amount' => $order->total, 'status' => 'pending']);
        $this->notifications->paymentRejected($order, $reason);
        activity('payments')->causedBy($admin)->performedOn($payment)->withProperties(['reason' => $reason])->log('reject');

        return $payment->fresh();
    }

    /** Record cash received by the driver when the trip completes. */
    public function recordCash(Order $order, int $amount, ?string $note = null): void
    {
        Payment::create(['order_id' => $order->id, 'method' => 'cash', 'provider' => 'driver', 'amount' => $amount, 'status' => 'paid', 'paid_at' => now()]);
        $order->update(['payment_status' => PaymentStatus::Paid, 'cash_collected' => $amount, 'cash_note' => $note]);
    }

    /** Scheduler: expire pending payments past their deadline. */
    public function expireOverdue(): int
    {
        $count = 0;
        Order::query()->where('status', OrderStatus::PendingPayment->value)->whereNotNull('payment_expires_at')->where('payment_expires_at', '<=', now())
            ->where('payment_status', '!=', PaymentStatus::PendingReview->value)
            ->each(function (Order $order) use (&$count) {
                $this->stateMachine->transition($order, OrderStatus::Expired, ActorType::System, null, 'batas waktu pembayaran lewat');
                $order->payments()->where('status', 'pending')->update(['status' => 'expired']);
                $this->notifications->paymentExpired($order);
                $count++;
            });

        return $count;
    }
}
