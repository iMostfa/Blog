# Building & testing with Bazel

This repo can be built and tested with [Bazel](https://bazel.build) alongside the
existing npm/Docker flow. Bazel is **fully hermetic**: it downloads its own pinned
Zola binary, Node, and Chromium — nothing needs to be installed on the host (the
Bazel version itself is pinned in `.bazelversion` and fetched by bazelisk).

## Common commands

| Command | What it does |
| --- | --- |
| `bazel build //:site` | Builds the production site → `bazel-bin/site/public` |
| `bazel test //:check_site` | Hermetic, cross-platform gate: asserts the site builds offline |
| `bazel test //...` | Runs all non-manual tests (`check_site`) — green on any OS |
| `bazel test //:visual_test` | Playwright visual snapshots (see caveat below) |
| `bazel run //:update_snapshots` | Regenerates visual baselines into the source tree |

## How it fits together

- **`//tools/zola`** — a bzlmod module extension downloads the pinned Zola
  (`extensions.bzl`, version + sha256s) and exposes `@zola//:zola_bin`. The
  `zola_site` rule (`defs.bzl`) runs `zola build` into a directory output.
- **`//:site`** / **`//:site_test`** — the production build and a test build with a
  `localhost` base_url for serving under tests.
- **`//tools/serve`** — a dependency-free Node static server (run via
  `aspect_rules_js`) that serves the built site to Playwright.
- **`//:visual_test`** — `rules_playwright` provides a checksum-pinned Chromium;
  the suite runs against the static-served `//:site_test`.

## Visual baselines caveat ⚠️

The committed baselines under `tests/visual/visual.spec.ts-snapshots/` are
`*-linux.png`. Playwright compares against baselines for the **host OS**, so:

- On **Linux** (CI), `bazel test //:visual_test` compares against the `-linux`
  baselines.
- On **macOS**, there are no `-darwin` baselines, so the test reports "snapshot
  doesn't exist" / writes them locally. This is expected — `visual_test` is tagged
  `manual` so it is excluded from `bazel test //...` and won't make local runs red.
  Generate local baselines with `bazel run //:update_snapshots` if you want to
  compare on macOS.

Also note the Bazel visual path uses `rules_playwright`'s own Chromium, which may
render slightly differently from the Docker/Playwright-image flow that produced the
committed baselines (`.github/workflows/visual.yml`). The Docker flow remains the
authoritative visual gate; the Bazel visual run in `.github/workflows/bazel.yml` is
non-blocking until baselines are regenerated for the Bazel toolchain.

## Bumping versions

- **Zola**: edit `ZOLA_VERSION` + `ZOLA_SHA256` in `tools/zola/extensions.bzl`.
- **Playwright/Chromium**: bump `@playwright/test` in `package.json`, regenerate the
  lockfile with hermetic pnpm — `rm pnpm-lock.yaml && bazel run -- @pnpm --dir "$PWD"
  install --lockfile-only` — and set `playwright_version` in `MODULE.bazel`. Then
  refresh the browser hashes: `bazel build //tools/playwright:integrity_map` and update
  `integrity_path_map` (convert the emitted `sha256-<hex>` to SRI base64).

> Bazel is pinned to **9.x** (`.bazelversion`). `aspect_rules_js` 3.x requires a
> **pnpm v9** lockfile (`lockfileVersion: '9.0'`); regenerate it with the `@pnpm`
> command above rather than host `pnpm`.
