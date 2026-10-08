"use client";

import { DriverShell, DriverHeader } from "@/components/driver/shell";
import { OfferCard } from "@/components/driver/offer-card";
import { useApi } from "@/lib/use-api";
import type { Offer } from "@/lib/driver";
import { Empty } from "@/components/ui/empty";

export default function OffersPage() {
  return <DriverShell><Inner /></DriverShell>;
}
function Inner() {
  const { data, reload } = useApi<Offer[]>("/driver/offers", { poll: 10000 });
  return (
    <>
      <DriverHeader title="Tawaran trip" back="/driver" />
      {!data?.length ? <Empty title="Tidak ada tawaran saat ini" hint="Tawaran baru muncul otomatis selama Anda online." /> : <div className="flex flex-col gap-3">{data.map((o) => <OfferCard key={o.id} offer={o} onDone={reload} />)}</div>}
    </>
  );
}
