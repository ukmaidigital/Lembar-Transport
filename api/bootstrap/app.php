<?php

use App\Exceptions\BusinessRuleException;
use App\Http\Middleware\RequestId;
use App\Http\Middleware\SetLocale;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'abilities' => CheckAbilities::class,
            'ability' => CheckForAnyAbility::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'request.id' => RequestId::class,
            'locale' => SetLocale::class,
        ]);
        $middleware->api(prepend: [RequestId::class, SetLocale::class]);
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());
        $json = fn (string $code, string $message, int $status, array $details = []) => response()->json(['error' => ['code' => $code, 'message' => $message, 'details' => $details]], $status);
        $exceptions->render(fn (ValidationException $e, Request $r) => $r->is('api/*') ? $json('VALIDATION_FAILED', $e->getMessage(), 422, $e->errors()) : null);
        $exceptions->render(fn (AuthenticationException $e, Request $r) => $r->is('api/*') ? $json('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.', 401) : null);
        $exceptions->render(fn (UnauthorizedException $e, Request $r) => $r->is('api/*') ? $json('FORBIDDEN', 'Anda tidak memiliki izin untuk tindakan ini.', 403) : null);
        $exceptions->render(fn (AccessDeniedHttpException $e, Request $r) => $r->is('api/*') ? $json('FORBIDDEN', $e->getMessage() ?: 'Akses ditolak.', 403) : null);
        $exceptions->render(fn (AuthorizationException $e, Request $r) => $r->is('api/*') ? $json('FORBIDDEN', $e->getMessage() ?: 'Akses ditolak.', 403) : null);
        $exceptions->render(fn (ModelNotFoundException|NotFoundHttpException $e, Request $r) => $r->is('api/*') ? $json('NOT_FOUND', 'Data tidak ditemukan.', 404) : null);
        $exceptions->render(fn (ThrottleRequestsException $e, Request $r) => $r->is('api/*') ? $json('RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.', 429) : null);
        $exceptions->render(fn (BusinessRuleException $e) => $e->render());
    })->create();
