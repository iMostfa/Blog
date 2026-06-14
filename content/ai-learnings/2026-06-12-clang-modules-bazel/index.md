+++
title = "Clang Modules and Bazel, From First Principles"
date = 2026-06-12

[taxonomies]
tags = ["bazel", "build-systems", "ios", "swift", "ai-learnings"]

[extra]
card = "card.png"
+++

This write-up was distilled from a real migration session: enabling explicit Clang modules
(`swift.use_c_modules`) in a large iOS monorepo, debugged end-to-end with an AI agent. One build flag
flipped; nine builds failed; none of the failing code had changed. The document below builds every
concept needed to understand why — header resolution, module maps, PCMs, Bazel's action model, aspects —
and then walks through each failure as a case study. Prerequisites: you can read Swift/Objective-C and
know Bazel has "rules". Nothing more is assumed.

<style>
.xmod { --xpos:#1a7f37; --xneg:#b3261e; --xwarn:#9a6700; }
[data-theme="dark"] .xmod { --xpos:#7ee787; --xneg:#ff7b72; --xwarn:#e3b341; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .xmod { --xpos:#7ee787; --xneg:#ff7b72; --xwarn:#e3b341; } }
.xmod .toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.25rem 2rem; list-style:none; padding:0; margin:.5rem 0 0; }
.xmod .toc-grid a { display:block; padding:.15rem 0; }
.xmod .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:.75rem; margin:1rem 0; }
.xmod .card { background:var(--bg-light); border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; }
.xmod .card h4 { margin:.1rem 0 .5rem; font-size:1rem; }
.xmod .card p, .xmod .card li { font-size:.9rem; margin:.5rem 0; }
.xmod .card ul { margin:.25rem 0; padding-left:1.25rem; }
.xmod pre { font-size:.8rem; line-height:1.5; overflow-x:auto; }
.xmod .err { color:var(--xneg); font-weight:700; }
.xmod .ok { color:var(--xpos); }
.xmod .dim { color:var(--text-light); }
.xmod .mode-toggle { display:inline-flex; gap:.25rem; border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.25rem; margin:1rem 0 .75rem; background:var(--bg-light); }
.xmod .mode-toggle button { font-family:var(--mono-font); font-size:.9rem; border:none; border-radius:.25rem; padding:.4rem 1rem; cursor:pointer; background:transparent; color:var(--text-light); }
.xmod .mode-toggle button.active { background:var(--accent); color:var(--accent-text); }
.xmod .mode-panel { display:none; }
.xmod .mode-panel.active { display:block; }
.xmod .diagram { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1.25rem; background:var(--bg-light); }
.xmod .dgrid { display:flex; flex-wrap:wrap; gap:.6rem; }
.xmod .dbox { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.7rem .8rem; background:var(--bg); font-size:.78rem; line-height:1.5; flex:1; min-width:200px; }
.xmod .dbox .dtitle { font-weight:700; font-size:.84rem; margin-bottom:.4rem; display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.xmod .dbox.big { flex-basis:100%; }
.xmod .dbox.fail { border-color:var(--xneg); }
.xmod .dbox.pass { border-color:var(--xpos); }
.xmod .pill { display:inline-block; border-radius:999px; padding:0 .55rem; font-size:.68rem; font-weight:700; }
.xmod .pill.red { color:var(--xneg); border:1px solid var(--xneg); }
.xmod .pill.green { color:var(--xpos); border:1px solid var(--xpos); }
.xmod .pill.blue { color:var(--link); border:1px solid var(--link); }
.xmod .arrow-down { text-align:center; color:var(--text-light); width:100%; margin:.2rem 0; }
.xmod .dcaption { font-size:.85rem; color:var(--text-light); margin-top:.8rem; line-height:1.6; }
.xmod .callout { border:1px solid var(--accent); border-left:4px solid var(--accent); border-radius:var(--standard-border-radius); padding:1.25rem; margin:1rem 0; background:var(--bg-light); }
.xmod .callout .rule { font-weight:700; font-size:1.05rem; line-height:1.55; margin:.25rem 0; }
.xmod .callout .corollary { color:var(--text-light); font-size:.92rem; margin:.75rem 0 0; }
.xmod details.issue { border:1px solid var(--border); border-radius:var(--standard-border-radius); margin-bottom:.6rem; }
.xmod details.issue summary { display:flex; align-items:baseline; gap:.7rem; cursor:pointer; }
.xmod details.issue .num { color:var(--accent); font-weight:700; flex-shrink:0; }
.xmod details.issue .t { font-weight:700; }
.xmod details.issue .s { display:block; font-size:.8rem; color:var(--text-light); font-weight:400; }
.xmod .ibody { padding:.25rem .5rem .5rem; }
.xmod .q { font-size:.75rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin:1rem 0 .25rem; }
.xmod .ibody p { font-size:.92rem; margin:.25rem 0; }
.xmod .lesson { border-left:3px solid var(--xwarn); padding:.5rem .8rem; margin-top:1rem; font-size:.88rem; background:var(--bg); border-radius:0 .25rem .25rem 0; }
.xmod .lesson strong { color:var(--xwarn); }
.xmod .chart-wrap { position:relative; height:320px; margin:1rem 0; }
.xmod .legend { list-style:none; padding:0; font-size:.88rem; }
.xmod .legend li { display:flex; gap:.6rem; padding:.4rem 0; border-bottom:1px solid var(--border); align-items:baseline; }
.xmod .legend li:last-child { border-bottom:none; }
.xmod .legend .ldot { width:.7rem; height:.7rem; border-radius:.2rem; flex-shrink:0; transform:translateY(.05rem); }
.xmod .legend .ld { color:var(--text-light); display:block; font-size:.82rem; }
.xmod .gloss dt { font-weight:700; color:var(--accent); margin-top:.9rem; }
.xmod .gloss dd { margin:0.15rem 0 0 0; font-size:.9rem; }
.xmod table td, .xmod table th { font-size:.88rem; vertical-align:top; }
.xmod figure { margin:1rem 0; }
.xmod .fig svg { width:100%; height:auto; display:block; }
.xmod .svg-cap { font-size:.82rem; color:var(--text-light); text-align:center; margin-top:.5rem; line-height:1.55; }
.xmod .donut-wrap { display:flex; flex-wrap:wrap; gap:1.25rem 2rem; align-items:center; }
.xmod .donut-wrap svg { width:200px; height:200px; flex-shrink:0; margin:0 auto; }
.xmod .donut-wrap .legend { flex:1; min-width:250px; }
.xmod .legend .ldot { display:inline-block; }
@media (max-width:600px) { .xmod .toc-grid { grid-template-columns:1fr; } }
</style>

<div class="xmod">
<nav aria-label="Contents">
<h2 id="contents">Contents</h2>
<ol class="toc-grid">
<li><a href="#part1">Header imports and search paths</a></li>
<li><a href="#part2">Module maps and PCMs</a></li>
<li><a href="#part3">Bazel: the minimum working model</a></li>
<li><a href="#part4">Implicit vs. explicit compilation</a></li>
<li><a href="#part5">The governing invariant</a></li>
<li><a href="#part6">Case studies: nine failures</a></li>
<li><a href="#part7">Root-cause classification</a></li>
<li><a href="#part8">Diagnostic reference</a></li>
<li><a href="#part9">FAQ</a></li>
<li><a href="#part10">Glossary</a></li>
</ol>
</nav>

<h2 id="part1">Part 1 — How a header import is resolved</h2>
<p>Everything in this document reduces to one question: given an <code>#import</code> line, where does the compiler look for the file? There are two import forms and three search mechanisms.</p>
<div class="cards">
<div class="card">
<h4>Textual inclusion</h4>
<p><code>#import "X.h"</code> and <code>#import &lt;Y/Y.h&gt;</code> are preprocessor directives. By default the preprocessor replaces the line with the full text of the file, recursively. A translation unit (one <code>.m</code> file) expands to itself plus every header it transitively includes — frequently 100k+ lines — re-parsed for every translation unit.</p>
</div>
<div class="card">
<h4>Quote include: <code>#import "X.h"</code></h4>
<p>Resolution order:</p>
<ul>
<li>The directory of the <em>including file</em> ("includer-relative"). <code>"../Shared/X.h"</code> resolves here without any flags.</li>
<li>Then each directory passed with <code>-I</code>, in order.</li>
</ul>
<p>A quote include naming a file in a <em>different</em> directory only works if some <code>-I</code> flag points there. This is the root cause of case 6.</p>
</div>
<div class="card">
<h4>Angle include: <code>#import &lt;Y/Z.h&gt;</code></h4>
<p>Resolution order:</p>
<ul>
<li>Each <code>-I</code> directory: looks for <code>&lt;dir&gt;/Y/Z.h</code>.</li>
<li>Each <code>-F</code> directory (framework search path): looks for <code>&lt;dir&gt;/Y.framework/Headers/Z.h</code>.</li>
<li>System/SDK paths.</li>
</ul>
<p><code>#import &lt;FBSDKCoreKit_Basics/FBSDKCoreKit_Basics.h&gt;</code> requires a <code>-F</code> flag pointing at the directory containing <code>FBSDKCoreKit_Basics.framework</code>. Root cause of case 1.</p>
</div>
<div class="card">
<h4>Framework layout</h4>
<p>A built framework is a directory with fixed structure:</p>
<pre>FBSDKCoreKit.framework/
├── FBSDKCoreKit          (binary)
├── Headers/              (public headers)
│   └── FBSDKCoreKit.h
└── Modules/
    └── module.modulemap  (Part 2)</pre>
<p>An <strong>xcframework</strong> is a wrapper directory holding one such framework per platform slice (device, simulator, …).</p>
</div>
</div>
<figure class="fig">
<svg viewBox="0 0 640 372" role="img" aria-label="Two side-by-side search-order flowcharts for resolving an import. The quote include &quot;X.h&quot; tries the including file's own directory first, then each -I directory, otherwise file not found. The angle include &lt;Y/Z.h&gt; tries each -I directory, then each -F framework directory, then system and SDK paths, otherwise file not found. The first step of the quote path and the framework step of the angle path are highlighted as the steps that explain cases 6 and 1 respectively.">
  <defs>
    <marker id="xmDown" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-light)"/></marker>
  </defs>
  <!-- QUOTE lane -->
  <rect x="35" y="14" width="255" height="42" rx="6" fill="var(--bg-light)" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="162" y="33" font-size="13" font-weight="700" fill="var(--accent)" text-anchor="middle" font-family="var(--mono-font)">#import "X.h"</text>
  <text x="162" y="48" font-size="10.5" fill="var(--text-light)" text-anchor="middle">quote include</text>
  <line x1="162" y1="58" x2="162" y2="75" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <rect x="35" y="78" width="255" height="52" rx="6" fill="var(--bg)" stroke="var(--xpos)" stroke-width="1.5"/>
  <text x="48" y="100" font-size="12" font-weight="700" fill="var(--fg-color)">1 · Includer's own directory</text>
  <text x="48" y="118" font-size="10.5" fill="var(--text-light)">"../Shared/X.h" resolves here — no flags</text>
  <line x1="162" y1="132" x2="162" y2="151" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <text x="172" y="145" font-size="10" fill="var(--text-light)">not found ↓</text>
  <rect x="35" y="154" width="255" height="52" rx="6" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="48" y="176" font-size="12" font-weight="700" fill="var(--fg-color)">2 · each -I dir, in order</text>
  <text x="48" y="194" font-size="10.5" fill="var(--text-light)">supplied by flags only</text>
  <line x1="162" y1="208" x2="162" y2="227" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <text x="172" y="221" font-size="10" fill="var(--text-light)">not found ↓</text>
  <rect x="35" y="230" width="255" height="42" rx="6" fill="var(--bg)" stroke="var(--xneg)" stroke-width="1.5"/>
  <text x="162" y="256" font-size="12" font-weight="700" fill="var(--xneg)" text-anchor="middle">else → file not found</text>
  <!-- ANGLE lane -->
  <rect x="350" y="14" width="255" height="42" rx="6" fill="var(--bg-light)" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="477" y="33" font-size="13" font-weight="700" fill="var(--accent)" text-anchor="middle" font-family="var(--mono-font)">#import &lt;Y/Z.h&gt;</text>
  <text x="477" y="48" font-size="10.5" fill="var(--text-light)" text-anchor="middle">angle include</text>
  <line x1="477" y1="58" x2="477" y2="75" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <rect x="350" y="78" width="255" height="52" rx="6" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="363" y="100" font-size="12" font-weight="700" fill="var(--fg-color)">1 · each -I dir</text>
  <text x="363" y="118" font-size="10.5" fill="var(--text-light)">looks for &lt;dir&gt;/Y/Z.h</text>
  <line x1="477" y1="132" x2="477" y2="151" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <text x="487" y="145" font-size="10" fill="var(--text-light)">not found ↓</text>
  <rect x="350" y="154" width="255" height="52" rx="6" fill="var(--bg)" stroke="var(--xpos)" stroke-width="1.5"/>
  <text x="363" y="176" font-size="12" font-weight="700" fill="var(--fg-color)">2 · each -F framework dir</text>
  <text x="363" y="194" font-size="10.5" fill="var(--text-light)">&lt;dir&gt;/Y.framework/Headers/Z.h — case 1</text>
  <line x1="477" y1="208" x2="477" y2="227" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <text x="487" y="221" font-size="10" fill="var(--text-light)">not found ↓</text>
  <rect x="350" y="230" width="255" height="52" rx="6" fill="var(--bg)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="363" y="252" font-size="12" font-weight="700" fill="var(--fg-color)">3 · System / SDK paths</text>
  <text x="363" y="270" font-size="10.5" fill="var(--text-light)">toolchain defaults</text>
  <line x1="477" y1="284" x2="477" y2="303" stroke="var(--text-light)" stroke-width="1.4" marker-end="url(#xmDown)"/>
  <rect x="350" y="306" width="255" height="42" rx="6" fill="var(--bg)" stroke="var(--xneg)" stroke-width="1.5"/>
  <text x="477" y="332" font-size="12" font-weight="700" fill="var(--xneg)" text-anchor="middle">else → file not found</text>
</svg>
</figure>
<p class="svg-cap">Resolution is just this walk down a list of locations. The <span style="color:var(--xpos);font-weight:700">green</span> steps need no target-private flags; every other step depends on a <code>-I</code> or <code>-F</code> that must be present <em>in the running compilation</em> — which is exactly what changes when a module is compiled in isolation (Parts 4–5).</p>
<div class="card">
<h4>The consequence that matters</h4>
<p>Header resolution is governed entirely by <strong>which flags are on the command line of the compilation currently running</strong>. The same header can resolve in one compilation and fail in another with no change to any file — only the flag set differs. The entire migration is about <em>which compilation</em> parses each header, and therefore which flags are in effect.</p>
</div>

<h2 id="part2">Part 2 — Module maps and PCMs</h2>
<p>Textual inclusion has two structural problems: cost (every consumer re-parses every header) and fragility (a header's meaning depends on whatever macros and flags the consumer happens to have). Clang modules address both.</p>
<div class="card">
<h4>The module map</h4>
<p>A <code>module.modulemap</code> file declares that a set of headers forms a named unit:</p>
<pre>framework module FBSDKCoreKit {
  umbrella header "FBSDKCoreKit.h"   <span class="dim">// this header (and its includes) define the module's contents</span>
  export *                            <span class="dim">// importers also see what this module's headers import</span>
  module * { export * }              <span class="dim">// one submodule per header under the umbrella</span>
}</pre>
<ul>
<li><strong>umbrella header</strong> — a header that includes all other public headers; the module's contents are whatever it declares.</li>
<li><strong>framework module</strong> — header paths resolve inside the framework's <code>Headers/</code> directory.</li>
<li>Non-framework module maps list headers explicitly: <code>module LookinServer { header "A.h" header "B.h" }</code>.</li>
</ul>
</div>
<div class="cards">
<div class="card">
<h4>The PCM (precompiled module)</h4>
<p>To "build a module," the compiler parses the headers named by the module map — in a compilation of its own, with its own flag set — and serializes the resulting AST to a binary <code>.pcm</code> file. Importers deserialize the PCM instead of re-parsing headers. Analogous to <code>.c → .o</code>: parse once, reuse many times.</p>
</div>
<div class="card">
<h4>How imports change</h4>
<p><code>@import FBSDKCoreKit;</code> (ObjC) and <code>import FBSDKCoreKit</code> (Swift) load the module by name. With modules enabled, even a textual-looking <code>#import &lt;FBSDKCoreKit/FBSDKCoreKit.h&gt;</code> is remapped to a module import when a module map claims that header. Swift has no headers at all — <strong>every</strong> ObjC dependency reaches Swift through a module, which is why module correctness is non-negotiable in a mixed codebase.</p>
</div>
<div class="card">
<h4>Module-level dependencies</h4>
<p>Building module A's PCM may itself encounter <code>#import &lt;B/B.h&gt;</code>. If B is covered by a module map, A's PCM records a dependency on module B, and B's PCM must be available. Modules therefore form a dependency graph of their own, parallel to the build system's target graph. The migration's central problem: these two graphs <strong>must agree</strong>, and under the old mode nothing checked that they did.</p>
</div>
<div class="card">
<h4>The two open questions</h4>
<p>The module map says nothing about <em>when</em> the PCM is built or <em>which flags</em> that build sees. Two strategies exist:</p>
<ul>
<li><strong>Implicit</strong> — the compiler builds PCMs on demand, mid-compilation (Part 4, left panel).</li>
<li><strong>Explicit</strong> — the build system builds every PCM as a scheduled step (Part 4, right panel).</li>
</ul>
<p>The migration is the switch from the first to the second.</p>
</div>
</div>
<figure class="fig">
<svg viewBox="0 0 640 274" role="img" aria-label="Two graphs side by side over the same two nodes, FBSDKCoreKit and FBSDKCoreKit_Basics. On the left, the module graph, an arrow runs from FBSDKCoreKit down to FBSDKCoreKit_Basics, labelled by the umbrella header's angle import. On the right, the Bazel target graph, the same two nodes have no connecting edge because the SPM binary target was generated with deps equal to an empty list; the missing edge is drawn as a red dashed arrow with a cross. The caption states the two graphs must agree under explicit compilation.">
  <defs>
    <marker id="xmMA" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)"/></marker>
    <marker id="xmMR" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--xneg)"/></marker>
  </defs>
  <text x="170" y="26" font-size="12.5" font-weight="700" fill="var(--accent)" text-anchor="middle">Module graph — header imports</text>
  <text x="475" y="26" font-size="12.5" font-weight="700" fill="var(--accent)" text-anchor="middle">Bazel target graph — deps</text>
  <line x1="320" y1="42" x2="320" y2="258" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>
  <!-- LEFT: module graph -->
  <rect x="80" y="50" width="180" height="46" rx="6" fill="var(--bg-light)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="170" y="78" font-size="12.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle" font-family="var(--mono-font)">FBSDKCoreKit</text>
  <line x1="170" y1="96" x2="170" y2="182" stroke="var(--accent)" stroke-width="2" marker-end="url(#xmMA)"/>
  <text x="180" y="134" font-size="10.5" fill="var(--text-light)">#import</text>
  <text x="180" y="148" font-size="10.5" fill="var(--text-light)">&lt;…_Basics/…&gt;</text>
  <rect x="80" y="186" width="180" height="46" rx="6" fill="var(--bg-light)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="170" y="214" font-size="11.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle" font-family="var(--mono-font)">FBSDKCoreKit_Basics</text>
  <!-- RIGHT: target graph -->
  <rect x="385" y="50" width="180" height="46" rx="6" fill="var(--bg-light)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="475" y="73" font-size="12.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle" font-family="var(--mono-font)">FBSDKCoreKit</text>
  <text x="475" y="88" font-size="10" fill="var(--xneg)" text-anchor="middle" font-family="var(--mono-font)">deps = [ ]</text>
  <line x1="475" y1="96" x2="475" y2="182" stroke="var(--xneg)" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#xmMR)"/>
  <circle cx="475" cy="139" r="11" fill="var(--bg)" stroke="var(--xneg)" stroke-width="1.5"/>
  <text x="475" y="143" font-size="13" font-weight="700" fill="var(--xneg)" text-anchor="middle">✗</text>
  <text x="492" y="135" font-size="10.5" fill="var(--xneg)">edge</text>
  <text x="492" y="149" font-size="10.5" fill="var(--xneg)">absent</text>
  <rect x="385" y="186" width="180" height="46" rx="6" fill="var(--bg-light)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="475" y="214" font-size="11.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle" font-family="var(--mono-font)">FBSDKCoreKit_Basics</text>
</svg>
</figure>
<p class="svg-cap">The umbrella header creates a <span style="color:var(--accent);font-weight:700">module-graph edge</span>, but RSPM generated the binary target with <code>deps = []</code>, so the matching <span style="color:var(--xneg);font-weight:700">target-graph edge is missing</span>. Implicit mode never compared the two; explicit mode compiles each module in isolation and the gap becomes case 1's <code>file not found</code>.</p>

<h2 id="part3">Part 3 — Bazel: the minimum working model</h2>
<p>Six concepts are sufficient to read everything that follows.</p>
<div class="cards">
<div class="card">
<h4>1 · Targets and labels</h4>
<p>A <strong>target</strong> is a named buildable unit declared in a <code>BUILD</code> file, addressed by a <strong>label</strong>: <code>//Modules/Networking:Networking</code> means "target <code>Networking</code> in package <code>Modules/Networking</code>". Labels starting with <code>@</code> address targets in <strong>external repositories</strong> — downloaded dependencies, e.g. <code>@swiftpkg_facebook_ios_sdk//:FacebookCore</code>.</p>
</div>
<div class="card">
<h4>2 · Rules and attributes</h4>
<p>Each target is an instance of a <strong>rule</strong> (<code>swift_library</code>, <code>objc_library</code>, <code>apple_dynamic_xcframework_import</code>) with <strong>attributes</strong>:</p>
<ul>
<li><code>srcs</code>, <code>hdrs</code> — source and header files.</li>
<li><code>deps</code> — labels of targets this target depends on. <strong>This is the build graph.</strong></li>
<li><code>copts</code> — extra compiler flags, private to this target's own compilations.</li>
<li><code>includes</code> — header search dirs that <em>propagate</em>: dependents get them automatically.</li>
<li><code>features</code> — named toolchain behaviors; <code>"x"</code> enables, <code>"-x"</code> disables, per target or globally.</li>
</ul>
</div>
<div class="card">
<h4>3 · Actions and sandboxing</h4>
<p>Building a target produces <strong>actions</strong>: concrete command lines (one compiler invocation each) with <strong>declared inputs and outputs</strong>. Actions run sandboxed — the command can only read files declared as inputs. An undeclared file is absent, not merely discouraged. Actions are cacheable (locally and remotely) and reproducible precisely because their inputs are closed.</p>
</div>
<div class="card">
<h4>4 · Providers</h4>
<p>Targets pass structured data to dependents through <strong>providers</strong>. Two matter here:</p>
<ul>
<li><code>CcInfo</code> — C-family compilation context: headers, defines, <code>-I</code>/<code>-F</code> search paths. A target's <code>copts</code> are <em>not</em> in CcInfo; <code>includes</code> are.</li>
<li><code>SwiftInfo</code> — Swift modules and, under explicit compilation, the Clang modules (module map + PCM) a target exposes.</li>
</ul>
<p>"X propagates to dependents" always means "X travels in a provider along <code>deps</code> edges."</p>
</div>
<div class="card">
<h4>5 · Aspects</h4>
<p>An <strong>aspect</strong> walks the dependency graph and attaches <em>additional</em> actions and providers to existing targets without editing their BUILD files. The relevant one is rules_swift's <code>swift_clang_module_aspect</code>: it visits every target reachable through <code>deps</code>, and for each target that owns a module map, registers a <code>SwiftPrecompileCModule</code> action that builds the PCM. Error messages name it explicitly: <em>"from aspects [swift_clang_module_aspect] on objc_library rule target …"</em>.</p>
</div>
<div class="card">
<h4>6 · Generated external repos (RSPM)</h4>
<p>Swift Package Manager dependencies are integrated by <strong>rules_swift_package_manager (RSPM)</strong>: it downloads each package, reads its manifest, and <em>generates</em> a BUILD file — one target per SPM target. A binary SPM target (<code>binaryTarget</code>, a prebuilt xcframework) becomes an <code>apple_*_xcframework_import</code> target. Critical limitation: SPM's manifest format gives binary targets <strong>no dependency list</strong>, so RSPM generates them with <code>deps = []</code>. RSPM ≥ 1.17 adds <code>configure_package(target_deps = {...})</code> to inject edges into the generated BUILD by hand.</p>
</div>
</div>

<h2 id="part4">Part 4 — Implicit vs. explicit compilation</h2>
<p>Same sources, same module maps. The difference is who schedules PCM compilation and which flags it sees. The migration enables two features in <code>.bazelrc</code>: <code>swift.emit_c_module</code> and <code>swift.use_c_modules</code>.</p>
<div class="mode-toggle" role="tablist" aria-label="Module mode toggle">
<button id="btnImplicit" class="active" onclick="xmodShowMode('implicit')" role="tab" aria-selected="true">Implicit (before)</button>
<button id="btnExplicit" onclick="xmodShowMode('explicit')" role="tab" aria-selected="false">Explicit (after)</button>
</div>
<div id="panelImplicit" class="mode-panel active diagram" role="tabpanel">
<div class="dgrid">
<div class="dbox big pass">
<div class="dtitle">Step 1 — Bazel schedules ONE action: the consumer's Swift compile <span class="pill green">all search paths merged</span></div>
<span class="dim">swiftc compiles</span> RudderManager.swift<span class="dim">. Its target's deps are many, so the merged CcInfo yields:</span><br>
-F facebook&nbsp; -F braze&nbsp; -F zendesk&nbsp; -F sentry&nbsp; -F firebase&nbsp; -I lookin/Shared&nbsp; <span class="dim">… one command line, everything visible</span>
</div>
<div class="arrow-down">↓ during that compile, swiftc encounters <code>import FBSDKCoreKit</code> and no PCM exists yet</div>
<div class="dbox big">
<div class="dtitle">Step 2 — the compiler builds the PCM itself, mid-compilation</div>
<span class="dim">It finds the module map via the -F paths, then parses FBSDKCoreKit.h. That parse hits</span> #import &lt;FBSDKCoreKit_Basics/…&gt;<br>
<span class="ok">resolves</span> <span class="dim">— this parse runs INSIDE the consumer's compilation and inherits its full flag set (Part 1: resolution = current flags).</span><br>
<span class="dim">The PCM lands in a compiler-private cache, outside Bazel: ~/…/ModuleCache/&lt;hash&gt;/FBSDKCoreKit-&lt;hash&gt;.pcm</span>
</div>
</div>
<p class="dcaption"><strong>Properties of implicit compilation.</strong> (1) PCM builds are not Bazel actions: invisible to the action graph, excluded from remote caching, re-done per machine and per flag-hash. (2) The flag set used to build a PCM is whatever the <em>first importer</em> had — module content can vary by import order and configuration. (3) Header resolution inside a module build borrows the consumer's search paths, so a module's undeclared dependency on a sibling resolves successfully whenever any consumer's flags cover it. No mechanism verifies that the module graph matches the target graph.</p>
</div>
<div id="panelExplicit" class="mode-panel diagram" role="tabpanel">
<div class="dgrid">
<div class="dbox big">
<div class="dtitle">Step 0 — swift_clang_module_aspect walks the deps graph and schedules one PCM action per module map</div>
<span class="dim">Each SwiftPrecompileCModule action's inputs = the owning target's files + its declared deps' CcInfo/SwiftInfo. Nothing else exists inside the sandbox.</span>
</div>
<div class="dbox pass">
<div class="dtitle">PCM: FBSDKCoreKit_Basics <span class="pill green">OK</span></div>
<span class="dim">Needs no other module → compiles from its own framework files alone.</span>
</div>
<div class="dbox fail">
<div class="dtitle">PCM: FBSDKCoreKit <span class="pill red">FAILS</span></div>
<span class="dim">deps = </span><span class="err">[]</span> <span class="dim">(SPM binary target, Part 3 §6)</span><br>
<span class="dim">→ no -F path to the sibling in this sandbox</span><br>
#import &lt;FBSDKCoreKit_Basics/…&gt; → <span class="err">file not found</span>
</div>
<div class="dbox">
<div class="dtitle">PCM: BrazeKit <span class="pill blue">independent</span></div>
<span class="dim">Own action, own sandbox, runs in parallel.</span>
</div>
<div class="arrow-down">↓ Swift compiles are scheduled only after the PCMs they need exist</div>
<div class="dbox big">
<div class="dtitle">Consumer compile receives finished artifacts — it never parses dependency headers</div>
-fmodule-map-file=…/module.modulemap&nbsp;&nbsp;-fmodule-file=FBSDKCoreKit=bazel-out/…/FBSDKCoreKit.pcm<br>
<span class="dim">Each PCM is an ordinary Bazel action: sandboxed, deterministic per configuration, remote-cacheable, shared across machines.</span>
</div>
</div>
<p class="dcaption"><strong>Properties of explicit compilation.</strong> (1) Every module map reachable through <code>deps</code> is precompiled — <em>whether or not any source imports it</em> (relevant in case 2). (2) Each PCM build sees only declared inputs; an undeclared dependency is a hard error rather than a silent borrow. (3) PCM actions are cached and shared org-wide, and run in parallel ahead of Swift compiles. The cost: every assumption the implicit mode silently absorbed must now hold explicitly. The nine case studies are exactly those assumptions.</p>
</div>

<h2 id="part5">Part 5 — The governing invariant</h2>
<div class="callout">
<p class="rule">Under explicit compilation, each module map is compiled in an isolated, sandboxed action whose visible inputs are the owning target's files plus its declared dependencies' providers. Consumer search paths do not exist inside that sandbox.</p>
<p class="corollary"><strong>Corollary (root cause of cases 6 and 8):</strong> when the aspect constructs a PCM action for a target, it takes the compilation context from <code>CcInfo</code> — and forwards only <code>-D</code> defines from the target's <code>copts</code>. Since <code>copts</code> never enter CcInfo (Part 3 §4), any <code>-I</code> search path supplied via copts is <strong>absent</strong> from the PCM compile. Search paths reach a PCM action only through the <code>includes</code> attribute or a dependency's CcInfo.</p>
</div>
<figure class="fig">
<svg viewBox="0 0 640 296" role="img" aria-label="Two boxes contrasting the same module import in two compilations. The left box, the consumer Swift compile, lists framework search paths merged from all dependencies — dash F facebook, braze, zendesk, sentry, and dash I lookin slash Shared — and the import of the sibling header resolves with a green check because the PCM is built inside this compilation and inherits its full flag set. The right box, the isolated PCM action sandbox, contains only FBSDKCoreKit's own framework files because deps is empty, so the same sibling import fails with a red file-not-found, since the consumer search paths do not exist inside the sandbox.">
  <!-- LEFT: consumer compile -->
  <rect x="22" y="40" width="292" height="240" rx="8" fill="var(--bg)" stroke="var(--xpos)" stroke-width="1.5"/>
  <text x="168" y="26" font-size="12.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle">Consumer Swift compile</text>
  <text x="40" y="68" font-size="10.5" fill="var(--text-light)">search paths merged from all deps' CcInfo:</text>
  <text x="40" y="92" font-size="11.5" fill="var(--fg-color)" font-family="var(--mono-font)">-F facebook&#160;&#160;-F braze</text>
  <text x="40" y="112" font-size="11.5" fill="var(--fg-color)" font-family="var(--mono-font)">-F zendesk&#160;&#160;&#160;-F sentry</text>
  <text x="40" y="132" font-size="11.5" fill="var(--fg-color)" font-family="var(--mono-font)">-I lookin/Shared&#160;&#160;…</text>
  <line x1="40" y1="150" x2="296" y2="150" stroke="var(--border)" stroke-width="1"/>
  <text x="40" y="178" font-size="11.5" font-weight="700" fill="var(--fg-color)">PCM built inside this compile</text>
  <text x="40" y="206" font-size="11.5" fill="var(--xpos)" font-family="var(--mono-font)">#import &lt;…_Basics/…&gt;</text>
  <text x="40" y="226" font-size="12.5" font-weight="700" fill="var(--xpos)">✓ resolves</text>
  <text x="40" y="252" font-size="10.5" fill="var(--text-light)">inherits the full flag set</text>
  <!-- RIGHT: isolated PCM sandbox -->
  <rect x="326" y="40" width="292" height="240" rx="8" fill="var(--bg)" stroke="var(--xneg)" stroke-width="1.5"/>
  <text x="472" y="26" font-size="12.5" font-weight="700" fill="var(--fg-color)" text-anchor="middle">Isolated PCM action — sandbox</text>
  <text x="344" y="68" font-size="10.5" fill="var(--text-light)">visible inputs (deps = [ ]):</text>
  <text x="344" y="92" font-size="11.5" fill="var(--fg-color)" font-family="var(--mono-font)">FBSDKCoreKit/ own files</text>
  <text x="344" y="116" font-size="10.5" fill="var(--text-light)">— nothing else exists here —</text>
  <line x1="344" y1="150" x2="600" y2="150" stroke="var(--border)" stroke-width="1"/>
  <text x="344" y="178" font-size="11.5" font-weight="700" fill="var(--fg-color)">PCM built as its own action</text>
  <text x="344" y="206" font-size="11.5" fill="var(--xneg)" font-family="var(--mono-font)">#import &lt;…_Basics/…&gt;</text>
  <text x="344" y="226" font-size="12.5" font-weight="700" fill="var(--xneg)">✗ file not found</text>
  <text x="344" y="252" font-size="10.5" fill="var(--text-light)">consumer -F paths absent here</text>
</svg>
</figure>
<p class="svg-cap">Same import, two worlds. The consumer compile sees every dependency's search paths merged together, so a sibling resolves incidentally; the isolated PCM action sees only declared inputs, so the identical line fails. That difference is the entire migration.</p>

<h2 id="part6">Part 6 — Case studies: nine failures, in build order</h2>
<p>Each entry names the failing action, explains why the same code compiled under implicit mode, derives the root cause from Parts 1–5, and documents the fix.</p>
<details class="issue" open>
<summary><span class="num">01</span><span><span class="t">Facebook SDK — <code>'FBSDKCoreKit_Basics.h' file not found</code></span><span class="s">Undeclared edges between sibling binary frameworks · fixed via RSPM target_deps</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of <code>FBSDKCoreKit</code>. Its umbrella header contains an angle include of a sibling framework, <code>#import &lt;FBSDKCoreKit_Basics/FBSDKCoreKit_Basics.h&gt;</code>, which requires a <code>-F</code> path to the directory containing <code>FBSDKCoreKit_Basics.framework</code> (Part 1).</p>
<p class="q">Why it compiled under implicit mode</p>
<p>The PCM was built inside a consumer's compilation, which had every Facebook framework's <code>-F</code> path merged from its many deps (Part 4, implicit panel, step 2).</p>
<p class="q">Root cause</p>
<p>SPM binary targets carry no dependency list, so RSPM generated <code>deps = []</code> (Part 3 §6). The isolated PCM action's sandbox contains only FBSDKCoreKit's own files — the sibling framework is not an input, so its headers do not exist there (Part 3 §3).</p>
<p class="q">Fix</p>
<p>Upgraded RSPM 1.13.0 → 1.19.0 (the <code>target_deps</code> API landed in 1.17.0) and declared the SDK's internal layering in <code>MODULE.bazel</code>:</p>
<pre>swift_deps.configure_package(
    name = "facebook-ios-sdk",
    target_deps = {
        "FBSDKCoreKit":           ["FBAEMKit", "FBSDKCoreKit_Basics"],
        "FBAEMKit":               ["FBSDKCoreKit_Basics"],
        "FBSDKLoginKit":          ["FBSDKCoreKit"],
        "FBSDKShareKit":          ["FBSDKCoreKit"],
        "FBSDKGamingServicesKit": ["FBSDKCoreKit", "FBSDKShareKit"],
    },
)</pre>
<p>With the edges declared, the sibling's framework directory becomes a sandbox input and its CcInfo supplies the <code>-F</code> path; the dependency PCM is also built first, in topological order.</p>
<div class="lesson"><strong>General rule:</strong> the module graph (who imports whom at the header level) must be mirrored by the target graph (<code>deps</code>). Implicit mode never checked this; explicit mode enforces it.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">02</span><span><span class="t">GoogleAppMeasurement — <code>umbrella header not found</code></span><span class="s">Module map present, headers absent · fixed via rules_apple patch</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of GoogleAppMeasurement. The framework ships a module map whose <code>umbrella header</code> directive names <code>GoogleAppMeasurement-umbrella.h</code> — but the framework contains no <code>Headers/</code> directory at all. The referenced file does not exist in the vendor's artifact.</p>
<p class="q">Why it compiled under implicit mode</p>
<p>It never compiled — and never needed to. No source imports this module; the framework is link-only. Implicit PCM builds are triggered by imports (Part 4), so an unimported module map is never parsed. The defect was inert.</p>
<p class="q">Root cause</p>
<p>Explicit-mode property (1): the aspect precompiles every module map reachable in the graph, imported or not. Invalid metadata that implicit mode never evaluated now fails a scheduled action.</p>
<p class="q">Fix</p>
<p>A patch to rules_apple's xcframework import rules: when the imported framework ships no headers, do not create the Swift interop provider, so the aspect schedules no PCM action for it. Correct because a headerless framework has no importable surface; linking information is unaffected.</p>
<div class="lesson"><strong>General rule:</strong> eager precompilation validates all module metadata in the dependency graph, including metadata for modules that no source imports.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">03</span><span><span class="t">Zendesk / LiveRamp / Braze — <code>module 'SDKConfigurations' not found</code></span><span class="s">Cross-package edges; imports hidden in -Swift.h and .swiftinterface · fixed via target_deps with public labels</span></span></summary>
<div class="ibody">
<p class="q">Failing actions</p>
<p>Two kinds. (a) PCM precompile of MessagingSDK: binary frameworks containing Swift code ship a generated ObjC header (<code>MessagingSDK-Swift.h</code>) that re-exposes their Swift API to ObjC; it is part of the umbrella, and it contains <code>@import SDKConfigurations;</code> — a module import of a module from a <em>different SPM package</em>. (b) Compilation of MessagingAPI's <code>.swiftinterface</code>: frameworks with Swift API ship a textual interface file that rules_apple compiles into a binary swiftmodule, and that compilation must resolve every <code>import</code> statement in the file.</p>
<p class="q">Root cause</p>
<p>Identical to case 1 — binary targets, no declared edges — extended across package boundaries. The required modules live in other generated external repositories (Part 3 §6).</p>
<p class="q">Implementation notes</p>
<p>① A binary framework's true dependency set spans three file types: ObjC headers, the generated <code>-Swift.h</code>, and <code>.swiftinterface</code> files. The initial header-only audit missed the latter two; the complete audit found MessagingSDK → SDKConfigurations + CommonUISDK + MessagingAPI, SupportSDK → five Zendesk modules, BrazeLocation → BrazeKit, LRAtsSDKMediationAdapter → LRAtsSDK + GoogleMobileAds. ② Generated <code>.rspm</code> targets have package-private visibility; cross-package <code>target_deps</code> values must use each repo's <em>public product</em> labels, e.g. <code>@swiftpkg_core_sdk_ios//:ZendeskCoreSDK</code> — referencing the <code>.rspm</code> targets directly fails Bazel's visibility check.</p>
<div class="lesson"><strong>General rule:</strong> audit ObjC headers, <code>-Swift.h</code>, and <code>.swiftinterface</code> imports to determine a binary framework's dependency set. Any one alone is incomplete.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">04</span><span><span class="t">Firebase umbrella — <code>'FirebaseCore/FirebaseCore.h' file not found</code></span><span class="s">The required edge would create a cycle · fixed via __has_include source patch</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of the <code>Firebase</code> umbrella module — a source target whose only purpose is letting app code write <code>import Firebase</code>. Its header unconditionally angle-includes FirebaseCore's umbrella.</p>
<p class="q">Why target_deps does not apply</p>
<p>The build graph already contains the reverse edge: <code>FirebaseCore</code> depends on <code>Firebase</code> (it consumes the <code>Firebase_VERSION</code> define from it). Bazel's target graph must be acyclic — adding Firebase → FirebaseCore is rejected at analysis time. This is the one failure where "declare the edge" is structurally impossible.</p>
<p class="q">Fix</p>
<p>A source patch (RSPM <code>configure_package(patches)</code> applies patches to package sources after download, before BUILD generation) making the include conditional:</p>
<pre><span class="err">-#import &lt;FirebaseCore/FirebaseCore.h&gt;</span>
<span class="ok">+#if __has_include(&lt;FirebaseCore/FirebaseCore.h&gt;)</span>
<span class="ok">+  #import &lt;FirebaseCore/FirebaseCore.h&gt;</span>
<span class="ok">+#endif</span></pre>
<p><code>__has_include</code> evaluates against the current compilation's search paths (Part 1): true in every consumer compile (unchanged behavior), false in the isolated PCM action (import skipped, module compiles near-empty). Acceptable because no source in the repository imports <code>Firebase</code>; the rest of that header already uses the same guard pattern.</p>
<div class="lesson"><strong>General rule:</strong> when a required module edge would create a target-graph cycle, make the header conditional with <code>__has_include</code> instead of modifying the graph.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">05</span><span><span class="t">Sentry — <code>type argument 'SentrySpan' must be a pointer</code></span><span class="s">A never-compiled fallback branch is invalid ObjC · fixed via target_deps on the clang child target</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of <code>SentryInternal</code>, a source target in sentry-cocoa. The header:</p>
<pre>#if __has_include(&lt;Sentry/Sentry.h&gt;)
#  import &lt;Sentry/Sentry.h&gt;        <span class="dim">// declares: @protocol SentrySpan</span>
#endif
<span class="dim">…</span>
@class SentrySpan;                    <span class="dim">// fallback: forward-declares a CLASS of the same name</span>
@interface SentryTracer : NSObject &lt;SentrySpan&gt;</pre>
<p>ObjC keeps class and protocol names in separate namespaces. When the protocol exists, <code>&lt;SentrySpan&gt;</code> in that position resolves to it — valid. When only the forward-declared <em>class</em> exists, Clang parses <code>NSObject&lt;SentrySpan&gt;</code> as a generic specialization with a non-pointer type argument — the reported diagnostics. The fallback branch is invalid code that no compilation had ever selected.</p>
<p class="q">Root cause</p>
<p>The isolated PCM action has no path to <code>&lt;Sentry/Sentry.h&gt;</code> (no declared edge to the Sentry framework), so <code>__has_include</code> evaluates false for the first time in this codebase's history, selecting the broken branch.</p>
<p class="q">Fix</p>
<p>Declare the edge so the primary branch is selected. One subtlety: RSPM splits a mixed target into a parent plus per-language child targets; the failing action belongs to the generated clang child <code>SentryInternal.rspm_objc</code>. <code>target_deps</code> keys containing <code>.rspm</code> are matched against generated target names verbatim, allowing the edge to be attached exactly where the action runs: <code>"SentryInternal.rspm_objc": ["Sentry"]</code>.</p>
<div class="lesson"><strong>General rule:</strong> <code>__has_include</code> fallback branches are unexercised code paths. The isolated PCM compile is often the first compilation ever to execute them; expect latent invalidity.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">06</span><span><span class="t">LookinServer — <code>'LookinDefines.h' file not found</code></span><span class="s">Headers depend on copts -I, which never reaches the PCM action · fixed via include-path rewrite</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of LookinServer (a debug-tooling package; the module is imported from Swift, so it cannot be suppressed). Its public headers use quote includes such as <code>#import "LookinDefines.h"</code> for files located in <em>other directories</em> of the package (<code>Src/Main/Shared/</code>).</p>
<p class="q">Why it compiled under implicit mode</p>
<p>RSPM emits the package's internal header search dirs as <code>-I</code> flags in <code>copts</code>. Object-file compilations receive copts, and implicit PCM builds ran inside compilations that had them. Quote includes that fail includer-relative lookup (Part 1) fell through to those <code>-I</code> dirs and resolved.</p>
<p class="q">Root cause</p>
<p>The corollary from Part 5, verbatim: the PCM action takes its search paths from CcInfo, and copts <code>-I</code> flags are not in CcInfo. The PCM compile therefore has includer-relative lookup only, and <code>"LookinDefines.h"</code> is not in the includer's directory.</p>
<p class="q">Fix</p>
<p>A package patch rewriting the 24 cross-directory quote includes (15 headers) to includer-relative paths, e.g. <code>#import "../../Shared/LookinDefines.h"</code>. Includer-relative resolution needs no flags at all (Part 1), so both the PCM action and ordinary object compilations resolve identically.</p>
<div class="lesson"><strong>General rule:</strong> module headers must be self-contained — resolvable without target-private flags. A header needing copts <code>-I</code> to find its own module's files will fail explicit compilation.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">07</span><span><span class="t">RudderFirebase — <code>no module named 'RudderFirebase' declared in module map</code></span><span class="s">Declared module name diverges from framework name · fixed by renaming the module</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>PCM precompile of a first-party vendored xcframework. Under explicit mode the build system must name the module it is building: rules_apple derives that name from the xcframework's library name (<code>RudderFirebase</code>) and instructs Clang to build <em>that</em> module from the map. The map declares <code>module Rudder_Firebase</code> — the requested module is not defined in it.</p>
<p class="q">Why it compiled under implicit mode</p>
<p>Implicit lookup works in the opposite direction: the compiler scans available module maps for one declaring the name used at the import site (<code>import Rudder_Firebase</code>) and finds it. No component ever compared the declared name against the framework name.</p>
<p class="q">Fix</p>
<p>First-party files, so no patch machinery: renamed the module to <code>RudderFirebase</code> in both platform slices' module maps and updated the single <code>import</code> statement. A sweep of all other vendored xcframeworks found no further mismatches.</p>
<div class="lesson"><strong>General rule:</strong> for imported frameworks, declared module name must equal the framework/library name. Implicit mode treats this as a convention; explicit mode treats it as a contract.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">08</span><span><span class="t">Mixed-language module — <code>cannot find 'RudderBrazeFactory' in scope</code></span><span class="s">-import-underlying-module is invisible to the aspect · fixed via per-target opt-out</span></span></summary>
<div class="ibody">
<p class="q">Failing action</p>
<p>The Swift compile of a tracking module's Swift half. The target is one half of a <em>mixed-language module</em>: ObjC and Swift halves sharing one module name. The Swift half sees the ObjC half via two hand-written copts: <code>-import-underlying-module</code> ("load the Clang module with my own name") and <code>-Xcc -fmodule-map-file=…</code> (pointing at a hand-maintained module map).</p>
<p class="q">Root cause</p>
<p>That module map is referenced only from copts — it is not owned by any target the aspect visits, so no PCM action is scheduled for it (Part 3 §5: the aspect attaches actions to <em>targets</em>). Under implicit mode the compiler would simply build it on the fly; under explicit mode on-the-fly compilation is disabled, the underlying module fails to load, and every ObjC declaration is absent from the Swift compilation. The error is a symptom two layers removed from the cause.</p>
<p class="q">Fix</p>
<p>This was the only target in the repository using the pattern. Applied a per-target feature opt-out (Part 3 §2):</p>
<pre>features = ["-swift.use_c_modules"]   <span class="dim"># this target compiles with implicit modules</span></pre>
<p>The rest of the graph remains explicit. Long-term resolution: extract the ObjC half into its own named module and replace <code>-import-underlying-module</code> with an ordinary import.</p>
<div class="lesson"><strong>General rule:</strong> compilation inputs that exist only as flags (not as targets) are invisible to aspects. Per-target <code>-feature</code> disabling scopes exceptions without blocking a migration.</div>
</div>
</details>
<details class="issue">
<summary><span class="num">09</span><span><span class="t">Legacy app targets — <code>duplicate input file 'Support''</code></span><span class="s">Whitespace in include paths splits params-file arguments · fixed by renaming directories</span></span></summary>
<div class="ibody">
<p class="q">Failing actions</p>
<p>PCM precompiles of two first-party legacy targets whose include paths contain directories with spaces (<code>Archive Support</code>, <code>Report User</code>, <code>Mark as sold process</code>, <code>Seller review</code> — names inherited from Xcode group structure). Long command lines are passed via a <em>params file</em> (a file of arguments referenced as <code>@file.params</code>); the new precompile code path splits these entries on whitespace, turning <code>-I…/Archive Support</code> into two invalid tokens, reported as duplicate / unopenable input files.</p>
<p class="q">Why it compiled under implicit mode</p>
<p>The pre-existing compile actions quoted these arguments correctly. The failure is specific to argument handling in the SwiftPrecompileCModule path — the paths themselves were always hazardous, but no prior code path mishandled them.</p>
<p class="q">Fix</p>
<p>Renamed the four directories to CamelCase and updated the references in the build macro that declares these targets. Renaming removes the failure class; quoting workarounds would leave the hazard for the next tool.</p>
<div class="lesson"><strong>General rule:</strong> whitespace in source paths survives only as long as every tool in the chain quotes correctly. A migration that introduces new action types will exercise the hazard.</div>
</div>
</details>

<h2 id="part7">Part 7 — Root-cause classification</h2>
<p>The nine failures reduce to four categories, each with a distinct diagnostic signature and fix mechanism.</p>
<div class="diagram">
<div class="donut-wrap">
<svg viewBox="0 0 220 220" role="img" aria-label="Doughnut chart grouping the nine migration failures into four root-cause categories: missing dependency edges, 3 of 9; invalid vendor metadata, 3 of 9; toolchain coverage gaps, 2 of 9; and path hygiene, 1 of 9.">
  <g stroke="var(--bg-light)" stroke-width="3">
    <path d="M110,20 A90 90 0 0 1 187.94,155 L156.77,137 A54 54 0 0 0 110,56 Z" fill="var(--accent)"><title>Missing dependency edges — 3 of 9</title></path>
    <path d="M187.94,155 A90 90 0 0 1 32.06,155 L63.23,137 A54 54 0 0 0 156.77,137 Z" fill="var(--link)"><title>Invalid vendor metadata — 3 of 9</title></path>
    <path d="M32.06,155 A90 90 0 0 1 52.15,41.06 L75.29,68.64 A54 54 0 0 0 63.23,137 Z" fill="var(--accent-light)"><title>Toolchain coverage gaps — 2 of 9</title></path>
    <path d="M52.15,41.06 A90 90 0 0 1 110,20 L110,56 A54 54 0 0 0 75.29,68.64 Z" fill="var(--text-light)"><title>Path hygiene — 1 of 9</title></path>
  </g>
  <text x="110" y="105" font-size="34" font-weight="800" fill="var(--fg-color)" text-anchor="middle">9</text>
  <text x="110" y="128" font-size="12" fill="var(--text-light)" text-anchor="middle">failures</text>
</svg>
<ul class="legend" id="xmodLegend">
<li><span class="ldot" style="background:var(--accent)"></span><span><strong>Missing dependency edges — 3</strong><span class="ld">Cases 1, 3, 5. Header-level imports with no corresponding deps edge. Fix: target_deps.</span></span></li>
<li><span class="ldot" style="background:var(--link)"></span><span><strong>Invalid vendor metadata — 3</strong><span class="ld">Cases 2, 4, 7. Module maps and headers that were wrong but never compiled. Fix: rules patch, source patch, rename.</span></span></li>
<li><span class="ldot" style="background:var(--accent-light)"></span><span><strong>Toolchain coverage gaps — 2</strong><span class="ld">Cases 6, 8. Inputs carried in copts or flags that the aspect cannot see. Fix: include rewrite, per-target opt-out.</span></span></li>
<li><span class="ldot" style="background:var(--text-light)"></span><span><strong>Path hygiene — 1</strong><span class="ld">Case 9. Whitespace in paths mishandled by the new action's params files. Fix: rename.</span></span></li>
</ul>
</div>
</div>

<h2 id="part8">Part 8 — Diagnostic reference</h2>
<p>Lookup table for future <code>SwiftPrecompileCModule</code> failures.</p>
<table>
<thead><tr><th>Diagnostic</th><th>Fix mechanism</th></tr></thead>
<tbody>
<tr><td>Binary framework header cannot resolve a sibling framework's header</td><td><code>swift_deps.configure_package(target_deps = {…})</code>. Bare names for same-package targets; public product labels for cross-package.</td></tr>
<tr><td>Module map references nonexistent headers (headerless framework)</td><td>rules_apple patch: skip SwiftInteropInfo when the imported framework ships no headers.</td></tr>
<tr><td>Required dep edge would create a cycle</td><td>Source patch: guard the import with <code>__has_include</code>.</td></tr>
<tr><td>Quote includes resolvable only via copts <code>-I</code></td><td>Rewrite to includer-relative paths, or move the dirs to the <code>includes</code> attribute. copts <code>-I</code> does not reach the PCM action.</td></tr>
<tr><td>Mixed module using <code>-import-underlying-module</code></td><td>Per-target <code>features = ["-swift.use_c_modules"]</code>; restructure into separate modules later.</td></tr>
<tr><td><code>no module named X declared in module map</code></td><td>Align the declared module name with the framework/library name; update import statements.</td></tr>
<tr><td>Malformed argument errors (e.g. <code>duplicate input file 'Support''</code>)</td><td>A path containing whitespace is being split in the params file. Rename the directory.</td></tr>
<tr><td>Determining a binary framework's full dependency set</td><td>Audit three sources: ObjC headers, generated <code>-Swift.h</code>, and <code>.swiftinterface</code> imports.</td></tr>
</tbody>
</table>
<p class="dim" style="font-size:.88rem;">Constraint on patches: <code>configure_package(patches)</code> are applied to package <em>sources</em> after clone but <strong>before</strong> binary artifacts are downloaded. They can modify source files (case 4) but can never modify xcframework contents — which is why case 2 required a rules-level patch instead.</p>

<h2 id="part9">Part 9 — FAQ</h2>
<details>
<summary>A PCM precompile fails with "file not found", but the same import compiles inside the app target. What does this indicate?</summary>
<p>A missing dependency edge. The app compile succeeds because its merged search paths (all deps' CcInfo) cover the header; the isolated PCM action sees only the owning target's declared deps. Identify which target owns the missing header and declare the edge — for SPM binary targets, via <code>target_deps</code>.</p>
</details>
<details>
<summary>Does adding <code>-IPath/To/Headers</code> to a target's copts fix a precompile resolution error?</summary>
<p>No. copts never enter CcInfo, and the aspect builds the PCM action's command from CcInfo — forwarding only <code>-D</code> defines from copts. Use the <code>includes</code> attribute, a dependency whose CcInfo carries the path, or includer-relative includes in the headers.</p>
</details>
<details>
<summary>A vendor header produces diagnostics inconsistent with code that demonstrably works elsewhere. What is the likely cause?</summary>
<p>An <code>__has_include</code> fallback branch is being compiled for the first time. The isolated PCM action cannot see a header that all prior compilations could, so the preprocessor selects a branch never previously compiled — which may be invalid. Make the primary branch's header reachable in the PCM action (declare the edge).</p>
</details>
<details>
<summary>Why is the error attributed to an "aspect" rather than to my target?</summary>
<p>PCM actions are not declared by the failing target's rule; they are attached by <code>swift_clang_module_aspect</code> as it walks the deps graph. The message <em>"from aspects […] on objc_library rule target X"</em> means: the aspect, visiting target X, registered this precompile action, and the action failed. The target to fix is X (or its missing dependency), not the top-level target you asked Bazel to build.</p>
</details>
<details>
<summary>What does explicit module compilation provide over implicit?</summary>
<p>PCM compilations become declared Bazel actions: remote-cacheable (one compilation per module per configuration, shared across all machines and CI), deterministic (independent of import order and consumer flags), schedulable in parallel ahead of Swift compiles, and validating (undeclared dependencies fail instead of resolving incidentally). Every failure in Part 6 corresponds to a defect that implicit compilation masked.</p>
</details>

<h2 id="part10">Part 10 — Glossary</h2>
<dl class="gloss">
<dt>module map</dt><dd>File (<code>module.modulemap</code>) declaring that a set of headers forms a named Clang module. Framework modules resolve headers in <code>Headers/</code>; an <em>umbrella header</em> defines contents by transitive inclusion.</dd>
<dt>PCM</dt><dd>Precompiled module — serialized binary AST produced by compiling a module map's headers once. Importers deserialize it instead of re-parsing headers.</dd>
<dt>implicit modules</dt><dd>Compilation mode in which the compiler builds needed PCMs on demand, inside whichever compilation first imports them, inheriting that compilation's flags. PCMs live in a compiler-private cache outside the build system.</dd>
<dt>explicit modules</dt><dd>Compilation mode in which the build system schedules a dedicated, sandboxed action per module map (<code>SwiftPrecompileCModule</code>) and passes finished PCMs to consumers via <code>-fmodule-file=</code>. Enabled in rules_swift by <code>swift.emit_c_module</code> + <code>swift.use_c_modules</code>.</dd>
<dt>-I / -F</dt><dd>Header search path flags: <code>-I dir</code> for plain includes, <code>-F dir</code> for framework-style includes (<code>&lt;Name/Header.h&gt;</code> → <code>dir/Name.framework/Headers/Header.h</code>).</dd>
<dt>quote vs. angle include</dt><dd><code>"X.h"</code> searches the includer's directory first, then <code>-I</code> dirs. <code>&lt;Y/Z.h&gt;</code> searches <code>-I</code>, then <code>-F</code>, then system paths.</dd>
<dt>__has_include</dt><dd>Preprocessor operator testing whether a header is resolvable under the current compilation's search paths. Evaluates differently per compilation; guards become first-compiled code paths under explicit modules.</dd>
<dt>target / label / deps</dt><dd>Bazel's unit of build, its address (<code>//pkg:name</code>, external: <code>@repo//pkg:name</code>), and the attribute forming the dependency graph.</dd>
<dt>action</dt><dd>A concrete command with declared inputs/outputs, run in a sandbox containing only declared inputs. Unit of caching and parallelism.</dd>
<dt>CcInfo / SwiftInfo</dt><dd>Providers carrying compilation context along deps edges. CcInfo: headers, defines, search paths (from <code>includes</code>, not <code>copts</code>). SwiftInfo: Swift modules and, under explicit mode, Clang module artifacts.</dd>
<dt>aspect</dt><dd>A graph traversal attaching extra actions/providers to existing targets. <code>swift_clang_module_aspect</code> attaches PCM precompile actions to every module-map-owning target reachable through deps.</dd>
<dt>copts vs. includes</dt><dd><code>copts</code>: private flags for the target's own object compilations; not propagated, not visible to PCM actions (except <code>-D</code>). <code>includes</code>: search dirs entering CcInfo, visible to dependents and PCM actions.</dd>
<dt>xcframework</dt><dd>Distribution bundle containing one prebuilt framework per platform slice. Imported into Bazel by <code>apple_static_xcframework_import</code> / <code>apple_dynamic_xcframework_import</code>.</dd>
<dt>RSPM / target_deps</dt><dd>rules_swift_package_manager: generates Bazel BUILD files for SPM packages. <code>configure_package(target_deps)</code> (≥1.17) injects dependency edges into generated targets — required for binary targets, which SPM manifests cannot give deps.</dd>
<dt>-Swift.h</dt><dd>Generated ObjC header exposing a framework's Swift API to ObjC. Part of the umbrella; may contain <code>@import</code> of other modules, contributing to the module dependency set.</dd>
<dt>.swiftinterface</dt><dd>Textual Swift module interface shipped in binary frameworks; compiled by the build into a binary swiftmodule. Its <code>import</code> statements must all be resolvable, contributing to the dependency set.</dd>
<dt>-import-underlying-module</dt><dd>Swift flag loading the Clang module with the same name as the module being compiled — the mixed-language module pattern. The module map involved is supplied by flags, not owned by a target, making it invisible to aspects.</dd>
<dt>params file</dt><dd>File holding a long argument list, passed to a tool as <code>@file.params</code> to avoid OS command-length limits. Argument splitting bugs in params handling surface as malformed-path errors.</dd>
</dl>

<h2 id="summary">Summary</h2>
<div class="callout">
<p class="rule">Header resolution is a function of the running compilation's flags. Implicit mode builds modules inside consumer compilations, so undeclared dependencies resolve through borrowed flags. Explicit mode builds each module in a sandboxed action with only declared inputs, so the module graph and the target graph must agree. Each of the nine failures was a point of disagreement: an undeclared edge, invalid metadata never previously evaluated, an input invisible to the aspect, or a path hazard exercised by the new action type.</p>
<p class="corollary">App target green with <code>swift.use_c_modules</code> · June 2026</p>
</div>
</div>

<script>
function xmodShowMode(mode) {
  var isImplicit = mode === 'implicit';
  document.getElementById('panelImplicit').classList.toggle('active', isImplicit);
  document.getElementById('panelExplicit').classList.toggle('active', !isImplicit);
  document.getElementById('btnImplicit').classList.toggle('active', isImplicit);
  document.getElementById('btnExplicit').classList.toggle('active', !isImplicit);
  document.getElementById('btnImplicit').setAttribute('aria-selected', isImplicit);
  document.getElementById('btnExplicit').setAttribute('aria-selected', !isImplicit);
}
</script>
