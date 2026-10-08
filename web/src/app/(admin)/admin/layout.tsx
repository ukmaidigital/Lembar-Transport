import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "@/app/globals.css";

export const metadata: Metadata = { title: { default: "Lembar Transport Admin", template: "%s · LT Admin" }, robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
