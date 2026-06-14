# Visual snapshot tests

Screenshot-based regression tests for the blog, using
[Playwright](https://playwright.dev/docs/test-snapshots). They catch CSS/theme
regressions — e.g. an accent color that tints the whole background, or a widget
that loses its styling when variable names change.

## Why Docker?

Pixel screenshots depend on font rendering, which differs between macOS (arm64)
and the Linux (amd64) GitHub Actions runners. To keep baselines stable
everywhere, **everything runs inside one pinned `linux/amd64` Playwright
container** — the same image locally and in CI (`.github/workflows/visual.yml`).
Never generate baselines directly on your Mac; they won't match CI.

## Usage

```bash
# Update / create baselines (run once, and whenever a visual change is intended)
npm run snap:update

# Assert nothing changed (what CI runs)
npm run snap:test
```

Both build the container, install deps into a named Docker volume (your host
stays clean — no local `node_modules`), boot `zola serve`, and run the suite.

Commit the generated baselines under `tests/visual/visual.spec.ts-snapshots/`.
On failure, open `playwright-report/` (also uploaded as a CI artifact) to see the
expected / actual / diff images.

## What's covered

`visual.spec.ts` snapshots a matrix of:

- **Pages:** home, a normal post, the `.xstat` stats post, a tag page, about
- **Languages:** English + Arabic (RTL), via `/` vs `/ar/` URLs
- **Themes:** dark + light (forced via `localStorage.theme`)
- **Viewports:** desktop (1280) + mobile (390)

External, non-deterministic regions are neutralized: all non-localhost requests
are blocked (the Giscus comments iframe and the Chart.js CDN), and those regions
are hidden before capture. Transitions/animations are disabled and web fonts are
awaited so captures are stable.

## Keeping versions in sync

The Playwright version appears in three places and must match:
`package.json` (`@playwright/test`), `tests/visual/Dockerfile` (image tag), and
`.github/workflows/visual.yml` (`container.image`). The Zola version is pinned in
the Dockerfile and the workflow.
