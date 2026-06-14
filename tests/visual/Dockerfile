# Deterministic environment for visual snapshots.
#
# Pinned to linux/arm64 so it runs native on Apple Silicon (no QEMU — emulated
# Chromium crashes) and matches the arm64 GitHub runners used in CI. The base
# image is the official Playwright image (browsers pre-installed); we only add
# the Zola binary on top.
#
# Keep the Playwright version here in sync with @playwright/test in package.json
# and with .github/workflows/visual.yml.
FROM --platform=linux/arm64 mcr.microsoft.com/playwright:v1.49.1-jammy

ARG ZOLA_VERSION=0.22.1
RUN curl -sSL "https://github.com/getzola/zola/releases/download/v${ZOLA_VERSION}/zola-v${ZOLA_VERSION}-aarch64-unknown-linux-gnu.tar.gz" \
      | tar -xz -C /usr/local/bin \
    && zola --version

WORKDIR /work
