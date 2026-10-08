<?php

use App\Services\DispatchEngine;
use App\Services\DriverOnboardingService;
use App\Services\MaintenanceService;
use App\Services\PaymentService;
use App\Services\TripService;
use Illuminate\Support\Facades\Schedule;

// Scheduler (PRD Bab 12.9). Times are UTC; WITA = UTC+8.
Schedule::call(fn () => app(DispatchEngine::class)->tick())->everyMinute()->name('dispatch:tick')->withoutOverlapping();
Schedule::call(fn () => app(PaymentService::class)->expireOverdue())->everyFiveMinutes()->name('payments:expire')->withoutOverlapping();
Schedule::call(fn () => app(MaintenanceService::class)->sendPreArrivalReminders())->everyTenMinutes()->name('reminders:pre-arrival');
Schedule::call(fn () => app(MaintenanceService::class)->sendDayBeforeReminders())->dailyAt('12:00')->name('reminders:day-before'); // 20.00 WITA
Schedule::call(fn () => app(TripService::class)->autoCompleteStale())->everyThirtyMinutes()->name('trips:auto-complete');
Schedule::call(fn () => app(DriverOnboardingService::class)->checkDocumentExpiry())->dailyAt('22:00')->name('documents:expiry'); // 06.00 WITA
Schedule::call(fn () => app(MaintenanceService::class)->preparePayouts())->weeklyOn(0, '23:00')->name('payouts:prepare'); // Senin 07.00 WITA
Schedule::call(fn () => app(MaintenanceService::class)->purgeExpiredData())->dailyAt('19:00')->name('data:purge'); // 03.00 WITA
