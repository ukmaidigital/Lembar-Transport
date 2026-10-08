// Admin: login → dashboard → verification review (approve documents, activate) → drivers → orders/board → dispatch →
// order detail with manual assignment → payments, ledger, payout, tariffs, zones, meeting points, reports, settings, staff, audit, vehicles.
import { launch, shot, finish, fail, BASE as base } from "./lib.mjs";

const { browser, page, errors } = await launch({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(base + "/admin/masuk");
  await page.fill('input[type="email"]', "super@lembartransport.test");
  await page.fill('input[type="password"]', "password");
  await page.click("button:has-text('Masuk')");
  await page.waitForURL(/\/admin$/);
  await page.waitForSelector("text=Penjemputan hari ini");
  await page.waitForTimeout(1200);
  await shot(page, "admin-dashboard");

  // Verification queue → first applicant → approve all pending docs → activate
  await page.goto(base + "/admin/verifikasi");
  await page.waitForSelector("table");
  await page.waitForTimeout(800);
  await shot(page, "admin-verification-queue");
  const review = page.locator("a:has-text('Review')").last();
  if (await review.count()) {
    await review.click();
    await page.waitForSelector("text=Daftar periksa");
    await page.waitForTimeout(800);
    await shot(page, "admin-verification-detail");
    // approve pending docs one by one by clicking list rows then "Setujui"
    for (let i = 0; i < 9; i++) {
      const rows = page.locator("li:has(span:has-text('Menunggu review'))");
      if (!(await rows.count())) break;
      await rows.first().click();
      await page.waitForTimeout(300);
      const btn = page.locator("button:has-text('Setujui')");
      if (!(await btn.count())) break;
      await btn.click();
      await page.waitForTimeout(900);
    }
    await shot(page, "admin-verification-approved");
    const activate = page.locator("button:has-text('Aktifkan')");
    console.log("activate enabled:", await activate.isEnabled().catch(() => false));
    if (await activate.isEnabled().catch(() => false)) {
      await activate.click();
      await page.fill("textarea", "Semua dokumen valid.");
      await page.click("button:has-text('Konfirmasi')");
      await page.waitForURL(/\/admin\/verifikasi$/);
      console.log("applicant activated");
    }
  }

  // Drivers
  await page.goto(base + "/admin/driver");
  await page.waitForSelector("table tbody tr");
  await shot(page, "admin-drivers");
  await page.locator("a:has-text('Detail')").first().click();
  await page.waitForSelector("text=Trip terbaru");
  await page.waitForTimeout(600);
  await shot(page, "admin-driver-detail");

  // Orders table + board + detail with assign dialog
  await page.goto(base + "/admin/pesanan");
  await page.waitForSelector("table tbody tr");
  await page.waitForTimeout(600);
  await shot(page, "admin-orders");
  await page.click("button:has-text('Papan')");
  await page.waitForTimeout(500);
  await shot(page, "admin-orders-board");
  await page.goto(base + "/admin/dispatch");
  await page.waitForSelector("text=Driver online");
  await page.waitForTimeout(800);
  await shot(page, "admin-dispatch");
  const attn = page.locator("table a.font-mono").first();
  if (await attn.count()) {
    await attn.click();
    await page.waitForSelector("text=Riwayat status");
    await page.waitForTimeout(600);
    await shot(page, "admin-order-detail");
    const assign = page.locator("button:has-text('Tugaskan driver'), button:has-text('Ganti driver')").first();
    if (await assign.count()) {
      await assign.click();
      await page.waitForSelector("text=Kelayakan");
      await page.waitForTimeout(800);
      await shot(page, "admin-order-assign");
      const pick = page.locator("button:has-text('Pilih')").first();
      if (await pick.count()) { await pick.click(); await page.click("button:has-text('Konfirmasi penugasan')"); await page.waitForTimeout(1500); console.log("manual assign done"); await shot(page, "admin-order-assigned"); }
    }
  }

  for (const [path, wait, name] of [["/admin/pembayaran", "text=Menunggu review", "payments"], ["/admin/keuangan/ledger", "text=Top-up", "ledger"], ["/admin/keuangan/payout", "text=Siap dibayar", "payout"], ["/admin/tarif", "table", "tariffs"], ["/admin/zona", "table", "zones"], ["/admin/titik-temu", "text=Titik temu", "meeting-points"], ["/admin/laporan", "text=Laporan", "reports"], ["/admin/pengaturan", "text=Komisi platform", "settings"], ["/admin/staf", "text=Matriks peran", "staff"], ["/admin/audit", "table", "audit"], ["/admin/kendaraan", "table", "vehicles"]]) {
    await page.goto(base + path);
    await page.waitForSelector(wait);
    await page.waitForTimeout(900);
    await shot(page, `admin-${name}`);
  }
} catch (e) { await fail(page, browser, errors, "admin", e); }
await finish(browser, errors, "admin");
