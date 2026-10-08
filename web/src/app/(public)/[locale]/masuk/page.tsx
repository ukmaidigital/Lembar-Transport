"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import NextLink from "next/link";
import { OtpLogin } from "@/components/otp-login";
import { useAuth } from "@/lib/auth";

function LoginInner() {
  const t = useTranslations("login");
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useAuth();
  return (
    <div className="card mx-auto flex max-w-sm flex-col gap-3">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-slate-600">{t("subtitle")}</p>
      <OtpLogin role="customer" askName onSuccess={async (u) => { await refresh(); if (u.role === "driver") window.location.href = "/driver"; else router.push(sp.get("next")?.replace(/^\/en/, "") || "/akun"); }} />
      <NextLink href="/driver/masuk" className="text-center text-xs text-slate-500 underline">{t("driverCta")}</NextLink>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
