// Generates branded PNG assets by rendering HTML in headless Chromium:
//   - static/favicon.png            (512x512)  — "M" monogram
//   - static/apple-touch-icon.png   (180x180)  — same
//   - content/ai-learnings/2026-06-14-mean-median-percentiles/card.png (1200x628)
//
// Run inside the snapshot container:
//   docker run --rm --platform=linux/arm64 -v "$PWD":/work \
//     -v blog-snap-modules:/work/node_modules -w /work blog-snapshots \
//     sh -lc "node tests/visual/generate-assets.cjs"
//
// Re-run after editing this file to regenerate the assets.

const { chromium } = require('@playwright/test');

// ── Theme colors (match static/custom.css + the post) ───────────────────────
const BG = '#0d0d0f';
const FG = '#f0f0f0';
const ACCENT = '#9bb1d6';
const MUTED = 'rgba(255,255,255,0.55)';
const P50 = '#79c0ff';
const P90 = '#ff7b72';

const FONT =
  "-apple-system,'Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif";

// ── Favicon: a single bold M, sized to the viewport so it fills any size ────
const faviconHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;overflow:hidden}
  .icon{width:100vw;height:100vh;background:${BG};display:flex;
    align-items:center;justify-content:center}
  .icon span{font-family:${FONT};font-weight:800;color:${ACCENT};
    font-size:74vmin;line-height:1;letter-spacing:-0.04em;
    transform:translateY(-2%)}
</style></head><body><div class="icon"><span>M</span></div></body></html>`;

// ── Share card: title + percentile staircase, in the post's style ───────────
// The staircase path is reused from the post figure (viewBox 0 0 640 290).
const STAIR =
  'M70,250 L113,250 L113,229 L135,229 L135,208 L156,208 L156,187 L178,187 ' +
  'L178,166 L200,166 L200,145 L221,145 L221,124 L264,124 L264,103 L329,103 ' +
  'L329,82 L437,82 L437,61 L567,61 L567,40 L610,40';

const cardHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;overflow:hidden}
  .card{width:1200px;height:628px;background:${BG};color:${FG};
    box-sizing:border-box;padding:72px 76px;position:relative;
    font-family:${FONT};overflow:hidden}
  .kicker{font-size:22px;font-weight:700;letter-spacing:.18em;
    text-transform:uppercase;color:${ACCENT}}
  h1{font-size:78px;line-height:1.04;margin:26px 0 0;font-weight:800;
    letter-spacing:-0.02em;max-width:760px}
  .sub{margin-top:18px;font-size:30px;color:${MUTED};font-weight:500}
  .legend{position:absolute;left:76px;bottom:72px;display:flex;gap:34px;
    font-size:24px;color:${MUTED};align-items:center}
  .legend b{color:${FG};font-weight:700}
  .dot{display:inline-block;width:15px;height:15px;border-radius:50%;
    margin-right:10px;vertical-align:middle}
  .brand{position:absolute;right:76px;bottom:70px;font-size:26px;
    font-weight:700;color:${FG}}
  .brand .at{color:${ACCENT}}
  svg{position:absolute;right:40px;top:150px;width:620px;height:auto}
</style></head><body>
  <div class="card">
    <div class="kicker">AI Learnings</div>
    <h1>Mean, Median, and Percentiles</h1>
    <div class="sub">From first principles</div>

    <svg viewBox="0 0 640 290" fill="none">
      <line x1="70" y1="250" x2="612" y2="250" stroke="${MUTED}" stroke-width="2"/>
      <line x1="70" y1="250" x2="70" y2="40" stroke="${MUTED}" stroke-width="2"/>
      <line x1="70" y1="61" x2="437" y2="61" stroke="${P90}" stroke-width="2" stroke-dasharray="5 4"/>
      <line x1="437" y1="61" x2="437" y2="250" stroke="${P90}" stroke-width="2" stroke-dasharray="5 4"/>
      <line x1="70" y1="145" x2="200" y2="145" stroke="${P50}" stroke-width="2" stroke-dasharray="5 4"/>
      <line x1="200" y1="145" x2="200" y2="250" stroke="${P50}" stroke-width="2" stroke-dasharray="5 4"/>
      <path d="${STAIR}" stroke="${ACCENT}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="200" cy="145" r="6" fill="${P50}"/>
      <circle cx="437" cy="61" r="6" fill="${P90}"/>
      <text x="200" y="278" font-size="20" font-weight="700" fill="${P50}" text-anchor="middle" font-family="${FONT}">P50</text>
      <text x="437" y="278" font-size="20" font-weight="700" fill="${P90}" text-anchor="middle" font-family="${FONT}">P90</text>
    </svg>

    <div class="legend">
      <span><span class="dot" style="background:${P50}"></span><b>P50</b> median</span>
      <span><span class="dot" style="background:${P90}"></span><b>P90</b> the tail</span>
    </div>
    <div class="brand"><span class="at">/</span> mostafa</div>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  async function shoot(html, w, h, path) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path });
    await page.close();
    console.log('wrote', path, `(${w}x${h})`);
  }

  await shoot(faviconHtml, 512, 512, 'static/favicon.png');
  await shoot(faviconHtml, 180, 180, 'static/apple-touch-icon.png');
  await shoot(
    cardHtml,
    1200,
    628,
    'content/ai-learnings/2026-06-14-mean-median-percentiles/card.png',
  );

  await browser.close();
})();
