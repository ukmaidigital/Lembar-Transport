import { setRequestLocale } from "next-intl/server";

const FAQ = {
  id: [
    ["Bagaimana cara memesan?", "Pilih tujuan, tanggal dan perkiraan jam tiba, lalu masukkan data kapal dan nomor WhatsApp. Harga terkunci 30 menit dan Anda langsung menerima tiket dengan titik temu."],
    ["Bagaimana jika kapal terlambat?", "Waktu tunggu gratis 60 menit dihitung sejak kapal benar-benar sandar. Tekan tombol \"Kapal sudah sandar\" di tiket Anda agar driver bersiap."],
    ["Di mana titik temunya?", "Pintu keluar Terminal Penumpang (Gate A), sebelah loket informasi. Driver membawa papan nama bertuliskan nama Anda."],
    ["Metode pembayaran apa saja?", "Tunai ke driver di tujuan, atau transfer bank/QRIS dengan unggah bukti (dikonfirmasi tim Finance). Pembayaran kartu dan e-wallet menyusul."],
    ["Bisakah membatalkan pesanan?", "Bisa. ≥ 24 jam sebelum penjemputan gratis, 6–24 jam dikenakan 50 %, kurang dari 6 jam atau setelah driver berangkat 100 %."],
    ["Apakah harga sudah termasuk semuanya?", "Ya: BBM, jasa driver, dan pas pelabuhan. Tidak termasuk tiket objek wisata dan parkir di tujuan."],
    ["Bagaimana menghubungi Ops?", "Tim Ops bekerja 24 jam melalui WhatsApp yang tercantum di tiket Anda."],
  ],
  en: [
    ["How do I book?", "Choose a destination, arrival date and estimated time, then enter your ferry details and WhatsApp number. The price is locked for 30 minutes and you immediately receive a ticket with the meeting point."],
    ["What if the ferry is late?", "Free waiting (60 minutes) starts when the ferry actually docks. Tap \"Ferry has docked\" on your ticket so your driver gets ready."],
    ["Where is the meeting point?", "Passenger terminal exit (Gate A), next to the information desk. Your driver holds a name board with your name."],
    ["Which payment methods are available?", "Cash to the driver at your destination, or bank transfer/QRIS with proof upload (confirmed by our Finance team). Card and e-wallet payments are coming."],
    ["Can I cancel?", "Yes. Free at least 24 hours before pickup, 50 % between 6 and 24 hours, 100 % under 6 hours or once the driver is on the way."],
    ["Is everything included in the price?", "Yes: fuel, driver and harbour fees. Attraction tickets and parking at your destination are not included."],
    ["How do I reach Ops?", "Our Ops team is available 24 hours via the WhatsApp number on your ticket."],
  ],
};

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const items = FAQ[locale === "en" ? "en" : "id"];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">FAQ</h1>
      {items.map(([q, a]) => (
        <details key={q} className="card group">
          <summary className="cursor-pointer font-semibold">{q}</summary>
          <p className="mt-2 text-sm text-slate-600">{a}</p>
        </details>
      ))}
    </div>
  );
}
