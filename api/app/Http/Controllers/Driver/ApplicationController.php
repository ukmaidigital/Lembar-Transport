<?php

namespace App\Http\Controllers\Driver;

use App\Enums\DocumentType;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Controllers\FileController;
use App\Http\Resources\DriverResource;
use App\Models\Driver;
use App\Models\DriverDocument;
use App\Services\DriverOnboardingService;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function __construct(private DriverOnboardingService $onboarding) {}

    private function driver(Request $request, bool $create = false): Driver
    {
        $driver = $request->user()->driver;
        if (! $driver) {
            if ($create) {
                return $this->onboarding->startApplication($request->user());
            }
            throw new BusinessRuleException('NO_APPLICATION', 'Belum ada pendaftaran. Mulai dari langkah pertama.', 404);
        }

        return $driver->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount', 'partnerOrganization']);
    }

    public function start(Request $request)
    {
        return (new DriverResource($this->driver($request, true)->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount'])))->response()->setStatusCode(201);
    }

    public function me(Request $request)
    {
        return new DriverResource($this->driver($request, true)->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount']));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'nik' => ['sometimes', 'digits:16'],
            'birth_date' => ['sometimes', 'date', 'before:-18 years'],
            'address' => ['sometimes', 'string', 'max:500'],
            'emergency_contact_name' => ['sometimes', 'string', 'max:120'],
            'emergency_contact_phone' => ['sometimes', 'string', 'max:20'],
            'vehicle' => ['sometimes', 'array'],
            'vehicle.vehicle_class' => ['required_with:vehicle', 'string', 'exists:vehicle_classes,code'],
            'vehicle.brand' => ['required_with:vehicle', 'string', 'max:60'],
            'vehicle.model' => ['required_with:vehicle', 'string', 'max:60'],
            'vehicle.year' => ['required_with:vehicle', 'integer', 'min:1990', 'max:'.(now()->year + 1)],
            'vehicle.plate_number' => ['required_with:vehicle', 'string', 'max:20'],
            'vehicle.color' => ['nullable', 'string', 'max:30'],
            'vehicle.seats' => ['nullable', 'integer', 'min:1', 'max:40'],
            'vehicle.luggage_capacity' => ['nullable', 'integer', 'min:0', 'max:40'],
            'vehicle.has_child_seat' => ['nullable', 'boolean'],
            'vehicle.has_roof_rack' => ['nullable', 'boolean'],
            'vehicle.stnk_expires_at' => ['nullable', 'date'],
            'bank_account' => ['sometimes', 'array'],
            'bank_account.bank_code' => ['required_with:bank_account', 'string', 'max:20'],
            'bank_account.account_number' => ['required_with:bank_account', 'string', 'max:30'],
            'bank_account.account_name' => ['required_with:bank_account', 'string', 'max:120'],
        ]);
        $driver = $this->onboarding->updateApplication($this->driver($request, true), $data);

        return new DriverResource($driver->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount']));
    }

    public function submit(Request $request)
    {
        return new DriverResource($this->onboarding->submit($this->driver($request))->load(['user', 'primaryVehicle.vehicleClass', 'bankAccount']));
    }

    public function documents(Request $request)
    {
        $driver = $this->driver($request, true);

        return response()->json(['data' => (new DriverResource($driver))->toArray($request)['documents'], 'meta' => ['missing' => (new DriverResource($driver))->toArray($request)['missing_documents']]]);
    }

    public function uploadDocument(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', array_map(fn ($t) => $t->value, DocumentType::cases()))],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'expires_at' => ['nullable', 'date', 'after:today'],
            'document_number' => ['nullable', 'string', 'max:40'],
        ]);
        $doc = $this->onboarding->uploadDocument($this->driver($request, true), DocumentType::from($data['type']), $request->file('file'), $data['expires_at'] ?? null, $data['document_number'] ?? null);

        return response()->json(['data' => ['id' => $doc->id, 'type' => $doc->type->value, 'status' => $doc->status->value, 'version' => $doc->version, 'expires_at' => $doc->expires_at?->toDateString()]], 201);
    }

    public function documentUrl(Request $request, DriverDocument $document)
    {
        abort_unless($document->driver_id === $request->user()->driver?->id, 403);

        return response()->json(['data' => ['url' => FileController::signedUrl($document->file_path)]]);
    }
}
