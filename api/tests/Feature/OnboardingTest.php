<?php

use App\Enums\DocumentType;
use App\Models\Driver;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    seedReference();
    Storage::fake('local');
});

function registerDriver(): array
{
    $phone = '+628129990001';
    $req = test()->postJson('/api/v1/auth/otp/request', ['phone' => $phone, 'purpose' => 'register_driver'])->assertOk()->json('data');
    $res = test()->postJson('/api/v1/auth/otp/verify', ['phone' => $phone, 'code' => $req['debug_code'], 'role' => 'driver', 'name' => 'Agus Pratama', 'purpose' => 'register_driver'])->assertOk()->json('data');

    return [$res['token'], $res['user']];
}

it('takes a driver from registration through verification to active', function () {
    [$token, $user] = registerDriver();
    expect($user['role'])->toBe('driver');
    $this->withToken($token)->postJson('/api/v1/driver/applications')->assertCreated()->assertJsonPath('data.status', 'draft');
    $this->withToken($token)->patchJson('/api/v1/driver/applications/current', [
        'nik' => '5201123456789012', 'birth_date' => '1990-07-01', 'address' => 'Gerung', 'emergency_contact_name' => 'Istri', 'emergency_contact_phone' => '+628130000010',
        'vehicle' => ['vehicle_class' => 'mpv_standard', 'brand' => 'Suzuki', 'model' => 'Ertiga', 'year' => 2021, 'plate_number' => 'DR 7890 MN', 'stnk_expires_at' => now()->addMonths(5)->toDateString()],
        'bank_account' => ['bank_code' => 'BCA', 'account_number' => '9876543210', 'account_name' => 'Agus Pratama'],
    ])->assertOk()->assertJsonPath('data.vehicle.plate_number', 'DR 7890 MN');

    // cannot submit without documents
    $this->withToken($token)->postJson('/api/v1/driver/applications/current/submit')->assertStatus(422)->assertJsonPath('error.code', 'DOCUMENTS_INCOMPLETE');
    // expiry required for SIM
    $this->withToken($token)->post('/api/v1/driver/documents', ['type' => 'sim', 'file' => UploadedFile::fake()->image('sim.jpg')], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonPath('error.code', 'EXPIRY_REQUIRED');

    foreach (DocumentType::required() as $type) {
        $this->withToken($token)->post('/api/v1/driver/documents', ['type' => $type->value, 'file' => UploadedFile::fake()->image($type->value.'.jpg'), 'expires_at' => $type->hasExpiry() ? now()->addYear()->toDateString() : null], ['Accept' => 'application/json'])->assertCreated();
    }
    $this->withToken($token)->postJson('/api/v1/driver/applications/current/submit')->assertOk()->assertJsonPath('data.status', 'submitted');
    // going online is blocked until active
    $this->withToken($token)->patchJson('/api/v1/driver/availability', ['is_online' => true])->assertStatus(409);

    $verifier = adminUser('verifier');
    $apps = $this->withToken(adminToken($verifier))->getJson('/api/v1/admin/driver-applications')->assertOk()->json('data');
    expect($apps)->toHaveCount(1)->and($apps[0]['sla_deadline_at'])->not->toBeNull();
    $driverId = $apps[0]['id'];
    $docs = $apps[0]['documents'];

    // reject STNK first → revision required → re-upload only STNK
    $stnk = collect($docs)->firstWhere('type', 'stnk');
    $this->withToken(adminToken($verifier))->postJson("/api/v1/admin/drivers/{$driverId}/documents/{$stnk['id']}/review", ['approve' => false, 'reason_code' => 'blurry', 'note' => 'Foto buram'])->assertOk();
    $this->withToken(adminToken($verifier))->postJson("/api/v1/admin/drivers/{$driverId}/decision", ['decision' => 'activate'])->assertStatus(422)->assertJsonPath('error.code', 'DOCUMENTS_NOT_APPROVED');
    $this->withToken(adminToken($verifier))->postJson("/api/v1/admin/drivers/{$driverId}/decision", ['decision' => 'request_revision', 'note' => 'STNK buram'])->assertOk()->assertJsonPath('data.status', 'revision_required');

    $me = $this->withToken($token)->getJson('/api/v1/driver/me')->assertOk()->json('data');
    $stnkMe = collect($me['documents'])->firstWhere('type', 'stnk');
    expect($stnkMe['status'])->toBe('rejected')->and($stnkMe['rejection_note'])->toBe('Foto buram');
    // approved docs are locked for re-upload while in revision
    $this->withToken($token)->post('/api/v1/driver/documents', ['type' => 'ktp', 'file' => UploadedFile::fake()->image('ktp2.jpg')], ['Accept' => 'application/json'])->assertStatus(201); // ktp still pending → allowed
    $this->withToken($token)->post('/api/v1/driver/documents', ['type' => 'stnk', 'file' => UploadedFile::fake()->image('stnk2.jpg'), 'expires_at' => now()->addYear()->toDateString()], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.version', 2);
    $this->withToken($token)->postJson('/api/v1/driver/applications/current/submit')->assertOk()->assertJsonPath('data.status', 'submitted');

    foreach (Driver::find($driverId)->latestDocuments() as $doc) {
        $this->withToken(adminToken($verifier))->postJson("/api/v1/admin/drivers/{$driverId}/documents/{$doc->id}/review", ['approve' => true])->assertOk();
    }
    $this->withToken(adminToken($verifier))->postJson("/api/v1/admin/drivers/{$driverId}/decision", ['decision' => 'activate', 'note' => 'OK'])->assertOk()->assertJsonPath('data.status', 'active');
    expect(Driver::find($driverId)->primaryVehicle->status)->toBe('active');
    $this->withToken($token)->patchJson('/api/v1/driver/availability', ['is_online' => true])->assertOk()->assertJsonPath('data.is_online', true);
});

it('lets ops suspend and reactivate a driver with reasons, audited', function () {
    $driver = activeDriver();
    $ops = adminUser('ops');
    $this->withToken(adminToken($ops))->postJson("/api/v1/admin/drivers/{$driver->id}/suspend", ['reason' => 'Komplain berat'])->assertOk()->assertJsonPath('data.status', 'suspended');
    $this->withToken(adminToken($ops))->postJson("/api/v1/admin/drivers/{$driver->id}/reactivate", ['reason' => 'Sudah klarifikasi'])->assertOk()->assertJsonPath('data.status', 'active');
    $audit = $this->withToken(adminToken(adminUser('super_admin')))->getJson('/api/v1/admin/audit-logs?log=drivers')->assertOk()->json('data');
    expect(collect($audit)->pluck('action')->all())->toContain('suspend', 'reactivate');
});

it('registers a driver on behalf by admin', function () {
    $ops = adminUser('ops');
    $res = $this->withToken(adminToken($ops))->postJson('/api/v1/admin/drivers', ['name' => 'Made Wira', 'phone' => '0812-5555-0001', 'nik' => '5201000000000099', 'vehicle' => ['vehicle_class' => 'minibus_16', 'brand' => 'Toyota', 'model' => 'Hiace Premio', 'year' => 2022, 'plate_number' => 'DR 1 ZZ']])->assertCreated()->json('data');
    expect($res['phone'])->toBe('+6281255550001')->and($res['vehicle']['vehicle_class'])->toBe('minibus_16')->and($res['status'])->toBe('draft');
});
