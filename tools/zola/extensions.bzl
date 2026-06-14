"""Hermetic Zola binary as a bzlmod module extension.

Downloads the pinned Zola release tarball for the host platform and exposes the
binary as `@zola//:zola_bin`. The build is fully offline once the tarball is
fetched, so `zola build`/`zola check` run deterministically under Bazel.

To bump Zola: change ZOLA_VERSION and refresh ZOLA_SHA256 (each value is the
sha256 of the corresponding GitHub release tarball).
"""

ZOLA_VERSION = "0.22.1"

# sha256 of https://github.com/getzola/zola/releases/download/v<ZOLA_VERSION>/zola-v<ZOLA_VERSION>-<triple>.tar.gz
ZOLA_SHA256 = {
    "x86_64-unknown-linux-gnu": "0ca09aa40376aaa9ddfb512ff9ad963262ef95edb0d0f2d5ec6961b6f5cf22ef",
    "aarch64-unknown-linux-gnu": "8af437ec6352f33ccd24d7a1cfcb54a3db95d3ce376dc69525b4ef3fb6b8c1d1",
    "aarch64-apple-darwin": "46ac45a9e7628dba8593b124ee8794f4f9aa1c6b569918ecd4bbc5d0be190515",
    "x86_64-apple-darwin": "3898709e154ae0593933264a540c869348bdb10d7f1b03a42dfb78d63703b3b5",
}

def _host_triple(rctx):
    os = rctx.os.name.lower()
    arch = rctx.os.arch.lower()
    is_arm = arch in ("aarch64", "arm64")
    if os.startswith("mac") or os.startswith("darwin") or "os x" in os:
        return "aarch64-apple-darwin" if is_arm else "x86_64-apple-darwin"
    if os.startswith("linux"):
        return "aarch64-unknown-linux-gnu" if is_arm else "x86_64-unknown-linux-gnu"
    fail("Unsupported host platform for Zola: os=%s arch=%s" % (os, arch))

def _zola_repo_impl(rctx):
    triple = _host_triple(rctx)
    url = "https://github.com/getzola/zola/releases/download/v{v}/zola-v{v}-{t}.tar.gz".format(
        v = ZOLA_VERSION,
        t = triple,
    )
    rctx.download_and_extract(
        url = url,
        sha256 = ZOLA_SHA256[triple],
    )
    rctx.file("BUILD.bazel", """\
load("@bazel_skylib//rules:native_binary.bzl", "native_binary")

# The release tarball extracts a single executable named `zola`.
native_binary(
    name = "zola_bin",
    src = "zola",
    out = "zola",
    visibility = ["//visibility:public"],
)

exports_files(["zola"], visibility = ["//visibility:public"])
""")

_zola_repo = repository_rule(
    implementation = _zola_repo_impl,
    doc = "Downloads the pinned Zola binary for the host platform.",
)

def _zola_ext_impl(_mctx):
    _zola_repo(name = "zola")

zola = module_extension(
    implementation = _zola_ext_impl,
    doc = "Provides @zola//:zola_bin, the pinned Zola binary.",
)
