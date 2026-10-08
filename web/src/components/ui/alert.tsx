import { cn } from "@/lib/utils";

export function Alert({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger" | "good"; children: React.ReactNode; className?: string }) {
  const map = {
    info: "bg-brand-50 text-brand-600 border-brand-100",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-800 border-red-200",
    good: "bg-green-50 text-green-800 border-green-200",
  };
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", map[tone], className)}>{children}</div>;
}
