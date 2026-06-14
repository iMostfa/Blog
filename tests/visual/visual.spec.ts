import { test, expect, type Page } from '@playwright/test';

// Pages to snapshot. Language is baked into the URL (en vs /ar/).
const PAGES = [
  { name: 'home-en', path: '/' },
  { name: 'home-ar', path: '/ar/' },
  { name: 'post-en', path: '/blog/upgrade-your-tools/' },
  { name: 'post-xstat', path: '/ai-learnings/mean-median-percentiles/' },
  { name: 'tag', path: '/tags/ai-learnings/' },
  { name: 'about-en', path: '/about/' },
  { name: 'about-ar', path: '/ar/about/' },
];

const THEMES = ['dark', 'light'] as const;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

// Block everything that isn't the local site so screenshots are hermetic and
// identical offline: the Giscus comments iframe (giscus.app) and the Chart.js
// CDN used by the .xstat post would otherwise be network-dependent.
async function blockExternal(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      route.continue();
    } else {
      route.abort();
    }
  });
}

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    for (const p of PAGES) {
      test(`${p.name} · ${theme} · ${vp.name}`, async ({ page }) => {
        await blockExternal(page);
        // Duckquill's theme-switcher.js reads localStorage "theme" on load.
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t);
        }, theme);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        await page.goto(p.path, { waitUntil: 'load' });

        // Kill transitions/animations and hide non-deterministic regions that
        // depend on blocked external resources (comments iframe, chart canvas).
        // visibility:hidden keeps their layout box so the page height is stable.
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              transition: none !important;
              animation: none !important;
              scroll-behavior: auto !important;
            }
            #comments, .xstat .chart-wrap { visibility: hidden !important; }
          `,
        });

        // Wait for web fonts so text metrics are settled before capture.
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot(
          `${p.name}-${theme}-${vp.name}.png`,
          { fullPage: true },
        );
      });
    }
  }
}
