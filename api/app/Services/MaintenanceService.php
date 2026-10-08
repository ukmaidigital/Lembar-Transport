<?php

namespace App\Services;

use App\Enums\DriverStatus;
use App\Enums\LedgerType;
use App\Enums\OrderStatus;
use App\Models\Driver;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\OtpCode;
use App\Models\Payout;
use App\Models\Setting;
use App\Support\Wita;
use Illuminate\Support\Facades\Storage;

/** Scheduled housekeeping: reminders, weekly payouts, retention purge (PRD Bab 12.9, 16). */
class MaintenanceService
{
    public function __construct(private NotificationService $notifications, private LedgerService $ledger) {}

    /** 20.00 WITA: remind customer and driver about tomorrow's pickups. */
    public function sendDayBeforeReminders(): int
    {
        $start = Wita::of(now())->addDay()->startOfDay()->utc();
        $end = $start->copy()->addDay();
        $count = 0;
        Order::query()->whereBetween('pickup_at', [$start, $end])->whereIn('status', [OrderStatus::Confirmed->value, OrderStatus::Dispatching->value, OrderStatus::Assigned->value])
            ->each(function (Order $o) use (&$count) {
                if ($this->alreadySent('order.reminder_day_before', $o)) {
                    return;
                }
                $this->notifications->reminder($o, 'order.reminder_day_before');
                $count++;
            });

        return $count;
    }

    /** Every 10 minutes: T-2h before the estimated docking, remind the driver (and customer). */
    public function sendPreArrivalReminders(): int
    {
        $count = 0;
        Order::query()->where('status', OrderStatus::Assigned->value)->whereBetween('ferry_eta_min_at', [now()->addMinutes(110), now()->addMinutes(130)])
            ->each(function (Order $o) use (&$count) {
                if ($this->alreadySent('order.reminder_pre_arrival', $o)) {
                    return;
                }
                $this->notifications->reminder($o, 'order.reminder_pre_arrival');
                $count++;
            });

        return $count;
    }

    private function alreadySent(string $key, Order $order): bool
    {
        return NotificationLog::query()->where('template_key', $key)->where('payload->code', $order->code)->exists();
    }

    /** Weekly: create pending payouts for drivers whose balance meets the minimum and reserve the amount. */
    public function preparePayouts(): int
    {
        $min = (int) Setting::value('ledger.payout_min');
        $count = 0;
        Driver::query()->where('status', DriverStatus::Active->value)->where('balance', '>=', $min)->with('bankAccount')->each(function (Driver $d) use (&$count) {
            if (! $d->bankAccount || Payout::query()->where('driver_id', $d->id)->where('status', 'pending')->exists()) {
                return;
            }
            $amount = $d->balance;
            $payout = Payout::create([
                'driver_id' => $d->id, 'period_start' => now()->subWeek()->toDateString(), 'period_end' => now()->toDateString(), 'amount' => $amount,
                'bank_account_snapshot' => ['bank' => $d->bankAccount->bank_code, 'number' => $d->bankAccount->maskedNumber(), 'name' => $d->bankAccount->account_name],
                'status' => 'pending',
            ]);
            $entry = $this->ledger->record($d, LedgerType::Payout, -$amount, null, 'Payout mingguan #'.$payout->id, null, 'payout', $payout->id);
            $payout->update(['ledger_entry_id' => $entry->id]);
            $count++;
        });

        return $count;
    }

    /** Retention (PRD 16.1): OTP > 24 h, notification logs > 90 d, documents of rejected applicants > 90 d. */
    public function purgeExpiredData(): array
    {
        $otp = OtpCode::query()->where('created_at', '<', now()->subDay())->delete();
        $logs = NotificationLog::query()->where('created_at', '<', now()->subDays(90))->delete();
        $docs = 0;
        Driver::query()->where('status', DriverStatus::Rejected->value)->where('updated_at', '<', now()->subDays(90))->each(function (Driver $d) use (&$docs) {
            foreach ($d->documents as $doc) {
                Storage::delete($doc->file_path);
                $doc->delete();
                $docs++;
            }
            $d->update(['nik' => null]);
        });

        return ['otp' => $otp, 'notification_logs' => $logs, 'documents' => $docs];
    }
}
