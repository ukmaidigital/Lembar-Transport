#!/usr/bin/env python3
"""Consistency checks for the PRD sources.

- every image referenced from the markdown exists
- every PNG in docs/img is referenced from the markdown or README
- FR-* requirement IDs are unique and every referenced ID is defined
- every markdown table has a consistent column count
- table-of-contents anchors match GitHub-style heading slugs (and pandoc ids when built)
- (after build) PDF page count equals the number of PNG pages
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / "docs" / "PRD-Lembar-Transport.md"
README = ROOT / "README.md"
IMG_DIR = ROOT / "docs" / "img"
HTML = ROOT / "tools" / "prd" / "build" / "prd.html"
PDF = ROOT / "docs" / "PRD-Lembar-Transport.pdf"
PNG_DIR = ROOT / "docs" / "png"

errors = []
text = MD.read_text(encoding="utf-8")
readme = README.read_text(encoding="utf-8") if README.exists() else ""

# 1. image links resolve
refs = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", text)
for ref in refs:
    if not (MD.parent / ref).exists():
        errors.append(f"missing image: {ref}")

# 2. every PNG referenced somewhere
for png in sorted(IMG_DIR.glob("*.png")):
    rel = f"img/{png.name}"
    if rel not in text and png.name not in readme:
        errors.append(f"unreferenced image: {png.name}")

# 3. FR IDs
defined = re.findall(r"^\| (FR-[A-Z]{3}-\d{2}) \|", text, flags=re.M)
dupes = {d for d in defined if defined.count(d) > 1}
for d in sorted(dupes):
    errors.append(f"duplicate requirement id: {d}")
for ref in sorted(set(re.findall(r"FR-[A-Z]{3}-\d{2}", text))):
    if ref not in defined:
        errors.append(f"referenced but undefined requirement id: {ref}")

# 4. table shapes
lines = text.splitlines()
i = 0
while i < len(lines):
    if lines[i].startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1]):
        cols = lines[i].count("|") - 1
        j = i + 2
        while j < len(lines) and lines[j].startswith("|"):
            # ignore escaped pipes and pipes inside backticks
            row = re.sub(r"`[^`]*`", "", lines[j]).replace("\\|", "")
            if row.count("|") - 1 != cols:
                errors.append(f"table column mismatch at line {j + 1}: expected {cols}, got {row.count('|') - 1}")
            j += 1
        i = j
    else:
        i += 1

# 5. TOC anchors vs heading slugs
def gh_slug(heading: str) -> str:
    s = heading.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"\s", "-", s)

headings = re.findall(r"^## (.+)$", text, flags=re.M)
slugs = {gh_slug(h) for h in headings}
toc_links = re.findall(r"\]\(#([^)]+)\)", text)
for link in toc_links:
    if link not in slugs:
        errors.append(f"TOC anchor without matching heading: #{link}")
if HTML.exists():
    html = HTML.read_text(encoding="utf-8", errors="ignore")
    ids = set(re.findall(r'id="([^"]+)"', html))
    for link in toc_links:
        if link not in ids:
            errors.append(f"pandoc did not generate id for TOC anchor: #{link}")

# 6. page counts
if PDF.exists():
    out = subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", out, flags=re.M).group(1))
    pngs = len(list(PNG_DIR.glob("PRD-Lembar-Transport-*.png")))
    if pages != pngs:
        errors.append(f"PDF has {pages} pages but {pngs} PNG pages exist")
    print(f"PDF pages: {pages} · PNG pages: {pngs}")

print(f"images referenced: {len(refs)} · requirement ids: {len(defined)} · tables checked · headings: {len(headings)}")
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)
print("all checks passed")
