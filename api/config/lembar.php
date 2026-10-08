<?php

/*
 * Business rules from the PRD (Bab 6, 9). Values marked "setting" can be
 * overridden at runtime through the admin settings screen (table `settings`).
 */
return [
    'timezone' => 'Asia/Makassar', // WITA
    'currency' => 'IDR',
    'rounding' => 1000,

    'commission_rate' => 0.15, // setting
    'quote_ttl_minutes' => 30,
    'contact_window_hours' => 24,
    'vehicle_max_age_years' => 10,

    'dispatch' => [
        'lead_hours' => 48,               // start dispatch at T-48h (or immediately when closer)
        'waves' => [                      // [max drivers (null = all eligible), timeout seconds]
            [5, 120],
            [10, 120],
            [null, 180],
        ],
        'instant_waves' => [[null, 60], [null, 60]],
        'instant_radius_km' => 3,
        'instant_online_minutes' => 10,
        'retry_minutes' => 30,            // re-run waves every 30 min while needs_attention
        'retry_until_hours' => 6,         // ... until T-6h
        'overlap_buffer_minutes' => 60,
        'score_weights' => ['rating' => 0.4, 'acceptance' => 0.2, 'on_time' => 0.2, 'idle' => 0.2],
    ],

    'waiting' => [
        'free_minutes' => 60,             // setting
        'no_show_grace_minutes' => 30,
        'min_contact_attempts' => 3,
        'estimate_buffer_minutes' => 60,  // anchor fallback: eta_max + buffer
        'auto_complete_hours' => 6,
    ],

    'payment' => [
        'manual_expiry_hours' => 2,
        'manual_cutoff_hours' => 6,       // never later than T-6h
        'manual_min_lead_hours' => 8,     // manual transfer only when pickup >= 8h away
        'gateway_enabled' => env('LEMBAR_GATEWAY_ENABLED', false),
        'bank_account' => [
            'bank' => env('LEMBAR_BANK_NAME', 'BCA'),
            'number' => env('LEMBAR_BANK_NUMBER', '1234567890'),
            'holder' => env('LEMBAR_BANK_HOLDER', 'PT Lembar Transport'),
        ],
    ],

    'cancellation' => [
        // [minimum hours before pickup, fee percent]
        'tiers' => [[24, 0], [6, 50], [0, 100]],  // setting
        'driver_compensation_percent' => 50,
    ],

    'ledger' => [
        'balance_threshold' => -100000,   // setting
        'top_up_min' => 50000,
        'payout_min' => 50000,
        'payout_weekday' => 1,            // Monday
    ],

    'otp' => [
        'length' => 6,
        'ttl_minutes' => 5,
        'max_attempts' => 3,
        'per_hour' => 5,
        'expose_in_response' => env('LEMBAR_OTP_EXPOSE', env('APP_ENV') !== 'production'),
    ],

    'tokens' => [
        'customer_days' => 30,
        'driver_days' => 30,
        'admin_hours' => 8,
    ],

    'admin_2fa_required' => env('LEMBAR_ADMIN_2FA_REQUIRED', false),

    'verification_sla_hours' => 24,
    'document_expiry_reminders_days' => [30, 7, 1],

    'notifications' => [
        'driver' => env('LEMBAR_NOTIFICATION_DRIVER', 'log'), // log | whatsapp | ...
    ],

    'web_url' => env('LEMBAR_WEB_URL', 'http://localhost:3000'),
];
