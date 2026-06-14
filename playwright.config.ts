import { defineConfig } from '@playwright/test';

// Fixed port + explicit base-url so Playwright always has a stable URL.
// (`zola serve` auto-bumps the port if the default is busy, which would break
// a hard-coded URL — pinning both avoids that.)
const PORT = 8765;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: {
    toHaveScreenshot: {
      // Small tolerance for sub-pixel noise; the suite always runs in the same
      // linux/amd64 container, so diffs should otherwise be exact.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL,
    browserName: 'chromium',
    // Deterministic rendering across machines.
    deviceScaleFactor: 1,
    // Required to launch Chromium as root inside the container. Everything runs
    // native arm64 (locally on Apple Silicon and on arm64 GitHub runners), so no
    // emulation workarounds are needed.
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  webServer: {
    // --no-port-append: base-url already carries the port, so don't double it.
    command: `zola serve --interface 0.0.0.0 --port ${PORT} --base-url ${baseURL} --no-port-append`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
