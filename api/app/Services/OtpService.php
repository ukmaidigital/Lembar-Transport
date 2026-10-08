<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\OtpCode;
use Illuminate\Support\Facades\Hash;

/** WhatsApp/SMS one-time passwords (PRD US-03): 6 digits, 5 minutes, 3 attempts, 5 requests per hour. */
class OtpService
{
    public function __construct(private NotificationService $notifications) {}

    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/[^0-9+]/', '', trim($phone));
        if (str_starts_with($digits, '0')) {
            $digits = '+62'.substr($digits, 1);
        } elseif (str_starts_with($digits, '62')) {
            $digits = '+'.$digits;
        } elseif (! str_starts_with($digits, '+')) {
            $digits = '+'.$digits;
        }

        return $digits;
    }

    /** @return array{expires_at:string, debug_code?:string} */
    public function request(string $phone, string $purpose = 'login'): array
    {
        $phone = self::normalizePhone($phone);
        $recent = OtpCode::query()->where('phone', $phone)->where('created_at', '>=', now()->subHour())->count();
        if ($recent >= (int) config('lembar.otp.per_hour')) {
            throw new BusinessRuleException('OTP_RATE_LIMITED', 'Terlalu banyak permintaan OTP. Coba lagi dalam satu jam.', 429);
        }
        $length = (int) config('lembar.otp.length');
        $code = str_pad((string) random_int(0, (10 ** $length) - 1), $length, '0', STR_PAD_LEFT);
        $otp = OtpCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'purpose' => $purpose,
            'expires_at' => now()->addMinutes((int) config('lembar.otp.ttl_minutes')),
            'created_at' => now(),
        ]);
        $this->notifications->otp($phone, $code);
        $out = ['phone' => $phone, 'expires_at' => $otp->expires_at->toIso8601String()];
        if (config('lembar.otp.expose_in_response')) {
            $out['debug_code'] = $code;
        }

        return $out;
    }

    public function verify(string $phone, string $code, string $purpose = 'login'): bool
    {
        $phone = self::normalizePhone($phone);
        $otp = OtpCode::query()->where('phone', $phone)->where('purpose', $purpose)->whereNull('consumed_at')
            ->where('expires_at', '>', now())->latest('id')->first();
        if (! $otp) {
            throw new BusinessRuleException('OTP_INVALID', 'Kode OTP tidak ditemukan atau sudah kedaluwarsa.', 422);
        }
        if ($otp->attempts >= (int) config('lembar.otp.max_attempts')) {
            throw new BusinessRuleException('OTP_LOCKED', 'Terlalu banyak percobaan. Minta kode baru.', 422);
        }
        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');
            throw new BusinessRuleException('OTP_INVALID', 'Kode OTP salah.', 422);
        }
        $otp->update(['consumed_at' => now()]);

        return true;
    }
}
