<?php

namespace App\Http\Controllers;

use App\Models\NotificationLog;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $q = NotificationLog::query()->where('user_id', $request->user()->id)->where('channel', 'in_app')->latest('id');
        $items = $q->paginate((int) $request->integer('per_page', 25));

        return response()->json([
            'data' => $items->items(),
            'meta' => ['total' => $items->total(), 'unread' => NotificationLog::query()->where('user_id', $request->user()->id)->where('channel', 'in_app')->whereNull('read_at')->count(), 'current_page' => $items->currentPage(), 'last_page' => $items->lastPage()],
        ]);
    }

    public function read(Request $request, int $id)
    {
        $n = NotificationLog::query()->where('user_id', $request->user()->id)->findOrFail($id);
        $n->update(['read_at' => now()]);

        return response()->json(['data' => $n]);
    }

    public function readAll(Request $request)
    {
        NotificationLog::query()->where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['data' => ['ok' => true]]);
    }
}
