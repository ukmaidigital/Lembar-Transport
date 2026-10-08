import { TicketView } from "@/components/ticket-view";

export default async function TicketPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  return <TicketView code={kode} />;
}
