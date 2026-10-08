<?php

namespace App\Services;

use App\Enums\DriverStatus;
use App\Enums\OrderStatus;
use App\Models\DispatchOffer;
use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Setting;
use App\Models\TripIssue;
use App\Support\Wita;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/** Aggregations for the admin dashboard and reports (PRD Bab 17). */
class ReportService
{
    public function dashboard(): array
    {
        $today = Wita::of(now())->startOfDay()->utc();
        $tomorrow = $today->copy()->addDay();
        $orders = Order::query();

        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $day = $today->copy()->subDays($i);
            $series[] = ['date' => Wita::of($day)->toDateString(), 'count' => Order::query()->whereBetween('created_at', [$day, $day->copy()->addDay()])->whereNotIn('status', ['expired'])->count()];
        }

        return [
            'orders_today' => (clone $orders)->whereBetween('pickup_at', [$today, $tomorrow])->whereNotIn('status', ['cancelled', 'expired'])->count(),
            'orders_yesterday' => (clone $orders)->whereBetween('pickup_at', [$today->copy()->subDay(), $today])->whereNotIn('status', ['cancelled', 'expired'])->count(),
            'trips_running' => (clone $orders)->whereIn('status', ['en_route', 'arrived', 'on_trip'])->count(),
            'needs_attention' => (clone $orders)->where('needs_attention', true)->whereNotIn('status', ['completed', 'cancelled', 'expired', 'no_show'])->count(),
            'verification_pending' => Driver::query()->where('status', DriverStatus::Submitted->value)->count(),
            'verification_sla_breaches' => Driver::query()->where('status', DriverStatus::Submitted->value)->where('submitted_at', '<=', now()->subHours((int) Setting::value('verification_sla_hours')))->count(),
            'payments_pending_review' => Payment::query()->where('status', 'pending_review')->count(),
            'drivers_online' => Driver::query()->where('status', DriverStatus::Active->value)->where('is_online', true)->count(),
            'drivers_below_threshold' => Driver::query()->where('status', DriverStatus::Active->value)->where('balance', '<', (int) Setting::value('ledger.balance_threshold'))->count(),
            'documents_expiring_7d' => DriverDocument::query()->whereBetween('expires_at', [now(), now()->addDays(7)])->where('status', 'approved')->distinct('driver_id')->count('driver_id'),
            'pickups_today' => (clone $orders)->with(['destination', 'driver.user', 'vehicleClass'])->whereBetween('pickup_at', [$today, $tomorrow])
                ->whereNotIn('status', ['cancelled', 'expired'])->orderBy('ferry_eta_min_at')->orderBy('pickup_at')->limit(20)->get(),
            'series_14d' => $series,
        ];
    }

    public function orders(Carbon $from, Carbon $to, array $filters = []): array
    {
        $q = Order::query()->whereBetween('orders.created_at', [$from, $to]);
        $byStatus = (clone $q)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $byZone = (clone $q)->join('zones', 'zones.id', '=', 'orders.zone_id')->selectRaw('zones.name as zone, count(*) as c')->groupBy('zones.name')->pluck('c', 'zone');
        $byClass = (clone $q)->join('vehicle_classes', 'vehicle_classes.id', '=', 'orders.vehicle_class_id')->selectRaw('vehicle_classes.name_id as class, count(*) as c')->groupBy('vehicle_classes.name_id')->pluck('c', 'class');
        $byChannel = (clone $q)->selectRaw('channel, count(*) as c')->groupBy('channel')->pluck('c', 'channel');
        $byDay = (clone $q)->selectRaw('substr(orders.created_at, 1, 10) as d, count(*) as c')->groupBy('d')->orderBy('d')->pluck('c', 'd');

        return ['by_status' => $byStatus, 'by_zone' => $byZone, 'by_class' => $byClass, 'by_channel' => $byChannel, 'by_day' => $byDay, 'total' => (clone $q)->count()];
    }

    public function revenue(Carbon $from, Carbon $to): array
    {
        $completed = Order::query()->where('status', OrderStatus::Completed->value)->whereBetween('completed_at', [$from, $to]);
        $gmv = (int) (clone $completed)->sum('total');
        $commission = (int) (clone $completed)->sum('commission_amount');
        $waiting = (int) (clone $completed)->sum('waiting_fee');
        $cancellationFees = (int) Order::query()->whereIn('status', ['cancelled', 'no_show'])->whereBetween('cancelled_at', [$from, $to])->sum('cancellation_fee');
        $refunds = (int) Refund::query()->whereBetween('created_at', [$from, $to])->sum('amount');

        return [
            'trips_completed' => (clone $completed)->count(),
            'gmv' => $gmv, 'commission' => $commission, 'waiting_fees' => $waiting, 'cancellation_fees' => $cancellationFees, 'refunds' => $refunds,
            'by_method' => (clone $completed)->selectRaw('payment_method, count(*) as c, sum(total) as gmv')->groupBy('payment_method')->get(),
            'platform_net' => $commission + $cancellationFees - $refunds,
        ];
    }

    public function drivers(Carbon $from, Carbon $to): Collection
    {
        return Driver::query()->with('user')->whereIn('status', [DriverStatus::Active->value, DriverStatus::Suspended->value])->get()->map(function (Driver $d) use ($from, $to) {
            $trips = Order::query()->where('driver_id', $d->id)->where('status', 'completed')->whereBetween('completed_at', [$from, $to]);

            return [
                'driver_id' => $d->id, 'name' => $d->user->name, 'status' => $d->status->value, 'rating_avg' => $d->rating_avg,
                'trips' => (clone $trips)->count(), 'gmv' => (int) (clone $trips)->sum('total'), 'net' => (int) (clone $trips)->sum('driver_payout_amount'),
                'acceptance_rate_30d' => $d->acceptance_rate_30d, 'on_time_rate_90d' => $d->on_time_rate_90d, 'balance' => $d->balance,
                'withdrawals' => TripIssue::query()->where('driver_id', $d->id)->where('type', 'withdrawal')->whereBetween('created_at', [$from, $to])->count(),
            ];
        })->sortByDesc('trips')->values();
    }

    public function cancellations(Carbon $from, Carbon $to): array
    {
        $q = Order::query()->whereIn('status', ['cancelled', 'no_show'])->whereBetween('cancelled_at', [$from, $to]);

        return [
            'total' => (clone $q)->count(),
            'by_actor' => (clone $q)->selectRaw('cancelled_by_type, count(*) as c, sum(cancellation_fee) as fees')->groupBy('cancelled_by_type')->get(),
            'by_status' => (clone $q)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status'),
            'top_reasons' => (clone $q)->selectRaw('cancellation_reason, count(*) as c')->groupBy('cancellation_reason')->orderByDesc('c')->limit(10)->get(),
        ];
    }

    public function verification(Carbon $from, Carbon $to): array
    {
        $decided = Driver::query()->whereNotNull('verified_at')->whereBetween('verified_at', [$from, $to]);
        $avgHours = (clone $decided)->get()->map(fn (Driver $d) => $d->submitted_at ? $d->submitted_at->diffInMinutes($d->verified_at) / 60 : null)->filter()->avg();

        return [
            'submitted' => Driver::query()->whereBetween('submitted_at', [$from, $to])->count(),
            'activated' => (clone $decided)->count(),
            'rejected' => Driver::query()->where('status', 'rejected')->whereBetween('updated_at', [$from, $to])->count(),
            'avg_hours_to_decision' => $avgHours ? round($avgHours, 1) : null,
            'pending_now' => Driver::query()->where('status', 'submitted')->count(),
            'top_rejection_reasons' => DriverDocument::query()->where('status', 'rejected')->whereBetween('reviewed_at', [$from, $to])->selectRaw('rejection_reason_code, count(*) as c')->groupBy('rejection_reason_code')->orderByDesc('c')->get(),
        ];
    }

    public function dispatch(Carbon $from, Carbon $to): array
    {
        $assigned = Order::query()->whereNotNull('assigned_at')->whereBetween('assigned_at', [$from, $to])->get();
        $minutes = $assigned->map(fn (Order $o) => $o->dispatch_started_at ? $o->dispatch_started_at->diffInSeconds($o->assigned_at) / 60 : null)->filter()->sort()->values();
        $p90 = $minutes->isEmpty() ? null : round($minutes[(int) floor(($minutes->count() - 1) * 0.9)], 1);
        $offers = DispatchOffer::query()->whereBetween('offered_at', [$from, $to]);

        return [
            'assigned' => $assigned->count(),
            'avg_minutes_to_assign' => $minutes->isEmpty() ? null : round($minutes->avg(), 1),
            'p90_minutes_to_assign' => $p90,
            'needs_attention_total' => Order::query()->whereBetween('created_at', [$from, $to])->where('needs_attention', true)->count(),
            'offers' => (clone $offers)->count(),
            'acceptance_rate' => (clone $offers)->count() ? round((clone $offers)->where('response', 'accepted')->count() / (clone $offers)->count() * 100, 1) : null,
            'by_wave' => (clone $offers)->where('response', 'accepted')->selectRaw('wave, count(*) as c')->groupBy('wave')->pluck('c', 'wave'),
        ];
    }

    public function funnel(Carbon $from, Carbon $to): array
    {
        $q = Order::query()->whereBetween('created_at', [$from, $to]);

        return [
            'orders_created' => (clone $q)->count(),
            'orders_confirmed' => (clone $q)->whereNotIn('status', ['pending_payment', 'expired'])->count(),
            'orders_completed' => (clone $q)->where('status', 'completed')->count(),
            'expired' => (clone $q)->where('status', 'expired')->count(),
            'by_locale' => (clone $q)->selectRaw('locale, count(*) as c')->groupBy('locale')->pluck('c', 'locale'),
        ];
    }
}
