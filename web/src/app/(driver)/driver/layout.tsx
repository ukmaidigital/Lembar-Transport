import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Lembar Transport Driver", template: "%s · Driver" },
  description: "Aplikasi mitra driver Lembar Transport",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LT Driver" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#eb6834", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function DriverRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
