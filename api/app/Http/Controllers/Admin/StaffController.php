<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class StaffController extends Controller
{
    public function index()
    {
        return UserResource::collection(User::query()->where('role', UserRole::Admin->value)->with('roles')->orderBy('name')->get());
    }

    public function roles()
    {
        return response()->json(['data' => Role::query()->with('permissions:id,name')->get()->map(fn ($r) => ['name' => $r->name, 'permissions' => $r->permissions->pluck('name')])]);
    }

    public function store(Request $request)
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email', 'unique:users,email'], 'phone' => ['nullable', 'string', 'max:20'], 'password' => ['required', 'string', 'min:10'], 'roles' => ['required', 'array', 'min:1'], 'roles.*' => ['string', 'exists:roles,name']]);
        $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'phone' => $data['phone'] ?? null, 'password' => $data['password'], 'role' => UserRole::Admin, 'status' => 'active', 'email_verified_at' => now()]);
        $user->syncRoles($data['roles']);
        activity('staff')->causedBy($request->user())->performedOn($user)->withProperties(['roles' => $data['roles']])->log('create_staff');

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function update(Request $request, User $user)
    {
        abort_unless($user->isAdmin(), 404);
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:120'], 'phone' => ['nullable', 'string', 'max:20'], 'password' => ['nullable', 'string', 'min:10'], 'status' => ['sometimes', 'in:active,blocked'], 'roles' => ['sometimes', 'array', 'min:1'], 'roles.*' => ['string', 'exists:roles,name'], 'reset_2fa' => ['nullable', 'boolean']]);
        if ($user->id === $request->user()->id && (($data['status'] ?? 'active') !== 'active')) {
            abort(422, 'Tidak dapat menonaktifkan akun sendiri.');
        }
        $user->fill(array_filter(['name' => $data['name'] ?? null, 'phone' => $data['phone'] ?? null, 'status' => $data['status'] ?? null], fn ($v) => $v !== null));
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }
        if (! empty($data['reset_2fa'])) {
            $user->two_factor_secret = null;
            $user->two_factor_confirmed_at = null;
        }
        $user->save();
        if (isset($data['roles'])) {
            $user->syncRoles($data['roles']);
        }
        if (($data['status'] ?? null) === 'blocked') {
            $user->tokens()->delete();
        }
        activity('staff')->causedBy($request->user())->performedOn($user)->withProperties(array_keys($data))->log('update_staff');

        return new UserResource($user->fresh());
    }
}
