"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarDays, Wallet, User, Bell, CloudOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { flush, onQueueChange, pendingCount } from "@/lib/offline-queue";
import { PageLoading } from "@/components/ui/spinner";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/driver", label: "Beranda", icon: Home },
  { href: "/driver/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/driver/pendapatan", label: "Pendapatan", icon: Wallet },
  { href: "/driver/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/driver/profil", label: "Profil", icon: User },
];

/** Online/offline + queued-action banner and SW registration. */
export function ConnectivityBar() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    setOnline(navigator.onLine);
    const refresh = () => pendingCount().then(setPending).catch(() => {});
    const up = () => { setOnline(true); flush().then(refresh); };
    const down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    const off = onQueueChange(refresh);
    refresh();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); off(); };
  }, []);
  if (online && pending === 0) return null;
  return (
    <div className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium ${online ? "bg-amber-50 text-amber-900" : "bg-slate-800 text-white"}`}>
      {online ? <RefreshCw size={14} className="animate-spin" /> : <CloudOff size={14} />}
      {online ? `Mengirim ${pending} aksi tertunda…` : `Offline${pending ? ` · ${pending} aksi akan dikirim saat online` : " · aksi akan disimpan"}`}
    </div>
  );
}

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { meta } = useApi<unknown[]>(user?.role === "driver" ? "/notifications?per_page=1" : null, { poll: 60000 });
  const unread = Number(meta?.unread ?? 0);
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/driver/masuk?next=${encodeURIComponent(pathname)}`); return; }
    if (user.role !== "driver") { router.replace("/driver/masuk?role_mismatch=1"); return; }
    // Route by onboarding state: applicants go to the registration or verification pages.
    const st = user.driver_status;
    const onboarding = pathname.startsWith("/driver/daftar") || pathname.startsWith("/driver/verifikasi") || pathname.startsWith("/driver/bantuan") || pathname.startsWith("/driver/profil");
    if ((!st || st === "draft" || st === "revision_required") && !onboarding) router.replace("/driver/daftar");
    else if ((st === "submitted" || st === "rejected") && !onboarding) router.replace("/driver/verifikasi");
  }, [user, loading, pathname, router]);
  if (loading || !user) return <PageLoading />;
  const showNav = user.driver_status === "active" || user.driver_status === "suspended" || user.driver_status === "inactive";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50">
      <ConnectivityBar />
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/driver" ? pathname === "/driver" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-driver-600 font-semibold" : "text-slate-500"}`}>
                <Icon size={20} />{label}
                {href === "/driver/notifikasi" && unread > 0 && <span className="absolute right-1/4 top-1 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{unread}</span>}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function DriverHeader({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {back && <Link href={back} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="kembali">←</Link>}
      <h1 className="flex-1 text-lg font-bold">{title}</h1>
      {right}
    </div>
  );
}
