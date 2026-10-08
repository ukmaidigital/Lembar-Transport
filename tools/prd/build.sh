#!/usr/bin/env bash
# Build every PRD asset from source:
#   1. tools/prd/diagrams/*.html  → docs/img/*.png            (Playwright screenshots)
#   2. docs/PRD-Lembar-Transport.md → tools/prd/build/prd.html (pandoc, images embedded)
#   3. prd.html → docs/PRD-Lembar-Transport.pdf               (Chromium print, A4)
#   4. PDF → docs/png/PRD-Lembar-Transport-NN.png             (pdftoppm, 144 dpi)
#
# Requirements: node + global playwright with chromium, pandoc, poppler-utils (pdftoppm, pdfinfo).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
for tool in node pandoc pdftoppm pdfinfo; do
  command -v "$tool" >/dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done
BUILD=tools/prd/build
mkdir -p "$BUILD" docs/img docs/png

echo "[1/4] Rendering diagrams → docs/img"
node tools/prd/render.cjs shots tools/prd/diagrams docs/img

echo "[2/4] Markdown → HTML"
pandoc docs/PRD-Lembar-Transport.md \
  --from gfm --to html5 --standalone --embed-resources \
  --resource-path=docs --css tools/prd/prd.css \
  --metadata pagetitle="PRD Lembar Transport" --metadata lang=id \
  --output "$BUILD/prd.html"

echo "[3/4] HTML → PDF"
node tools/prd/render.cjs pdf "$BUILD/prd.html" docs/PRD-Lembar-Transport.pdf

echo "[4/4] PDF → PNG pages → docs/png"
rm -f docs/png/PRD-Lembar-Transport-*.png
pdftoppm -png -r 144 docs/PRD-Lembar-Transport.pdf docs/png/PRD-Lembar-Transport
PAGES=$(pdfinfo docs/PRD-Lembar-Transport.pdf | awk '/^Pages:/ {print $2}')
COUNT=$(ls docs/png/PRD-Lembar-Transport-*.png | wc -l | tr -d ' ')
echo "PDF pages: $PAGES · PNG pages: $COUNT"
[ "$PAGES" = "$COUNT" ] || { echo "page count mismatch" >&2; exit 1; }
echo "done"
