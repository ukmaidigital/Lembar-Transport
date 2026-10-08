<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/** Helpers for the product time zone (WITA, UTC+8). Storage stays in UTC. */
final class Wita
{
    public static function tz(): string
    {
        return config('lembar.timezone', 'Asia/Makassar');
    }

    public static function of(CarbonInterface|string $value): Carbon
    {
        return Carbon::parse($value)->setTimezone(self::tz());
    }

    public static function roundUp(int $amount, ?int $step = null): int
    {
        $step = $step ?: (int) config('lembar.rounding', 1000);

        return (int) (ceil($amount / $step) * $step);
    }

    public static function money(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }
}
