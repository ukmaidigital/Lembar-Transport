<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Setting::effective(), 'meta' => ['editable' => Setting::EDITABLE]]);
    }

    public function update(Request $request)
    {
        $data = $request->validate(['settings' => ['required', 'array']]);
        $changed = [];
        foreach ($data['settings'] as $key => $value) {
            if (! in_array($key, Setting::EDITABLE, true)) {
                continue;
            }
            $value = $this->coerce($key, $value);
            $changed[$key] = ['from' => Setting::value($key), 'to' => $value];
            Setting::put($key, $value, $request->user()->id);
        }
        activity('settings')->causedBy($request->user())->withProperties($changed)->log('update_settings');

        return response()->json(['data' => Setting::effective()]);
    }

    private function coerce(string $key, mixed $value): mixed
    {
        return match (true) {
            $key === 'commission_rate' => max(0, min(1, (float) $value)),
            in_array($key, ['cancellation.tiers', 'dispatch.waves'], true) => is_array($value) ? $value : json_decode((string) $value, true),
            in_array($key, ['payment.gateway_enabled', 'admin_2fa_required'], true) => filter_var($value, FILTER_VALIDATE_BOOL),
            default => is_numeric($value) ? (int) $value : $value,
        };
    }
}
