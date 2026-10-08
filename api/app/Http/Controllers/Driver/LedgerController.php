<?php

namespace App\Http\Controllers\Driver;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\LedgerEntry;
use App\Models\Payout;
use App\Models\Setting;
use App\Models\TopUpRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\Wita;
use Illuminate\Http\Request;

class LedgerController extends Controller
{
    public function index(Request $request)
    {
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        $period = $request->query('period', 'week');
        $start = match ($period) {
            'today' => Wita::of(now())->startOfDay()->utc(),
            'month' => Wita::of(now())->startOfMonth()->utc(),
            'all' => null,
            default => Wita::of(now())->startOfWeek()->utc(),
        };
        $entries = LedgerEntry::query()->where('driver_id', $driver->id)->when($start, fn ($q) => $q->where('created_at', '>=', $start))->with('order:id,code,total,payment_method,destination_location_id')->latest('id')->limit(200)->get();
        $trips = $driver->orders()->where('status', 'completed')->when($start, fn ($q) => $q->where('completed_at', '>=', $start));

        return response()->json(['data' => $entries, 'meta' => [
            'balance' => $driver->balance,
            'threshold' => (int) Setting::value('ledger.balance_threshold'),
            'below_threshold' => $driver->balance < (int) Setting::value('ledger.balance_threshold'),
            'trips_completed' => (clone $trips)->count(),
            'net_earnings' => (int) (clone $trips)->sum('driver_payout_amount'),
            'cash_commission' => (int) (clone $trips)->where('payment_method', 'cash')->sum('commission_amount'),
            'payout_min' => (int) Setting::value('ledger.payout_min'),
            'top_up_min' => (int) Setting::value('ledger.top_up_min'),
        ]]);
    }

    public function topUp(Request $request, NotificationService $notifications)
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1000'], 'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120']]);
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        if ($data['amount'] < (int) Setting::value('ledger.top_up_min')) {
            throw new BusinessRuleException('TOP_UP_MIN', 'Top-up minimum Rp '.number_format((int) Setting::value('ledger.top_up_min'), 0, ',', '.').'.', 422);
        }
        $key = $request->header('Idempotency-Key');
        if ($key && ($existing = TopUpRequest::query()->where('driver_id', $driver->id)->where('created_at', '>=', now()->subDay())->where('amount', $data['amount'])->where('status', 'pending_review')->first())) {
            return response()->json(['data' => $existing]);
        }
        $topUp = TopUpRequest::create(['driver_id' => $driver->id, 'amount' => $data['amount'], 'proof_path' => $request->file('file')->store("drivers/{$driver->id}/top-ups"), 'status' => 'pending_review']);
        foreach (User::role(['finance', 'super_admin'])->get() as $admin) {
            $notifications->send('finance.proof_uploaded', ['code' => 'TOP-UP #'.$topUp->id, 'total' => 'Rp '.number_format($topUp->amount, 0, ',', '.')], $admin, $admin->email, 'id', ['email', 'in_app']);
        }

        return response()->json(['data' => $topUp], 201);
    }

    public function topUps(Request $request)
    {
        return response()->json(['data' => TopUpRequest::query()->where('driver_id', $request->user()->driver?->id)->latest('id')->limit(50)->get()]);
    }

    public function payouts(Request $request)
    {
        return response()->json(['data' => Payout::query()->where('driver_id', $request->user()->driver?->id)->latest('id')->limit(50)->get()]);
    }
}
