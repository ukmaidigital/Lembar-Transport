<?php

namespace App\Http\Controllers\Admin;

use App\Enums\LedgerType;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Controllers\FileController;
use App\Models\Driver;
use App\Models\LedgerEntry;
use App\Models\Payout;
use App\Models\Setting;
use App\Models\TopUpRequest;
use App\Services\LedgerService;
use App\Services\MaintenanceService;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class LedgerAdminController extends Controller
{
    public function __construct(private LedgerService $ledger, private NotificationService $notifications) {}

    public function index(Request $request)
    {
        $q = LedgerEntry::query()->with(['driver.user:id,name', 'order:id,code'])->when($request->query('driver_id'), fn ($b, $d) => $b->where('driver_id', $d))->when($request->query('type'), fn ($b, $t) => $b->where('type', $t))->latest('id');
        $items = $q->paginate(50);
        $summary = $request->query('driver_id') ? Driver::with('user')->find($request->query('driver_id')) : null;

        return response()->json(['data' => $items->items(), 'meta' => ['total' => $items->total(), 'last_page' => $items->lastPage(), 'driver' => $summary ? ['id' => $summary->id, 'name' => $summary->user->name, 'balance' => $summary->balance] : null,
            'balances' => Driver::query()->with('user:id,name')->orderBy('balance')->limit(200)->get()->map(fn ($d) => ['driver_id' => $d->id, 'name' => $d->user?->name, 'balance' => $d->balance, 'status' => $d->status->value]),
            'threshold' => (int) Setting::value('ledger.balance_threshold')]]);
    }

    public function adjust(Request $request)
    {
        $data = $request->validate(['driver_id' => ['required', 'integer', 'exists:drivers,id'], 'amount' => ['required', 'integer', 'not_in:0'], 'note' => ['required', 'string', 'max:300']]);
        $entry = $this->ledger->record(Driver::findOrFail($data['driver_id']), LedgerType::Adjustment, $data['amount'], null, $data['note'], $request->user()->id);
        activity('ledger')->causedBy($request->user())->performedOn($entry)->withProperties($data)->log('adjustment');

        return response()->json(['data' => $entry], 201);
    }

    public function topUps(Request $request)
    {
        $items = TopUpRequest::query()->with('driver.user:id,name,phone')->when($request->query('status', 'pending_review') !== 'all', fn ($q) => $q->where('status', $request->query('status', 'pending_review')))->latest('id')->paginate(50);
        $data = collect($items->items())->map(fn (TopUpRequest $t) => ['id' => $t->id, 'driver_id' => $t->driver_id, 'driver_name' => $t->driver->user->name, 'driver_phone' => $t->driver->user->phone, 'balance' => $t->driver->balance, 'amount' => $t->amount, 'status' => $t->status, 'proof_url' => FileController::signedUrl($t->proof_path), 'created_at' => $t->created_at?->toIso8601String(), 'rejection_reason' => $t->rejection_reason]);

        return response()->json(['data' => $data, 'meta' => ['total' => $items->total(), 'last_page' => $items->lastPage()]]);
    }

    public function topUpProofUrl(TopUpRequest $topUp)
    {
        return response()->json(['data' => ['url' => FileController::signedUrl($topUp->proof_path)]]);
    }

    public function confirmTopUp(Request $request, TopUpRequest $topUp)
    {
        if ($topUp->status !== 'pending_review') {
            throw new BusinessRuleException('TOP_UP_NOT_PENDING', 'Top-up sudah diproses.', 409);
        }
        $entry = $this->ledger->record($topUp->driver, LedgerType::TopUp, $topUp->amount, null, 'Top-up #'.$topUp->id, $request->user()->id, 'top_up', $topUp->id);
        $topUp->update(['status' => 'confirmed', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'ledger_entry_id' => $entry->id]);
        $this->notifications->topUpConfirmed($topUp->driver->fresh('user'), $topUp->amount);
        activity('ledger')->causedBy($request->user())->performedOn($topUp)->log('confirm_top_up');

        return response()->json(['data' => $topUp->fresh()]);
    }

    public function rejectTopUp(Request $request, TopUpRequest $topUp)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:200']]);
        $topUp->update(['status' => 'rejected', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now(), 'rejection_reason' => $data['reason']]);
        activity('ledger')->causedBy($request->user())->performedOn($topUp)->withProperties($data)->log('reject_top_up');

        return response()->json(['data' => $topUp->fresh()]);
    }

    /** Preview who would be paid this week (FR-ADM-22). */
    public function preparePayouts()
    {
        $min = (int) Setting::value('ledger.payout_min');
        $drivers = Driver::query()->with(['user:id,name', 'bankAccount'])->where('status', 'active')->where('balance', '>=', $min)->get()
            ->map(fn (Driver $d) => ['driver_id' => $d->id, 'name' => $d->user->name, 'balance' => $d->balance, 'bank' => $d->bankAccount?->bank_code, 'account' => $d->bankAccount?->maskedNumber(), 'account_name' => $d->bankAccount?->account_name, 'has_pending' => Payout::where('driver_id', $d->id)->where('status', 'pending')->exists()]);

        return response()->json(['data' => $drivers, 'meta' => ['payout_min' => $min, 'total' => $drivers->sum('balance')]]);
    }

    public function storePayouts(Request $request, MaintenanceService $maintenance)
    {
        $count = $maintenance->preparePayouts();
        activity('ledger')->causedBy($request->user())->withProperties(['count' => $count])->log('prepare_payouts');

        return response()->json(['data' => ['created' => $count]], 201);
    }

    public function payouts(Request $request)
    {
        return response()->json(['data' => Payout::query()->with('driver.user:id,name')->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))->latest('id')->paginate(50)]);
    }

    public function updatePayout(Request $request, Payout $payout)
    {
        $data = $request->validate(['status' => ['required', 'in:pending,paid,failed'], 'reference' => ['nullable', 'string', 'max:100']]);
        if ($data['status'] === 'failed' && $payout->status !== 'failed') {
            $this->ledger->record($payout->driver, LedgerType::Adjustment, $payout->amount, null, 'Payout #'.$payout->id.' gagal, saldo dikembalikan', $request->user()->id, 'payout', $payout->id);
        }
        $payout->update($data + ['processed_by' => $request->user()->id, 'paid_at' => $data['status'] === 'paid' ? now() : null]);
        if ($data['status'] === 'paid') {
            $this->notifications->payoutSent($payout->driver->load('user'), $payout->amount);
        }
        activity('ledger')->causedBy($request->user())->performedOn($payout)->withProperties($data)->log('update_payout');

        return response()->json(['data' => $payout->fresh()]);
    }
}
