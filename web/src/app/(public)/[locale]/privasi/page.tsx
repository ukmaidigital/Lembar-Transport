import { setRequestLocale } from "next-intl/server";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const en = locale === "en";
  const items = en
    ? ["We process your name, WhatsApp number, optional email and booking details to provide the transfer service (contract performance under Indonesia's Personal Data Protection Law, UU 27/2022).", "Driver identity documents are stored encrypted and are only accessible to verification staff; access is logged.", "Retention: bookings and payments 10 years (bookkeeping), guest customer data anonymised 2 years after the last booking, OTP codes 24 hours, notification logs 90 days.", "Data is hosted in Indonesia. Payment, messaging and cloud providers act as processors under agreement.", "You may request access, correction, deletion or a copy of your data via Ops; we respond within 3×24 hours.", "We never sell your data and do not use third-party advertising cookies."]
    : ["Kami memproses nama, nomor WhatsApp, email (opsional), dan data pemesanan untuk menyediakan layanan transfer (pelaksanaan kontrak berdasarkan UU Pelindungan Data Pribadi 27/2022).", "Dokumen identitas driver disimpan terenkripsi dan hanya dapat diakses staf verifikasi; setiap akses dicatat.", "Retensi: pesanan dan pembayaran 10 tahun (pembukuan), data customer tamu dianonimkan 2 tahun setelah pesanan terakhir, kode OTP 24 jam, log notifikasi 90 hari.", "Data disimpan di Indonesia. Penyedia pembayaran, pesan, dan cloud bertindak sebagai pemroses berdasarkan perjanjian.", "Anda dapat meminta akses, perbaikan, penghapusan, atau salinan data melalui Ops; kami menanggapi dalam 3×24 jam.", "Kami tidak pernah menjual data Anda dan tidak memakai cookie iklan pihak ketiga."];
  return (
    <article className="mx-auto max-w-3xl text-sm text-slate-700">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">{en ? "Privacy policy" : "Kebijakan privasi"} <span className="text-sm font-normal text-slate-500">v1.0</span></h1>
      <ul className="list-disc space-y-2 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </article>
  );
}
