<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = ['value' => 'array'];

    /** Keys that admins may override at runtime (mirrors config/lembar.php). */
    public const EDITABLE = [
        'commission_rate', 'waiting.free_minutes', 'waiting.no_show_grace_minutes', 'cancellation.tiers',
        'ledger.balance_threshold', 'ledger.top_up_min', 'ledger.payout_min', 'dispatch.waves', 'dispatch.lead_hours',
        'dispatch.retry_minutes', 'payment.manual_expiry_hours', 'payment.manual_cutoff_hours', 'payment.manual_min_lead_hours',
        'payment.gateway_enabled', 'verification_sla_hours', 'admin_2fa_required',
    ];

    /** Read a business setting: database override, else config('lembar.*'). */
    public static function value(string $key, mixed $default = null): mixed
    {
        $all = Cache::remember('lembar.settings', 60, fn () => static::query()->pluck('value', 'key')->all());
        if (array_key_exists($key, $all)) {
            return $all[$key]['v'] ?? $all[$key];
        }

        return config('lembar.'.$key, $default);
    }

    public static function put(string $key, mixed $value, ?int $userId = null): void
    {
        static::updateOrCreate(['key' => $key], ['value' => ['v' => $value], 'updated_by' => $userId]);
        Cache::forget('lembar.settings');
    }

    /** @return array<string, mixed> effective values for all editable keys */
    public static function effective(): array
    {
        $out = [];
        foreach (self::EDITABLE as $key) {
            $out[$key] = static::value($key);
        }

        return $out;
    }
}
