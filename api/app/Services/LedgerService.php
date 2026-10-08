<?php

namespace App\Services;

use App\Enums\LedgerType;
use App\Models\Driver;
use App\Models\LedgerEntry;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

/** Partner balance ledger (PRD Bab 6.5, 9.5). Balance always equals the sum of entries. */
class LedgerService
{
    public function record(Driver $driver, LedgerType $type, int $amount, ?Order $order = null, ?string $note = null, ?int $createdBy = null, ?string $refType = null, ?int $refId = null): LedgerEntry
    {
        return DB::transaction(function () use ($driver, $type, $amount, $order, $note, $createdBy, $refType, $refId) {
            $locked = Driver::query()->lockForUpdate()->findOrFail($driver->id);
            $locked->balance += $amount;
            $locked->save();
            $driver->balance = $locked->balance;

            return LedgerEntry::create([
                'driver_id' => $driver->id,
                'order_id' => $order?->id,
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $locked->balance,
                'reference_type' => $refType,
                'reference_id' => $refId,
                'note' => $note,
                'created_by' => $createdBy,
                'created_at' => now(),
            ]);
        });
    }

    /** Settle a completed trip: prepaid credits the net fare, cash debits the commission. */
    public function settleTrip(Order $order): void
    {
        $driver = $order->driver;
        if (! $driver || $order->ledgerEntries()->whereIn('type', [LedgerType::TripEarning->value, LedgerType::Commission->value])->exists()) {
            return;
        }
        if ($order->isCash()) {
            $this->record($driver, LedgerType::Commission, -$order->commission_amount, $order, 'Komisi trip tunai '.$order->code);
        } else {
            $this->record($driver, LedgerType::TripEarning, $order->driver_payout_amount, $order, 'Pendapatan trip prabayar '.$order->code);
        }
        if ($order->waiting_fee > 0) {
            $rate = (float) $order->commission_rate;
            $net = $order->waiting_fee - (int) round($order->waiting_fee * $rate);
            $this->record($driver, LedgerType::WaitingFee, $order->isCash() ? -(int) round($order->waiting_fee * $rate) : $net, $order, 'Biaya tunggu '.$order->code);
        }
    }

    public function isBelowThreshold(Driver $driver): bool
    {
        return $driver->balance < (int) Setting::value('ledger.balance_threshold');
    }
}
