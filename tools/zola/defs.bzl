"""Bazel rule for building a Zola static site hermetically.

`zola_site` runs `zola build` against the repo sources using the pinned Zola
binary from @zola, emitting the generated site as a single directory output
(TreeArtifact). The build is offline: every remote reference in the content
(Chart.js, giscus, asciinema, fonts) is fetched by the *browser* at runtime,
not by `zola build`.
"""

def _zola_site_impl(ctx):
    # Namespace the output per target so multiple zola_site targets in the same
    # package (e.g. site + site_test) don't collide on bazel-bin/public.
    out_name = ctx.attr.out if ctx.attr.out else (ctx.label.name + "/public")
    out = ctx.actions.declare_directory(out_name)

    # `--root` is the directory that contains config.toml. For a site defined in
    # the repo root package that is the exec root itself (".").
    root = ctx.file.config.dirname
    if root == "":
        root = "."

    args = ctx.actions.args()
    args.add("--root", root)
    args.add("build")
    args.add("--output-dir", out.path)
    args.add("--force")
    if ctx.attr.base_url:
        args.add("--base-url", ctx.attr.base_url)

    ctx.actions.run(
        executable = ctx.executable._zola,
        arguments = [args],
        inputs = depset([ctx.file.config] + ctx.files.srcs),
        outputs = [out],
        mnemonic = "ZolaBuild",
        progress_message = "Building Zola site %s" % ctx.label,
    )

    return [DefaultInfo(files = depset([out]))]

zola_site = rule(
    implementation = _zola_site_impl,
    doc = "Builds a Zola site into a directory output.",
    attrs = {
        "config": attr.label(
            allow_single_file = True,
            mandatory = True,
            doc = "The site's config.toml.",
        ),
        "srcs": attr.label_list(
            allow_files = True,
            mandatory = True,
            doc = "All other inputs: content/, templates/, static/, i18n/, themes/.",
        ),
        "base_url": attr.string(
            doc = "Override config base_url (e.g. a localhost URL for tests).",
        ),
        "out": attr.string(
            default = "",
            doc = "Output directory name (defaults to <name>/public).",
        ),
        "_zola": attr.label(
            default = "@zola//:zola_bin",
            executable = True,
            cfg = "exec",
        ),
    },
)
