<?php

namespace App\Http\Controllers\Driver;

use App\Enums\DriverStatus;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Resources\DriverResource;
use App\Models\DriverAvailability;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AvailabilityController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate(['is_online' => ['sometimes', 'boolean'], 'lat' => ['nullable', 'numeric'], 'lng' => ['nullable', 'numeric']]);
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        if (($data['is_online'] ?? false) && $driver->status !== DriverStatus::Active) {
            throw new BusinessRuleException('DRIVER_NOT_ACTIVE', 'Akun belum aktif; selesaikan verifikasi terlebih dahulu.', 409);
        }
        $driver->fill(['last_seen_at' => now()]);
        if (array_key_exists('is_online', $data)) {
            $driver->is_online = $data['is_online'];
        }
        if (isset($data['lat'], $data['lng'])) {
            $driver->last_lat = $data['lat'];
            $driver->last_lng = $data['lng'];
        }
        $driver->save();

        return new DriverResource($driver->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount']));
    }

    public function blockedDates(Request $request)
    {
        $driver = $request->user()->driver;

        return response()->json(['data' => $driver ? $driver->availability()->where('is_blocked', true)->where('date', '>=', now()->subDay()->toDateString())->orderBy('date')->pluck('date')->map->toDateString() : []]);
    }

    public function setBlockedDates(Request $request)
    {
        $data = $request->validate(['dates' => ['present', 'array', 'max:366'], 'dates.*' => ['date']]);
        $driver = $request->user()->driver;
        abort_unless($driver, 404);
        $dates = collect($data['dates'])->map(fn ($d) => Carbon::parse($d)->toDateString())->unique()->values();
        $driver->availability()->where('date', '>=', now()->subDay()->toDateString())->whereNotIn('date', $dates)->delete();
        foreach ($dates as $date) {
            DriverAvailability::updateOrCreate(['driver_id' => $driver->id, 'date' => $date], ['is_blocked' => true]);
        }

        return response()->json(['data' => $dates]);
    }
}
