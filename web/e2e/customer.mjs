// Customer: landing → prices (EN) → booking wizard with OTP → ticket → guest gate with last-4 digits → cancel preview.
import { launch, shot, finish, fail, BASE as base } from "./lib.mjs";

const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 900 } });
const phone = "0812" + String(Date.now()).slice(-8);
try {
await page.goto(base + "/");
await page.waitForSelector("select option:nth-child(2)", { state: "attached" });
await shot(page, "customer-landing");

await page.goto(base + "/en/harga");
await page.waitForSelector("table tbody tr");
await shot(page, "customer-prices-en");
await page.context().clearCookies();

// Wizard: pick a destination 2 days ahead, 10:00 WITA
await page.goto(base + "/pesan");
await page.waitForSelector("select option:nth-child(2)", { state: "attached" });
await page.selectOption("select", { index: 1 });
const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
await page.fill('input[type="date"]', d);
await page.fill('input[type="time"]', "10:00");
await page.click("button.btn-primary");
await page.waitForSelector("text=/dasar|base/");
await shot(page, "customer-wizard-vehicles");
await page.locator("button.btn-primary:has-text('Dipilih'), button.btn-ghost:has-text('Pilih')").first().click();
// Ferry step: skip ferry data
await page.waitForSelector("text=Data kapal");
await page.check('input[type="checkbox"]');
await page.click("button.btn-primary:has-text('Lanjut')");
// Contact: OTP
await page.waitForSelector("text=Verifikasi nomor WhatsApp");
await page.fill('input[placeholder="Nama sesuai KTP"]', "Budi Santoso");
await page.fill('input[inputmode="tel"] >> nth=0', phone);
await page.click("button:has-text('Kirim kode OTP')");
await page.waitForSelector("b.font-mono");
const code = await page.textContent("b.font-mono");
await page.fill('input[inputmode="numeric"]', code.trim());
await page.click("button:has-text('Verifikasi')");
await page.waitForSelector("text=Masuk sebagai");
await shot(page, "customer-wizard-contact");
await page.click("button.btn-primary:has-text('Lanjut')");
await page.waitForSelector("text=Metode pembayaran");
await shot(page, "customer-wizard-pay");
await page.click("button.btn-primary:has-text('Pesan sekarang')");
await page.waitForURL(/\/pesanan\/LT-/);
await page.waitForSelector("text=Kode pesanan");
const url = page.url();
await shot(page, "customer-ticket");
console.log("ORDER", url);

// Guest gate: fresh context opening the ticket must ask for last 4 digits
const ctx2 = await browser.newContext({ locale: "id-ID" });
const p2 = await ctx2.newPage();
await p2.goto(url);
await p2.waitForSelector("text=Buka tiket");
await p2.fill('input[inputmode="numeric"]', phone.slice(-4));
await p2.click("button:has-text('Buka')");
await p2.waitForSelector("text=Kode pesanan");
await shot(p2, "customer-ticket-gate-ok");
// Cancellation preview
await p2.goto(url + "/batal");
await p2.waitForSelector("text=Biaya pembatalan");
await shot(p2, "customer-cancel");
await ctx2.close();
} catch (e) { await fail(page, browser, errors, "customer", e); }
await finish(browser, errors, "customer");
