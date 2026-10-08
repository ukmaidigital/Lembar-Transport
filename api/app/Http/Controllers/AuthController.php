<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Exceptions\BusinessRuleException;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use App\Services\OtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    public function requestOtp(Request $request, OtpService $otp)
    {
        $data = $request->validate(['phone' => ['required', 'string', 'min:8', 'max:20'], 'purpose' => ['nullable', 'in:login,register_driver']]);

        return response()->json(['data' => $otp->request($data['phone'], $data['purpose'] ?? 'login')]);
    }

    /** Verify OTP and issue a token. role=customer (default) or driver (creates the driver account on first login). */
    public function verifyOtp(Request $request, OtpService $otp, AuthService $auth)
    {
        $data = $request->validate([
            'phone' => ['required', 'string'], 'code' => ['required', 'string', 'size:'.config('lembar.otp.length')],
            'role' => ['nullable', 'in:customer,driver'], 'name' => ['nullable', 'string', 'max:120'], 'locale' => ['nullable', 'in:id,en'],
            'purpose' => ['nullable', 'in:login,register_driver'],
        ]);
        $otp->verify($data['phone'], $data['code'], $data['purpose'] ?? 'login');
        $phone = OtpService::normalizePhone($data['phone']);
        $role = UserRole::from($data['role'] ?? 'customer');
        $existing = User::query()->where('phone', $phone)->first();
        if ($existing && $existing->role !== $role) {
            if ($existing->isAdmin()) {
                throw new BusinessRuleException('ROLE_MISMATCH', 'Akun admin masuk melalui halaman admin.', 403);
            }
            if ($role === UserRole::Driver && $existing->isCustomer()) {
                $existing->update(['role' => UserRole::Driver]); // customer becomes a driver applicant
            } elseif ($role === UserRole::Customer && $existing->isDriver()) {
                $role = UserRole::Driver; // a driver logging in on the customer site keeps the driver account
            }
        }
        $user = $auth->findOrCreateByPhone($phone, $role, $data['name'] ?? null, $data['locale'] ?? null);
        if (! empty($data['name']) && str_starts_with($user->name, 'Pengguna ')) {
            $user->update(['name' => $data['name']]);
        }
        if ($user->status !== 'active') {
            throw new BusinessRuleException('ACCOUNT_BLOCKED', 'Akun Anda diblokir. Hubungi dukungan.', 403);
        }
        $token = $auth->issueToken($user, $request->header('X-Device', 'web'));

        return response()->json(['data' => ['token' => $token->plainTextToken, 'expires_at' => $token->accessToken->expires_at?->toIso8601String(), 'user' => new UserResource($user->load('driver'))]]);
    }

    public function adminLogin(Request $request, AuthService $auth)
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::query()->where('email', $data['email'])->where('role', UserRole::Admin->value)->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw new BusinessRuleException('INVALID_CREDENTIALS', 'Email atau kata sandi salah.', 401);
        }
        if ($user->status !== 'active') {
            throw new BusinessRuleException('ACCOUNT_BLOCKED', 'Akun dinonaktifkan.', 403);
        }
        if ($user->hasTwoFactorEnabled() || config('lembar.admin_2fa_required')) {
            if (! $user->hasTwoFactorEnabled()) {
                // 2FA is required but not yet set up: issue a short token so the admin can enrol first.
                $token = $auth->issueToken($user, 'admin-setup');

                return response()->json(['data' => ['token' => $token->plainTextToken, 'requires_totp_setup' => true, 'user' => new UserResource($user)]]);
            }
            $challenge = 'ch_'.Str::random(40);
            Cache::put('totp-challenge:'.$challenge, $user->id, now()->addMinutes(5));

            return response()->json(['data' => ['requires_totp' => true, 'challenge' => $challenge]]);
        }
        $token = $auth->issueToken($user, 'admin');

        return response()->json(['data' => ['token' => $token->plainTextToken, 'expires_at' => $token->accessToken->expires_at?->toIso8601String(), 'user' => new UserResource($user)]]);
    }

    public function adminTotp(Request $request, AuthService $auth)
    {
        $data = $request->validate(['challenge' => ['required', 'string'], 'code' => ['required', 'digits:6']]);
        $userId = Cache::get('totp-challenge:'.$data['challenge']);
        $user = $userId ? User::find($userId) : null;
        if (! $user || ! (new Google2FA)->verifyKey($user->two_factor_secret, $data['code'])) {
            throw new BusinessRuleException('TOTP_INVALID', 'Kode autentikator salah atau tantangan kedaluwarsa.', 401);
        }
        Cache::forget('totp-challenge:'.$data['challenge']);
        $token = $auth->issueToken($user, 'admin');

        return response()->json(['data' => ['token' => $token->plainTextToken, 'expires_at' => $token->accessToken->expires_at?->toIso8601String(), 'user' => new UserResource($user)]]);
    }

    public function enableTotp(Request $request)
    {
        $g = new Google2FA;
        $secret = $g->generateSecretKey();
        $user = $request->user();
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        return response()->json(['data' => ['secret' => $secret, 'otpauth_url' => $g->getQRCodeUrl('Lembar Transport', $user->email, $secret)]]);
    }

    public function confirmTotp(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $user = $request->user();
        if (! $user->two_factor_secret || ! (new Google2FA)->verifyKey($user->two_factor_secret, $data['code'])) {
            throw new BusinessRuleException('TOTP_INVALID', 'Kode autentikator salah.', 422);
        }
        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        return response()->json(['data' => new UserResource($user)]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['data' => ['ok' => true]]);
    }

    public function me(Request $request)
    {
        return response()->json(['data' => new UserResource($request->user()->load('driver'))]);
    }

    public function updateMe(Request $request)
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:120'], 'email' => ['sometimes', 'nullable', 'email', 'max:190'], 'locale' => ['sometimes', 'in:id,en']]);
        $request->user()->update($data);

        return response()->json(['data' => new UserResource($request->user()->fresh())]);
    }
}
