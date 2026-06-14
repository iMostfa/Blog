# Blog

A bilingual (en/ar) [Zola](https://www.getzola.org/) static site using the
`duckquill` theme. Builds and tests run through [Bazel](https://bazel.build) —
fully hermetic (Bazel fetches its own Zola, Node, and Chromium).

## Setup

```sh
# 1. Clone with the theme submodule
git clone --recurse-submodules <repo-url>
# (already cloned? run: git submodule update --init --recursive)

# 2. Install Bazelisk (picks up the pinned Bazel version in .bazelversion)
brew install bazelisk        # macOS; or see https://github.com/bazelbuild/bazelisk
```

Nothing else to install — Zola, Node, and Chromium are downloaded by Bazel.

## Build

```sh
bazel build //:site          # → bazel-bin/site/public
```

## Test

```sh
bazel test //...             # hermetic build check (any OS)
bazel test //:visual_test    # Playwright visual snapshots (Linux/CI; see note)
```

The visual baselines are Linux PNGs, so `//:visual_test` is authoritative on
Linux/CI. See [BAZEL.md](BAZEL.md) for details, the snapshot-update target, and
how to bump versions. The legacy `npm`/Docker visual flow and the Zola→Pages
deploy remain unchanged.
