"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ShieldCheck, Users, Car, ClipboardList, Radio, CreditCard, Wallet, Banknote, Tag, Map, MapPin, BarChart3, Settings, UserCog, ScrollText, LogOut, Menu, Ship } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/use-api";
import { PageLoading } from "@/components/ui/spinner";

type Item = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; perm?: string | string[]; badge?: string };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Operasional", items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/pesanan", label: "Pesanan", icon: ClipboardList, perm: "orders.view" },
    { href: "/admin/dispatch", label: "Dispatch", icon: Radio, perm: "orders.view", badge: "needs_attention" },
  ] },
  { title: "Mitra", items: [
    { href: "/admin/verifikasi", label: "Verifikasi", icon: ShieldCheck, perm: "drivers.view", badge: "verification_pending" },
    { href: "/admin/driver", label: "Driver", icon: Users, perm: "drivers.view" },
    { href: "/admin/kendaraan", label: "Kendaraan", icon: Car, perm: "fleet.manage" },
  ] },
  { title: "Keuangan", items: [
    { href: "/admin/pembayaran", label: "Pembayaran", icon: CreditCard, perm: "payments.confirm", badge: "payments_pending_review" },
    { href: "/admin/keuangan/ledger", label: "Ledger & top-up", icon: Wallet, perm: "ledger.manage" },
    { href: "/admin/keuangan/payout", label: "Payout", icon: Banknote, perm: "payouts.manage" },
  ] },
  { title: "Katalog", items: [
    { href: "/admin/tarif", label: "Tarif", icon: Tag, perm: "tariffs.manage" },
    { href: "/admin/zona", label: "Zona & tujuan", icon: Map, perm: "tariffs.manage" },
    { href: "/admin/titik-temu", label: "Titik temu", icon: MapPin, perm: "tariffs.manage" },
  ] },
  { title: "Sistem", items: [
    { href: "/admin/laporan", label: "Laporan", icon: BarChart3, perm: ["reports.view.all", "reports.view.ops", "reports.view.finance", "reports.view.verification"] },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, perm: "settings.manage" },
    { href: "/admin/staf", label: "Staf & peran", icon: UserCog, perm: "staff.manage" },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText, perm: "audit.view" },
  ] },
];

export function AdminShell({ children, title, actions }: { children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: dash } = useApi<Record<string, number>>(user?.role === "admin" ? "/admin/dashboard" : null, { poll: 60000 });
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/admin/masuk?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== "admin") router.replace("/admin/masuk?role_mismatch=1");
  }, [user, loading, pathname, router]);
  if (loading || !user || user.role !== "admin") return <PageLoading />;
  const allowed = (p?: string | string[]) => !p || (Array.isArray(p) ? p.some(can) : can(p));

  const nav = (
    <nav className="flex flex-col gap-4 p-3 text-sm">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => allowed(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.title}</div>
            {items.map(({ href, label, icon: Icon, badge }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              const n = badge && dash ? dash[badge] : 0;
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${active ? "bg-admin-50 font-semibold text-admin-600" : "text-slate-700 hover:bg-slate-100"}`}>
                  <Icon size={16} /><span className="flex-1">{label}</span>{n ? <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{n}</span> : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 flex-none border-r border-slate-200 bg-white lg:block">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 font-bold"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-admin-500 text-white"><Ship size={16} /></span>LT Admin</div>
        {nav}
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-64 bg-white" onClick={(e) => e.stopPropagation()}>{nav}</aside></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu size={20} /></button>
          <h1 className="flex-1 truncate text-base font-bold">{title}</h1>
          {actions}
          <div className="hidden text-right text-xs sm:block"><div className="font-semibold">{user.name}</div><div className="text-slate-500">{user.roles?.join(", ")}</div></div>
          <button onClick={async () => { await logout(); window.location.href = "/admin/masuk"; }} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Keluar"><LogOut size={16} /></button>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
