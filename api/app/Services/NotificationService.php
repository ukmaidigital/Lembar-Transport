<?php

namespace App\Services;

use App\Enums\ActorType;
use App\Models\Driver;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Multi-channel notifications (PRD Bab 11). Phase 1 drivers: "log" (records the message
 * and writes it to the application log) and "in_app" (visible in the apps). Swapping
 * LEMBAR_NOTIFICATION_DRIVER to a real WhatsApp/SMS/email provider is a transport change only.
 */
class NotificationService
{
    public function send(string $templateKey, array $data, ?User $user = null, ?string $recipient = null, string $locale = 'id', array $channels = ['whatsapp', 'in_app']): void
    {
        [$title, $body] = $this->render($templateKey, $data, $locale);
        foreach ($channels as $channel) {
            if ($channel === 'in_app' && ! $user) {
                continue;
            }
            NotificationLog::create([
                'user_id' => $user?->id,
                'recipient' => $recipient ?? $user?->phone ?? $user?->email,
                'channel' => $channel,
                'template_key' => $templateKey,
                'locale' => $locale,
                'title' => $title,
                'body' => $body,
                'payload' => $data,
                'status' => 'sent',
                'sent_at' => now(),
            ]);
            if ($channel !== 'in_app') {
                Log::channel(config('logging.default'))->info("[notify:{$channel}] {$templateKey} → ".($recipient ?? $user?->phone ?? '-').": {$body}");
            }
        }
    }

    public function render(string $key, array $data, string $locale): array
    {
        $t = trans("notifications.$key", $data, $locale);
        if (is_array($t)) {
            return [$t['title'] ?? $key, $t['body'] ?? ''];
        }

        return [$key, is_string($t) ? $t : ''];
    }

    private function orderData(Order $order): array
    {
        $order->loadMissing(['destination', 'driver.user', 'vehicle', 'meetingPoint']);
        $locale = $order->locale ?: 'id';

        return [
            'code' => $order->code,
            'name' => $order->guest_name,
            'destination' => $order->destination?->name($locale) ?? $order->destination_text,
            'pickup' => $order->pickup_at->setTimezone(config('lembar.timezone'))->format('D, d M Y H.i').' WITA',
            'total' => 'Rp '.number_format($order->total, 0, ',', '.'),
            'driver' => $order->driver?->user?->name ?? '-',
            'plate' => $order->vehicle?->plate_number ?? '-',
            'vehicle' => trim(($order->vehicle?->brand ?? '').' '.($order->vehicle?->model ?? '')) ?: '-',
            'meeting_point' => $order->meetingPoint?->name($locale) ?? '-',
            'ticket_url' => rtrim(config('lembar.web_url'), '/').'/pesanan/'.$order->code,
        ];
    }

    public function orderCreated(Order $order): void
    {
        $key = $order->status->value === 'pending_payment' ? 'order.pending_payment' : 'order.confirmed';
        $this->send($key, $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function orderConfirmed(Order $order): void
    {
        $this->send('order.confirmed', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function paymentRejected(Order $order, string $reason): void
    {
        $this->send('payment.rejected', $this->orderData($order) + ['reason' => $reason], $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function paymentExpired(Order $order): void
    {
        $this->send('payment.expired', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function driverAssigned(Order $order): void
    {
        $this->send('order.driver_assigned', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
        if ($order->driver?->user) {
            $this->send('driver.trip_assigned', $this->orderData($order), $order->driver->user, null, 'id', ['whatsapp', 'in_app']);
        }
    }

    public function driverChanged(Order $order): void
    {
        $this->send('order.driver_changed', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function offerCreated(Order $order, Driver $driver, int $seconds): void
    {
        $this->send('driver.new_offer', $this->orderData($order) + ['seconds' => $seconds, 'net' => 'Rp '.number_format($order->driver_payout_amount, 0, ',', '.')], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function docked(Order $order): void
    {
        if ($order->driver?->user) {
            $this->send('driver.ferry_docked', $this->orderData($order), $order->driver->user, null, 'id', ['whatsapp', 'in_app']);
        }
    }

    public function driverArrived(Order $order): void
    {
        $this->send('order.driver_arrived', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'in_app']);
    }

    public function tripCompleted(Order $order): void
    {
        $this->send('order.completed', $this->orderData($order), $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
    }

    public function orderCancelled(Order $order, ActorType $by): void
    {
        $data = $this->orderData($order) + ['by' => $by->value];
        $this->send('order.cancelled', $data, $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'email', 'in_app']);
        if ($order->driver?->user && $by !== ActorType::Driver) {
            $this->send('driver.trip_cancelled', $data, $order->driver->user, null, 'id', ['whatsapp', 'in_app']);
        }
    }

    public function needsAttention(Order $order): void
    {
        foreach (User::role(['ops', 'super_admin'])->get() as $admin) {
            $this->send('ops.needs_attention', $this->orderData($order), $admin, $admin->email, 'id', ['email', 'in_app']);
        }
    }

    public function paymentProofUploaded(Order $order): void
    {
        foreach (User::role(['finance', 'super_admin'])->get() as $admin) {
            $this->send('finance.proof_uploaded', $this->orderData($order), $admin, $admin->email, 'id', ['email', 'in_app']);
        }
    }

    public function driverApplicationSubmitted(Driver $driver): void
    {
        foreach (User::role(['verifier', 'super_admin'])->get() as $admin) {
            $this->send('verifier.application_submitted', ['name' => $driver->user->name, 'driver_id' => $driver->id], $admin, $admin->email, 'id', ['email', 'in_app']);
        }
    }

    public function driverDecision(Driver $driver, string $decision, ?string $note = null): void
    {
        $this->send('driver.decision_'.$decision, ['name' => $driver->user->name, 'note' => $note ?? '-'], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function driverSuspension(Driver $driver, bool $suspended, ?string $reason = null): void
    {
        $this->send($suspended ? 'driver.suspended' : 'driver.reactivated', ['name' => $driver->user->name, 'reason' => $reason ?? '-'], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function documentExpiring(Driver $driver, string $documentLabel, int $days): void
    {
        $this->send('driver.document_expiring', ['name' => $driver->user->name, 'document' => $documentLabel, 'days' => $days], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function balanceBelowThreshold(Driver $driver): void
    {
        $this->send('driver.balance_low', ['name' => $driver->user->name, 'balance' => 'Rp '.number_format($driver->balance, 0, ',', '.')], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function topUpConfirmed(Driver $driver, int $amount): void
    {
        $this->send('driver.top_up_confirmed', ['name' => $driver->user->name, 'amount' => 'Rp '.number_format($amount, 0, ',', '.')], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function payoutSent(Driver $driver, int $amount): void
    {
        $this->send('driver.payout_sent', ['name' => $driver->user->name, 'amount' => 'Rp '.number_format($amount, 0, ',', '.')], $driver->user, null, 'id', ['whatsapp', 'in_app']);
    }

    public function reminder(Order $order, string $key): void
    {
        $data = $this->orderData($order);
        $this->send($key, $data, $order->customer, $order->guest_phone, $order->locale ?: 'id', ['whatsapp', 'in_app']);
        if ($order->driver?->user) {
            $this->send('driver.'.substr($key, strpos($key, '.') + 1), $data, $order->driver->user, null, 'id', ['whatsapp', 'in_app']);
        }
    }

    public function otp(string $phone, string $code): void
    {
        $this->send('auth.otp', ['code' => $code, 'minutes' => config('lembar.otp.ttl_minutes')], null, $phone, 'id', ['whatsapp']);
    }
}
