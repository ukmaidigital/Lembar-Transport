<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\FileController;
use App\Models\FerryRoute;
use App\Models\HolidayDate;
use App\Models\Location;
use App\Models\Surcharge;
use App\Models\Tariff;
use App\Models\Vehicle;
use App\Models\VehicleClass;
use App\Models\Zone;
use App\Services\QuoteService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Zones, locations, ferry routes, tariffs, surcharges, holidays, vehicle classes and vehicles (FR-ADM-07, 17, 18). */
class CatalogController extends Controller
{
    public function vehicleClasses()
    {
        return response()->json(['data' => VehicleClass::query()->orderBy('sort_order')->get()]);
    }

    public function storeVehicleClass(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'alpha_dash', 'unique:vehicle_classes,code'], 'name_id' => ['required', 'string'], 'name_en' => ['required', 'string'], 'example_vehicles' => ['nullable', 'string'], 'max_passengers' => ['required', 'integer', 'min:1'], 'max_luggage' => ['required', 'integer', 'min:0'], 'sort_order' => ['nullable', 'integer'], 'is_active' => ['nullable', 'boolean']]);
        $vc = VehicleClass::create($data);
        activity('catalog')->causedBy($request->user())->performedOn($vc)->log('create_vehicle_class');

        return response()->json(['data' => $vc], 201);
    }

    public function updateVehicleClass(Request $request, VehicleClass $vehicleClass)
    {
        $data = $request->validate(['name_id' => ['sometimes', 'string'], 'name_en' => ['sometimes', 'string'], 'example_vehicles' => ['nullable', 'string'], 'max_passengers' => ['sometimes', 'integer', 'min:1'], 'max_luggage' => ['sometimes', 'integer', 'min:0'], 'sort_order' => ['nullable', 'integer'], 'is_active' => ['nullable', 'boolean']]);
        $vehicleClass->update($data);
        activity('catalog')->causedBy($request->user())->performedOn($vehicleClass)->withProperties($data)->log('update_vehicle_class');

        return response()->json(['data' => $vehicleClass]);
    }

    public function vehicles(Request $request)
    {
        return response()->json(['data' => Vehicle::query()->with(['driver.user:id,name', 'vehicleClass'])->when($request->query('q'), fn ($q, $s) => $q->where('plate_number', 'like', "%{$s}%"))->latest('id')->paginate(50)]);
    }

    public function updateVehicle(Request $request, Vehicle $vehicle)
    {
        $data = $request->validate(['status' => ['sometimes', 'in:pending,active,inactive'], 'has_child_seat' => ['sometimes', 'boolean'], 'has_roof_rack' => ['sometimes', 'boolean'], 'vehicle_class_id' => ['sometimes', 'integer', 'exists:vehicle_classes,id'], 'stnk_expires_at' => ['nullable', 'date'], 'kir_expires_at' => ['nullable', 'date']]);
        $vehicle->update($data);
        activity('catalog')->causedBy($request->user())->performedOn($vehicle)->withProperties($data)->log('update_vehicle');

        return response()->json(['data' => $vehicle->load('vehicleClass')]);
    }

    public function zones()
    {
        return response()->json(['data' => Zone::query()->orderBy('sort_order')->withCount('locations')->get()]);
    }

    public function storeZone(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:10', 'unique:zones,code'], 'name' => ['required', 'string'], 'description' => ['nullable', 'string'], 'sort_order' => ['nullable', 'integer'], 'is_active' => ['nullable', 'boolean']]);
        $zone = Zone::create($data);
        activity('catalog')->causedBy($request->user())->performedOn($zone)->log('create_zone');

        return response()->json(['data' => $zone], 201);
    }

    public function updateZone(Request $request, Zone $zone)
    {
        $data = $request->validate(['name' => ['sometimes', 'string'], 'description' => ['nullable', 'string'], 'sort_order' => ['nullable', 'integer'], 'is_active' => ['nullable', 'boolean']]);
        $zone->update($data);
        activity('catalog')->causedBy($request->user())->performedOn($zone)->withProperties($data)->log('update_zone');

        return response()->json(['data' => $zone]);
    }

    public function locations(Request $request)
    {
        $items = Location::query()->with('zone')->when($request->query('type'), fn ($q, $t) => $q->where('type', $t))->orderBy('zone_id')->orderBy('sort_order')->get()->map(fn (Location $l) => $l->toArray() + ['photo_url' => FileController::signedUrl($l->photo_path)]);

        return response()->json(['data' => $items]);
    }

    public function storeLocation(Request $request)
    {
        $data = $this->validateLocation($request);
        $loc = Location::create($data);
        activity('catalog')->causedBy($request->user())->performedOn($loc)->log('create_location');

        return response()->json(['data' => $loc], 201);
    }

    public function updateLocation(Request $request, Location $location)
    {
        $data = $this->validateLocation($request, false);
        $location->update($data);
        activity('catalog')->causedBy($request->user())->performedOn($location)->withProperties($data)->log('update_location');

        return response()->json(['data' => $location->fresh()]);
    }

    public function uploadLocationPhoto(Request $request, Location $location)
    {
        $request->validate(['file' => ['required', 'image', 'max:5120']]);
        $location->update(['photo_path' => $request->file('file')->store('locations')]);

        return response()->json(['data' => $location->toArray() + ['photo_url' => FileController::signedUrl($location->photo_path)]]);
    }

    private function validateLocation(Request $request, bool $create = true): array
    {
        $req = $create ? 'required' : 'sometimes';

        return $request->validate([
            'zone_id' => ['nullable', 'integer', 'exists:zones,id'], 'parent_id' => ['nullable', 'integer', 'exists:locations,id'],
            'type' => [$req, 'in:port,meeting_point,poi,airport,harbor,area'], 'name_id' => [$req, 'string', 'max:150'], 'name_en' => ['nullable', 'string', 'max:150'],
            'aliases' => ['nullable', 'array'], 'lat' => ['nullable', 'numeric'], 'lng' => ['nullable', 'numeric'], 'distance_km_est' => ['nullable', 'numeric'], 'duration_min_est' => ['nullable', 'integer'],
            'instructions_id' => ['nullable', 'string'], 'instructions_en' => ['nullable', 'string'], 'is_origin' => ['nullable', 'boolean'], 'is_active' => ['nullable', 'boolean'], 'sort_order' => ['nullable', 'integer'],
        ]);
    }

    public function ferryRoutes()
    {
        return response()->json(['data' => FerryRoute::query()->get()]);
    }

    public function storeFerryRoute(Request $request)
    {
        $data = $request->validate(['name' => ['required', 'string'], 'operator' => ['required', 'string'], 'origin_port' => ['required', 'string'], 'crossing_min_min' => ['required', 'integer', 'min:1'], 'crossing_min_max' => ['required', 'integer', 'gte:crossing_min_min'], 'schedule_timezone' => ['nullable', 'in:WIB,WITA,WIT'], 'is_active' => ['nullable', 'boolean']]);

        return response()->json(['data' => FerryRoute::create($data)], 201);
    }

    public function updateFerryRoute(Request $request, FerryRoute $ferryRoute)
    {
        $data = $request->validate(['name' => ['sometimes', 'string'], 'operator' => ['sometimes', 'string'], 'origin_port' => ['sometimes', 'string'], 'crossing_min_min' => ['sometimes', 'integer', 'min:1'], 'crossing_min_max' => ['sometimes', 'integer'], 'schedule_timezone' => ['nullable', 'in:WIB,WITA,WIT'], 'is_active' => ['nullable', 'boolean']]);
        $ferryRoute->update($data);

        return response()->json(['data' => $ferryRoute]);
    }

    /** Current tariff matrix plus future (scheduled) rules. */
    public function tariffs(Request $request, QuoteService $quotes)
    {
        $at = $request->query('at') ? Carbon::parse($request->query('at')) : now();
        $classes = VehicleClass::query()->orderBy('sort_order')->get();
        $rows = Zone::query()->orderBy('sort_order')->get()->map(function (Zone $zone) use ($classes, $at) {
            $active = Tariff::query()->where('zone_id', $zone->id)->where('service_type', 'transfer_oneway')->activeAt($at)->orderByDesc('valid_from')->get()->unique('vehicle_class_id')->keyBy('vehicle_class_id');

            return ['zone' => $zone, 'prices' => $classes->mapWithKeys(fn ($c) => [$c->code => $active->get($c->id)?->base_price])->all()];
        });
        $upcoming = Tariff::query()->with(['zone', 'vehicleClass'])->where('valid_from', '>', now())->orderBy('valid_from')->get();

        return response()->json(['data' => ['classes' => $classes, 'rows' => $rows, 'upcoming' => $upcoming, 'history' => Tariff::query()->with(['zone', 'vehicleClass', 'creator:id,name'])->latest('valid_from')->limit(100)->get()]]);
    }

    /** Publish a set of tariff rules with one valid_from (FR-ADM-17). */
    public function storeTariffs(Request $request)
    {
        $data = $request->validate([
            'valid_from' => ['required', 'date', 'after_or_equal:now'],
            'service_type' => ['nullable', 'in:transfer_oneway'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.zone_id' => ['required', 'integer', 'exists:zones,id'],
            'rules.*.vehicle_class' => ['required', 'string', 'exists:vehicle_classes,code'],
            'rules.*.base_price' => ['required', 'integer', 'min:0'],
        ]);
        $validFrom = Carbon::parse($data['valid_from']);
        $classes = VehicleClass::pluck('id', 'code');
        $created = [];
        foreach ($data['rules'] as $rule) {
            $created[] = Tariff::updateOrCreate(
                ['zone_id' => $rule['zone_id'], 'vehicle_class_id' => $classes[$rule['vehicle_class']], 'service_type' => $data['service_type'] ?? 'transfer_oneway', 'valid_from' => $validFrom],
                ['base_price' => $rule['base_price'], 'created_by' => $request->user()->id]
            );
        }
        activity('tariffs')->causedBy($request->user())->withProperties(['valid_from' => $validFrom->toIso8601String(), 'rules' => $data['rules']])->log('publish_tariffs');

        return response()->json(['data' => $created], 201);
    }

    public function previewTariff(Request $request, QuoteService $quotes)
    {
        $data = $request->validate(['zone_id' => ['required', 'integer'], 'pickup_at' => ['required', 'date'], 'passengers' => ['nullable', 'integer'], 'child_seats' => ['nullable', 'integer'], 'needs_roof_rack' => ['nullable', 'boolean']]);

        return response()->json(['data' => $quotes->quote(['zone_id' => $data['zone_id'], 'pickup_at' => $data['pickup_at'], 'passengers' => $data['passengers'] ?? 1, 'child_seats' => $data['child_seats'] ?? 0, 'needs_roof_rack' => $data['needs_roof_rack'] ?? false])]);
    }

    public function surcharges()
    {
        return response()->json(['data' => Surcharge::query()->with('vehicleClass:id,code,name_id')->orderBy('code')->get()]);
    }

    public function storeSurcharge(Request $request)
    {
        $data = $this->validateSurcharge($request);
        $s = Surcharge::create($data);
        activity('tariffs')->causedBy($request->user())->performedOn($s)->log('create_surcharge');

        return response()->json(['data' => $s], 201);
    }

    public function updateSurcharge(Request $request, Surcharge $surcharge)
    {
        $data = $this->validateSurcharge($request, false);
        $surcharge->update($data);
        activity('tariffs')->causedBy($request->user())->performedOn($surcharge)->withProperties($data)->log('update_surcharge');

        return response()->json(['data' => $surcharge]);
    }

    private function validateSurcharge(Request $request, bool $create = true): array
    {
        $req = $create ? 'required' : 'sometimes';

        return $request->validate(['code' => [$req, 'in:night,holiday,waiting,child_seat,roof_rack,extra_stop'], 'name_id' => [$req, 'string'], 'name_en' => [$req, 'string'], 'calc_type' => [$req, 'in:flat,percent,per_unit'], 'amount' => [$req, 'integer', 'min:0'], 'unit_minutes' => ['nullable', 'integer'], 'vehicle_class_id' => ['nullable', 'integer', 'exists:vehicle_classes,id'], 'applies_from' => ['nullable', 'date_format:H:i'], 'applies_to' => ['nullable', 'date_format:H:i'], 'is_active' => ['nullable', 'boolean']]);
    }

    public function holidays()
    {
        return response()->json(['data' => HolidayDate::query()->orderBy('date')->get()]);
    }

    public function storeHoliday(Request $request)
    {
        $data = $request->validate(['date' => ['required', 'date', 'unique:holiday_dates,date'], 'name' => ['required', 'string']]);

        return response()->json(['data' => HolidayDate::create($data)], 201);
    }

    public function deleteHoliday(HolidayDate $holiday)
    {
        $holiday->delete();

        return response()->json(['data' => ['ok' => true]]);
    }
}
