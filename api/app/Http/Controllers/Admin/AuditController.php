<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class AuditController extends Controller
{
    public function index(Request $request)
    {
        $items = Activity::query()->with('causer:id,name,email')
            ->when($request->query('log'), fn ($q, $l) => $q->where('log_name', $l))
            ->when($request->query('causer_id'), fn ($q, $c) => $q->where('causer_id', $c))
            ->when($request->query('subject_type'), fn ($q, $t) => $q->where('subject_type', 'like', "%{$t}%"))
            ->when($request->query('q'), fn ($q, $s) => $q->where('description', 'like', "%{$s}%"))
            ->latest('id')->paginate(50);

        return response()->json(['data' => collect($items->items())->map(fn (Activity $a) => [
            'id' => $a->id, 'log' => $a->log_name, 'action' => $a->description, 'subject_type' => class_basename((string) $a->subject_type), 'subject_id' => $a->subject_id,
            'causer' => $a->causer ? ['id' => $a->causer->id, 'name' => $a->causer->name] : null, 'properties' => $a->properties, 'created_at' => $a->created_at?->toIso8601String(),
        ]), 'meta' => ['total' => $items->total(), 'last_page' => $items->lastPage(), 'current_page' => $items->currentPage()]]);
    }
}
