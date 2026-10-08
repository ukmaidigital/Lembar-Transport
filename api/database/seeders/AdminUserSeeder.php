<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admins = [
            ['Super Admin', 'super@lembartransport.test', '+628110000001', 'super_admin'],
            ['Dewi Ops', 'ops@lembartransport.test', '+628110000002', 'ops'],
            ['Budi Verifikator', 'verifier@lembartransport.test', '+628110000003', 'verifier'],
            ['Sari Finance', 'finance@lembartransport.test', '+628110000004', 'finance'],
        ];
        foreach ($admins as [$name, $email, $phone, $role]) {
            $user = User::updateOrCreate(['email' => $email], [
                'name' => $name, 'phone' => $phone, 'phone_verified_at' => now(), 'email_verified_at' => now(),
                'password' => 'password', 'role' => UserRole::Admin, 'locale' => 'id', 'status' => 'active',
            ]);
            $user->syncRoles([$role]);
        }
    }
}
