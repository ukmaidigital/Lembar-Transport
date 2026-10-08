// Shared helpers for the end-to-end flows (plain Playwright scripts, no test runner needed).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

export const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
export const OUT = process.env.E2E_OUTPUT ?? new URL("./output", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

export async function launch(options = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "id-ID", ...options });
  const page = await context.newPage();
  const errors = [];
  const ignore = options.ignore ?? /auth\/me|otp\/request|driver\/masuk/;
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("response", (r) => { if (r.status() >= 500 || (r.status() >= 400 && !ignore.test(r.url()))) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return { browser, context, page, errors };
}

export const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

/** Phone + OTP login; the API exposes the OTP code in non-production so the flow is fully automatic. */
export async function otpLogin(page, url, phone, { name } = {}) {
  await page.goto(BASE + url);
  if (name) await page.fill('input[placeholder="Nama sesuai KTP"]', name);
  await page.fill('input[inputmode="tel"]', phone);
  await page.click("button:has-text('Kirim kode OTP')");
  await page.waitForSelector("b.font-mono");
  const code = (await page.textContent("b.font-mono")).trim();
  await page.fill('input[inputmode="numeric"]', code);
  await page.click("button:has-text('Masuk'), button:has-text('Daftar'), button:has-text('Verifikasi')");
}

export async function finish(browser, errors, label) {
  await browser.close();
  if (errors.length) { console.log(`${label}: ERRORS\n` + errors.join("\n")); process.exit(1); }
  console.log(`${label}: OK`);
}

export async function fail(page, browser, errors, label, e) {
  console.log(`${label}: FAIL ${String(e.message).split("\n")[0]} at ${page.url()}`);
  await page.screenshot({ path: `${OUT}/${label}-failure.png`, fullPage: true }).catch(() => {});
  if (errors.length) console.log("ERRORS\n" + errors.join("\n"));
  await browser.close(); process.exit(1);
}
