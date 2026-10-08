<?php

use App\Http\Controllers\Admin\AuditController;
use App\Http\Controllers\Admin\CatalogController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DriverAdminController;
use App\Http\Controllers\Admin\LedgerAdminController;
use App\Http\Controllers\Admin\OrderAdminController;
use App\Http\Controllers\Admin\PaymentAdminController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Customer\OrderController;
use App\Http\Controllers\Driver\ApplicationController;
use App\Http\Controllers\Driver\AvailabilityController;
use App\Http\Controllers\Driver\LedgerController;
use App\Http\Controllers\Driver\OfferController;
use App\Http\Controllers\Driver\TripController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PublicController;
use Illuminate\Support\Facades\Route;

// ---- Publik (PRD 14.1)
Route::prefix('public')->middleware('throttle:60,1,public')->group(function () {
    Route::get('vehicle-classes', [PublicController::class, 'vehicleClasses']);
    Route::get('zones', [PublicController::class, 'zones']);
    Route::get('locations', [PublicController::class, 'locations']);
    Route::get('ferry-routes', [PublicController::class, 'ferryRoutes']);
    Route::get('meeting-points', [PublicController::class, 'meetingPoints']);
    Route::get('tariffs', [PublicController::class, 'tariffs']);
    Route::get('policies', [PublicController::class, 'policies']);
    Route::post('quotes', [PublicController::class, 'quote']);
});

// ---- Autentikasi
Route::prefix('auth')->group(function () {
    Route::post('otp/request', [AuthController::class, 'requestOtp'])->middleware('throttle:10,1,otp_request');
    Route::post('otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:20,1,otp_verify');
    Route::post('admin/login', [AuthController::class, 'adminLogin'])->middleware('throttle:10,1,admin_login');
    Route::post('admin/totp', [AuthController::class, 'adminTotp'])->middleware('throttle:10,1,admin_totp');
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'updateMe']);
        Route::post('totp/enable', [AuthController::class, 'enableTotp'])->middleware('abilities:admin');
        Route::post('totp/confirm', [AuthController::class, 'confirmTotp'])->middleware('abilities:admin');
    });
});

// ---- Berkas privat (URL bertanda tangan 5 menit)
Route::get('files/{path}', [FileController::class, 'show'])->where('path', '.*')->name('files.show')->middleware('signed');

// ---- Customer (PRD 14.2); tiket dapat dibuka dengan kode + 4 digit telepon tanpa login
Route::middleware('throttle:120,1,customer')->group(function () {
    Route::post('orders', [OrderController::class, 'store'])->middleware('auth:sanctum');
    Route::get('orders', [OrderController::class, 'index'])->middleware(['auth:sanctum', 'abilities:customer']);
    Route::get('orders/{code}', [OrderController::class, 'show']);
    Route::get('orders/{code}/payment-instructions', [OrderController::class, 'paymentInstructions']);
    Route::post('orders/{code}/payment-proof', [OrderController::class, 'paymentProof']);
    Route::post('orders/{code}/docked', [OrderController::class, 'docked']);
    Route::get('orders/{code}/cancellation-preview', [OrderController::class, 'cancellationPreview']);
    Route::post('orders/{code}/cancel', [OrderController::class, 'cancel']);
    Route::post('orders/{code}/rating', [OrderController::class, 'rating']);
});

// ---- Notifikasi in-app (semua peran)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'read']);
    Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
});

// ---- Driver (PRD 14.3)
Route::prefix('driver')->middleware(['auth:sanctum', 'abilities:driver', 'throttle:120,1,driver'])->group(function () {
    Route::post('applications', [ApplicationController::class, 'start']);
    Route::patch('applications/current', [ApplicationController::class, 'update']);
    Route::post('applications/current/submit', [ApplicationController::class, 'submit']);
    Route::get('me', [ApplicationController::class, 'me']);
    Route::get('documents', [ApplicationController::class, 'documents']);
    Route::post('documents', [ApplicationController::class, 'uploadDocument']);
    Route::get('documents/{document}/url', [ApplicationController::class, 'documentUrl']);
    Route::patch('availability', [AvailabilityController::class, 'update']);
    Route::get('blocked-dates', [AvailabilityController::class, 'blockedDates']);
    Route::put('blocked-dates', [AvailabilityController::class, 'setBlockedDates']);
    Route::get('offers', [OfferController::class, 'index']);
    Route::post('offers/{offer}/accept', [OfferController::class, 'accept']);
    Route::post('offers/{offer}/decline', [OfferController::class, 'decline']);
    Route::get('trips', [TripController::class, 'index']);
    Route::get('trips/{code}', [TripController::class, 'show']);
    Route::post('trips/{code}/status', [TripController::class, 'status']);
    Route::post('trips/{code}/no-show', [TripController::class, 'noShow']);
    Route::post('trips/{code}/withdraw', [TripController::class, 'withdraw']);
    Route::post('trips/{code}/issues', [TripController::class, 'issue']);
    Route::get('ledger', [LedgerController::class, 'index']);
    Route::post('top-ups', [LedgerController::class, 'topUp']);
    Route::get('top-ups', [LedgerController::class, 'topUps']);
    Route::get('payouts', [LedgerController::class, 'payouts']);
});

// ---- Admin (PRD 14.4)
Route::prefix('admin')->middleware(['auth:sanctum', 'abilities:admin', 'throttle:300,1,admin'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index']);

    Route::middleware('permission:drivers.view')->group(function () {
        Route::get('driver-applications', [DriverAdminController::class, 'applications']);
        Route::get('drivers', [DriverAdminController::class, 'index']);
        Route::get('drivers/{driver}', [DriverAdminController::class, 'show']);
        Route::get('drivers/{driver}/documents/{document}/url', [DriverAdminController::class, 'documentUrl']);
    });
    Route::middleware('permission:drivers.verify')->group(function () {
        Route::post('drivers/{driver}/documents/{document}/review', [DriverAdminController::class, 'reviewDocument']);
        Route::post('drivers/{driver}/decision', [DriverAdminController::class, 'decide']);
    });
    Route::middleware('permission:drivers.manage')->group(function () {
        Route::post('drivers', [DriverAdminController::class, 'store']);
        Route::patch('drivers/{driver}', [DriverAdminController::class, 'update']);
        Route::post('drivers/{driver}/documents', [DriverAdminController::class, 'uploadDocument']);
        Route::post('drivers/{driver}/suspend', [DriverAdminController::class, 'suspend']);
        Route::post('drivers/{driver}/reactivate', [DriverAdminController::class, 'reactivate']);
        Route::post('drivers/{driver}/notes', [DriverAdminController::class, 'addNote']);
    });
    Route::middleware('permission:fleet.manage')->group(function () {
        Route::get('vehicle-classes', [CatalogController::class, 'vehicleClasses']);
        Route::post('vehicle-classes', [CatalogController::class, 'storeVehicleClass']);
        Route::patch('vehicle-classes/{vehicleClass}', [CatalogController::class, 'updateVehicleClass']);
        Route::get('vehicles', [CatalogController::class, 'vehicles']);
        Route::patch('vehicles/{vehicle}', [CatalogController::class, 'updateVehicle']);
    });

    Route::middleware('permission:orders.view')->group(function () {
        Route::get('orders', [OrderAdminController::class, 'index']);
        Route::get('orders/needs-attention', [OrderAdminController::class, 'needsAttention']);
        Route::get('orders/{code}', [OrderAdminController::class, 'show']);
        Route::get('orders/{code}/eligible-drivers', [OrderAdminController::class, 'eligibleDrivers']);
        Route::get('drivers-online', [OrderAdminController::class, 'driversOnline']);
    });
    Route::middleware('permission:orders.manage')->group(function () {
        Route::post('orders', [OrderAdminController::class, 'store']);
        Route::post('orders/{code}/cancel', [OrderAdminController::class, 'cancel']);
        Route::post('orders/{code}/no-show/confirm', [OrderAdminController::class, 'confirmNoShow']);
        Route::patch('orders/{code}/docked', [OrderAdminController::class, 'docked']);
        Route::post('orders/{code}/waiting-fee/approve', [OrderAdminController::class, 'approveWaitingFee']);
        Route::post('orders/{code}/issues/{issue}/resolve', [OrderAdminController::class, 'resolveIssue']);
    });
    Route::middleware('permission:orders.assign')->group(function () {
        Route::post('orders/{code}/assign', [OrderAdminController::class, 'assign']);
        Route::post('orders/{code}/unassign', [OrderAdminController::class, 'unassign']);
        Route::post('orders/{code}/redispatch', [OrderAdminController::class, 'redispatch']);
    });

    Route::middleware('permission:payments.confirm')->group(function () {
        Route::get('payments', [PaymentAdminController::class, 'index']);
        Route::get('payments/{payment}/proof-url', [PaymentAdminController::class, 'proofUrl']);
        Route::post('payments/{payment}/confirm', [PaymentAdminController::class, 'confirm']);
        Route::post('payments/{payment}/reject', [PaymentAdminController::class, 'reject']);
    });
    Route::middleware('permission:payments.refund')->group(function () {
        Route::get('refunds', [PaymentAdminController::class, 'refunds']);
        Route::post('refunds', [PaymentAdminController::class, 'storeRefund']);
        Route::patch('refunds/{refund}', [PaymentAdminController::class, 'updateRefund']);
    });
    Route::middleware('permission:ledger.manage')->group(function () {
        Route::get('ledger', [LedgerAdminController::class, 'index']);
        Route::post('ledger/adjustments', [LedgerAdminController::class, 'adjust']);
        Route::get('top-ups', [LedgerAdminController::class, 'topUps']);
        Route::get('top-ups/{topUp}/proof-url', [LedgerAdminController::class, 'topUpProofUrl']);
        Route::post('top-ups/{topUp}/confirm', [LedgerAdminController::class, 'confirmTopUp']);
        Route::post('top-ups/{topUp}/reject', [LedgerAdminController::class, 'rejectTopUp']);
    });
    Route::middleware('permission:payouts.manage')->group(function () {
        Route::get('payouts/prepare', [LedgerAdminController::class, 'preparePayouts']);
        Route::get('payouts', [LedgerAdminController::class, 'payouts']);
        Route::post('payouts', [LedgerAdminController::class, 'storePayouts']);
        Route::patch('payouts/{payout}', [LedgerAdminController::class, 'updatePayout']);
    });

    Route::middleware('permission:tariffs.manage')->group(function () {
        Route::get('zones', [CatalogController::class, 'zones']);
        Route::post('zones', [CatalogController::class, 'storeZone']);
        Route::patch('zones/{zone}', [CatalogController::class, 'updateZone']);
        Route::get('locations', [CatalogController::class, 'locations']);
        Route::post('locations', [CatalogController::class, 'storeLocation']);
        Route::patch('locations/{location}', [CatalogController::class, 'updateLocation']);
        Route::post('locations/{location}/photo', [CatalogController::class, 'uploadLocationPhoto']);
        Route::get('ferry-routes', [CatalogController::class, 'ferryRoutes']);
        Route::post('ferry-routes', [CatalogController::class, 'storeFerryRoute']);
        Route::patch('ferry-routes/{ferryRoute}', [CatalogController::class, 'updateFerryRoute']);
        Route::get('tariffs', [CatalogController::class, 'tariffs']);
        Route::post('tariffs', [CatalogController::class, 'storeTariffs']);
        Route::post('tariffs/preview', [CatalogController::class, 'previewTariff']);
        Route::get('surcharges', [CatalogController::class, 'surcharges']);
        Route::post('surcharges', [CatalogController::class, 'storeSurcharge']);
        Route::patch('surcharges/{surcharge}', [CatalogController::class, 'updateSurcharge']);
        Route::get('holiday-dates', [CatalogController::class, 'holidays']);
        Route::post('holiday-dates', [CatalogController::class, 'storeHoliday']);
        Route::delete('holiday-dates/{holiday}', [CatalogController::class, 'deleteHoliday']);
    });
    Route::middleware('permission:settings.manage')->group(function () {
        Route::get('settings', [SettingsController::class, 'index']);
        Route::put('settings', [SettingsController::class, 'update']);
    });
    Route::get('reports/{report}', [ReportController::class, 'show'])->middleware('role_or_permission:reports.view.all|reports.view.ops|reports.view.finance|reports.view.verification');
    Route::middleware('permission:staff.manage')->group(function () {
        Route::get('staff', [StaffController::class, 'index']);
        Route::post('staff', [StaffController::class, 'store']);
        Route::patch('staff/{user}', [StaffController::class, 'update']);
        Route::get('roles', [StaffController::class, 'roles']);
    });
    Route::get('audit-logs', [AuditController::class, 'index'])->middleware('permission:audit.view');
});
