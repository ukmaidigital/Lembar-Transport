<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Services\ReportService;

class DashboardController extends Controller
{
    public function index(ReportService $reports)
    {
        $data = $reports->dashboard();
        $data['pickups_today'] = OrderResource::collection($data['pickups_today'])->resolve();

        return response()->json(['data' => $data]);
    }
}
