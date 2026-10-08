<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\Wita;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    private const PERMISSIONS = [
        'orders' => 'reports.view.ops', 'dispatch' => 'reports.view.ops', 'cancellations' => 'reports.view.ops', 'funnel' => 'reports.view.ops',
        'revenue' => 'reports.view.finance', 'drivers' => 'reports.view.ops', 'verification' => 'reports.view.verification',
    ];

    public function show(Request $request, string $report, ReportService $reports)
    {
        abort_unless(isset(self::PERMISSIONS[$report]), 404);
        $user = $request->user();
        abort_unless($user->can('reports.view.all') || $user->can(self::PERMISSIONS[$report]), 403);
        $from = $request->query('from') ? Wita::of($request->query('from'))->startOfDay()->utc() : now()->subDays(30)->startOfDay();
        $to = $request->query('to') ? Wita::of($request->query('to'))->endOfDay()->utc() : now()->endOfDay();
        $data = $reports->{$report}($from, $to);
        if ($request->query('format') === 'csv') {
            return $this->csv($report, $data);
        }

        return response()->json(['data' => $data, 'meta' => ['from' => $from->toIso8601String(), 'to' => $to->toIso8601String()]]);
    }

    private function csv(string $report, mixed $data): StreamedResponse
    {
        $rows = [];
        if ($data instanceof Collection) {
            $rows = $data->map(fn ($r) => (array) $r)->all();
        } elseif (is_array($data)) {
            foreach ($data as $section => $value) {
                if (is_iterable($value)) {
                    foreach ($value as $k => $v) {
                        $rows[] = ['section' => $section, 'key' => is_object($v) || is_array($v) ? json_encode($k) : $k, 'value' => is_object($v) || is_array($v) ? json_encode($v) : $v];
                    }
                } else {
                    $rows[] = ['section' => $section, 'key' => '', 'value' => $value];
                }
            }
        }

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            if ($rows !== []) {
                fputcsv($out, array_keys($rows[0]));
                foreach ($rows as $r) {
                    fputcsv($out, array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), $r));
                }
            }
            fclose($out);
        }, "laporan-{$report}-".now()->format('Ymd').'.csv', ['Content-Type' => 'text/csv']);
    }
}
