<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public const PERMISSIONS = [
        'drivers.view', 'drivers.verify', 'drivers.manage', 'fleet.manage',
        'orders.view', 'orders.manage', 'orders.assign',
        'payments.confirm', 'payments.refund', 'ledger.manage', 'payouts.manage',
        'tariffs.manage', 'settings.manage', 'staff.manage',
        'reports.view.ops', 'reports.view.finance', 'reports.view.verification', 'reports.view.all',
        'audit.view',
    ];

    public const ROLES = [
        'super_admin' => '*',
        'ops' => ['drivers.view', 'drivers.manage', 'fleet.manage', 'orders.view', 'orders.manage', 'orders.assign', 'reports.view.ops'],
        'verifier' => ['drivers.view', 'drivers.verify', 'reports.view.verification'],
        'finance' => ['orders.view', 'payments.confirm', 'payments.refund', 'ledger.manage', 'payouts.manage', 'reports.view.finance'],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (self::PERMISSIONS as $p) {
            Permission::findOrCreate($p, 'web');
        }
        foreach (self::ROLES as $role => $perms) {
            $r = Role::findOrCreate($role, 'web');
            $r->syncPermissions($perms === '*' ? self::PERMISSIONS : $perms);
        }
    }
}
