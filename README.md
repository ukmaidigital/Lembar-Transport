# Lembar Transport

Web app pemesanan kendaraan (mobil + driver) dari **Pelabuhan Lembar, Lombok Barat**: harga tetap per zona, driver terverifikasi, titik temu jelas. Monorepo berisi **PRD** (`docs/`), **API Laravel 12** (`api/`), dan **frontend Next.js 15** (`web/`) dengan tiga antarmuka — **customer** (ID/EN), **driver** (PWA), dan **admin** (verifikasi & manajemen driver, dispatch, pembayaran, tarif, laporan).

Status: **Fase 1 MVP terimplementasi** sesuai PRD v1.0 (8 Oktober 2026) — seluruh kebutuhan *Must* Bab 7 plus beberapa *Should* yang murah (rating, riwayat, SOS, payout mingguan, feature flag).

![Ringkasan PRD satu halaman](docs/img/prd-overview.png)

## Mulai cepat (lokal, SQLite)

Prasyarat: PHP 8.3 + Composer, Node 22 + npm. Tidak perlu MySQL/Docker untuk mencoba.

```bash
scripts/dev.sh          # install deps, migrate + seed demo, jalankan API :8000, scheduler, queue, dan web :3000
scripts/dev.sh --reset  # buat ulang database demo
```

| Antarmuka | URL | Akun demo |
|---|---|---|
| Customer | http://localhost:3000 (EN: `/en`) | OTP ke nomor WhatsApp apa pun; **kode OTP ditampilkan di layar** pada mode non-produksi |
| Driver (PWA) | http://localhost:3000/driver | `08120000001` … `08120000006` (aktif), `08120000010` (menunggu verifikasi); daftar baru lewat `/driver/masuk?daftar=1` |
| Admin | http://localhost:3000/admin/masuk | `super@lembartransport.test`, `ops@…`, `verifier@…`, `finance@…` — kata sandi `password` (2FA opsional; wajib bila `LEMBAR_ADMIN_2FA_REQUIRED=true`) |
| API | http://localhost:8000/api/v1 | Lihat `api/routes/api.php` (129 endpoint, Bab 14 PRD) |

Pengujian:

```bash
cd api && vendor/bin/pint --test && php artisan test     # 32 feature test Pest (SQLite in-memory)
cd web && npm run lint && npx tsc --noEmit && npm run build
npm --prefix web run e2e                                 # Playwright: alur customer, driver, admin (screenshot di web/e2e/output)
```

Integrasi eksternal dijalankan dalam mode *stub* yang siap diganti: OTP/WhatsApp/email dicatat ke tabel `notification_logs` (driver `log`), gateway pembayaran di balik flag `payment.gateway_enabled`, berkas di disk privat dengan URL bertanda tangan (ganti `FILESYSTEM_DISK=s3` untuk produksi).

## Windows: semua di Docker (tanpa PHP/Node)

Prasyarat: **Docker Desktop** (backend WSL2, status *Engine running*) dan **Git**. Buka PowerShell:

```powershell
git clone -b claude/optimistic-faraday-9hgpbq https://github.com/ukmaidigital/Lembar-Transport.git "D:\Fullstack Project\Lembar Transport"
cd "D:\Fullstack Project\Lembar Transport"
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

Skrip menjalankan `docker compose up -d --build` dengan `docker-compose.yml` di root: **mysql** (8.4), **redis**, **api** (Laravel di PHP 8.3, `:8000`), **queue**, **scheduler**, dan **web** (Next.js dev server dengan hot reload, `:3000`). Start pertama 5–10 menit (unduh image, `composer install`, `npm ci`, migrasi + seed demo); berikutnya hanya beberapa detik dan data tetap tersimpan. Setelah siap, browser terbuka ke http://localhost:3000.

| Perintah | Fungsi |
|---|---|
| `scripts\setup-windows.ps1` | jalankan / perbarui stack |
| `scripts\setup-windows.ps1 -Stop` atau `docker compose down` | hentikan (data tetap) |
| `scripts\setup-windows.ps1 -Reset` | hapus database, vendor, node_modules lalu mulai dari nol |
| `docker compose logs -f api web` | lihat log |
| `docker compose exec mysql mysql -ulembar -psecret lembar` | MySQL CLI |
| `docker compose exec -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: api php artisan test` | jalankan Pest di container (SQLite in-memory, database dev tidak tersentuh) |

MySQL dari aplikasi Windows (HeidiSQL, DBeaver, MySQL Workbench): host `127.0.0.1`, port **3307** (bukan 3306, agar tidak bentrok dengan XAMPP/Laragon), user `lembar`, kata sandi `secret`, database `lembar`.

Troubleshooting: port bentrok → set variabel sebelum menjalankan skrip, misalnya `$env:WEB_PORT=3001; $env:API_PORT=8001; $env:MYSQL_PORT=3308`. Perubahan kode di `api/` dan `web/` langsung terbaca (bind mount). Bila `package-lock.json` / `composer.lock` berubah, dependensi dipasang ulang otomatis saat container restart (`docker compose restart api web`).

## Menjalankan dengan MySQL 8 + Redis (Docker)

Prasyarat tambahan: Docker Engine (daemon berjalan) dan Docker Compose v2+. API dan web tetap berjalan native; hanya database dan Redis yang di container (`deploy/docker-compose.dev.yml`).

```bash
scripts/dev.sh --mysql            # nyalakan MySQL 8.4 + Redis 7, tunggu sehat, migrate + seed, jalankan API/web
scripts/dev.sh --mysql --reset    # buat ulang database
# atau manual:
docker compose -f deploy/docker-compose.dev.yml up -d
```

| Hal | Nilai |
|---|---|
| Koneksi | `127.0.0.1:3306`, database `lembar`, user `lembar`, kata sandi `secret` (root: `root`) |
| Database lain | `lembar_test` (Pest), `lembar_e2e` (Playwright) — dibuat otomatis oleh `deploy/mysql-init/` saat volume pertama kali dibuat |
| Redis | `127.0.0.1:6379` (cache, sesi, queue) |
| CLI | `docker compose -f deploy/docker-compose.dev.yml exec mysql mysql -ulembar -psecret lembar` |
| Reset total | `docker compose -f deploy/docker-compose.dev.yml down -v` |

Untuk memakai MySQL secara permanen tanpa skrip, salin nilai `DB_*`/`REDIS_*` yang dikomentari di `api/.env.example` ke `api/.env`. Pengujian terhadap MySQL: `DB_CONNECTION=mysql DB_DATABASE=lembar_test DB_USERNAME=lembar DB_PASSWORD=secret php artisan test` dan `E2E_DB=mysql npm --prefix web run e2e`; CI juga menjalankan Pest di MySQL 8 (job `api-mysql`).

## Deploy (Docker Compose, MySQL 8 + Redis)

```bash
cp deploy/.env.example deploy/.env   # isi APP_KEY, domain, kredensial DB, rekening
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Layanan: `nginx` (satu entrypoint: `/api/*` → php-fpm, sisanya → Next.js), `api` (php-fpm, migrasi otomatis saat boot), `queue` (`queue:work redis`), `scheduler` (`schedule:work`: dispatch tiap menit, kedaluwarsa pembayaran, pengingat, auto-complete, pengecekan dokumen, payout mingguan, purge data), `web` (Next.js standalone), `mysql`, `redis`. CI (`.github/workflows/ci.yml`) menjalankan Pint + Pest, ESLint + tsc + `next build`, dan e2e Playwright.

## Arsitektur singkat

- **API** `api/` — Laravel 12, Sanctum token per peran (customer/driver 30 hari, admin 8 jam + TOTP), spatie/permission (`super_admin`, `ops`, `verifier`, `finance`), spatie/activitylog (audit). Domain di `app/Services`: `QuoteService` (tarif aktif, surcharge malam/hari raya, pembulatan, kunci harga 30 menit), `OrderStateMachine` (Lampiran C, riwayat append-only), `DispatchEngine` (kelayakan, skor 40/20/20/20, gelombang 5/10/semua, *first-accept-wins* dengan `lockForUpdate`, retry 30 menit, `needs_attention`), `PaymentService`, `CancellationPolicy` (tier ≥24 jam 0 % · 6–24 jam 50 % · <6 jam 100 %), `TripService` (jangkar sandar, tunggu gratis 60 menit, no-show, `client_timestamp` offline), `LedgerService` (komisi, top-up, payout, ambang saldo), `DriverOnboardingService`, `NotificationService`, `ReportService`. Aturan bisnis di `config/lembar.php`, dapat ditimpa dari admin (tabel `settings`).
- **Web** `web/` — Next.js 15 App Router, Tailwind v4, next-intl (customer ID/EN). BFF: token disimpan di cookie httpOnly oleh `/api/auth/session`, semua panggilan browser lewat `/api/proxy/*`; `middleware.ts` menjaga rute per area. Driver = PWA (manifest, service worker Serwist, antrean aksi offline di IndexedDB yang mengirim ulang status trip dengan stempel waktu klien).
- **Data** — migrasi MySQL-compatible (Bab 13), seeder: peran/izin, kelas kendaraan, zona/lokasi/titik temu/rute feri, tarif Lampiran B, pengaturan, admin, data demo.

## Pemetaan kebutuhan (Bab 7) → implementasi

| FR | Implementasi |
|---|---|
| CUS-01…06 pencarian, quote, kapasitas, feri, kontak+OTP, pembayaran | `web/src/components/booking-wizard.tsx`, `POST /public/quotes`, `POST /orders`, `OtpService`, `PaymentService::allowedMethods` |
| CUS-08…11, 14 tiket, "kapal sandar", pembatalan, status, bahasa | `web/src/components/ticket-view.tsx`, `/orders/{code}` (gate `phone_last4`), `/docked`, `/cancel`, next-intl `messages/{id,en}.json` |
| CUS-12/13 rating, riwayat | `pesanan/[kode]/ulasan`, `akun/pesanan`, `OrderService::rate` |
| DRV-01…05 daftar, dokumen, kendaraan, rekening, status verifikasi | `web/src/app/(driver)/driver/daftar`, `verifikasi`, `DriverOnboardingService` |
| DRV-06…12 online, tawaran, terima/tolak, jadwal, status trip, tunai, offline | `driver/page.tsx`, `tawaran`, `jadwal`, `trip/[kode]`, `DispatchEngine::accept`, `TripService::setStatus`, `web/src/lib/offline-queue.ts` |
| DRV-13…17 papan nama, no-show, pendapatan/top-up, profil/dokumen, SOS | `trip/[kode]/papan-nama`, `TripService::requestNoShow`, `pendapatan`, `profil/*`, `bantuan` + `trips/{code}/issues` |
| ADM-01…07 verifikasi & manajemen driver, kendaraan | `admin/verifikasi/[id]` (review berdampingan, checklist, keputusan), `admin/driver/*`, `admin/kendaraan` |
| ADM-09…14 pesanan, detail, assign manual, dispatch, pesanan manual, pembatalan | `admin/pesanan/*`, `admin/dispatch`, `OrderAdminController` (eligible drivers + override beralasan) |
| ADM-15…16 pembayaran, refund | `admin/pembayaran`, `PaymentAdminController` |
| ADM-17…19 tarif, surcharge, zona/titik temu | `admin/tarif`, `admin/zona`, `admin/titik-temu`, `CatalogController` |
| ADM-20…23 ledger, top-up, payout, laporan | `admin/keuangan/*`, `admin/laporan` (JSON + CSV), `ReportService` |
| ADM-24… pengaturan, staf, audit | `admin/pengaturan`, `admin/staf`, `admin/audit`, `SettingsController`, activitylog |
| SYS-01…08, 11, 12 auth/peran, notifikasi, audit, scheduler, idempotency, i18n, rate limit, retensi, flag | `bootstrap/app.php`, `routes/console.php`, `Idempotency-Key`, `SetLocale`, `throttle:*`, `MaintenanceService::purgeExpiredData`, `Setting::value` |

## Tangkapan layar

Hasil e2e terhadap data demo ada di [`docs/screenshots/`](docs/screenshots/): `customer-*.png` (landing, harga EN, wizard, tiket, pembatalan), `driver-*.png` (beranda, tawaran, trip, papan nama, jadwal, pendapatan, pendaftaran, verifikasi), `admin-*.png` (dashboard, verifikasi, driver, pesanan, papan, dispatch, assign, pembayaran, ledger, payout, tarif, zona, titik temu, laporan, pengaturan, staf, audit).

## Dokumen produk (PRD)

## Isi repositori

| Berkas | Keterangan |
|---|---|
| [`docs/PRD-Lembar-Transport.md`](docs/PRD-Lembar-Transport.md) | PRD lengkap (21 bab + lampiran) dalam Markdown |
| [`docs/PRD-Lembar-Transport.pdf`](docs/PRD-Lembar-Transport.pdf) | PRD yang sama dalam PDF A4 (hasil render) |
| [`docs/png/`](docs/png/) | PRD lengkap per halaman A4 dalam PNG (`PRD-Lembar-Transport-NN.png`) |
| [`docs/img/prd-overview.png`](docs/img/prd-overview.png) | Ringkasan PRD satu halaman (infografis) |
| [`docs/img/`](docs/img/) | Diagram dan wireframe yang disisipkan ke PRD (lihat tabel di bawah) |
| [`tools/prd/`](tools/prd/) | Sumber diagram (HTML + SVG), stylesheet cetak, dan skrip regenerasi |

![Ringkasan PRD satu halaman](docs/img/prd-overview.png)

## Diagram dan wireframe

| Gambar | Berkas | Sumber |
|---|---|---|
| Gambar 1 — Ringkasan PRD satu halaman | `docs/img/prd-overview.png` | `tools/prd/diagrams/prd-overview.html` |
| Gambar 2 — Alur pemesanan customer (swimlane) | `docs/img/flow-customer-booking.png` | `tools/prd/diagrams/flow-customer-booking.html` |
| Gambar 3 — Alur onboarding dan manajemen driver | `docs/img/flow-driver-onboarding.png` | `tools/prd/diagrams/flow-driver-onboarding.html` |
| Gambar 4 — State machine status pesanan | `docs/img/order-state-machine.png` | `tools/prd/diagrams/order-state-machine.html` |
| Gambar 5 — Sitemap per peran | `docs/img/sitemap.png` | `tools/prd/diagrams/sitemap.html` |
| Gambar 6 — Wireframe customer (5 layar) | `docs/img/wireframe-customer.png` | `tools/prd/diagrams/wireframe-customer.html` |
| Gambar 7 — Wireframe driver (6 layar) | `docs/img/wireframe-driver.png` | `tools/prd/diagrams/wireframe-driver.html` |
| Gambar 8 — Wireframe admin (4 layar) | `docs/img/wireframe-admin.png` | `tools/prd/diagrams/wireframe-admin.html` |
| Gambar 9 — Arsitektur sistem | `docs/img/architecture.png` | `tools/prd/diagrams/architecture.html` |
| Gambar 10 — ERD | `docs/img/erd.png` | `tools/prd/diagrams/erd.html` |

## Ringkasan keputusan produk

- **Model bisnis:** managed marketplace; kendaraan milik mitra, platform mengambil komisi (default 15 %), tarif **tetap** per zona tujuan × kelas kendaraan.
- **Mode pemesanan:** pre-booking yang dikaitkan dengan jadwal feri (operator + jam berangkat → estimasi sandar; tombol "Kapal sudah sandar" memulai tunggu gratis 60 menit); order dadakan via QR terminal memakai mesin yang sama.
- **Dispatch:** penawaran otomatis bergelombang ke driver yang layak (skor keadilan, penerimaan pertama menang) dengan admin sebagai fallback (`needs_attention`).
- **Pembayaran:** tunai dan transfer manual (Must); Midtrans Snap (Should); tanpa dompet saldo customer. `payment_status` terpisah dari `status` pesanan.
- **Arsitektur:** satu aplikasi Next.js (area `/`, `/driver` PWA, `/admin`) di atas Laravel REST API `/api/v1` (Sanctum), MySQL 8, Redis, object storage S3-compatible; hosting region Jakarta.
- **Fase:** Fase 0 discovery (2 minggu) → Fase 1 MVP (10 minggu + pilot 4 minggu) → Fase 2 → Fase 3. Rincian di Bab 5 dan 18 PRD.

## Regenerasi dokumen dan gambar

Prasyarat: Node.js ≥ 18 dengan Playwright global dan Chromium (`npm i -g playwright && npx playwright install chromium`), `pandoc`, dan `poppler-utils` (`pdftoppm`, `pdfinfo`).

```bash
bash tools/prd/build.sh                                      # semua: diagram → PNG, PRD → PDF → PNG per halaman
node tools/prd/render.cjs shots tools/prd/diagrams docs/img  # hanya diagram
node tools/prd/render.cjs shot tools/prd/diagrams/erd.html docs/img/erd.png   # satu diagram
```

Setiap diagram adalah berkas HTML mandiri (CSS + SVG inline, font Inter, tanpa ketergantungan jaringan); `tools/prd/diagrams/_lib.js` menyediakan helper kotak, panah, swimlane, dan legenda; `_wire.css` menyediakan gaya wireframe.

## Struktur repositori

```
README.md
api/                          Laravel 12 REST API (app/Services = domain, routes/api.php = 129 endpoint, tests/Feature = Pest)
web/                          Next.js 15 — src/app/(public)/[locale] customer · (driver)/driver PWA · (admin)/admin · api/ (BFF)
  e2e/                        alur Playwright end-to-end (customer, driver, admin) + run.sh
deploy/                       Dockerfile.api, Dockerfile.web, docker-compose.yml, nginx.conf, .env.example
scripts/dev.sh                stack pengembangan lokal (SQLite)
.github/workflows/ci.yml      Pint + Pest · ESLint + tsc + next build · e2e
docs/
  PRD-Lembar-Transport.md     PRD lengkap
  PRD-Lembar-Transport.pdf    hasil render
  img/                        diagram, wireframe, infografis (PNG, 2x)
  png/                        PRD per halaman A4 (PNG)
  screenshots/                tangkapan layar hasil e2e
tools/prd/
  diagrams/*.html             sumber setiap gambar
  diagrams/_lib.js, _lib.css  helper SVG dan gaya bersama
  diagrams/_wire.css          gaya wireframe
  prd.css                     stylesheet cetak PRD
  render.cjs                  renderer Playwright (screenshot dan PDF)
  build.sh                    pipeline lengkap
```
