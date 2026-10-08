"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn("max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} aria-label="tutup" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}{hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}</div>;
}

export function Table({ head, children, empty }: { head: React.ReactNode; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500"><tr>{head}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-slate-500">Tidak ada data.</p>}
    </div>
  );
}
export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => <th className={cn("px-3 py-2 font-semibold", className)}>{children}</th>;
export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={cn("px-3 py-2 align-top", className)}>{children}</td>;

export function Stat({ label, value, tone, hint, href }: { label: string; value: React.ReactNode; tone?: "danger" | "warn" | "good"; hint?: string; href?: string }) {
  const c = tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-green-700" : "text-slate-900";
  const inner = <><div className="text-xs text-slate-500">{label}</div><div className={cn("text-2xl font-bold", c)}>{value}</div>{hint && <div className="text-[11px] text-slate-500">{hint}</div>}</>;
  return href ? <a href={href} className="card block hover:border-admin-500">{inner}</a> : <div className="card">{inner}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-slate-200 p-1 text-xs font-semibold">
      {items.map((i) => <button key={i.value} onClick={() => onChange(i.value)} className={cn("rounded-md px-3 py-1.5", value === i.value ? "bg-white shadow" : "text-slate-600")}>{i.label}{i.count !== undefined ? ` (${i.count})` : ""}</button>)}
    </div>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) { return <div className="mb-3 flex flex-wrap items-end gap-2">{children}</div>; }
