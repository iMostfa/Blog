import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

// Fixed port + explicit base-url so Playwright always has a stable URL.
// (`zola serve` auto-bumps the port if the default is busy, which would break
// a hard-coded URL — pinning both avoids that.)
const PORT = 8765;
const baseURL = `http://localhost:${PORT}`;

// Two ways to serve the site:
//   - Bazel: a static server (STATIC_SERVER) serves the pre-built site (SITE_DIR).
//   - Legacy `npm run test:visual`: `zola serve` renders from the source tree.
const STATIC_SERVER = process.env.STATIC_SERVER;
const SITE_DIR = process.env.SITE_DIR;
const webServerCommand = STATIC_SERVER
  ? `./${STATIC_SERVER} ${SITE_DIR} ${PORT}`
  : `zola serve --interface 127.0.0.1 --port ${PORT} --base-url ${baseURL} --no-port-append`;

// `bazel run //:update_snapshots` sets BUILD_WORKSPACE_DIRECTORY; write baselines
// back into the real source tree instead of the read-only runfiles sandbox.
const wsDir = process.env.BUILD_WORKSPACE_DIRECTORY;
const updatingInBazel = !!process.env.UPDATE_SNAPSHOTS && !!wsDir;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  // The HTML reporter writes to disk; under Bazel the cwd is a read-only
  // runfiles tree, so use the plain list reporter there (CI=1).
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }], ['list']],
  ...(updatingInBazel
    ? {
        snapshotPathTemplate: join(
          wsDir!,
          'tests/visual/visual.spec.ts-snapshots/{arg}{-snapshotSuffix}{ext}',
        ),
      }
    : {}),
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
    command: webServerCommand,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
