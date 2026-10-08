<#
.SYNOPSIS
  Menjalankan Lembar Transport di Windows sepenuhnya dengan Docker Desktop (MySQL, Redis, API Laravel, queue, scheduler, Next.js).

.EXAMPLE
  cd "D:\Fullstack Project\Lembar Transport"
  powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1          # jalankan / perbarui
  powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Reset   # hapus database & mulai dari nol
  powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Stop    # hentikan semua container
#>
param(
  [switch]$Reset,
  [switch]$Stop,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`n[x] $msg" -ForegroundColor Red; exit 1 }

Step "Memeriksa Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker tidak ditemukan. Pasang Docker Desktop: https://www.docker.com/products/docker-desktop/" }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker Desktop belum berjalan. Buka Docker Desktop, tunggu status 'Engine running', lalu jalankan skrip ini lagi." }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker Compose v2 tidak tersedia. Perbarui Docker Desktop." }

if ($Stop) {
  Step "Menghentikan container"
  docker compose down
  exit 0
}

if ($Reset) {
  Step "Reset: menghapus container dan volume (database, vendor, node_modules)"
  docker compose down -v
  Remove-Item -Force -ErrorAction SilentlyContinue "api\storage\.lembar-ready"
}

$ports = @{ MYSQL_PORT = 3307; API_PORT = 8000; WEB_PORT = 3000; REDIS_PORT = 6379 }
foreach ($name in $ports.Keys) {
  $override = [Environment]::GetEnvironmentVariable($name)
  $port = if ($override) { [int]$override } else { $ports[$name] }
  $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -notmatch 'com.docker|docker|wslrelay|vpnkit' }
  if ($busy) { Write-Host "[!] Port $port ($name) sedang dipakai aplikasi lain. Set variabel `$env:$name ke port lain bila container gagal start." -ForegroundColor Yellow }
}

Step "Membangun dan menyalakan container (pertama kali bisa 5-10 menit: unduh image, composer install, npm ci)"
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail "docker compose up gagal. Lihat pesan di atas atau jalankan: docker compose logs" }

function Wait-Url($url, $label, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  Write-Host -NoNewline "Menunggu $label "
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -lt 500) { Write-Host " siap" -ForegroundColor Green; return $true }
    } catch { }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 5
  }
  Write-Host " belum siap" -ForegroundColor Yellow
  return $false
}

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { 8000 }
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { 3000 }
$mysqlPort = if ($env:MYSQL_PORT) { $env:MYSQL_PORT } else { 3307 }
$apiOk = Wait-Url "http://localhost:$apiPort/up" "API" 900
$webOk = Wait-Url "http://localhost:$webPort/" "web" 900
if (-not ($apiOk -and $webOk)) {
  Write-Host "Container masih menyiapkan diri. Pantau dengan: docker compose logs -f api web" -ForegroundColor Yellow
}

Write-Host @"

  Lembar Transport berjalan
  -------------------------
  Customer   http://localhost:$webPort            (EN: /en)
  Driver     http://localhost:$webPort/driver     OTP demo: 08120000001 ... 08120000006 (kode OTP tampil di layar)
  Admin      http://localhost:$webPort/admin/masuk  super@lembartransport.test / password  (juga ops@, verifier@, finance@)
  API        http://localhost:$apiPort/api/v1

  MySQL      127.0.0.1:$mysqlPort  database lembar  user lembar / secret  (root / root)
             CLI: docker compose exec mysql mysql -ulembar -psecret lembar
  Redis      127.0.0.1:6379

  Log        docker compose logs -f api web
  Berhenti   docker compose down        (data tetap)
  Reset      powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Reset

"@ -ForegroundColor White

if (-not $NoBrowser -and $webOk) { Start-Process "http://localhost:$webPort" }
