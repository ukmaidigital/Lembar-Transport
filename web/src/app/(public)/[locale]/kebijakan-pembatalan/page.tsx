import { setRequestLocale } from "next-intl/server";

export default async function CancellationPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const en = locale === "en";
  return (
    <article className="prose mx-auto max-w-3xl text-sm text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">{en ? "Cancellation and refund policy" : "Kebijakan pembatalan dan refund"}</h1>
      <table className="mt-4 w-full text-sm">
        <thead><tr className="text-left text-slate-500"><th className="py-1">{en ? "Cancelled" : "Dibatalkan"}</th><th>{en ? "Fee" : "Biaya"}</th><th>{en ? "Refund (prepaid)" : "Refund (prabayar)"}</th></tr></thead>
        <tbody>
          <tr className="border-t"><td className="py-1">{en ? "≥ 24 hours before pickup" : "≥ 24 jam sebelum penjemputan"}</td><td>0 %</td><td>100 %</td></tr>
          <tr className="border-t"><td className="py-1">{en ? "6–24 hours before" : "6–24 jam sebelumnya"}</td><td>50 %</td><td>50 %</td></tr>
          <tr className="border-t"><td className="py-1">{en ? "< 6 hours or after the driver departs" : "< 6 jam atau setelah driver berangkat"}</td><td>100 %</td><td>0 %</td></tr>
          <tr className="border-t"><td className="py-1">{en ? "No-show (after 60 min free waiting + 30 min grace)" : "No-show (setelah tunggu gratis 60 menit + tenggang 30 menit)"}</td><td>100 %</td><td>0 %</td></tr>
          <tr className="border-t"><td className="py-1">{en ? "Cancelled by us (e.g. ferry cancelled)" : "Dibatalkan oleh kami (misalnya pelayaran batal)"}</td><td>0 %</td><td>100 %</td></tr>
        </tbody>
      </table>
      <p className="mt-4">{en ? "Refunds to bank accounts are processed within 3 working days. Payment-gateway fees that the provider does not return are not refunded." : "Refund ke rekening bank diproses dalam 3 hari kerja. Biaya gateway yang tidak dikembalikan penyedia tidak di-refund."}</p>
      <p>{en ? "Free waiting is 60 minutes from the moment the ferry docks (your \"Ferry has docked\" tap, an Ops update, or the estimated docking time plus 60 minutes). Beyond that, a waiting fee per 30 minutes applies after Ops approval." : "Tunggu gratis 60 menit dihitung sejak kapal sandar (tombol \"Kapal sudah sandar\", pembaruan Ops, atau estimasi sandar + 60 menit). Setelahnya berlaku biaya tunggu per 30 menit dengan persetujuan Ops."}</p>
    </article>
  );
}
