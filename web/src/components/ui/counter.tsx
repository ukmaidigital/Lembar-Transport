"use client";

export function Counter({ label, value, onChange, min = 0, max = 99 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center justify-between rounded-lg border border-slate-300 px-2 py-1.5">
        <button type="button" className="h-8 w-8 rounded-md text-lg text-slate-600 hover:bg-slate-100" onClick={() => onChange(Math.max(min, value - 1))} aria-label="kurangi">−</button>
        <span className="font-semibold">{value}</span>
        <button type="button" className="h-8 w-8 rounded-md text-lg text-slate-600 hover:bg-slate-100" onClick={() => onChange(Math.min(max, value + 1))} aria-label="tambah">+</button>
      </div>
    </div>
  );
}
