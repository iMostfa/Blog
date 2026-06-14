+++
title = "Mean, Median, and Percentiles, From First Principles"
date = 2026-06-14

[taxonomies]
tags = ["statistics", "performance", "build-systems", "metrics", "ai-learnings"]
+++

This write-up was distilled from a real session reading a build dashboard: three numbers —
mean **11.2 min**, P50 **8.35 min**, P90 **19.8 min** — and one question, *do these even make sense?*
The document below builds every concept needed to answer it from the ground up: what a mean and a
median actually measure, why latency is always uneven, what percentiles add, and how to sanity-check
a set of summary numbers in seconds. Prerequisites: you can add and divide. Nothing more is assumed.

<style>
.xstat { --xpos:#1a7f37; --xneg:#b3261e; --xwarn:#9a6700; --xmean:#9a6700; --xp50:#0969da; --xp90:#b3261e; }
[data-theme="dark"] .xstat { --xpos:#7ee787; --xneg:#ff7b72; --xwarn:#e3b341; --xmean:#e3b341; --xp50:#79c0ff; --xp90:#ff7b72; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .xstat { --xpos:#7ee787; --xneg:#ff7b72; --xwarn:#e3b341; --xmean:#e3b341; --xp50:#79c0ff; --xp90:#ff7b72; } }
.xstat .toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.25rem 2rem; list-style:none; padding:0; margin:.5rem 0 0; }
.xstat .toc-grid a { display:block; padding:.15rem 0; }
.xstat .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:.75rem; margin:1rem 0; }
.xstat .card { background:var(--bg-light); border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; }
.xstat .card h4 { margin:.1rem 0 .5rem; font-size:1rem; }
.xstat .card p, .xstat .card li { font-size:.9rem; margin:.5rem 0; }
.xstat .card ul { margin:.25rem 0; padding-left:1.25rem; }
.xstat pre { font-size:.8rem; line-height:1.5; overflow-x:auto; }
.xstat .err { color:var(--xneg); font-weight:700; }
.xstat .ok { color:var(--xpos); }
.xstat .dim { color:var(--text-light); }
.xstat .mono { font-family:var(--mono-font); }
.xstat .stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; margin:1rem 0; }
.xstat .stat-box { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; background:var(--bg-light); border-top:3px solid var(--accent); }
.xstat .stat-box.b-p50 { border-top-color:var(--xp50); }
.xstat .stat-box.b-mean { border-top-color:var(--xmean); }
.xstat .stat-box.b-p90 { border-top-color:var(--xp90); }
.xstat .stat-box .label { font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-light); }
.xstat .stat-box .value { font-size:1.9rem; font-weight:800; line-height:1.1; margin:.2rem 0; }
.xstat .stat-box .value .u { font-size:.9rem; font-weight:500; color:var(--text-light); }
.xstat .stat-box.b-p50 .value { color:var(--xp50); }
.xstat .stat-box.b-mean .value { color:var(--xmean); }
.xstat .stat-box.b-p90 .value { color:var(--xp90); }
.xstat .stat-box .sub { font-size:.82rem; color:var(--text-light); }
.xstat .mode-toggle { display:inline-flex; gap:.25rem; border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.25rem; margin:1rem 0 .75rem; background:var(--bg-light); }
.xstat .mode-toggle button { font-family:var(--mono-font); font-size:.9rem; border:none; border-radius:.25rem; padding:.4rem 1rem; cursor:pointer; background:transparent; color:var(--text-light); }
.xstat .mode-toggle button.active { background:var(--accent); color:var(--accent-text); }
.xstat .diagram { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1.25rem; background:var(--bg-light); }
.xstat .chart-wrap { position:relative; height:340px; margin:.5rem 0 1rem; }
.xstat .dcaption { font-size:.85rem; color:var(--text-light); margin-top:.4rem; line-height:1.6; }
.xstat .callout { border:1px solid var(--accent); border-left:4px solid var(--accent); border-radius:var(--standard-border-radius); padding:1.25rem; margin:1rem 0; background:var(--bg-light); }
.xstat .callout .rule { font-weight:700; font-size:1.05rem; line-height:1.55; margin:.25rem 0; }
.xstat .callout .corollary { color:var(--text-light); font-size:.92rem; margin:.75rem 0 0; }
.xstat .check { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem 1.1rem; margin:.6rem 0; }
.xstat .check.pass { border-left:4px solid var(--xpos); }
.xstat .check.watch { border-left:4px solid var(--xwarn); }
.xstat .check h4 { margin:.1rem 0 .35rem; }
.xstat .check h4 .badge { font-size:.7rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; padding:.05rem .5rem; border-radius:999px; margin-left:.5rem; }
.xstat .check.pass .badge { color:var(--xpos); border:1px solid var(--xpos); }
.xstat .check.watch .badge { color:var(--xwarn); border:1px solid var(--xwarn); }
.xstat .check p { font-size:.92rem; margin:.3rem 0; }
.xstat .pill-formula { display:inline-block; font-family:var(--mono-font); font-size:.82rem; background:var(--bg); border:1px solid var(--border); border-radius:.3rem; padding:.05rem .45rem; }
.xstat .lesson { border-left:3px solid var(--xwarn); padding:.5rem .8rem; margin-top:1rem; font-size:.88rem; background:var(--bg); border-radius:0 .25rem .25rem 0; }
.xstat .lesson strong { color:var(--xwarn); }
.xstat .q { font-size:.75rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin:1rem 0 .25rem; }
.xstat .gloss dt { font-weight:700; color:var(--accent); margin-top:.9rem; }
.xstat .gloss dd { margin:0.15rem 0 0 0; font-size:.9rem; }
.xstat table td, .xstat table th { font-size:.88rem; vertical-align:top; }
.xstat details { margin-bottom:.6rem; }
.xstat details summary { cursor:pointer; font-weight:700; }
.xstat details p { font-size:.92rem; }
/* ===== static HTML/CSS math (no KaTeX, no JS, themes via currentColor) ===== */
.xstat .m { font-family:Georgia,'Times New Roman',serif; font-style:italic; white-space:nowrap; }
.xstat .m sub, .xstat .m sup { font-style:normal; }
.xstat .rm { font-style:normal; font-family:Georgia,'Times New Roman',serif; }
.xstat .eq { margin:1.1rem 0; text-align:center; font-family:Georgia,'Times New Roman',serif; font-size:1.15rem; overflow-x:auto; overflow-y:hidden; }
.xstat .frac { display:inline-block; vertical-align:-0.55em; text-align:center; margin:0 .15em; }
.xstat .frac > .n { display:block; padding:0 .35em; }
.xstat .frac > .d { display:block; padding:0 .35em; border-top:1px solid currentColor; }
.xstat .cases { display:inline-flex; align-items:center; vertical-align:middle; }
.xstat .cases .brace { font-size:2.6em; line-height:.9; font-weight:300; }
.xstat .cases .rows { display:inline-flex; flex-direction:column; gap:.3em; margin-left:.25em; text-align:left; font-size:.92rem; }
.xstat .cases .row { white-space:nowrap; }
.xstat .under { display:inline-flex; flex-direction:column; align-items:center; margin:0 .35em; vertical-align:middle; }
.xstat .under .ulbl { font-style:normal; font-family:var(--mono-font); font-size:.68rem; letter-spacing:.04em; text-transform:uppercase; color:var(--text-light); margin-top:.25em; }
.xstat figure { margin:0; }
.xstat .xsfig svg, .xstat .skewfig svg { width:100%; height:auto; display:block; }
.xstat [hidden] { display:none !important; }
.xstat .svg-cap { font-size:.82rem; color:var(--text-light); text-align:center; margin-top:.4rem; }
@media (max-width:600px) { .xstat .toc-grid { grid-template-columns:1fr; } .xstat .eq { font-size:1rem; } }
</style>

<div class="xstat">
<nav aria-label="Contents">
<h2 id="contents">Contents</h2>
<ol class="toc-grid">
<li><a href="#part1">Two ways to summarize a list</a></li>
<li><a href="#part2">Why latency is uneven</a></li>
<li><a href="#part3">Percentiles: P50, P90, P99</a></li>
<li><a href="#part4">The shape, drawn</a></li>
<li><a href="#part5">Sanity-checking a set of numbers</a></li>
<li><a href="#part6">Which number to use when</a></li>
<li><a href="#part7">Things people get wrong</a></li>
<li><a href="#part8">Glossary</a></li>
</ol>
</nav>

<h2 id="part1">Part 1 — Two ways to summarize a list of numbers</h2>
<p>You have many measurements — build durations, request latencies, page loads — and you want one number that says "this is what's typical". There are two common choices, and they answer subtly different questions.</p>
<div class="cards">
<div class="card">
<h4>Mean (the average)</h4>
<p>The arithmetic mean of <span class="m">n</span> values is</p>
<div class="eq"><span class="m">x&#772; = <span class="frac"><span class="n">1</span><span class="d">n</span></span> Σ<sub>i=1</sub><sup>n</sup> x<sub>i</sub></span></div>
<p>Every point enters the sum, which is its weakness: a single large <span class="m">x<sub>i</sub></span> shifts <span class="m">x&#772;</span> by <span class="m">Δx<sub>i</sub> / n</span>. The mean is the distribution's <strong>center of mass</strong>.</p>
</div>
<div class="card">
<h4>Median (the middle, a.k.a. P50)</h4>
<p>Sort the values <span class="m">x<sub>(1)</sub> ≤ x<sub>(2)</sub> ≤ … ≤ x<sub>(n)</sub></span>; the median is the middle order statistic:</p>
<div class="eq"><span class="m">x&#771; =</span><span class="cases"><span class="brace">{</span><span class="rows"><span class="row"><span class="m">x<sub>((n+1)/2)</sub></span><span class="rm">,&nbsp; n odd</span></span><span class="row"><span class="m">½(x<sub>(n/2)</sub> + x<sub>(n/2+1)</sub>)</span><span class="rm">,&nbsp; n even</span></span></span></span></div>
<p>It depends only on <em>position</em>, not magnitude — so a single huge value barely moves it.</p>
</div>
</div>
<div class="card">
<h4>The example that shows the difference</h4>
<p>Five builds finish in <span class="m">x = (6, 7, 8, 9, 40)</span> minutes (one was a cold-cache straggler):</p>
<div class="eq"><span class="m">x&#772; = <span class="frac"><span class="n">6+7+8+9+40</span><span class="d">5</span></span> = <span class="frac"><span class="n">70</span><span class="d">5</span></span> = <strong style="color:var(--xneg)">14</strong>,&nbsp;&nbsp;&nbsp; x&#771; = x<sub>(3)</sub> = <strong style="color:var(--xpos)">8</strong></span></div>
<p>Four of five builds finished under 10 minutes, yet <span class="m">x&#772; = 14</span> — the lone 40 dragged it up, while <span class="m">x&#771; = 8</span> stayed put. <strong>The mean is sensitive to outliers; the median is robust to them.</strong></p>
</div>
<div class="callout">
<p class="rule" style="text-align:center;font-family:Georgia,serif;"><span class="m">x&#772; &gt; x&#771;</span> &nbsp;⟺&nbsp; <span class="rm">long tail on the high side (right skew)</span></p>
<p class="corollary">The gap measures the pull. Our build numbers give <span class="m">x&#772; − x&#771; = 11.2 − 8.35 = 2.85</span> min, a ratio of <span class="m">x&#772; / x&#771; = 11.2 / 8.35 ≈ 1.34</span> — a slow minority pulling the mean ~34% above the median. The normal signature of timing data (Part 2).</p>
</div>

<h2 id="part2">Part 2 — Why latency is (almost) always uneven</h2>
<p>Build times, request times, any "how long did it take" metric share a structural property: they are <strong>right-skewed</strong> — a tall cluster of fast results with a long tail trailing off to the right.</p>
<div class="cards">
<div class="card">
<h4>There is a floor, but no ceiling</h4>
<p>A build can't take less than zero time, and in practice not less than some minimum (compile the world, link, etc.). But it <em>can</em> take arbitrarily long: a cold cache, a busy machine, a flaky network download, a retry. The fast side is bounded; the slow side is open-ended. That asymmetry <em>is</em> the skew.</p>
</div>
<div class="card">
<h4>Consequence: <span class="m">x&#772; ≥ x&#771;</span>, by default</h4>
<p>The high-side tail pulls the center-of-mass while the middle position holds, so for healthy latency you should <em>expect</em></p>
<div class="eq"><span class="m">x&#772; &ge; x&#771;</span></div>
<p>It is not a defect to fix — it is the shape of the phenomenon.</p>
</div>
</div>
<figure class="skewfig">
<svg viewBox="0 0 640 270" role="img" aria-label="A right-skewed density curve. A red wall on the left marks a hard floor — builds cannot be faster than a minimum. To the right the curve trails off into a long tail labelled 'no ceiling: cold cache, contention, retries make it arbitrarily slow'. The median marker sits near the peak and the mean marker sits to its right, with the gap between them labelled as the skew.">
  <defs>
    <marker id="xsArrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-light)"/></marker>
  </defs>
  <path d="M70,215 C95,215 150,60 185,58 C235,55 270,150 350,180 C440,206 520,212 610,213 L610,215 L70,215 Z" fill="var(--accent)" opacity="0.16"/>
  <path d="M70,215 C95,215 150,60 185,58 C235,55 270,150 350,180 C440,206 520,212 610,213" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
  <line x1="70" y1="215" x2="620" y2="215" stroke="var(--border)" stroke-width="1"/>
  <line x1="70" y1="215" x2="70" y2="40" stroke="var(--xneg)" stroke-width="2.5"/>
  <line x1="58" y1="62" x2="70" y2="74" stroke="var(--xneg)" stroke-width="1.5"/>
  <line x1="58" y1="92" x2="70" y2="104" stroke="var(--xneg)" stroke-width="1.5"/>
  <line x1="58" y1="122" x2="70" y2="134" stroke="var(--xneg)" stroke-width="1.5"/>
  <line x1="58" y1="152" x2="70" y2="164" stroke="var(--xneg)" stroke-width="1.5"/>
  <line x1="58" y1="182" x2="70" y2="194" stroke="var(--xneg)" stroke-width="1.5"/>
  <text x="78" y="52" font-size="12" font-weight="700" fill="var(--xneg)">hard floor</text>
  <text x="78" y="67" font-size="10.5" fill="var(--text-light)">can't be faster</text>
  <text x="78" y="80" font-size="10.5" fill="var(--text-light)">than the minimum</text>
  <text x="185" y="40" font-size="12" font-weight="700" fill="var(--accent)" text-anchor="middle">most builds cluster here</text>
  <text x="500" y="150" font-size="12" fill="var(--text-light)" text-anchor="middle">long tail</text>
  <line x1="360" y1="240" x2="625" y2="240" stroke="var(--text-light)" stroke-width="1.5" marker-end="url(#xsArrow)"/>
  <text x="358" y="256" font-size="11" fill="var(--text-light)">no ceiling: cold cache, contention, retries &#8594; arbitrarily slow</text>
  <line x1="212" y1="215" x2="212" y2="95" stroke="var(--xp50)" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="212" y="88" font-size="11" font-weight="700" fill="var(--xp50)" text-anchor="middle">median</text>
  <line x1="268" y1="215" x2="268" y2="95" stroke="var(--xmean)" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="268" y="88" font-size="11" font-weight="700" fill="var(--xmean)" text-anchor="middle">mean</text>
  <line x1="212" y1="201" x2="268" y2="201" stroke="var(--text-light)" stroke-width="1.2"/>
  <line x1="212" y1="197" x2="212" y2="205" stroke="var(--text-light)" stroke-width="1.2"/>
  <line x1="268" y1="197" x2="268" y2="205" stroke="var(--text-light)" stroke-width="1.2"/>
  <text x="276" y="205" font-size="10.5" fill="var(--text-light)">&#8592; gap = skew</text>
</svg>
</figure>
<p class="svg-cap">A hard floor on the left, an open-ended tail on the right: that asymmetry <em>is</em> the right-skew, and it is what pushes the mean to the right of the median.</p>
<div class="lesson"><strong>Reframe:</strong> the surprising case is <span class="m">x&#772; &lt; x&#771;</span>. For a duration metric that almost never happens naturally — if you see it, suspect the metric is computed wrong, units are mixed, or negative/clamped values leaked in.</div>

<h2 id="part3">Part 3 — Percentiles: P50, P90, P99</h2>
<p>A percentile answers one plain question: <strong>compared to everything else, how far up the list is this?</strong> Sort your builds from fastest to slowest — <span class="m">P<sub>90</sub></span> is the point that 90% of builds come in <em>under</em>. Only the slowest 10% take longer.</p>
<p>Make it concrete. Here are five build times, in the order they finished: <span class="mono">8, 5, 19, 6, 9</span> minutes. Line them up fastest&nbsp;&#8594;&nbsp;slowest:</p>
<div class="eq"><span class="mono">5&nbsp;&nbsp;&nbsp;6&nbsp;&nbsp;&nbsp;<strong style="color:var(--xp50)">8</strong>&nbsp;&nbsp;&nbsp;9&nbsp;&nbsp;&nbsp;<strong style="color:var(--xp90)">19</strong></span></div>
<ul>
<li>The <strong style="color:var(--xp50)">middle</strong> value is <strong>8</strong> — that is the <strong>median</strong>, also called <strong>P50</strong>. Half the builds are faster, half are slower. The "typical" build.</li>
<li>The <strong>average</strong> is (5+6+8+9+19) ÷ 5 = <strong>9.4</strong> — bigger than the median, because the one slow <strong style="color:var(--xp90)">19</strong> drags it up. That gap between 9.4 and 8 is exactly the problem with averages from Part&nbsp;1.</li>
<li><strong>P90</strong> is the same move, but at 90% instead of 50%: walk up the sorted list until you have passed 90% of the builds. With lots of data it is "the line that 9 out of 10 builds beat" — it lives out in the slow tail.</li>
</ul>
<p>Now imagine doing this for hundreds of builds. Walk left&nbsp;&#8594;&nbsp;right through every build time, and each time you pass one build, step up a little. The height at any point is just <em>"what fraction of builds have I passed so far?"</em> — that rising staircase is the picture below. To read any percentile, find its height on the left, slide across to the steps, and drop down to the time.</p>
<figure class="skewfig">
<svg viewBox="0 0 640 290" role="img" aria-label="An empirical cumulative distribution function drawn as a rising staircase. The horizontal axis is build time in minutes; the vertical axis is the fraction of samples at or below that time, climbing from 0 to 1 in ten equal steps of one tenth. A dashed blue line at height 0.50 runs across to the staircase and drops down to P50 equals 8 minutes, the median. A dashed red line at height 0.90 runs across and drops to P90 equals 19 minutes, further out in the tail.">
  <defs>
    <marker id="xsArrow2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--text-light)"/></marker>
  </defs>
  <line x1="70" y1="250" x2="620" y2="250" stroke="var(--text-light)" stroke-width="1.5" marker-end="url(#xsArrow2)"/>
  <line x1="70" y1="250" x2="70" y2="32" stroke="var(--text-light)" stroke-width="1.5" marker-end="url(#xsArrow2)"/>
  <text x="78" y="30" font-size="11" font-weight="700" fill="var(--text-light)">F(x) = fraction of builds &#8804; x</text>
  <text x="64" y="44" font-size="10.5" fill="var(--text-light)" text-anchor="end">1.0</text>
  <text x="64" y="65" font-size="10.5" font-weight="700" fill="var(--xp90)" text-anchor="end">0.9</text>
  <text x="64" y="149" font-size="10.5" font-weight="700" fill="var(--xp50)" text-anchor="end">0.5</text>
  <text x="64" y="253" font-size="10.5" fill="var(--text-light)" text-anchor="end">0</text>
  <text x="616" y="268" font-size="10.5" fill="var(--text-light)" text-anchor="end">build time (min) &#8594;</text>
  <line x1="70" y1="61" x2="437" y2="61" stroke="var(--xp90)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <line x1="437" y1="61" x2="437" y2="250" stroke="var(--xp90)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <line x1="70" y1="145" x2="200" y2="145" stroke="var(--xp50)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <line x1="200" y1="145" x2="200" y2="250" stroke="var(--xp50)" stroke-width="1.6" stroke-dasharray="4 3"/>
  <path d="M70,250 L113,250 L113,229 L135,229 L135,208 L156,208 L156,187 L178,187 L178,166 L200,166 L200,145 L221,145 L221,124 L264,124 L264,103 L329,103 L329,82 L437,82 L437,61 L567,61 L567,40 L610,40" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="113" cy="229" r="3.4" fill="var(--accent)"/>
  <circle cx="135" cy="208" r="3.4" fill="var(--accent)"/>
  <circle cx="156" cy="187" r="3.4" fill="var(--accent)"/>
  <circle cx="178" cy="166" r="3.4" fill="var(--accent)"/>
  <circle cx="200" cy="145" r="4.4" fill="var(--xp50)"/>
  <circle cx="221" cy="124" r="3.4" fill="var(--accent)"/>
  <circle cx="264" cy="103" r="3.4" fill="var(--accent)"/>
  <circle cx="329" cy="82" r="3.4" fill="var(--accent)"/>
  <circle cx="437" cy="61" r="4.4" fill="var(--xp90)"/>
  <circle cx="567" cy="40" r="3.4" fill="var(--accent)"/>
  <text x="200" y="267" font-size="11" font-weight="700" fill="var(--xp50)" text-anchor="middle">P50 = 8</text>
  <text x="200" y="280" font-size="9.5" fill="var(--text-light)" text-anchor="middle">(median)</text>
  <text x="437" y="267" font-size="11" font-weight="700" fill="var(--xp90)" text-anchor="middle">P90 = 19</text>
</svg>
</figure>
<p class="svg-cap">Each build nudges the line up one step. To find <span class="m">P<sub>90</sub></span>: start at 90% on the left, slide across to the staircase, then drop to the time below it. <span class="m">P<sub>50</sub></span> is the median; <span class="m">P<sub>90</sub></span> and <span class="m">P<sub>99</sub></span> sit further out in the slow tail.</p>
<details>
<summary>The same idea, written as a formula</summary>
<p>Let <span class="m">F(x)</span> be the fraction of samples at or below <span class="m">x</span> — exactly the height of the staircase above. Then the <span class="m">k</span>-th percentile is the smallest <span class="m">x</span> whose height has reached <span class="m">k/100</span>:</p>
<div class="eq"><span class="m">P<sub>k</sub> = inf { x : F(x) ≥ <span class="frac"><span class="n">k</span><span class="d">100</span></span> }</span>,&nbsp;&nbsp;&nbsp; <span class="m">x&#771; = P<sub>50</sub></span></div>
<p>"<span class="m">inf</span>" just means "the smallest value that qualifies" — it only matters for the flat parts of the staircase, where many <span class="m">x</span> share the same height.</p>
</details>
<div class="cards">
<div class="card">
<h4>P50 — the typical case</h4>
<p>Half of builds are faster than this. The everyday experience. Same thing as the median.</p>
</div>
<div class="card">
<h4>P90 — the "bad day"</h4>
<p>9 of every 10 builds beat this; the slowest 10% are worse. This is the number that captures "sometimes it just takes forever" without being thrown off by the single worst outlier.</p>
</div>
<div class="card">
<h4>P99 — the worst-case-ish</h4>
<p>Only 1 in 100 is slower. Matters when rare slowness is expensive (CI queues, user-facing requests at scale). Not in our three numbers, but worth requesting.</p>
</div>
</div>
<div class="lesson"><strong>Key property:</strong> percentiles are <em>positions</em> in the sorted data, so — like the median — they are robust to outliers. A single catastrophic build moves P99 a little and P50 not at all. That robustness is exactly why SLOs are written on percentiles, not on the mean.</div>

<h2 id="part4">Part 4 — The shape, drawn</h2>
<p>Here is the distribution of build durations. Toggle between a hypothetical <em>symmetric</em> dataset and the <em>skewed</em> one our real numbers describe, and watch the three markers move relative to each other.</p>
<div class="mode-toggle" role="tablist" aria-label="Distribution toggle">
<button id="xsBtnSkew" class="active" onclick="xstatShow('skew')" role="tab" aria-selected="true">Skewed (our build data)</button>
<button id="xsBtnSym" onclick="xstatShow('sym')" role="tab" aria-selected="false">Symmetric (for contrast)</button>
</div>
<div class="diagram">
<figure id="xsFigSkew" class="xsfig">
<svg viewBox="0 0 640 300" role="img" aria-label="Histogram of build durations, right-skewed: most builds fall between 4 and 12 minutes, with a long tail past 25 minutes. The median marker (P50, 8.35) sits left of the mean marker (11.2), and the P90 marker (19.8) sits far out in the tail.">
<line x1="44" y1="248" x2="612" y2="248" stroke="var(--border)" stroke-width="1"/>
<rect x="47.9" y="228.0" width="35.8" height="20.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="91.6" y="188.0" width="35.8" height="60.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="135.3" y="108.0" width="35.8" height="140.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="179.0" y="28.0" width="35.8" height="220.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="222.7" y="68.0" width="35.8" height="180.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="266.4" y="128.0" width="35.8" height="120.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="310.1" y="168.0" width="35.8" height="80.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="353.8" y="198.0" width="35.8" height="50.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="397.5" y="218.0" width="35.8" height="30.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="441.2" y="208.0" width="35.8" height="40.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="484.9" y="218.0" width="35.8" height="30.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="528.5" y="228.0" width="35.8" height="20.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="572.2" y="238.0" width="35.8" height="10.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<text x="44.0" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">0</text>
<text x="131.4" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">4</text>
<text x="218.8" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">8</text>
<text x="306.2" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">12</text>
<text x="393.5" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">16</text>
<text x="480.9" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">20</text>
<text x="524.6" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">25</text>
<text x="568.3" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">30</text>
<text x="328" y="296" font-size="12" fill="var(--text-light)" text-anchor="middle">build duration (minutes)</text>
<line x1="226.4" y1="28" x2="226.4" y2="248" stroke="var(--xp50)" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="196.4" y="21" width="60" height="15" rx="3" fill="var(--bg-light)"/>
<text x="226.4" y="32" font-size="11" font-weight="700" fill="var(--xp50)" text-anchor="middle">P50 8.35</text>
<line x1="288.7" y1="28" x2="288.7" y2="248" stroke="var(--xmean)" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="258.7" y="51" width="60" height="15" rx="3" fill="var(--bg-light)"/>
<text x="288.7" y="62" font-size="11" font-weight="700" fill="var(--xmean)" text-anchor="middle">Mean 11.2</text>
<line x1="476.6" y1="28" x2="476.6" y2="248" stroke="var(--xp90)" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="446.6" y="81" width="60" height="15" rx="3" fill="var(--bg-light)"/>
<text x="476.6" y="92" font-size="11" font-weight="700" fill="var(--xp90)" text-anchor="middle">P90 19.8</text>
</svg>
</figure>
<figure id="xsFigSym" class="xsfig" hidden>
<svg viewBox="0 0 640 300" role="img" aria-label="Histogram of a symmetric distribution: a bell-shaped cluster with no tail. The median marker (P50, 10.0) and the mean marker (10.0) land on the same line, illustrating that for symmetric data the mean and median coincide.">
<line x1="44" y1="248" x2="612" y2="248" stroke="var(--border)" stroke-width="1"/>
<rect x="47.9" y="238.0" width="35.8" height="10.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="91.6" y="218.0" width="35.8" height="30.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="135.3" y="168.0" width="35.8" height="80.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="179.0" y="88.0" width="35.8" height="160.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="222.7" y="28.0" width="35.8" height="220.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="266.4" y="28.0" width="35.8" height="220.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="310.1" y="88.0" width="35.8" height="160.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="353.8" y="168.0" width="35.8" height="80.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="397.5" y="218.0" width="35.8" height="30.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<rect x="441.2" y="238.0" width="35.8" height="10.0" rx="2" fill="var(--accent)" opacity="0.38"/>
<text x="44.0" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">0</text>
<text x="131.4" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">4</text>
<text x="218.8" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">8</text>
<text x="306.2" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">12</text>
<text x="393.5" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">16</text>
<text x="480.9" y="264" font-size="11" fill="var(--text-light)" text-anchor="middle">20</text>
<text x="328" y="296" font-size="12" fill="var(--text-light)" text-anchor="middle">build duration (minutes)</text>
<line x1="262.5" y1="28" x2="262.5" y2="248" stroke="var(--xp50)" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="232.5" y="21" width="61" height="15" rx="3" fill="var(--bg-light)"/>
<text x="263" y="32" font-size="11" font-weight="700" fill="var(--xp50)" text-anchor="middle">P50 = Mean = 10</text>
<line x1="380.4" y1="28" x2="380.4" y2="248" stroke="var(--xp90)" stroke-width="2" stroke-dasharray="5 4"/>
<rect x="350.4" y="81" width="60" height="15" rx="3" fill="var(--bg-light)"/>
<text x="380.4" y="92" font-size="11" font-weight="700" fill="var(--xp90)" text-anchor="middle">P90 15.4</text>
</svg>
</figure>
<p class="dcaption" id="xstatCaption">Right-skewed: a tall cluster of fast builds and a long tail. The mean (yellow) is dragged right of the median (blue) by that tail; P90 (red) sits far out in it.</p>
</div>
<div class="stat-row">
<div class="stat-box b-p50"><div class="label">P50 · Median</div><div class="value">8.35<span class="u"> min</span></div><div class="sub">The typical build. Half finish faster.</div></div>
<div class="stat-box b-mean"><div class="label">Mean · Average</div><div class="value">11.2<span class="u"> min</span></div><div class="sub">Pulled up by the slow tail.</div></div>
<div class="stat-box b-p90"><div class="label">P90 · Tail</div><div class="value">19.8<span class="u"> min</span></div><div class="sub">9 of 10 beat this; slowest 10% are worse.</div></div>
</div>

<h2 id="part5">Part 5 — Sanity-checking a set of numbers</h2>
<p>Back to the original question: <em>do mean 11.2, P50 8.35, P90 19.8 make sense?</em> Two quick checks settle it.</p>
<div class="check pass">
<h4>Ordering check <span class="badge">passes</span></h4>
<p>For right-skewed latency the only sensible order is <span class="m">P<sub>50</sub> &lt; x&#772; &lt; P<sub>90</sub></span>. Ours:</p>
<div class="eq"><span class="m">8.35 &lt; 11.2 &lt; 19.8</span> &nbsp;<span class="ok" style="font-style:normal">✓</span></div>
<p><span class="m">x&#772;</span> above the median is the expected fingerprint of skew (Part 2). Had <span class="m">x&#772; &lt; 8.35</span>, that would be the red flag worth chasing.</p>
</div>
<div class="check watch">
<h4>Tail check <span class="badge">worth a look</span></h4>
<p>Two dimensionless ratios gauge how uneven the data is:</p>
<div class="eq"><span class="under"><span class="m"><span class="frac"><span class="n">P<sub>90</sub></span><span class="d">P<sub>50</sub></span></span> = <span class="frac"><span class="n">19.8</span><span class="d">8.35</span></span> ≈ 2.37</span><span class="ulbl">spread</span></span>&nbsp;&nbsp;&nbsp;&nbsp;<span class="under"><span class="m"><span class="frac"><span class="n">x&#772;</span><span class="d">P<sub>50</sub></span></span> = <span class="frac"><span class="n">11.2</span><span class="d">8.35</span></span> ≈ 1.34</span><span class="ulbl">skew</span></span></div>
<p>The slowest 10% take well over double a typical build. Both ratios sit in the normal range (most real systems land 2–4×), but the tail is where time is actually lost.</p>
</div>
<div class="callout">
<p class="rule">Verdict: the numbers are internally consistent and realistic. They describe an ordinary, healthy distribution — most builds near 8 minutes, an average nudged to ~11 by a slow minority, a "bad day" near 20.</p>
<p class="corollary">The one thing to act on is that 8 → 20 minute tail, not the headline average.</p>
</div>

<h2 id="part6">Part 6 — Which number to use when</h2>
<table>
<thead><tr><th>Number</th><th>Use it for</th><th>Why</th></tr></thead>
<tbody>
<tr><td><strong>P50</strong></td><td>Headline "how fast are builds" / daily developer experience</td><td>Reflects the common case, immune to rare outliers.</td></tr>
<tr><td><strong>P90 / P95</strong></td><td>SLOs, alerting thresholds, "worst-case" budgeting</td><td>Catches tail regressions before they become "builds randomly hang" complaints.</td></tr>
<tr><td><strong>P99 / max</strong></td><td>Rare-but-expensive slowness at scale</td><td>The true worst case lives past P90; request it when the tail is costly.</td></tr>
<tr><td class="dim"><strong>Mean</strong></td><td class="dim">Almost nothing, on its own</td><td class="dim">One 60-min build moves it without telling you whether the typical case or the tail changed. Useful only paired with the median as a skew signal.</td></tr>
</tbody>
</table>
<div class="lesson"><strong>General rule:</strong> report a percentile for decisions, keep the mean only as a companion to the median. A dashboard showing the mean alone hides whether your typical build or your tail got worse.</div>

<h2 id="part7">Part 7 — Things people get wrong</h2>
<details open>
<summary>"I'll just average the percentiles to combine two services."</summary>
<p>First, what "combine" means here: you have build times measured <em>separately</em> for two things — say a Linux runner pool and a macOS pool, or the <span class="mono">app</span> and <span class="mono">core</span> targets in a monorepo — and you want one P90 across both. The tempting shortcut is to average the two P90s your dashboard already shows. It doesn't work, because a percentile is a <em>position</em> in the sorted data, not a quantity you can add or average.</p>
<p>Counterexample: pool A is ten builds all at <strong>2&nbsp;min</strong> (so <span class="m">P<sub>90</sub></span> = 2), pool B is ten builds at <strong>10&nbsp;min</strong> (<span class="m">P<sub>90</sub></span> = 10). Averaging the two gives 6&nbsp;min — but dump all 20 builds into one pile and the real combined <span class="m">P<sub>90</sub></span> is <strong style="color:var(--xp90)">10&nbsp;min</strong>. Build volume tips it further: if <span class="mono">core</span> builds 2,000&times;/day and <span class="mono">app</span> builds 10&times;/day, the combined P90 is essentially <span class="mono">core</span>'s — one pool dominates the pile, so averaging the two numbers as equals is meaningless.</p>
<div class="eq"><span class="m">P<sub>90</sub>(A ∪ B) ≠ ½(P<sub>90</sub>(A) + P<sub>90</sub>(B))</span></div>
<p>You also can't recover the mean <span class="m">x&#772;</span> from <span class="m">P<sub>50</sub></span> and <span class="m">P<sub>90</sub></span>: those say nothing about the top 10%, where the mean's weight sits. Two pools with the <em>same</em> P50 and P90 can have wildly different averages — one's slowest builds might top out at 25&nbsp;min, another's drag out to hours.</p>
<p>Each percentile is its own independent cut of the data. To combine pools or projects, go back to the <strong>raw build durations</strong> (pool them and recompute), or keep a mergeable summary per pool like a <strong>histogram</strong> or <strong>t-digest</strong> and merge those <em>before</em> reading the percentile — never do arithmetic on the finished P90 numbers.</p>
</details>
<details>
<summary>"Mean and median are basically the same thing."</summary>
<p>Only for symmetric data (toggle the chart in Part 4 to see them coincide). For anything with a tail — which is all latency — they diverge, and the gap is information: it tells you how skewed the data is.</p>
</details>
<details>
<summary>"A 2.37× P90/P50 ratio looks bad."</summary>
<p>It's typical, not bad. Build and request systems commonly sit between 2× and 4×. A ratio drifting toward 5×+ signals an unstable tail worth investigating; a ratio near 1× would mean unusually consistent timing. 2.37× is normal variability with clear room to tighten.</p>
</details>
<details>
<summary>"These three numbers are enough."</summary>
<p>Three things are missing: the <strong>sample count and time window</strong> (11.2 min over 50 builds is far less trustworthy than over 50,000), the <strong>P99 / max</strong> (the real worst case lives past P90), and a <strong>trend over time</strong> (a single snapshot can't say whether builds are getting faster or slower).</p>
</details>

<h2 id="part8">Glossary</h2>
<dl class="gloss">
<dt>mean (average)</dt><dd><span class="m">x&#772; = (1/n) Σ<sub>i</sub> x<sub>i</sub></span>. Uses every point; sensitive to outliers. The distribution's center of mass.</dd>
<dt>median (P50)</dt><dd><span class="m">x&#771; = P<sub>50</sub></span>, the middle order statistic of the sorted data — half below, half above. Robust to outliers.</dd>
<dt>percentile (P<em>k</em>)</dt><dd><span class="m">P<sub>k</sub> = inf{ x : F(x) ≥ k/100 }</span>, the value below which <span class="m">k</span>% of measurements fall. <span class="m">P<sub>50</sub></span> is the median.</dd>
<dt>right-skew</dt><dd>A distribution with a long high-side tail and a low-side bound. Produces <span class="m">x&#772; &gt; x&#771;</span>. The natural shape of latency data.</dd>
<dt>tail</dt><dd>The slow minority of measurements (e.g. the slowest 10%, captured by <span class="m">P<sub>90</sub></span>). Where most "it's sometimes slow" pain lives.</dd>
<dt>SLO</dt><dd>Service Level Objective — a target almost always written on a percentile (e.g. <span class="m">P<sub>95</sub> &lt; 15</span> min) because percentiles are robust to single outliers.</dd>
<dt>spread / skew ratio</dt><dd><span class="m">P<sub>90</sub>/P<sub>50</sub></span> measures tail spread; <span class="m">x&#772;/P<sub>50</sub></span> measures skew. Quick gauges of how uneven a distribution is.</dd>
</dl>

<h2 id="summary">Summary</h2>
<div class="callout">
<p class="rule">The mean is a balance point and moves with every outlier; the median and other percentiles are positions and ignore magnitude. Latency data has a floor but no ceiling, so it is right-skewed, so its mean sits above its median by default. To sanity-check a set of summary numbers, confirm the ordering (P50 &lt; Mean &lt; P90 for skewed data) and read the gaps as skew. Make decisions on percentiles; keep the mean only as a companion that reveals skew.</p>
<p class="corollary">Build numbers verified consistent: P50 8.35 · Mean 11.2 · P90 19.8 min · June 2026</p>
</div>
</div>

<script>
// Pure DOM toggle between the two static SVG figures — no canvas, no resize observers.
var XSTAT_CAP = {
  skew: 'Right-skewed: a tall cluster of fast builds and a long tail. The mean (yellow) is dragged right of the median (blue) by that tail; P90 (red) sits far out in it.',
  sym: 'Symmetric (hypothetical): with no tail, the mean and median coincide — they land on the same line. This is the only case where "average" and "typical" mean the same thing. Real latency rarely looks like this.'
};
function xstatShow(mode) {
  var skew = mode === 'skew';
  var fSkew = document.getElementById('xsFigSkew'), fSym = document.getElementById('xsFigSym');
  var bSkew = document.getElementById('xsBtnSkew'), bSym = document.getElementById('xsBtnSym');
  if (fSkew) fSkew.hidden = !skew;
  if (fSym) fSym.hidden = skew;
  if (bSkew) { bSkew.classList.toggle('active', skew); bSkew.setAttribute('aria-selected', String(skew)); }
  if (bSym) { bSym.classList.toggle('active', !skew); bSym.setAttribute('aria-selected', String(!skew)); }
  var cap = document.getElementById('xstatCaption');
  if (cap) cap.textContent = XSTAT_CAP[mode];
}
</script>
</div>
