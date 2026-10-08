import { setRequestLocale } from "next-intl/server";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const en = locale === "en";
  const items = en
    ? ["Lembar Transport connects passengers with verified partner drivers for transfers from Lembar Harbour. Vehicles are owned and operated by partner drivers.", "Prices are fixed per destination zone and vehicle class and include fuel, driver and harbour fees. Night and holiday surcharges are shown before you confirm.", "Bookings are confirmed when payment is received (cashless) or immediately (cash). A driver is assigned automatically; Ops may reassign when needed.", "Free waiting is 60 minutes after the ferry docks; a passenger may be marked as no-show after a further 30 minutes and at least three contact attempts.", "The cancellation policy on the dedicated page applies. Ops can waive fees for force majeure such as cancelled sailings.", "Your contact details are shared with the assigned driver only for the duration of the trip and 24 hours afterwards.", "Complaints are handled via Ops within 7 working days. Indonesian law applies."]
    : ["Lembar Transport mempertemukan penumpang dengan driver mitra terverifikasi untuk perjalanan dari Pelabuhan Lembar. Kendaraan dimiliki dan dioperasikan oleh driver mitra.", "Harga tetap per zona tujuan dan kelas kendaraan, sudah termasuk BBM, jasa driver, dan pas pelabuhan. Surcharge malam dan hari raya ditampilkan sebelum Anda mengonfirmasi.", "Pesanan terkonfirmasi saat pembayaran diterima (non-tunai) atau seketika (tunai). Driver ditugaskan otomatis; Ops dapat menugaskan ulang bila diperlukan.", "Tunggu gratis 60 menit sejak kapal sandar; penumpang dapat dinyatakan tidak hadir setelah 30 menit berikutnya dan minimal tiga upaya kontak.", "Kebijakan pembatalan pada halaman khusus berlaku. Ops dapat membebaskan biaya untuk force majeure seperti pelayaran yang dibatalkan.", "Data kontak Anda dibagikan kepada driver yang ditugaskan hanya selama perjalanan dan 24 jam setelahnya.", "Keluhan ditangani melalui Ops dalam 7 hari kerja. Hukum Indonesia berlaku."];
  return (
    <article className="mx-auto max-w-3xl text-sm text-slate-700">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{en ? "Terms and conditions" : "Syarat dan ketentuan"} <span className="text-sm font-normal text-slate-500">v1.0</span></h1>
      <ol className="list-decimal space-y-2 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ol>
    </article>
  );
}
