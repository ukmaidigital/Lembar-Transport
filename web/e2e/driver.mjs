// Driver PWA: OTP login → home → offers (accept when available) → trip + name board → schedule → earnings → profile,
// then a fresh applicant completes the registration wizard with document uploads and submits for verification.
import { writeFileSync } from "node:fs";
import { launch, shot, finish, fail, otpLogin, BASE as base, OUT } from "./lib.mjs";

const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const { browser, page, errors } = await launch(mobile);
try {
  // --- Active demo driver: home, offers, accept, trip, schedule, earnings, profile
  await otpLogin(page, "/driver/masuk", "08120000001");
  await page.waitForURL(/\/driver$/);
  await page.waitForSelector("text=Trip hari ini");
  await page.waitForTimeout(1500);
  await shot(page, "driver-home");

  const offerCount = await page.locator("text=Tawaran trip").count();
  console.log("offers visible on home:", offerCount);
  await page.goto(base + "/driver/tawaran");
  await page.waitForSelector("text=Tawaran trip");
  await page.waitForTimeout(1200);
  await shot(page, "driver-offers");
  const accept = page.locator("button:has-text('Terima')").first();
  if (await accept.count()) {
    await accept.click();
    await page.waitForURL(/\/driver\/trip\//, { timeout: 15000 });
    await page.waitForSelector("text=Penumpang");
    await page.waitForTimeout(800);
    await shot(page, "driver-trip-assigned");
    console.log("accepted →", page.url());
  } else console.log("no offer to accept");

  // Demo trip assigned for tomorrow + name board
  await page.goto(base + "/driver");
  await page.waitForSelector("a[href^='/driver/trip/']");
  const tripHref = await page.locator("a[href^='/driver/trip/']").first().getAttribute("href");
  await page.goto(base + tripHref);
  await page.waitForSelector("text=Penumpang");
  await page.goto(base + tripHref + "/papan-nama");
  await page.waitForSelector("text=Kembali ke trip");
  await shot(page, "driver-nameboard");

  await page.goto(base + "/driver/jadwal");
  await page.waitForSelector("text=Mendatang");
  await page.waitForTimeout(800);
  await shot(page, "driver-schedule");
  await page.click("button:has-text('Hari libur')");
  await page.waitForSelector("text=Simpan hari libur");
  await shot(page, "driver-blocked-dates");

  await page.goto(base + "/driver/pendapatan");
  await page.waitForSelector("text=Mutasi");
  await page.waitForTimeout(800);
  await shot(page, "driver-earnings");
  await page.goto(base + "/driver/profil");
  await page.waitForSelector("text=Rekening payout");
  await shot(page, "driver-profile");

  // --- New applicant: registration wizard with document uploads → submitted
  const ctx2 = await browser.newContext({ locale: "id-ID", ...mobile });
  ctx2.setDefaultTimeout(Number(process.env.E2E_TIMEOUT ?? 60000));
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push("pageerror(p2): " + e.message));
  const phone = "0813" + String(Date.now()).slice(-8);
  await otpLogin(p2, "/driver/masuk?daftar=1", phone, { name: "Komang Arta" });
  await p2.waitForURL(/\/driver\/daftar/);
  await p2.waitForSelector("text=Pendaftaran mitra driver");
  await p2.fill('input[maxlength="16"]', "5201011503900001");
  await p2.fill('input[type="date"]', "1990-03-15");
  await p2.fill("textarea", "Jl. Raya Lembar No. 12, Lembar, Lombok Barat");
  await shot(p2, "driver-register-1");
  await p2.click("button:has-text('Simpan & lanjut')");
  await p2.waitForSelector("text=Kelas kendaraan");
  await p2.fill('input[placeholder="Toyota"]', "Toyota");
  await p2.fill('input[placeholder="Avanza"]', "Avanza");
  await p2.fill('input[placeholder="DR 1234 AB"]', "DR " + String(Date.now()).slice(-4) + " KA");
  await p2.click("button:has-text('Simpan & lanjut')");
  await p2.waitForSelector("text=Nomor rekening");
  await p2.fill('input[inputmode="numeric"] >> nth=0', "1234567890");
  await p2.fill('input.input >> nth=1', "Komang Arta");
  await p2.click("button:has-text('Simpan & lanjut')");
  await p2.waitForSelector("text=Unggah foto / PDF");
  // tiny valid PNG fixture
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const fixture = `${OUT}/fixture-doc.png`;
  writeFileSync(fixture, png);
  for (const type of ["ktp", "sim", "stnk", "skck", "selfie_ktp", "vehicle_photo", "bank_account"]) {
    const date = p2.locator(`input[type="date"][data-doc="${type}"]`);
    if (await date.count()) await date.fill("2028-06-30");
    await p2.locator(`input[type="file"][data-doc="${type}"]`).setInputFiles(fixture);
    await p2.waitForSelector(`input[type="file"][data-doc="${type}"]:not([disabled])`, { state: "attached", timeout: 15000 }).catch(() => {});
    await p2.waitForTimeout(500);
  }
  await p2.waitForSelector("button:has-text('Lanjut'):not([disabled])", { timeout: 20000 });
  await shot(p2, "driver-register-docs");
  await p2.click("button:has-text('Lanjut')");
  await p2.waitForSelector("text=Ringkasan");
  await p2.click("button:has-text('Kirim pendaftaran')");
  await p2.waitForURL(/\/driver\/verifikasi/);
  await p2.waitForSelector("text=Menunggu verifikasi");
  await shot(p2, "driver-verification");
  console.log("applicant submitted:", phone);
  await ctx2.close();
} catch (e) { await fail(page, browser, errors, "driver", e); }
await finish(browser, errors, "driver");
