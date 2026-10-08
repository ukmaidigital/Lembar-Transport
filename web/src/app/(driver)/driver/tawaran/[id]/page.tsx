"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { OfferCard } from "@/components/driver/offer-card";
import { useApi } from "@/lib/use-api";
import type { Offer } from "@/lib/driver";
import { Alert } from "@/components/ui/alert";
import { PageLoading } from "@/components/ui/spinner";

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DriverShell><Inner id={id} /></DriverShell>;
}
function Inner({ id }: { id: string }) {
  const router = useRouter();
  const { data, loading } = useApi<Offer[]>("/driver/offers", { poll: 10000 });
  const offer = data?.find((o) => String(o.id) === id);
  return (
    <>
      <DriverHeader title="Detail tawaran" back="/driver/tawaran" />
      {loading && !data ? <PageLoading /> : offer ? <OfferCard offer={offer} onDone={() => router.replace("/driver/tawaran")} /> : <Alert tone="warn">Tawaran sudah tidak tersedia (kedaluwarsa atau diambil driver lain).</Alert>}
    </>
  );
}
