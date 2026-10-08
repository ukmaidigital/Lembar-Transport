import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-slate-600">Halaman tidak ditemukan · Page not found</p>
      <Link href="/" className="btn-primary mt-6 inline-flex">Beranda</Link>
    </div>
  );
}
