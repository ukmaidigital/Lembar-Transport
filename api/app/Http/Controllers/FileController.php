<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class FileController extends Controller
{
    /** Serve a private file through a signed URL (5 minutes). */
    public function show(Request $request, string $path)
    {
        abort_unless(Storage::exists($path), 404);

        return Storage::response($path);
    }

    public static function signedUrl(?string $path): ?string
    {
        return $path ? URL::temporarySignedRoute('files.show', now()->addMinutes(5), ['path' => $path]) : null;
    }
}
