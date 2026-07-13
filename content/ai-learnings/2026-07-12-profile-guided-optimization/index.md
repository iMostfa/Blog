+++
title = "Profile-Guided Optimization, From First Principles"
date = 2026-07-12

[taxonomies]
tags = ["pgo", "llvm", "performance", "ios", "build-systems", "ai-learnings"]

[extra]
card = "card.png"
+++

This write-up was distilled from an LLVM talk about making Profile-Guided Optimization (PGO) useful
for mobile apps. The talk starts from a very practical problem: mobile startup is sensitive to page
faults, but traditional PGO often improves speed by increasing code size through inlining. That trade-off
is awkward on mobile, where smaller code can launch faster.

The interesting idea in the talk is temporal profiling: record when functions first execute, merge many
startup traces, then let the linker reorder functions so startup code sits together in the final binary.
The reported results were the kind worth remembering: up to 40% fewer startup page faults, almost 1-3%
compressed-size reduction, and in one Firefox iOS experiment, over 6% compressed-size reduction for the
client binary from function reordering alone.

Reddit's iOS optimization write-up is the production-scale case study that made the idea click for me.
Using PGO, temporal profiling, and function reordering, Reddit reduced the main iOS binary from 198.6 MiB
to 157.1 MiB and the compressed IPA from 280.6 MiB to 239.6 MiB. The numbers are impressive, but the
core idea is more important: instead of asking the compiler and linker to guess what matters, you run the
app, record what actually happened, and feed that evidence back into the next build.

This document builds that idea from scratch. Prerequisites: you know an app eventually becomes a binary
and that a compiler turns source code into machine code. Nothing more.

<style>
.xpgo { --pos:#1a7f37; --neg:#b3261e; --warn:#9a6700; --hot:#b3261e; --warm:#bf8700; --cold:#0969da; --ink:#57606a; }
[data-theme="dark"] .xpgo { --pos:#7ee787; --neg:#ff7b72; --warn:#e3b341; --hot:#ff7b72; --warm:#e3b341; --cold:#79c0ff; --ink:#8b949e; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .xpgo { --pos:#7ee787; --neg:#ff7b72; --warn:#e3b341; --hot:#ff7b72; --warm:#e3b341; --cold:#79c0ff; --ink:#8b949e; } }
.xpgo .toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.25rem 2rem; list-style:none; padding:0; margin:.5rem 0 0; }
.xpgo .toc-grid a { display:block; padding:.15rem 0; }
.xpgo .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:.75rem; margin:1rem 0; }
.xpgo .card { background:var(--bg-light); border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; }
.xpgo .card h4 { margin:.1rem 0 .5rem; font-size:1rem; }
.xpgo .card p, .xpgo .card li { font-size:.9rem; margin:.5rem 0; }
.xpgo .card ul { margin:.25rem 0; padding-left:1.2rem; }
.xpgo pre { font-size:.8rem; line-height:1.5; overflow-x:auto; }
.xpgo .dim { color:var(--text-light); }
.xpgo .ok { color:var(--pos); font-weight:700; }
.xpgo .err { color:var(--neg); font-weight:700; }
.xpgo .hot { color:var(--hot); font-weight:700; }
.xpgo .cold { color:var(--cold); font-weight:700; }
.xpgo .warm { color:var(--warm); font-weight:700; }
.xpgo .diagram { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1.25rem; background:var(--bg-light); margin:1rem 0; }
.xpgo .dgrid { display:flex; flex-wrap:wrap; gap:.6rem; align-items:stretch; }
.xpgo .dbox { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.75rem .85rem; background:var(--bg); font-size:.82rem; line-height:1.5; flex:1; min-width:190px; }
.xpgo .dbox .dtitle { font-weight:700; font-size:.86rem; margin-bottom:.35rem; }
.xpgo .arrow { display:flex; align-items:center; justify-content:center; color:var(--text-light); font-weight:700; min-width:1.5rem; }
.xpgo .dcaption { font-size:.85rem; color:var(--text-light); margin-top:.8rem; line-height:1.6; }
.xpgo .callout { border:1px solid var(--accent); border-left:4px solid var(--accent); border-radius:var(--standard-border-radius); padding:1.1rem 1.25rem; margin:1rem 0; background:var(--bg-light); }
.xpgo .callout .rule { font-weight:700; font-size:1.03rem; line-height:1.55; margin:.2rem 0; }
.xpgo .callout .corollary { color:var(--text-light); font-size:.9rem; margin:.65rem 0 0; }
.xpgo table td, .xpgo table th { font-size:.88rem; vertical-align:top; }
.xpgo .pill { display:inline-block; border-radius:999px; padding:0 .55rem; font-size:.68rem; font-weight:700; border:1px solid currentColor; }
.xpgo .pill.hot { color:var(--hot); }
.xpgo .pill.cold { color:var(--cold); }
.xpgo .pill.warm { color:var(--warm); }
.xpgo .layout { display:grid; grid-template-columns:1fr; gap:.7rem; margin:1rem 0; }
.xpgo .row { display:grid; grid-template-columns:7rem 1fr; gap:.7rem; align-items:center; }
.xpgo .rlabel { font-size:.75rem; font-weight:700; color:var(--text-light); text-transform:uppercase; letter-spacing:.04em; }
.xpgo .pages { display:flex; flex-wrap:wrap; gap:.28rem; }
.xpgo .page { width:2rem; height:1.4rem; border:1px solid var(--border); border-radius:.25rem; background:var(--bg); }
.xpgo .page.hot { background:color-mix(in srgb,var(--hot) 34%,var(--bg)); border-color:var(--hot); }
.xpgo .page.warm { background:color-mix(in srgb,var(--warm) 30%,var(--bg)); border-color:var(--warm); }
.xpgo .page.cold { background:color-mix(in srgb,var(--cold) 24%,var(--bg)); border-color:var(--cold); }
.xpgo .metric-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; margin:1rem 0; }
.xpgo .metric { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; background:var(--bg-light); border-top:3px solid var(--accent); }
.xpgo .metric .label { font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-light); }
.xpgo .metric .value { font-size:1.6rem; font-weight:800; line-height:1.15; margin:.25rem 0; color:var(--accent); }
.xpgo .metric .sub { font-size:.82rem; color:var(--text-light); }
.xpgo .iviz { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; background:var(--bg-light); margin:1rem 0; }
.xpgo .iviz h4 { margin:.1rem 0 .65rem; font-size:1rem; }
.xpgo .seg { display:inline-flex; flex-wrap:wrap; gap:.25rem; border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.25rem; background:var(--bg); margin:.15rem 0 .8rem; }
.xpgo .seg button { border:0; border-radius:.25rem; padding:.4rem .75rem; background:transparent; color:var(--text-light); cursor:pointer; font:inherit; font-size:.86rem; }
.xpgo .seg button.active { background:var(--accent); color:var(--accent-text); }
.xpgo .panel { display:none; }
.xpgo .panel.active { display:block; }
.xpgo .mini-flow { display:flex; flex-wrap:wrap; gap:.45rem; align-items:stretch; margin:.5rem 0; }
.xpgo .node { border:1px solid var(--border); border-radius:var(--standard-border-radius); background:var(--bg); padding:.65rem .75rem; min-width:8.5rem; flex:1; font-size:.84rem; line-height:1.45; }
.xpgo .node strong { display:block; margin-bottom:.2rem; }
.xpgo .node.hot { border-color:var(--hot); background:color-mix(in srgb,var(--hot) 12%,var(--bg)); }
.xpgo .node.cold { border-color:var(--cold); background:color-mix(in srgb,var(--cold) 12%,var(--bg)); }
.xpgo .node.warm { border-color:var(--warm); background:color-mix(in srgb,var(--warm) 12%,var(--bg)); }
.xpgo .bars { display:grid; gap:.45rem; margin:.6rem 0; }
.xpgo .barrow { display:grid; grid-template-columns:minmax(6rem,9rem) 1fr 3.5rem; gap:.6rem; align-items:center; font-size:.84rem; }
.xpgo .track { height:.85rem; border-radius:999px; background:var(--bg); border:1px solid var(--border); overflow:hidden; }
.xpgo .fill { display:block; height:100%; width:var(--w,50%); background:var(--accent); transition:width .15s ease; }
.xpgo .fill.hot { background:var(--hot); }
.xpgo .fill.cold { background:var(--cold); }
.xpgo .fill.warm { background:var(--warm); }
.xpgo .range-line { display:grid; grid-template-columns:7rem 1fr 4rem; gap:.7rem; align-items:center; margin:.5rem 0; font-size:.86rem; }
.xpgo input[type="range"] { width:100%; accent-color:var(--accent); }
.xpgo .stamp-row { display:flex; flex-wrap:wrap; gap:.4rem; margin:.65rem 0; }
.xpgo .stamp { border:1px solid var(--border); border-radius:var(--standard-border-radius); background:var(--bg); padding:.45rem .6rem; min-width:4.8rem; text-align:center; font-family:var(--mono-font); font-size:.78rem; }
.xpgo .stamp.on { border-color:var(--hot); color:var(--hot); background:color-mix(in srgb,var(--hot) 10%,var(--bg)); }
.xpgo .stage { opacity:.55; }
.xpgo .stage.active { opacity:1; border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
.xpgo .choice-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:.6rem; margin:.7rem 0; }
.xpgo .choice { border:1px solid var(--border); border-radius:var(--standard-border-radius); background:var(--bg); padding:.75rem; font-size:.86rem; }
.xpgo .choice strong { display:block; margin-bottom:.25rem; color:var(--accent); }
.xpgo .term-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:.45rem; margin:.6rem 0; }
.xpgo .term-grid button { text-align:left; border:1px solid var(--border); border-radius:var(--standard-border-radius); background:var(--bg); color:var(--fg-color); padding:.55rem .65rem; cursor:pointer; font:inherit; font-size:.84rem; }
.xpgo .term-grid button.active { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset; }
.xpgo .term-card { border:1px solid var(--accent); border-radius:var(--standard-border-radius); background:var(--bg); padding:.85rem; font-size:.9rem; min-height:4rem; }
.xpgo details.faq { border:1px solid var(--border); border-radius:var(--standard-border-radius); margin-bottom:.55rem; padding:.2rem .6rem; }
.xpgo details.faq summary { cursor:pointer; font-weight:700; padding:.45rem 0; }
.xpgo details.faq p { font-size:.92rem; margin:.45rem 0; }
.xpgo .gloss dt { font-weight:700; color:var(--accent); margin-top:.9rem; }
.xpgo .gloss dd { margin:.15rem 0 0; font-size:.9rem; }
@media (max-width:650px) { .xpgo .toc-grid { grid-template-columns:1fr; } .xpgo .row { grid-template-columns:1fr; gap:.3rem; } .xpgo .arrow { min-width:100%; } }
</style>

<div class="xpgo">
<nav aria-label="Contents">
<h2 id="contents">Contents</h2>
<ol class="toc-grid">
<li><a href="#part1">What the compiler normally guesses</a></li>
<li><a href="#part2">Why mobile cares about hot code and size</a></li>
<li><a href="#part3">The PGO feedback loop</a></li>
<li><a href="#part4">Coverage profiling</a></li>
<li><a href="#part5">Temporal profiling</a></li>
<li><a href="#part6">Function layout and page faults</a></li>
<li><a href="#part7">Balanced partitioning</a></li>
<li><a href="#part8">Reddit's iOS pipeline</a></li>
<li><a href="#part9">Case study: reading a real profile</a></li>
<li><a href="#part10">Measurement and traps</a></li>
<li><a href="#part11">Diagnostic reference</a></li>
<li><a href="#part12">FAQ</a></li>
<li><a href="#part13">Glossary</a></li>
</ol>
</nav>

<h2 id="part1">Part 1 — What the compiler normally guesses</h2>
<p>A compiler has to make performance decisions before your app has ever run. Should this function be inlined? Which branch is likely? Which loop deserves more aggressive optimization? Which code should be kept close together in the final binary?</p>

<div class="iviz">
<h4>Static guess vs. profile-guided build</h4>
<div class="mini-flow">
<div class="node warm"><strong>Static build</strong>Source code shape</div>
<div class="arrow">→</div>
<div class="node warm"><strong>Heuristics</strong>Compiler guesses hot paths</div>
<div class="arrow">→</div>
<div class="node cold"><strong>Risk</strong>Budget goes to the wrong code</div>
</div>
<div class="mini-flow">
<div class="node hot"><strong>PGO build</strong>Instrumented app run</div>
<div class="arrow">→</div>
<div class="node hot"><strong>Profile data</strong>Real hot paths recorded</div>
<div class="arrow">→</div>
<div class="node"><strong>Optimized build</strong>Budget follows evidence</div>
</div>
<p class="dcaption">The difference is not that PGO has a smarter compiler. It gives the compiler a measured workload to believe.</p>
</div>

<p>Without profiles, the compiler uses static heuristics: educated guesses based on the shape of the code. Those guesses are often reasonable, but they are still guesses. A function that looks small may be irrelevant. A branch that looks unlikely may be the branch every user hits during startup. A generic utility may be cold in most of the app but hot on the first screen.</p>

<div class="cards">
<div class="card">
<h4>Static optimization</h4>
<p>The compiler looks only at source/IR. It optimizes based on general rules: small functions are inline candidates, loops get transformed, branches get predicted from code shape.</p>
</div>
<div class="card">
<h4>Profile-guided optimization</h4>
<p>You first build an instrumented app, run representative flows, merge the generated profile files, then rebuild using those profiles. The compiler now has evidence.</p>
</div>
</div>

<div class="iviz">
<h4>Switch the compiler's view</h4>
<div class="seg" role="tablist" aria-label="Compiler view">
<button class="active" type="button" onclick="xpgoShow('guess-view','guess')">Static guess</button>
<button type="button" onclick="xpgoShow('guess-view','profile')">Profile evidence</button>
</div>
<div data-xpgo-group="guess-view" data-xpgo-panel="guess" class="panel active">
<div class="mini-flow">
<div class="node warm"><strong>Source shape</strong>Small function, branch, loop</div>
<div class="arrow">→</div>
<div class="node"><strong>Heuristic</strong>"This probably matters"</div>
<div class="arrow">→</div>
<div class="node cold"><strong>Risk</strong>Wrong path gets budget</div>
</div>
<p class="dcaption">Without profiles, the compiler only sees the code's shape. It cannot know which path users actually hit.</p>
</div>
<div data-xpgo-group="guess-view" data-xpgo-panel="profile" class="panel">
<div class="mini-flow">
<div class="node hot"><strong>Runtime data</strong>startup called this 1,000x</div>
<div class="arrow">→</div>
<div class="node"><strong>Optimizer</strong>Spend budget here</div>
<div class="arrow">→</div>
<div class="node cold"><strong>Cold path</strong>Keep small, move later</div>
</div>
<p class="dcaption">PGO replaces "probably" with measured behavior from the workload you chose.</p>
</div>
</div>

<div class="callout">
<p class="rule">PGO is a feedback loop: build with instrumentation → run realistic behavior → collect profiles → rebuild using those profiles.</p>
<p class="corollary">The profile does not change what your program means. It changes how aggressively and where the toolchain spends optimization budget.</p>
</div>

<div class="callout">
<p class="rule">The rule to remember: coverage PGO tells the compiler what code is hot. Temporal PGO tells the linker what code runs together. On mobile, both matter because code size and code layout affect startup.</p>
</div>

<h2 id="part2">Part 2 — Why mobile cares about hot code and size</h2>
<p>Mobile startup is not only about how fast one function executes after it is already in memory. Before that function can run, its code has to be present in memory. If it is not, the kernel brings in the page that contains it, and that page fault costs time. A smaller and better-laid-out <code>__TEXT</code> section usually means fewer pages touched during startup.</p>

<p>This is why the hot/cold distinction matters. PGO is deciding where the toolchain should spend optimization budget. Some code deserves aggressive treatment because it runs during startup or a critical flow. Some code should mostly stay out of the way because making it bigger or placing it early can hurt the path users actually feel.</p>

<p>PGO starts with a simple split: some code is <span class="hot">hot</span>, some code is <span class="cold">cold</span>. Hot does not mean "important to the product" and cold does not mean "dead". Hot means "executed often, or executed during an important measured window". Cold means "rarely executed in the profile you collected".</p>

<table>
<thead><tr><th>Category</th><th>Meaning</th><th>Optimization implication</th></tr></thead>
<tbody>
<tr><td><span class="pill hot">Hot</span></td><td>Runs frequently or during a critical flow such as cold startup.</td><td>Worth inlining, branch tuning, layout priority, and sometimes more code size.</td></tr>
<tr><td><span class="pill cold">Cold</span></td><td>Runs rarely or never in the collected workload.</td><td>Avoid wasting binary size. Keep it out of the hot path and often optimize for size.</td></tr>
<tr><td><span class="pill warm">Warm</span></td><td>Runs sometimes, but not in the first-order path.</td><td>Optimize normally; do not let it disrupt startup layout.</td></tr>
</tbody>
</table>

<p>The phrase "hot path" is only meaningful relative to the workload you profiled. If your profile comes from login and home-feed startup, then PGO learns about login and home-feed startup. It cannot magically optimize a checkout flow, editor flow, or obscure settings screen unless that behavior appears in the profile.</p>

<h3>Why <code>-Oz</code> can beat "faster" optimization</h3>
<p>On desktop/server code, "optimize for speed" often sounds like the obvious default. On mobile, size is part of speed. That is why mobile apps are often built with <code>-Oz</code> or other size-aware settings instead of blindly choosing speed-oriented optimization. More inlining can make a hot CPU loop faster, but it can also inflate code size enough to hurt cold startup.</p>

<div class="iviz">
<h4>Move the inlining dial</h4>
<div class="range-line">
<label for="xpgo-inline-range">Inlining</label>
<input id="xpgo-inline-range" type="range" min="0" max="100" value="35" oninput="xpgoInline(this.value)">
<strong id="xpgo-inline-label">35%</strong>
</div>
<div class="bars">
<div class="barrow"><span>CPU call overhead</span><span class="track"><span id="xpgo-overhead" class="fill cold" style="--w:65%"></span></span><span id="xpgo-overhead-label">65%</span></div>
<div class="barrow"><span>Code size</span><span class="track"><span id="xpgo-codesize" class="fill hot" style="--w:35%"></span></span><span id="xpgo-codesize-label">35%</span></div>
<div class="barrow"><span>Startup page risk</span><span class="track"><span id="xpgo-pagerisk" class="fill warm" style="--w:42%"></span></span><span id="xpgo-pagerisk-label">42%</span></div>
</div>
<p class="dcaption">Inlining can reduce call overhead, but it also grows code. On mobile, too much growth can make startup worse even if individual calls are faster.</p>
</div>

<h2 id="part3">Part 3 — The PGO feedback loop</h2>
<p>At a high level, PGO has two builds and one run in the middle.</p>

<div class="diagram">
<div class="dgrid">
<div class="dbox"><div class="dtitle">1. Instrumented build</div>Compile with flags such as <code>-fprofile-generate</code>. The produced app includes counters or probes that write execution data.</div>
<div class="arrow">→</div>
<div class="dbox"><div class="dtitle">2. Representative run</div>Exercise the app through realistic flows: startup, logged-out, logged-in, notifications, critical screens, experiments.</div>
<div class="arrow">→</div>
<div class="dbox"><div class="dtitle">3. Merge profiles</div>Combine raw outputs with <code>llvm-profdata merge</code> into a stable <code>.profdata</code> file.</div>
<div class="arrow">→</div>
<div class="dbox"><div class="dtitle">4. Optimized build</div>Rebuild with <code>-fprofile-use=/path/profile.profdata</code>. The compiler and linker now optimize with evidence.</div>
</div>
<p class="dcaption">The profiles are build inputs. Treat them like generated artifacts with a freshness policy, not like magic constants checked in forever.</p>
</div>

<div class="iviz">
<h4>Step through the feedback loop</h4>
<div class="seg" role="tablist" aria-label="PGO loop steps">
<button class="active" type="button" onclick="xpgoStage('loop',1)">1 Build</button>
<button type="button" onclick="xpgoStage('loop',2)">2 Run</button>
<button type="button" onclick="xpgoStage('loop',3)">3 Merge</button>
<button type="button" onclick="xpgoStage('loop',4)">4 Rebuild</button>
</div>
<div class="mini-flow" data-xpgo-stage-group="loop">
<div class="node stage active" data-xpgo-stage="1"><strong>Instrument</strong>Add counters/timestamps</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="2"><strong>Exercise</strong>Run representative flows</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="3"><strong>Merge</strong>Turn raw runs into profile input</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="4"><strong>Optimize</strong>Compiler/linker use the profile</div>
</div>
<p id="xpgo-loop-caption" class="dcaption">The first build is deliberately instrumented; it is not the final app you ship.</p>
</div>

<pre>clang -fprofile-generate ...       <span class="dim"># build an instrumented binary</span>
./run-representative-workload      <span class="dim"># emits one or more .profraw files</span>
llvm-profdata merge *.profraw -o app.profdata
clang -fprofile-use=app.profdata ...</pre>

<h2 id="part4">Part 4 — Coverage profiling</h2>
<p>Coverage profiling answers: <strong>what ran, and how much?</strong> It records function counts, branch behavior, and other execution-frequency signals. When you feed that profile into a later compile, the compiler can make better local decisions.</p>

<div class="cards">
<div class="card">
<h4>Inlining</h4>
<p>Inlining removes a function call by copying the callee into the caller. It can expose further optimization, but it can also grow the binary. PGO helps spend inlining budget on hot calls instead of cold ones.</p>
</div>
<div class="card">
<h4>Branch layout</h4>
<p>If one branch is usually taken, the compiler can lay out the common path so the CPU does less jumping and prediction is easier.</p>
</div>
<div class="card">
<h4>Loop and codegen choices</h4>
<p>Loops that actually run many iterations can justify heavier optimization. Cold loops should not receive the same attention by default.</p>
</div>
</div>

<div class="iviz">
<h4>Choose a coverage profile</h4>
<div class="seg" role="tablist" aria-label="Coverage workload">
<button class="active" type="button" onclick="xpgoShow('coverage-view','startup')">Startup profile</button>
<button type="button" onclick="xpgoShow('coverage-view','settings')">Settings profile</button>
</div>
<div data-xpgo-group="coverage-view" data-xpgo-panel="startup" class="panel active">
<div class="bars">
<div class="barrow"><span>bootstrap()</span><span class="track"><span class="fill hot" style="--w:95%"></span></span><span>950</span></div>
<div class="barrow"><span>decodeFeed()</span><span class="track"><span class="fill hot" style="--w:78%"></span></span><span>780</span></div>
<div class="barrow"><span>openSettings()</span><span class="track"><span class="fill cold" style="--w:4%"></span></span><span>40</span></div>
</div>
<p class="dcaption">The compiler sees startup and feed code as hot, so inlining and branch decisions bias toward that path.</p>
</div>
<div data-xpgo-group="coverage-view" data-xpgo-panel="settings" class="panel">
<div class="bars">
<div class="barrow"><span>bootstrap()</span><span class="track"><span class="fill warm" style="--w:35%"></span></span><span>350</span></div>
<div class="barrow"><span>decodeFeed()</span><span class="track"><span class="fill cold" style="--w:12%"></span></span><span>120</span></div>
<div class="barrow"><span>openSettings()</span><span class="track"><span class="fill hot" style="--w:92%"></span></span><span>920</span></div>
</div>
<p class="dcaption">A different workload teaches a different truth. This is why representative profiling matters.</p>
</div>
</div>

<div class="callout">
<p class="rule">Coverage PGO is mostly about compiler decisions inside and between functions.</p>
<p class="corollary">It tells the optimizer where the execution weight is, so it can avoid treating every path as equally important. The mobile caveat: default IRPGO is often tuned toward inlining and speed, so without size-aware settings it can grow the binary.</p>
</div>

<p>That caveat matters. If PGO says "this call is hot", the compiler may inline it. Sometimes that is exactly right. Sometimes the extra code size creates more instruction-cache pressure and more pages to fault in. LLVM has size-oriented knobs such as profile-guided size optimization and inlining controls for this reason. PGO is evidence; policy still matters.</p>

<h2 id="part5">Part 5 — Temporal profiling</h2>
<p>Coverage answers "how often?". Temporal profiling answers <strong>"when, and in what order?"</strong> That distinction matters for startup. During a cold launch, the device does not load your entire binary into memory at once. It faults in pages as code is touched. If startup functions are scattered across the file, the system touches more pages earlier.</p>

<p>Temporal profiling records an execution trace: function A happened, then B, then C. For mobile startup, that sequence is gold. It lets the linker place functions that execute close together physically close together in the binary.</p>

<div class="diagram">
<div class="dgrid">
<div class="dbox"><div class="dtitle">Coverage profile</div><code>FeedViewController.viewDidLoad</code>: 1<br><code>JSONDecoder.decode</code>: 340<br><code>SettingsScreen.open</code>: 0</div>
<div class="arrow">→</div>
<div class="dbox"><div class="dtitle">Compiler learns</div>Decode path is hot. Settings path is cold. Inline and branch decisions should reflect that.</div>
</div>
<div class="dgrid" style="margin-top:.7rem">
<div class="dbox"><div class="dtitle">Temporal profile</div><code>main → AppDelegate → bootstrap → feed → first cell</code></div>
<div class="arrow">→</div>
<div class="dbox"><div class="dtitle">Linker learns</div>These functions belong near each other because startup touches them in this order.</div>
</div>
<p class="dcaption">Both profiles describe the same app, but they answer different optimization questions.</p>
</div>

<div class="iviz">
<h4>Record first-call timestamps</h4>
<div class="seg" role="tablist" aria-label="Temporal trace">
<button class="active" type="button" onclick="xpgoTrace(0)">Reset</button>
<button type="button" onclick="xpgoTrace(1)">Call 1</button>
<button type="button" onclick="xpgoTrace(2)">Call 2</button>
<button type="button" onclick="xpgoTrace(3)">Call 3</button>
<button type="button" onclick="xpgoTrace(4)">Call 4</button>
</div>
<div class="stamp-row">
<span id="xpgo-stamp-main" class="stamp">main<br>0</span>
<span id="xpgo-stamp-app" class="stamp">App<br>0</span>
<span id="xpgo-stamp-feed" class="stamp">Feed<br>0</span>
<span id="xpgo-stamp-cell" class="stamp">Cell<br>0</span>
<span id="xpgo-stamp-settings" class="stamp">Settings<br>0</span>
</div>
<p id="xpgo-trace-caption" class="dcaption">Before execution, every timestamp is zero. Zero means "not observed in this run."</p>
</div>

<p>In Reddit's write-up, temporal profiling used LLVM's <code>-pgo-temporal-instrumentation</code>. The LLVM talk explains the mechanism: every instrumented function gets a timestamp slot initialized to zero; on the first call, the runtime writes the current global timestamp and increments it. When the raw profile is dumped, functions can be sorted by timestamp to recover a trace. A zero timestamp means the function did not run in that profile.</p>

<p>A key detail: temporal instrumentation has much lower binary-size overhead than traditional IR PGO instrumentation, which helps the profiled app behave more like the real release app. If the profiled build is wildly different from release, its function order is less trustworthy.</p>

<h2 id="part6">Part 6 — Function layout and page faults</h2>
<p>A binary is not just a bag of functions. It is an ordered file. That order affects cold startup because the kernel brings code into memory in pages. Reddit's article calls out 16 KiB pages on iOS. The exact page size matters less than the invariant: touching code from many far-apart regions causes more page faults than touching code from nearby regions.</p>

<div class="layout">
<div class="row">
<div class="rlabel">Before layout</div>
<div class="pages" aria-label="Scattered hot and cold pages before layout">
<span class="page hot"></span><span class="page cold"></span><span class="page"></span><span class="page hot"></span><span class="page"></span><span class="page warm"></span><span class="page cold"></span><span class="page hot"></span><span class="page"></span><span class="page cold"></span><span class="page warm"></span><span class="page hot"></span>
</div>
</div>
<div class="row">
<div class="rlabel">After layout</div>
<div class="pages" aria-label="Clustered hot pages after layout">
<span class="page hot"></span><span class="page hot"></span><span class="page hot"></span><span class="page hot"></span><span class="page warm"></span><span class="page warm"></span><span class="page"></span><span class="page"></span><span class="page cold"></span><span class="page cold"></span><span class="page cold"></span><span class="page"></span>
</div>
</div>
</div>

<div class="iviz">
<h4>Compare page touches</h4>
<div class="seg" role="tablist" aria-label="Binary layout">
<button class="active" type="button" onclick="xpgoShow('layout-view','scattered')">Scattered</button>
<button type="button" onclick="xpgoShow('layout-view','clustered')">Clustered</button>
</div>
<div data-xpgo-group="layout-view" data-xpgo-panel="scattered" class="panel active">
<div class="bars">
<div class="barrow"><span>Pages touched</span><span class="track"><span class="fill hot" style="--w:92%"></span></span><span>11</span></div>
<div class="barrow"><span>Startup wait</span><span class="track"><span class="fill warm" style="--w:80%"></span></span><span>high</span></div>
</div>
<p class="dcaption">Startup functions are spread apart, so the launch path jumps across many pages.</p>
</div>
<div data-xpgo-group="layout-view" data-xpgo-panel="clustered" class="panel">
<div class="bars">
<div class="barrow"><span>Pages touched</span><span class="track"><span class="fill hot" style="--w:38%"></span></span><span>5</span></div>
<div class="barrow"><span>Startup wait</span><span class="track"><span class="fill warm" style="--w:32%"></span></span><span>lower</span></div>
</div>
<p class="dcaption">Startup functions are adjacent, so the launch path reuses nearby pages.</p>
</div>
</div>

<p>Function reordering does not make a function faster in isolation. It makes the startup walk through the binary cheaper: fewer scattered pages, fewer cold misses, less waiting before the app becomes interactive.</p>

<div class="callout">
<p class="rule">For cold startup, where code lives can matter almost as much as what the code does.</p>
<p class="corollary">That is the part of PGO I want to remember: profiles can guide not only compiler transforms, but also physical binary layout.</p>
</div>

<p>Also keep two goals separate: the compressed IPA should be small so install/update is fast, while the installed binary should be laid out so launch is fast. The app is not decompressing the IPA during startup; compression helps distribution, page-fault reduction helps launch.</p>

<h2 id="part7">Part 7 — Balanced partitioning</h2>
<p>The hard part is that layout has two goals that can pull in different directions.</p>

<div class="cards">
<div class="card">
<h4>Startup locality</h4>
<p>Functions that run near each other in time should sit near each other in the file. This reduces page faults during cold startup and critical flows.</p>
</div>
<div class="card">
<h4>Compression locality</h4>
<p>Functions with similar instruction patterns often compress better when placed near each other, because LZ-style compression benefits from repeated nearby patterns.</p>
</div>
</div>

<div class="iviz">
<h4>Pick the layout objective</h4>
<div class="seg" role="tablist" aria-label="Balanced partitioning objective">
<button class="active" type="button" onclick="xpgoShow('bp-view','startup')">Startup</button>
<button type="button" onclick="xpgoShow('bp-view','compression')">Compression</button>
<button type="button" onclick="xpgoShow('bp-view','both')">Both</button>
</div>
<div data-xpgo-group="bp-view" data-xpgo-panel="startup" class="panel active">
<div class="mini-flow">
<div class="node hot"><strong>A</strong>main</div><div class="node hot"><strong>B</strong>bootstrap</div><div class="node hot"><strong>C</strong>feed</div><div class="node cold"><strong>X</strong>settings</div>
</div>
<p class="dcaption">Prioritize functions that execute close together in the startup trace.</p>
</div>
<div data-xpgo-group="bp-view" data-xpgo-panel="compression" class="panel">
<div class="mini-flow">
<div class="node cold"><strong>X1</strong>similar bytes</div><div class="node cold"><strong>X2</strong>similar bytes</div><div class="node warm"><strong>Y1</strong>similar bytes</div><div class="node warm"><strong>Y2</strong>similar bytes</div>
</div>
<p class="dcaption">Prioritize functions with similar instruction patterns so compression sees repeated nearby sequences.</p>
</div>
<div data-xpgo-group="bp-view" data-xpgo-panel="both" class="panel">
<div class="mini-flow">
<div class="node hot"><strong>Hot trace</strong>A · B · C</div><div class="node warm"><strong>Warm similar</strong>Y1 · Y2</div><div class="node cold"><strong>Cold similar</strong>X1 · X2</div>
</div>
<p class="dcaption">Balanced partitioning searches for a useful compromise: startup locality first where it matters, compression locality elsewhere.</p>
</div>
</div>

<p>Balanced partitioning treats layout like a graph problem. Functions are nodes. Relationships between functions are utilities: "these two run near each other" or "these two look similar for compression". The algorithm recursively partitions the graph so strongly related functions tend to stay together. With an option such as <code>--compression-sort=both</code>, the linker can balance temporal locality and compression locality instead of choosing only one.</p>

<div class="diagram">
<div class="dgrid">
<div class="dbox"><div class="dtitle">Temporal utility</div><code>A → B → C</code> appeared in the startup trace, so A, B, and C should be close.</div>
<div class="dbox"><div class="dtitle">Compression utility</div><code>X</code> and <code>Y</code> have similar machine-code patterns, so placing them close may shrink the compressed IPA.</div>
<div class="dbox"><div class="dtitle">Partitioning decision</div>Keep high-utility relationships inside the same partition when possible; split weaker relationships first.</div>
</div>
<p class="dcaption">This is why the same optimization can improve startup and reduce size. The layout is optimized using real execution traces plus code-similarity signals.</p>
</div>

<p>The LLVM talk gives a concrete compression model: LZ-style compression benefits from repeated instruction sequences appearing within a sliding window. Function contents can be represented by stable hashes of instructions; functions sharing many utility vertices are good candidates to place near each other. For startup, the utility vertices come from temporal traces instead.</p>

<h2 id="part8">Part 8 — Reddit's iOS pipeline</h2>
<p>Reddit's production story becomes much easier to read once the pieces are separated.</p>

<div class="cards">
<div class="card">
<h4>1. Representative workloads</h4>
<p>They reused UI performance tests around important P0 use cases: fresh install, signed-out, logged-in, account switching, opening posts, and feed paths. HTTP stubbing reduced noise so the profiles reflected app behavior instead of network timing.</p>
</div>
<div class="card">
<h4>2. Two profile families</h4>
<p>Coverage profiles fed compiler optimization through <code>-profile-use</code>. Temporal profiles fed linker function ordering through LLD.</p>
</div>
<div class="card">
<h4>3. Final optimized release build</h4>
<p>The final App Store binary was built with profile inputs, a custom LLVM linker, and balanced partitioning for startup locality and compression.</p>
</div>
</div>

<pre>instrumented app + UI tests
  ├─ coverage .profraw files  → llvm-profdata merge → coverage.profdata
  └─ temporal .profraw files  → llvm-profdata merge → temporal.profdata

release build
  ├─ swiftc / clang use coverage.profdata for compiler PGO
  └─ LLD uses temporal.profdata for function ordering</pre>

<div class="iviz">
<h4>Follow one profile through the release pipeline</h4>
<div class="seg" role="tablist" aria-label="Reddit pipeline">
<button class="active" type="button" onclick="xpgoStage('reddit',1)">UI tests</button>
<button type="button" onclick="xpgoStage('reddit',2)">Merge</button>
<button type="button" onclick="xpgoStage('reddit',3)">Compile</button>
<button type="button" onclick="xpgoStage('reddit',4)">Link</button>
</div>
<div class="mini-flow" data-xpgo-stage-group="reddit">
<div class="node stage active" data-xpgo-stage="1"><strong>Tests</strong>realistic app paths</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="2"><strong>Profiles</strong>coverage + temporal</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="3"><strong>swiftc/clang</strong>use coverage data</div>
<div class="arrow">→</div>
<div class="node stage" data-xpgo-stage="4"><strong>LLD</strong>uses temporal layout</div>
</div>
<p id="xpgo-reddit-caption" class="dcaption">The profile starts as UI-test behavior, not as a hand-written order file.</p>
</div>

<p>They also tuned the inlining threshold upward. That is an important reminder: PGO is not just one flag. It is a build pipeline. Profiles make bolder optimization choices safer, but they do not remove trade-offs. More inlining can speed hot paths and expose optimization, but it can increase binary size. In Reddit's case, the layout/compression savings created room to be more aggressive.</p>

<h3>Results Worth Remembering</h3>
<div class="metric-row">
<div class="metric"><div class="label">Compressed IPA</div><div class="value">280.6 → 239.6 MiB</div><div class="sub">14.6% reduction</div></div>
<div class="metric"><div class="label">Uncompressed payload</div><div class="value">359.8 → 313.1 MiB</div><div class="sub">15.3% reduction</div></div>
<div class="metric"><div class="label">Main binary</div><div class="value">198.6 → 157.1 MiB</div><div class="sub">20.8% reduction</div></div>
</div>

<p>Those are size wins. The startup win was subtler to measure because iOS performs background optimizations after installation. Reddit focused on first-day behavior after install/update, where cold-start layout matters most, and used a dual-release strategy: one standard release, then an identical-code optimized release.</p>

<h2 id="part9">Part 9 — Case study: reading a real profile</h2>
<p>Everything above was theory plus other people's numbers. So I collected an IR PGO profile from the app I work on — a large marketplace iOS app, ~100 build modules — using a UI test that performs 6 cold launches and a feed browse pass. Then I actually read the profile. This section is what the theory looks like against production-scale code, and it changed how I think about two things: how extreme the hot/cold split really is, and whose code the hot set is made of.</p>

<div class="metric-row">
<div class="metric"><div class="label">Functions instrumented</div><div class="value">383,676</div><div class="sub">the whole app + every dependency</div></div>
<div class="metric"><div class="label">Executions recorded</div><div class="value">36.65M</div><div class="sub">sum of every branch-point counter</div></div>
<div class="metric"><div class="label">Never called</div><div class="value">96.32%</div><div class="sub">369,574 functions had entry count 0</div></div>
</div>

<h3>How skewed is "skewed"?</h3>
<p>Before looking, I assumed hot/cold meant something like 20/80. The real distribution is not in that universe. <code>llvm-profdata show --detailed-summary</code> prints a cumulative table: how many counter blocks (branch points) does it take to cover each share of all recorded executions? Verbatim output:</p>

<pre>$ xcrun llvm-profdata show --detailed-summary app.profdata
Total functions: 383676
Total number of blocks: 1073586
Total count: 36654739
Detailed summary:
26 blocks (0.00%) with count >= 197216 account for 50% of the total counts.
485 blocks (0.05%) with count >= 6384 account for 90% of the total counts.
1084 blocks (0.10%) with count >= 1505 account for 95% of the total counts.
4666 blocks (0.43%) with count >= 133 account for 99% of the total counts.</pre>

<div class="iviz">
<h4>Blocks needed to cover each share of execution</h4>
<div class="bars">
<div class="barrow"><span>50% of counts</span><span class="track"><span class="fill hot" style="--w:50%"></span></span><span>26</span></div>
<div class="barrow"><span>80%</span><span class="track"><span class="fill hot" style="--w:80%"></span></span><span>181</span></div>
<div class="barrow"><span>90%</span><span class="track"><span class="fill warm" style="--w:90%"></span></span><span>485</span></div>
<div class="barrow"><span>95%</span><span class="track"><span class="fill warm" style="--w:95%"></span></span><span>1,084</span></div>
<div class="barrow"><span>99%</span><span class="track"><span class="fill cold" style="--w:99%"></span></span><span>4,666</span></div>
<div class="barrow"><span>100%</span><span class="track"><span class="fill cold" style="--w:100%"></span></span><span>24,071</span></div>
</div>
<p class="dcaption">Bar length = share of execution covered; the number on the right = blocks needed, out of 1,073,586. Only 24,071 blocks (2.2%) executed at all.</p>
</div>

<div class="callout">
<p class="rule">If execution were uniform, covering 50% of the counts would take ~537,000 blocks. It took 26. That is a concentration factor of roughly 20,000×.</p>
<p class="corollary">This is why PGO works at all: the compiler can lavish attention on a few hundred functions and treat literally everything else as cold, and that policy is correct for 97.8% of the binary.</p>
</div>

<h3>Whose code is hot? Not mine.</h3>
<p>My second wrong assumption: that the hot set would be my app's code. Bucketing all 21M function <em>entries</em> by what kind of code was entered:</p>

<div class="iviz">
<h4>Share of function entries by code kind</h4>
<div class="bars">
<div class="barrow"><span>Swift runtime helpers</span><span class="track"><span class="fill hot" style="--w:43.5%"></span></span><span>43.5%</span></div>
<div class="barrow"><span>Compiler glue</span><span class="track"><span class="fill warm" style="--w:37.8%"></span></span><span>37.8%</span></div>
<div class="barrow"><span>Third-party SDKs</span><span class="track"><span class="fill cold" style="--w:16%"></span></span><span>16.0%</span></div>
<div class="barrow"><span>My app's code</span><span class="track"><span class="fill" style="--w:1.5%"></span></span><span>1.5%</span></div>
</div>
<p class="dcaption">"Compiler glue" = protocol/value witnesses, outlined copy/destroy helpers, thunks, metadata accessors — machinery the compiler generates around everyone's code.</p>
</div>

<p>The single most-called function in the entire app was <code>__swift_memcpy1_1</code> — 2,920,324 calls. That is 2.9 million <em>one-byte copies</em>, almost all driven by one third-party experimentation SDK that round-trips its JSON payloads through type-erased <code>Any</code> boxes during launch. The hottest single branch point in the binary was the read loop of nanopb — the C protobuf parser inside the analytics SDK — at 3.31M executions, because analytics state is parsed <em>and re-encoded</em> on every cold start.</p>

<table>
<thead><tr><th>Hottest spots in the binary</th><th>What it is</th><th>Max count</th></tr></thead>
<tbody>
<tr><td><code>buf_read</code> (nanopb)</td><td>protobuf decode loop, analytics SDK</td><td>3,312,715</td></tr>
<tr><td><code>__swift_memcpy1_1</code></td><td>runtime helper: copy one byte</td><td>2,920,324</td></tr>
<tr><td><code>__swift_noop_void_return</code></td><td>runtime helper: do nothing</td><td>2,629,953</td></tr>
<tr><td><code>AnyEncodable</code> destroy/copy witnesses</td><td>Codable type-erasure glue, experiments SDK</td><td>535,920 / 446,600</td></tr>
</tbody>
</table>

<p>Three more things the profile revealed that no amount of code review would have surfaced:</p>

<div class="cards">
<div class="card">
<h4>The profile is a free product audit</h4>
<p>17% of all function entries belonged to one experimentation SDK's Codable glue. The localization layer burned 250K entries in just 56 functions, copying a large enum payload on every string lookup. Neither showed up in any Instruments session we had run — they were spread across too many tiny calls.</p>
</div>
<div class="card">
<h4>Dead weight is measurable</h4>
<p>A generated analytics-events package contributed 6.8% of all functions in the binary but ~0.05% of execution. That is exactly the code the cold-marking half of PGO shrinks — and the strongest argument for the layout techniques in Parts 5–7.</p>
</div>
<div class="card">
<h4>The hot set is glue, so PGO's wins are glue wins</h4>
<p>Inlining a 3-line value witness into its hot caller eliminates call overhead on millions of one-byte copies. The classic C wins apply too: precise branch weights in nanopb's decode loops, the hottest code in the binary.</p>
</div>
</div>

<p>To do this on any app: build with <code>-fprofile-generate</code> (plus swiftc's IR-profile flags on iOS), run a launch workload, merge, then read the result before applying it:</p>

<pre>xcrun llvm-profdata show --detailed-summary app.profdata   <span class="dim"># the skew table</span>
xcrun llvm-profdata show --topn=50 app.profdata | xcrun swift-demangle   <span class="dim"># hottest functions</span>
xcrun llvm-profdata show --all-functions --counts app.profdata | less    <span class="dim"># everything</span></pre>

<div class="callout">
<p class="rule">Read the profile before you feed it to the compiler. The same file that guides the optimizer is the most honest launch-behavior audit you will ever get for free.</p>
</div>

<h2 id="part10">Part 10 — Measurement and traps</h2>
<p>PGO sounds mechanical, but the quality of the result depends on the quality of the profile and the measurement plan.</p>

<table>
<thead><tr><th>Trap</th><th>Why it matters</th><th>Mitigation</th></tr></thead>
<tbody>
<tr><td>Unrepresentative profile</td><td>The optimizer improves the behavior you showed it, not the behavior you hoped it would infer.</td><td>Profile critical user flows, feature-flag combinations, and startup states.</td></tr>
<tr><td>Profile staleness</td><td>As code changes, old profiles mention removed functions and miss new hot paths.</td><td>Regenerate profiles automatically in CI, especially before release.</td></tr>
<tr><td>Instrumentation distortion</td><td>If the instrumented app is much larger or slower, temporal order may differ from release.</td><td>Prefer low-overhead temporal instrumentation for layout profiles where available.</td></tr>
<tr><td>Speed-vs-size policy</td><td>Inlining-heavy PGO can improve CPU-bound paths while making mobile startup worse through code growth.</td><td>Use size-aware optimization settings and measure both binary size and startup/page-fault behavior.</td></tr>
<tr><td>Toolchain mismatch</td><td>Profiles and compilers/linkers need compatible formats and versions.</td><td>Pin toolchain versions and treat profile corruption/version errors as infrastructure failures.</td></tr>
<tr><td>Confounded rollout</td><td>If code changes and optimization changes ship together, impact is hard to isolate.</td><td>Use a controlled release plan when measuring pure optimization impact.</td></tr>
</tbody>
</table>

<div class="iviz">
<h4>Tap a trap</h4>
<div class="choice-grid">
<button class="choice" type="button" onclick="xpgoTrap('profile')"><strong>Bad profile</strong>Tests do not match real behavior.</button>
<button class="choice" type="button" onclick="xpgoTrap('stale')"><strong>Stale profile</strong>Code changed after collection.</button>
<button class="choice" type="button" onclick="xpgoTrap('rollout')"><strong>Confounded rollout</strong>Code and optimization ship together.</button>
</div>
<div id="xpgo-trap-card" class="term-card">Pick a trap to see the failure mode.</div>
</div>

<div class="callout">
<p class="rule">The hard engineering is not "turn on PGO". The hard engineering is collecting profiles you trust and proving the optimized binary helped.</p>
</div>

<h2 id="part11">Part 11 — Diagnostic reference</h2>
<p>Useful commands and flags to recognize when reading a PGO pipeline:</p>

<table>
<thead><tr><th>Thing</th><th>Role</th></tr></thead>
<tbody>
<tr><td><code>-fprofile-generate</code></td><td>Build an instrumented binary that emits raw profile data.</td></tr>
<tr><td><code>LLVM_PROFILE_FILE</code></td><td>Common runtime environment variable used to control where profile files are written.</td></tr>
<tr><td><code>llvm-profdata merge</code></td><td>Merge one or more <code>.profraw</code> files into a <code>.profdata</code> file consumed by the compiler/linker.</td></tr>
<tr><td><code>-fprofile-use=path</code> / <code>-profile-use=path</code></td><td>Use a merged profile during the optimized build.</td></tr>
<tr><td><code>-pgo-temporal-instrumentation</code></td><td>LLVM temporal profiling instrumentation for ordering-sensitive profile data.</td></tr>
<tr><td><code>--compression-sort=both</code></td><td>LLD layout mode that balances startup-oriented ordering and compression-oriented ordering.</td></tr>
<tr><td><code>-Oz</code></td><td>Optimize for size. Important on mobile because code size can affect page faults and startup.</td></tr>
<tr><td>PGSO / inlining controls</td><td>Size-aware policy knobs that can mitigate binary growth from PGO-guided inlining.</td></tr>
<tr><td><code>pgo-warn-missing-function=false</code></td><td>Suppress warnings/errors when profiles mention functions not present in the final binary. Useful when profiled and release builds are close but not identical.</td></tr>
</tbody>
</table>

<div class="iviz">
<h4>Command map</h4>
<div class="term-grid">
<button class="active" type="button" onclick="xpgoTerm('cmd','generate')">-fprofile-generate</button>
<button type="button" onclick="xpgoTerm('cmd','merge')">llvm-profdata merge</button>
<button type="button" onclick="xpgoTerm('cmd','use')">-fprofile-use</button>
<button type="button" onclick="xpgoTerm('cmd','temporal')">-pgo-temporal-instrumentation</button>
<button type="button" onclick="xpgoTerm('cmd','sort')">--compression-sort=both</button>
</div>
<div id="xpgo-cmd-card" class="term-card">Build an instrumented binary that emits raw profile data. This is the learning build, not the final release build.</div>
</div>

<h2 id="part12">Part 12 — FAQ</h2>
<details class="faq">
<summary>Is PGO the same as test coverage?</summary>
<p>No. Both may use instrumentation, but the goal differs. Test coverage asks "did tests execute this code?" PGO asks "how should the optimizer spend effort based on execution behavior?" A profile can be useful for PGO even if it is not a complete coverage report.</p>
</details>
<details class="faq">
<summary>Does PGO require production user data?</summary>
<p>No. Production profiles can be more representative, but they are operationally harder. Reddit chose UI tests with stable stubs and many important use cases. That is a practical trade-off: less real-world diversity, more repeatability and lower complexity.</p>
</details>
<details class="faq">
<summary>Can PGO make code slower?</summary>
<p>Yes. A stale or biased profile can over-optimize the wrong paths, increase code size, or damage instruction-cache locality. That is why measurement and rollback matter.</p>
</details>
<details class="faq">
<summary>Why does binary layout affect compressed size?</summary>
<p>Compression algorithms such as LZ variants exploit repeated patterns within a window. If similar machine-code sequences are placed near each other, the compressed artifact can shrink.</p>
</details>
<details class="faq">
<summary>Is the app decompressing its IPA during startup?</summary>
<p>No. The compressed IPA matters for download and installation. Startup page faults come from touching installed binary pages that are not resident in memory yet. These are related optimization goals, but not the same mechanism.</p>
</details>
<details class="faq">
<summary>Why not always use speed optimization with PGO?</summary>
<p>Because mobile startup is sensitive to code size. A speed-oriented profile can encourage more inlining, which can increase the amount of code the app has to page in. For mobile, the best policy often balances speed, size, and layout.</p>
</details>
<details class="faq">
<summary>Why is startup impact strongest after install or update?</summary>
<p>Because the first launches touch cold filesystem and memory state. Over time, OS-level caching and background optimizations can reduce the visible difference, so first-day metrics are often the cleanest window.</p>
</details>

<div class="iviz">
<h4>Quick check</h4>
<div class="seg" role="tablist" aria-label="PGO quiz">
<button class="active" type="button" onclick="xpgoShow('quiz-view','q')">Question</button>
<button type="button" onclick="xpgoShow('quiz-view','a')">Answer</button>
</div>
<div data-xpgo-group="quiz-view" data-xpgo-panel="q" class="panel active">
<p>If the optimized app has a smaller compressed IPA but the same startup page faults, which half of the optimization probably helped?</p>
</div>
<div data-xpgo-group="quiz-view" data-xpgo-panel="a" class="panel">
<p><strong>Compression locality.</strong> Startup locality is measured through page faults and time-to-interactive behavior; compressed IPA size is a distribution/install win.</p>
</div>
</div>

<h2 id="part13">Part 13 — Glossary</h2>
<div class="iviz">
<h4>Pick a term</h4>
<div class="term-grid">
<button class="active" type="button" onclick="xpgoTerm('gloss','pgo')">PGO</button>
<button type="button" onclick="xpgoTerm('gloss','coverage')">Coverage profile</button>
<button type="button" onclick="xpgoTerm('gloss','temporal')">Temporal profile</button>
<button type="button" onclick="xpgoTerm('gloss','reorder')">Function reordering</button>
<button type="button" onclick="xpgoTerm('gloss','fault')">Page fault</button>
</div>
<div id="xpgo-gloss-card" class="term-card">A feedback loop: collect execution behavior from an instrumented run, then use it to optimize a later build.</div>
</div>
<dl class="gloss">
<dt>PGO</dt>
<dd>Profile-Guided Optimization: optimizing a later build using profiles collected from an earlier instrumented run.</dd>
<dt>IRPGO</dt>
<dd>Instrumentation-based PGO at the LLVM IR level. The compiler inserts instrumentation into intermediate representation to collect execution data.</dd>
<dt>Coverage profile</dt>
<dd>A profile describing which functions, branches, and paths ran and how often.</dd>
<dt>Temporal profile</dt>
<dd>A profile describing execution order over time, useful for function layout.</dd>
<dt>Function reordering</dt>
<dd>Changing the order of functions in the final binary so related code is physically close.</dd>
<dt>Page fault</dt>
<dd>An event where the system must bring a memory page into the process because the app touched code or data not currently resident.</dd>
<dt>LLD</dt>
<dd>LLVM's linker. In this context, it consumes temporal profiles and performs function layout optimizations.</dd>
<dt>Profile staleness</dt>
<dd>The loss of profile usefulness as source code and behavior drift away from the workload that produced the profile.</dd>
</dl>

<h2 id="sources">Sources</h2>
<ul>
<li>Reddit Engineering: <a href="https://www.reddit.com/r/RedditEng/comments/1hgbldp/reddits_ios_app_binary_optimization/">Reddit's iOS App Binary Optimization</a>, written by Karim Alweheshy.</li>
<li>YouTube / LLVM talk: <a href="https://youtu.be/yd4pbSTjwuA">temporal profiling and balanced partitioning for mobile PGO</a>.</li>
<li>LLVM Clang Users Manual: <a href="https://clang.llvm.org/docs/UsersManual.html#profile-guided-optimization">Profile Guided Optimization</a>.</li>
<li>LLVM discourse RFC: <a href="https://discourse.llvm.org/t/rfc-temporal-profiling-extension-for-irpgo/68068">Temporal profiling extension for IRPGO</a>.</li>
</ul>

<script>
function xpgoShow(group, panel) {
  document.querySelectorAll('[data-xpgo-group="' + group + '"]').forEach(function (el) {
    el.classList.toggle('active', el.getAttribute('data-xpgo-panel') === panel);
  });
  document.querySelectorAll('[onclick*="' + group + '"]').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('onclick').indexOf("'" + panel + "'") !== -1);
  });
}

function xpgoInline(value) {
  var inline = Number(value);
  var overhead = 100 - inline;
  var pageRisk = Math.min(100, Math.round(inline * 1.2));
  document.getElementById('xpgo-inline-label').textContent = inline + '%';
  document.getElementById('xpgo-overhead').style.setProperty('--w', overhead + '%');
  document.getElementById('xpgo-overhead-label').textContent = overhead + '%';
  document.getElementById('xpgo-codesize').style.setProperty('--w', inline + '%');
  document.getElementById('xpgo-codesize-label').textContent = inline + '%';
  document.getElementById('xpgo-pagerisk').style.setProperty('--w', pageRisk + '%');
  document.getElementById('xpgo-pagerisk-label').textContent = pageRisk + '%';
}

function xpgoStage(group, step) {
  document.querySelectorAll('[data-xpgo-stage-group="' + group + '"] .stage').forEach(function (el) {
    el.classList.toggle('active', Number(el.getAttribute('data-xpgo-stage')) === step);
  });
  document.querySelectorAll("[onclick*=\"xpgoStage('" + group + "'\"]").forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('onclick').indexOf(',' + step + ')') !== -1);
  });
  var captions = {
    loop: {
      1: 'The first build is deliberately instrumented; it is not the final app you ship.',
      2: 'The run must look like real behavior, because the optimizer will believe it.',
      3: 'Raw profile files become a stable .profdata input for the next build.',
      4: 'The final build uses evidence to guide compiler and linker choices.'
    },
    reddit: {
      1: 'The profile starts as UI-test behavior, not as a hand-written order file.',
      2: 'Many raw runs are merged so one path does not dominate the release.',
      3: 'Coverage data guides compiler choices such as inlining and branch layout.',
      4: 'Temporal data guides linker layout so startup functions sit together.'
    }
  };
  var caption = document.getElementById('xpgo-' + group + '-caption');
  if (caption) caption.textContent = captions[group][step];
}

function xpgoTrace(step) {
  var order = [
    ['xpgo-stamp-main', 'main', 1],
    ['xpgo-stamp-app', 'App', 2],
    ['xpgo-stamp-feed', 'Feed', 3],
    ['xpgo-stamp-cell', 'Cell', 4]
  ];
  ['xpgo-stamp-main', 'xpgo-stamp-app', 'xpgo-stamp-feed', 'xpgo-stamp-cell', 'xpgo-stamp-settings'].forEach(function (id) {
    var el = document.getElementById(id);
    var name = el.textContent.split(/\s+/)[0];
    el.innerHTML = name + '<br>0';
    el.classList.remove('on');
  });
  order.slice(0, step).forEach(function (item) {
    var el = document.getElementById(item[0]);
    el.innerHTML = item[1] + '<br>' + item[2];
    el.classList.add('on');
  });
  var captions = [
    'Before execution, every timestamp is zero. Zero means "not observed in this run."',
    'main is first, so it receives timestamp 1.',
    'App startup code follows, so it receives timestamp 2.',
    'The feed path appears next in this workload.',
    'The first visible cell is part of the startup trace; Settings remains zero.'
  ];
  document.getElementById('xpgo-trace-caption').textContent = captions[step];
}

function xpgoTrap(kind) {
  var text = {
    profile: '<strong>Failure mode:</strong> the optimizer improves the test fantasy, not the real app. Fix it by profiling critical flows and feature-flag combinations.',
    stale: '<strong>Failure mode:</strong> old profiles miss new hot code and mention deleted functions. Fix it by regenerating profiles in CI before release.',
    rollout: '<strong>Failure mode:</strong> you cannot tell whether PGO helped because code changed too. Fix it with an identical-code optimized release when measuring impact.'
  };
  document.getElementById('xpgo-trap-card').innerHTML = text[kind];
}

function xpgoTerm(group, key) {
  var cards = {
    cmd: {
      generate: 'Build an instrumented binary that emits raw profile data. This is the learning build, not the final release build.',
      merge: 'Combine multiple .profraw files into one .profdata file so the next build can consume it.',
      use: 'Feed the merged profile into the optimized build so compiler decisions use runtime evidence.',
      temporal: 'Record first-call timing so the linker can reconstruct function order for startup layout.',
      sort: 'Ask the linker to balance startup locality and compression locality when ordering functions.'
    },
    gloss: {
      pgo: 'A feedback loop: collect execution behavior from an instrumented run, then use it to optimize a later build.',
      coverage: 'The "what ran and how often" profile. It mostly guides compiler decisions.',
      temporal: 'The "when did it run" profile. It mostly guides linker layout.',
      reorder: 'Changing physical function order in the final binary so related code sits close together.',
      fault: 'The cost paid when the app touches a code page that is not resident in memory yet.'
    }
  };
  var card = document.getElementById('xpgo-' + group + '-card');
  if (card) card.textContent = cards[group][key];
  var onclickPrefix = "xpgoTerm('" + group + "'";
  document.querySelectorAll('[onclick*="' + onclickPrefix + '"]').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('onclick').indexOf("'" + key + "'") !== -1);
  });
}
</script>
</div>
