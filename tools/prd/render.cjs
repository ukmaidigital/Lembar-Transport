#!/usr/bin/env node
/*
 * tools/prd/render.cjs — render PRD assets with Playwright + Chromium.
 *
 *   node tools/prd/render.cjs shots <html-dir> <png-dir>   screenshot every *.html in a folder
 *   node tools/prd/render.cjs shot  <in.html>  <out.png>   screenshot one file
 *   node tools/prd/render.cjs pdf   <in.html>  <out.pdf>   print the rendered PRD to A4 PDF
 *
 * A diagram HTML can pick its own viewport width and device scale factor with
 * <body data-width="1600" data-scale="2"> (defaults: 1600 px, 2x). The page is
 * captured full-height, so the diagram decides its own height.
 *
 * Requires the global Playwright install (npm i -g playwright) with a Chromium
 * build available (npx playwright install chromium).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadPlaywright() {
  const candidates = ['playwright'];
  try {
    const root = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    candidates.push(path.join(root, 'playwright'));
  } catch (_) { /* npm not available */ }
  for (const dir of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(dir, 'playwright'));
  }
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_) { /* try next */ }
  }
  throw new Error('Cannot find "playwright". Install it with: npm i -g playwright && npx playwright install chromium');
}

const fileUrl = (p) => 'file://' + path.resolve(p);

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function shot(browser, input, output) {
  const probe = await browser.newPage();
  await probe.goto(fileUrl(input));
  const { width, scale } = await probe.evaluate(() => ({
    width: Number(document.body.dataset.width) || 1600,
    scale: Number(document.body.dataset.scale) || 2,
  }));
  await probe.close();

  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(fileUrl(input));
  await settle(page);
  if (errors.length) throw new Error(`${input}: script error(s) while rendering:\n  ${errors.join('\n  ')}`);
  // Fit the viewport to the content so the capture has no trailing whitespace.
  const height = await page.evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height));
  await page.setViewportSize({ width, height: Math.max(height, 10) });
  await settle(page);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, fullPage: true });
  await context.close();
  console.log(`✓ ${path.relative(process.cwd(), output)}  ${width}×${height} css px @${scale}x`);
}

async function pdf(browser, input, output) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(fileUrl(input));
  await settle(page);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:8px;color:#6b7280;' +
      'padding:0 16mm;display:flex;justify-content:space-between;">' +
      '<span>Lembar Transport · Product Requirements Document</span>' +
      '<span>Halaman <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  await context.close();
  console.log(`✓ ${path.relative(process.cwd(), output)}`);
}

(async () => {
  const [cmd, a, b] = process.argv.slice(2);
  if (!cmd || !a || !b) {
    console.error(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\s*/, ''));
    process.exit(2);
  }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    if (cmd === 'shot') {
      await shot(browser, a, b);
    } else if (cmd === 'pdf') {
      await pdf(browser, a, b);
    } else if (cmd === 'shots') {
      const files = fs.readdirSync(a).filter((f) => f.endsWith('.html')).sort();
      if (files.length === 0) throw new Error(`No .html files in ${a}`);
      for (const f of files) {
        await shot(browser, path.join(a, f), path.join(b, f.replace(/\.html$/, '.png')));
      }
    } else {
      throw new Error(`Unknown command: ${cmd}`);
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
