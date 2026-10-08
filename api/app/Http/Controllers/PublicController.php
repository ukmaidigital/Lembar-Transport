<?php

namespace App\Http\Controllers;

use App\Models\FerryRoute;
use App\Models\Location;
use App\Models\Setting;
use App\Models\VehicleClass;
use App\Models\Zone;
use App\Services\PaymentService;
use App\Services\QuoteService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PublicController extends Controller
{
    public function vehicleClasses()
    {
        return response()->json(['data' => VehicleClass::query()->where('is_active', true)->orderBy('sort_order')->get()]);
    }

    public function zones()
    {
        return response()->json(['data' => Zone::query()->where('is_active', true)->orderBy('sort_order')->with(['locations' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])->get()]);
    }

    public function locations(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $items = Location::query()->where('is_active', true)->whereNotNull('zone_id')->with('zone')
            ->when($q !== '', fn ($b) => $b->where(fn ($w) => $w->where('name_id', 'like', "%{$q}%")->orWhere('name_en', 'like', "%{$q}%")->orWhere('aliases', 'like', "%{$q}%")))
            ->orderBy('sort_order')->limit(50)->get();

        return response()->json(['data' => $items]);
    }

    public function ferryRoutes()
    {
        return response()->json(['data' => FerryRoute::query()->where('is_active', true)->get()]);
    }

    public function meetingPoints()
    {
        $items = Location::query()->where('type', 'meeting_point')->where('is_active', true)->orderBy('sort_order')->get()
            ->map(fn (Location $l) => $l->toArray() + ['photo_url' => FileController::signedUrl($l->photo_path)]);

        return response()->json(['data' => $items]);
    }

    public function tariffs(QuoteService $quotes)
    {
        return response()->json(['data' => $quotes->priceList()]);
    }

    /** Policies the UI must show before payment (PRD 16.4). */
    public function policies(PaymentService $payments, Request $request)
    {
        $pickup = $request->query('pickup_at') ? Carbon::parse($request->query('pickup_at')) : now()->addDays(2);

        return response()->json(['data' => [
            'cancellation_tiers' => Setting::value('cancellation.tiers'),
            'free_waiting_minutes' => (int) Setting::value('waiting.free_minutes'),
            'no_show_grace_minutes' => (int) Setting::value('waiting.no_show_grace_minutes'),
            'payment_methods' => array_map(fn ($m) => $m->value, $payments->allowedMethods($pickup)),
            'manual_payment_expiry_hours' => (int) Setting::value('payment.manual_expiry_hours'),
            'manual_payment_min_lead_hours' => (int) Setting::value('payment.manual_min_lead_hours'),
            'bank_account' => config('lembar.payment.bank_account'),
            'quote_ttl_minutes' => (int) config('lembar.quote_ttl_minutes'),
            'otp_expose' => (bool) config('lembar.otp.expose_in_response'),
        ]]);
    }

    public function quote(Request $request, QuoteService $quotes)
    {
        $data = $request->validate([
            'destination_location_id' => ['required_without:zone_id', 'nullable', 'integer'],
            'zone_id' => ['required_without:destination_location_id', 'nullable', 'integer'],
            'pickup_at' => ['required', 'date'],
            'passengers' => ['required', 'integer', 'min:1', 'max:40'],
            'luggage_units' => ['nullable', 'numeric', 'min:0', 'max:60'],
            'child_seats' => ['nullable', 'integer', 'min:0', 'max:4'],
            'needs_roof_rack' => ['nullable', 'boolean'],
            'service_type' => ['nullable', 'in:transfer_oneway'],
        ]);
        $data['locale'] = app()->getLocale();

        return response()->json(['data' => $quotes->quote($data)]);
    }
}
