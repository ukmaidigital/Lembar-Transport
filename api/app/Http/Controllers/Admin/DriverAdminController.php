<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DocumentType;
use App\Enums\DriverStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Controllers\FileController;
use App\Http\Resources\DriverResource;
use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Setting;
use App\Models\TripIssue;
use App\Models\User;
use App\Services\DriverOnboardingService;
use App\Services\OtpService;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class DriverAdminController extends Controller
{
    private const WITH = ['user', 'primaryVehicle.vehicleClass', 'bankAccount', 'partnerOrganization', 'documents'];

    public function __construct(private DriverOnboardingService $onboarding) {}

    public function applications(Request $request)
    {
        $items = Driver::query()->with(self::WITH)->whereIn('status', [DriverStatus::Submitted->value, DriverStatus::RevisionRequired->value])
            ->orderByRaw("case when status = 'submitted' then 0 else 1 end")->orderBy('submitted_at')->paginate(25);

        return DriverResource::collection($items);
    }

    public function index(Request $request)
    {
        $q = Driver::query()->with(self::WITH)
            ->when($request->query('status'), fn ($b, $s) => $b->where('status', $s))
            ->when($request->query('online') !== null && $request->query('online') !== '', fn ($b) => $b->where('is_online', filter_var($request->query('online'), FILTER_VALIDATE_BOOL)))
            ->when($request->query('q'), fn ($b, $s) => $b->whereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%")->orWhere('phone', 'like', "%{$s}%"))->orWhereHas('vehicles', fn ($v) => $v->where('plate_number', 'like', "%{$s}%")))
            ->when($request->query('below_threshold'), fn ($b) => $b->where('balance', '<', (int) Setting::value('ledger.balance_threshold')))
            ->orderBy($request->query('sort', 'created_at') === 'rating' ? 'rating_avg' : 'created_at', 'desc');

        return DriverResource::collection($q->paginate((int) $request->integer('per_page', 25)));
    }

    public function show(Driver $driver)
    {
        return (new DriverResource($driver->load(self::WITH)))->additional(['meta' => [
            'recent_trips' => $driver->orders()->with(['destination'])->latest('pickup_at')->limit(10)->get()->map(fn ($o) => ['code' => $o->code, 'status' => $o->status->value, 'pickup_at' => $o->pickup_at?->toIso8601String(), 'destination' => $o->destination?->name_id, 'total' => $o->total]),
            'ledger' => $driver->ledgerEntries()->latest('id')->limit(10)->get(),
            'issues' => TripIssue::query()->where('driver_id', $driver->id)->latest('id')->limit(10)->get(),
            'activity' => Activity::query()->where('subject_type', Driver::class)->where('subject_id', $driver->id)->latest('id')->limit(20)->get(),
        ]]);
    }

    /** Register a driver on their behalf (FR-ADM-06). */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'phone' => ['required', 'string', 'max:20'],
            'nik' => ['nullable', 'digits:16'], 'birth_date' => ['nullable', 'date'], 'address' => ['nullable', 'string', 'max:500'],
            'emergency_contact_name' => ['nullable', 'string', 'max:120'], 'emergency_contact_phone' => ['nullable', 'string', 'max:20'],
            'partner_organization_id' => ['nullable', 'integer', 'exists:partner_organizations,id'],
            'vehicle' => ['nullable', 'array'], 'bank_account' => ['nullable', 'array'],
        ]);
        $phone = OtpService::normalizePhone($data['phone']);
        $user = User::query()->where('phone', $phone)->first() ?? User::create(['name' => $data['name'], 'phone' => $phone, 'role' => UserRole::Driver, 'status' => 'active']);
        if ($user->isAdmin()) {
            abort(422, 'Nomor ini milik akun admin.');
        }
        $user->update(['role' => UserRole::Driver]);
        $driver = $this->onboarding->startApplication($user);
        $driver = $this->onboarding->updateApplication($driver, $data, true);
        activity('drivers')->causedBy($request->user())->performedOn($driver)->log('register_on_behalf');

        return (new DriverResource($driver->load(self::WITH)))->response()->setStatusCode(201);
    }

    public function update(Request $request, Driver $driver)
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:120'], 'nik' => ['sometimes', 'digits:16'], 'birth_date' => ['sometimes', 'date'], 'address' => ['sometimes', 'string'],
            'emergency_contact_name' => ['sometimes', 'string'], 'emergency_contact_phone' => ['sometimes', 'string'], 'partner_organization_id' => ['nullable', 'integer'], 'vehicle' => ['sometimes', 'array'], 'bank_account' => ['sometimes', 'array']]);
        $driver = $this->onboarding->updateApplication($driver, $data, true);
        activity('drivers')->causedBy($request->user())->performedOn($driver)->withProperties(array_keys($data))->log('update');

        return new DriverResource($driver->load(self::WITH));
    }

    public function uploadDocument(Request $request, Driver $driver)
    {
        $data = $request->validate(['type' => ['required', 'in:'.implode(',', array_map(fn ($t) => $t->value, DocumentType::cases()))], 'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'], 'expires_at' => ['nullable', 'date'], 'document_number' => ['nullable', 'string', 'max:40']]);
        $doc = $this->onboarding->uploadDocument($driver, DocumentType::from($data['type']), $request->file('file'), $data['expires_at'] ?? null, $data['document_number'] ?? null);

        return response()->json(['data' => $doc], 201);
    }

    public function documentUrl(Request $request, Driver $driver, DriverDocument $document)
    {
        abort_unless($document->driver_id === $driver->id, 404);
        activity('verification')->causedBy($request->user())->performedOn($document)->log('view_document');

        return response()->json(['data' => ['url' => FileController::signedUrl($document->file_path)]]);
    }

    public function reviewDocument(Request $request, Driver $driver, DriverDocument $document)
    {
        abort_unless($document->driver_id === $driver->id, 404);
        $data = $request->validate(['approve' => ['required', 'boolean'], 'reason_code' => ['nullable', 'string', 'max:50'], 'note' => ['nullable', 'string', 'max:300'], 'expires_at' => ['nullable', 'date']]);
        $doc = $this->onboarding->reviewDocument($document, $request->user(), $data['approve'], $data['reason_code'] ?? null, $data['note'] ?? null, $data['expires_at'] ?? null);

        return response()->json(['data' => $doc, 'meta' => ['driver' => new DriverResource($driver->fresh(self::WITH))]]);
    }

    public function decide(Request $request, Driver $driver)
    {
        $data = $request->validate(['decision' => ['required', 'in:activate,request_revision,reject'], 'note' => ['nullable', 'string', 'max:500']]);

        return new DriverResource($this->onboarding->decide($driver, $request->user(), $data['decision'], $data['note'] ?? null)->load(self::WITH));
    }

    public function suspend(Request $request, Driver $driver)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:300']]);

        return new DriverResource($this->onboarding->suspend($driver, $request->user(), $data['reason'])->load(self::WITH));
    }

    public function reactivate(Request $request, Driver $driver)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:300']]);

        return new DriverResource($this->onboarding->reactivate($driver, $request->user(), $data['reason'])->load(self::WITH));
    }

    public function addNote(Request $request, Driver $driver)
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:500']]);
        $driver->update(['notes' => trim(($driver->notes ?? '')."\n[".now()->toDateString().' '.$request->user()->name.'] '.$data['note'])]);

        return new DriverResource($driver->load(self::WITH));
    }
}
