+++
title = "iOS Code Signing, From First Principles"
date = 2026-06-27

[taxonomies]
tags = ["ios", "code-signing", "provisioning-profiles", "fastlane", "ci", "ai-learnings"]

[extra]
card = "card.png"
+++

This write-up was distilled from a real session: wiring a CI pipeline to ship a **ShowCase**
app (a design-system demo app) to **TestFlight**, debugged end-to-end with an AI agent. The release
build failed with `no provisioning profile was found named 'match AppStore com.example.designkit.ShowCase'`.
A profile was downloaded to "fix" it — and turned out to be the *wrong type*. Untangling that one error
required understanding the entire chain: certificates, App IDs, devices, profiles, the four distribution
channels, fastlane match, and where a profile has to physically sit for a build to find it. This document
builds every concept from scratch and ends with a reference you can reuse. Prerequisites: you've built an
iOS app once and know what an `.ipa` roughly is. Nothing more.

<style>
.csign { --pos:#1a7f37; --neg:#b3261e; --warn:#9a6700; }
[data-theme="dark"] .csign { --pos:#7ee787; --neg:#ff7b72; --warn:#e3b341; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .csign { --pos:#7ee787; --neg:#ff7b72; --warn:#e3b341; } }
.csign .toc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.25rem 2rem; list-style:none; padding:0; margin:.5rem 0 0; }
.csign .toc-grid a { display:block; padding:.15rem 0; }
.csign .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:.75rem; margin:1rem 0; }
.csign .card { background:var(--bg-light); border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1rem; }
.csign .card h4 { margin:.1rem 0 .5rem; font-size:1rem; }
.csign .card p, .csign .card li { font-size:.9rem; margin:.5rem 0; }
.csign .card ul { margin:.25rem 0; padding-left:1.2rem; }
.csign pre { font-size:.8rem; line-height:1.5; overflow-x:auto; }
.csign .err { color:var(--neg); font-weight:700; }
.csign .ok { color:var(--pos); font-weight:700; }
.csign .dim { color:var(--text-light); }
.csign .diagram { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:1.25rem; background:var(--bg-light); margin:1rem 0; }
.csign .dgrid { display:flex; flex-wrap:wrap; gap:.6rem; }
.csign .dbox { border:1px solid var(--border); border-radius:var(--standard-border-radius); padding:.7rem .8rem; background:var(--bg); font-size:.8rem; line-height:1.5; flex:1; min-width:200px; }
.csign .dbox .dtitle { font-weight:700; font-size:.85rem; margin-bottom:.4rem; }
.csign .dbox.big { flex-basis:100%; }
.csign .arrow-down { text-align:center; color:var(--text-light); width:100%; margin:.2rem 0; }
.csign .dcaption { font-size:.85rem; color:var(--text-light); margin-top:.8rem; line-height:1.6; }
.csign .callout { border:1px solid var(--accent); border-left:4px solid var(--accent); border-radius:var(--standard-border-radius); padding:1.1rem 1.25rem; margin:1rem 0; background:var(--bg-light); }
.csign .callout .rule { font-weight:700; font-size:1.02rem; line-height:1.5; margin:.2rem 0; }
.csign .callout .corollary { color:var(--text-light); font-size:.9rem; margin:.6rem 0 0; }
.csign table td, .csign table th { font-size:.86rem; vertical-align:top; }
.csign .pill { display:inline-block; border-radius:999px; padding:0 .55rem; font-size:.7rem; font-weight:700; }
.csign .pill.red { color:var(--neg); border:1px solid var(--neg); }
.csign .pill.green { color:var(--pos); border:1px solid var(--pos); }
.csign .pill.blue { color:var(--link); border:1px solid var(--link); }
.csign .gloss dt { font-weight:700; color:var(--accent); margin-top:.9rem; }
.csign .gloss dd { margin:.15rem 0 0; font-size:.9rem; }
.csign details.faq { border:1px solid var(--border); border-radius:var(--standard-border-radius); margin-bottom:.5rem; padding:.2rem .6rem; }
.csign details.faq summary { cursor:pointer; font-weight:700; padding:.4rem 0; }
.csign details.faq p { font-size:.92rem; margin:.4rem 0; }
@media (max-width:600px) { .csign .toc-grid { grid-template-columns:1fr; } }
</style>

<div class="csign">
<nav aria-label="Contents">
<h2 id="contents">Contents</h2>
<ol class="toc-grid">
<li><a href="#part1">The cast of five</a></li>
<li><a href="#part2">Certificates: who you are</a></li>
<li><a href="#part3">App IDs &amp; entitlements: what the app is</a></li>
<li><a href="#part4">The provisioning profile: the knot</a></li>
<li><a href="#part5">Four profile types, two flags</a></li>
<li><a href="#part6">Channels: how a build reaches a human</a></li>
<li><a href="#part7">fastlane match: signing for teams</a></li>
<li><a href="#part8">Where the profile must physically be</a></li>
<li><a href="#part9">Case study: the ShowCase failure</a></li>
<li><a href="#part10">Diagnostic reference</a></li>
<li><a href="#part11">FAQ</a></li>
<li><a href="#part12">Glossary</a></li>
</ol>
</nav>

<h2 id="part1">Part 1 — The cast of five</h2>
<p>Apple code signing answers one question at install/launch time: <em>"Is this exact app allowed to run on this device, and who vouches for it?"</em> Everything else is bookkeeping that supports that check. There are exactly five primitives. Learn what each one <strong>binds</strong> and the rest follows.</p>

<div class="cards">
<div class="card">
<h4>1. Team / Account</h4>
<p>Your Apple Developer Program membership, identified by a <strong>Team ID</strong> (e.g. <code>ABCDE12345</code>). Everything below is scoped to one team. Two apps in the same team share certificates; two apps in different accounts share nothing.</p>
</div>
<div class="card">
<h4>2. Certificate</h4>
<p>Proves <em>who built the app</em>. A public/private key pair where Apple signs your public key. <span class="dim">Team-scoped, not app-scoped.</span></p>
</div>
<div class="card">
<h4>3. App ID</h4>
<p>The app's identity — its <strong>bundle id</strong> (<code>com.example.designkit.ShowCase</code>) plus the capabilities it's allowed to use.</p>
</div>
<div class="card">
<h4>4. Device</h4>
<p>A specific iPhone/iPad registered by <strong>UDID</strong>. Only matters for two of the four profile types. Capped at 100 per device class per year.</p>
</div>
<div class="card">
<h4>5. Provisioning profile</h4>
<p>The document that <strong>ties the other four together</strong> and is signed by Apple. This is the piece everyone finds confusing, because it's the knot — so we build up to it.</p>
</div>
</div>

<div class="callout">
<p class="rule">The mental model: a certificate says <em>who</em>, an App ID says <em>what</em>, devices say <em>where</em>, and a provisioning profile is Apple's signed statement that this <em>who + what + where</em> combination is permitted.</p>
</div>

<h2 id="part2">Part 2 — Certificates: who you are</h2>
<p>A signing certificate is a <strong>public/private key pair</strong>. You generate the pair locally; the private key never leaves your Keychain. You send a Certificate Signing Request (the public half) to Apple, and Apple hands back a certificate — essentially your public key with Apple's signature on it, saying "this key belongs to this team."</p>

<p>When you <em>sign</em> an app, <code>codesign</code> uses the <strong>private key</strong> to produce a signature over the app bundle. When iOS verifies the app, it checks that signature against the <strong>certificate</strong> embedded (by reference) in the provisioning profile. No private key → you cannot sign. No matching certificate in the profile → the device rejects the signature.</p>

<p>Two kinds matter:</p>
<table>
<thead><tr><th>Certificate</th><th>Purpose</th><th>Scope</th></tr></thead>
<tbody>
<tr><td><strong>Apple Development</strong></td><td>Sign debug builds you run from Xcode on your own registered devices.</td><td>Per-developer (each dev usually has their own).</td></tr>
<tr><td><strong>Apple Distribution</strong></td><td>Sign everything you ship: Ad-Hoc, TestFlight, App Store.</td><td><strong>One per team, shared.</strong> The same distribution cert signs every app in the team.</td></tr>
</tbody>
</table>

<div class="callout">
<p class="rule">Certificates are team-scoped, never app-scoped.</p>
<p class="corollary">This is why, in our session, the existing Apple Distribution certificate could sign a brand-new app (<code>com.example.designkit.ShowCase</code>) without anything new — as long as the app lived in the same team. A new bundle id does <em>not</em> require a new certificate. (It <em>does</em> require a new profile — see Part 4.)</p>
</div>

<p>Practical gotcha: Apple limits the number of distribution certificates per account (historically ~2–3). If every engineer and every CI machine generated their own, you'd exhaust the limit and break each other's signing. That problem is exactly what <a href="#part7">fastlane match</a> exists to solve.</p>

<h2 id="part3">Part 3 — App IDs &amp; entitlements: what the app is</h2>
<p>An <strong>App ID</strong> registers a bundle id with Apple and records which <strong>capabilities</strong> it may use (Push Notifications, Associated Domains, Keychain Sharing, App Groups, …). Two forms:</p>
<ul>
<li><strong>Explicit</strong>: <code>com.example.designkit.ShowCase</code> — matches exactly one app. Required for capabilities like Push.</li>
<li><strong>Wildcard</strong>: <code>com.example.*</code> — matches a family of apps, but can't carry most capabilities.</li>
</ul>
<p><strong>Entitlements</strong> are the runtime permissions your app actually requests (in an <code>.entitlements</code> file). The rule the OS enforces: the entitlements baked into your signed app must be a <em>subset</em> of what the App ID enables and what the provisioning profile grants. Ask for an entitlement the profile doesn't carry → install fails. This is a common source of "it ran in debug but the release build won't install."</p>

<h2 id="part4">Part 4 — The provisioning profile: the knot</h2>
<p>A provisioning profile is a single file (<code>.mobileprovision</code>) that is a <strong>CMS-signed property list</strong>. "Signed" means Apple has cryptographically endorsed its contents — you can't edit it. Inside, it bundles:</p>

<div class="diagram">
<div class="dgrid">
<div class="dbox big"><div class="dtitle">embedded.mobileprovision — what's inside</div>
One or more <strong>certificates</strong> (the allowed signers) · exactly one <strong>App ID</strong> (bundle id + entitlements) · a <strong>device list</strong> (for some types) · the <strong>Team ID</strong> · an <strong>expiry date</strong> · a <strong>UUID</strong> and a human <strong>Name</strong>.</div>
</div>
<div class="arrow-down">↓ at build time</div>
<div class="dgrid">
<div class="dbox">codesign signs the <code>.app</code> with your <strong>private key</strong>, and copies the profile into the bundle as <code>embedded.mobileprovision</code>.</div>
</div>
<div class="arrow-down">↓ at install / launch</div>
<div class="dgrid">
<div class="dbox">iOS checks: signature matches a cert in the profile? bundle id matches the App ID? device in the list (or channel allows all)? entitlements ⊆ profile? profile not expired? <strong>All must pass.</strong></div>
</div>
<p class="dcaption">The profile is the contract the device evaluates. It is the only one of the five primitives that travels <em>inside</em> the shipped app.</p>
</div>

<p>Two consequences that trip everyone up:</p>
<ul>
<li><strong>Profiles are bundle-id-scoped.</strong> A profile for <code>com.example.OtherApp</code> can never sign <code>com.example.designkit.ShowCase</code>, even in the same team with the same certificate. A new app always needs a new profile.</li>
<li><strong>Profiles expire</strong> (typically one year). The cert can be valid while the profile is stale, or vice-versa. "It built last quarter" is not evidence it builds today.</li>
</ul>

<h2 id="part5">Part 5 — Four profile types, two flags</h2>
<p>There are four profile types, and you can tell them apart by just <strong>two fields</strong> inside the decoded plist: <code>get-task-allow</code> (is the app debuggable?) and <code>ProvisionedDevices</code> (is there a UDID allowlist?).</p>

<table>
<thead><tr><th>Type</th><th><code>get-task-allow</code></th><th><code>ProvisionedDevices</code></th><th>Signed with</th><th>Used for</th></tr></thead>
<tbody>
<tr><td><strong>Development</strong></td><td class="ok">true</td><td>yes (your devices)</td><td>Apple Development</td><td>Xcode run/debug</td></tr>
<tr><td><strong>Ad-Hoc</strong></td><td>false</td><td><strong>yes</strong> (allowlist)</td><td>Apple Distribution</td><td>OTA install to listed devices</td></tr>
<tr><td><strong>App Store</strong></td><td>false</td><td><strong>none</strong></td><td>Apple Distribution</td><td>TestFlight &amp; App Store</td></tr>
<tr><td><strong>Enterprise</strong></td><td>false</td><td>none, but <code>ProvisionsAllDevices=true</code></td><td>In-House Distribution</td><td>Internal distribution (Apple Enterprise Program only)</td></tr>
</tbody>
</table>

<p>The single most useful distinction in practice:</p>
<div class="callout">
<p class="rule">Ad-Hoc and App Store profiles are <em>both</em> signed with the same distribution certificate and <em>both</em> have <code>get-task-allow=false</code>. They differ in one thing: <strong>Ad-Hoc has a device allowlist, App Store does not.</strong></p>
<p class="corollary">That one difference decides everything downstream. A device list means "only these phones." No device list means "this goes through Apple's store infrastructure (TestFlight/App Store), which controls distribution instead." You cannot mix them: an Ad-Hoc profile cannot be uploaded to TestFlight, and an App Store profile cannot sideload onto a random device.</p>
</div>

<h2 id="part6">Part 6 — Channels: how a build reaches a human</h2>
<p>"How do I get the app onto someone's phone?" has four answers, and each is locked to a profile type. Choosing the channel <em>is</em> choosing the profile.</p>

<div class="cards">
<div class="card">
<h4><span class="pill blue">Development</span></h4>
<p>Xcode → your own registered device, with the debugger attached. Devices must be in the profile. For engineers, not testers.</p>
</div>
<div class="card">
<h4><span class="pill red">Ad-Hoc</span></h4>
<p>Build an <code>.ipa</code>, host it on an OTA install page (Bitrise public install page, Firebase App Distribution, Diawi…). <strong>Every tester's UDID must be registered</strong> and the profile regenerated. Hard cap ~100 devices/year/class.</p>
</div>
<div class="card">
<h4><span class="pill green">TestFlight</span></h4>
<p>Upload an App-Store-signed build to App Store Connect. Testers join by <strong>email / group — no UDID</strong>. Up to 100 internal + 10,000 external testers (external needs a light review).</p>
</div>
<div class="card">
<h4><span class="pill green">App Store</span></h4>
<p>Same App Store profile, but submitted for full App Review and released publicly.</p>
</div>
</div>

<div class="callout">
<p class="rule">If the destination is TestFlight, the profile must be App Store. Full stop.</p>
<p class="corollary">This is the crux of the whole session. The goal was "designers install the ShowCase app via TestFlight." TestFlight only accepts App-Store-signed builds, so Ad-Hoc was never an option — even though Ad-Hoc <em>feels</em> simpler. The payoff for App Store signing is huge for this use case: <strong>zero UDID management</strong>. Designers come and go; nobody wants to register and re-register phones.</p>
</div>

<h2 id="part7">Part 7 — fastlane match: signing for teams</h2>
<p>Everything above works for one developer on one Mac. It falls apart for a team + CI, for two reasons: (1) Apple limits distribution certificates, so you can't let everyone generate their own; (2) certificates depend on a <em>private key</em> that lives in one Keychain — a CI machine that didn't generate the key can't sign at all.</p>

<p><a href="https://docs.fastlane.tools/actions/match/">fastlane <strong>match</strong></a> solves this with one idea: <strong>store the shared distribution certificate (including its private key) and all the provisioning profiles in a private, encrypted git repository.</strong> Every machine — laptops and CI — runs <code>match</code> to <em>download and install</em> the same identity instead of creating new ones.</p>

<div class="diagram">
<div class="dgrid">
<div class="dbox">Private repo <code>ios-match</code><br><span class="dim">encrypted .p12 (cert+key) + .mobileprovision files</span></div>
<div class="dbox">→ <code>fastlane match</code> on any machine →</div>
<div class="dbox">Keychain gets the cert+key<br>profiles land in <code>~/Library/MobileDevice/Provisioning&nbsp;Profiles/</code></div>
</div>
<p class="dcaption">One source of truth, encrypted with a passphrase. New CI box? Run match, you're signing in seconds.</p>
</div>

<p>match also imposes a <strong>naming convention</strong> on the profiles it creates: <code>match {Type} {bundleid}</code> — e.g. <code>match AppStore com.example.designkit.ShowCase</code>. That exact string becomes the profile's <em>Name</em>, which matters in the next part. A subtle trap we hit: the <code>app_identifier</code> list in the <code>Matchfile</code> is only a <em>default</em>; if your Fastfile lanes call <code>match(app_identifier: [...])</code> with an explicit list, that list wins and the Matchfile is ignored. Adding a new bundle id means editing the lane, not just the Matchfile.</p>

<h2 id="part8">Part 8 — Where the profile must physically be</h2>
<p>Creating a profile in the portal (or in the match repo) is not enough. The signing tool has to <em>find</em> it on the machine doing the build. There is one canonical location:</p>
<pre>~/Library/MobileDevice/Provisioning Profiles/*.mobileprovision</pre>

<p>How it gets there, and how a build refers to it, depends on the toolchain:</p>
<table>
<thead><tr><th>Toolchain</th><th>How it finds the profile</th></tr></thead>
<tbody>
<tr><td>Xcode (automatic)</td><td>Manages and installs profiles for you, matching by bundle id + capabilities.</td></tr>
<tr><td>fastlane match</td><td>Downloads from the encrypted repo into the folder above.</td></tr>
<tr><td>Bitrise CI</td><td>The <code>certificate-and-profile-installer</code> step installs whatever profiles/certs are uploaded to the Bitrise app's "Code Signing &amp; Files" store into that folder.</td></tr>
<tr><td>Bazel (rules_apple <code>local_provisioning_profile</code>)</td><td>Searches the folder above <strong>by the profile's Name field</strong> — not by bundle id, not by file path.</td></tr>
</tbody>
</table>

<div class="callout">
<p class="rule">Bazel resolves the profile by <em>name</em>, so the name in your BUILD config must equal the <em>Name</em> field inside the actual installed profile.</p>
<p class="corollary">Our build config asked for <code>match AppStore com.example.designkit.ShowCase</code> (the match convention). A hand-made portal profile named <code>showcase-adhoc-testflight</code> would not be found even if it were the right type — the names don't match. Either name the portal profile to match, or point the build config at the real name.</p>
</div>

<h2 id="part9">Part 9 — Case study: the ShowCase failure</h2>
<p>Now the whole session reads cleanly. The pipeline ran a release (App Store) build of <code>//ShowCase:ShowCaseApp</code> and died:</p>
<pre><span class="err">error: no provisioning profile was found named 'match AppStore com.example.designkit.ShowCase'</span></pre>
<p>Correct and expected: the certificate (team-scoped) was reusable, but the <em>profile</em> (bundle-id-scoped) for this brand-new app didn't exist anywhere yet — not in the portal, not in the match repo, not installed on the runner.</p>

<p>A profile was then downloaded to unblock it. The right move before trusting any <code>.mobileprovision</code> is to <strong>decode and inspect it</strong>:</p>
<pre>security cms -D -i showcase-testflight.mobileprovision &gt; /tmp/p.plist
plutil -extract Name        raw -o - /tmp/p.plist   <span class="dim"># showcase-adhoc-testflight</span>
plutil -extract TeamIdentifier.0 raw -o - /tmp/p.plist <span class="dim"># ABCDE12345  ✅</span>
plutil -extract Entitlements.get-task-allow raw -o - /tmp/p.plist <span class="dim"># false</span>
plutil -extract ProvisionedDevices raw -o - /tmp/p.plist <span class="dim"># 69  ← devices!</span></pre>

<p>Team ✅, bundle id ✅ — but <code>get-task-allow=false</code> <strong>and</strong> a 69-device <code>ProvisionedDevices</code> list. Cross-reference the table in Part 5: that is an <strong>Ad-Hoc</strong> profile, despite the word "testflight" in its filename. App Store Connect would reject it. The fix wasn't to install it — it was to go back to the portal and create the <em>App Store</em> distribution type (Distribution → App Store Connect, no device selection) for the same App ID.</p>

<div class="callout">
<p class="rule">A profile's filename is a human label and lies freely. Its <em>type</em> lives in two fields you must decode to see.</p>
</div>

<h2 id="part10">Part 10 — Diagnostic reference</h2>
<p>Keep these. They turn "signing is magic" into "signing is a plist I can read."</p>

<p><strong>Decode any profile to readable XML:</strong></p>
<pre>security cms -D -i Some.mobileprovision        <span class="dim"># prints the plist</span></pre>

<p><strong>Identify a profile's type</strong> (run after piping the decode to a file, e.g. <code>/tmp/p.plist</code>):</p>
<pre>plutil -extract Name              raw -o - /tmp/p.plist
plutil -extract AppIDName         raw -o - /tmp/p.plist
plutil -extract TeamIdentifier.0  raw -o - /tmp/p.plist
plutil -extract Entitlements.application-identifier raw -o - /tmp/p.plist
plutil -extract Entitlements.get-task-allow         raw -o - /tmp/p.plist
plutil -extract ExpirationDate    raw -o - /tmp/p.plist
plutil -extract ProvisionedDevices raw -o - /tmp/p.plist  <span class="dim"># errors/absent ⇒ App Store; a number ⇒ Ad-Hoc/Dev</span>
plutil -extract ProvisionsAllDevices raw -o - /tmp/p.plist <span class="dim"># true ⇒ Enterprise</span></pre>

<p><strong>List what's installed on this machine:</strong></p>
<pre>ls -1 ~/Library/MobileDevice/Provisioning\ Profiles/
<span class="dim"># then decode each to read its Name</span></pre>

<p><strong>Inspect signing certificates in your Keychain:</strong></p>
<pre>security find-identity -v -p codesigning   <span class="dim"># lists usable signing identities</span></pre>

<p><strong>See how an already-built app was signed:</strong></p>
<pre>codesign -dvvv --entitlements :- /path/to/Your.app</pre>

<h2 id="part11">FAQ</h2>
<details class="faq"><summary>I added a new app to the same team. Do I need a new certificate?</summary>
<p><strong>No.</strong> Certificates are team-scoped. The existing Apple Distribution certificate signs any app in the team. You <em>do</em> need a new App ID and a new provisioning profile, because both are bundle-id-scoped.</p></details>

<details class="faq"><summary>Why can't I just use my Ad-Hoc profile for TestFlight? It's distribution-signed.</summary>
<p>TestFlight distribution is handled by Apple's store infrastructure, which requires an App Store profile (no device list). An Ad-Hoc profile carries a UDID allowlist and is meant for direct OTA installs; App Store Connect rejects it on upload.</p></details>

<details class="faq"><summary>The build says it can't find a profile, but I can see it in the Apple portal.</summary>
<p>Existing in the portal ≠ installed on the build machine. It must be downloaded into <code>~/Library/MobileDevice/Provisioning Profiles/</code> (via Xcode, fastlane match, or a CI installer step). And if you build with Bazel, the profile's <em>Name</em> must match what your BUILD config asks for.</p></details>

<details class="faq"><summary>Development vs Ad-Hoc — both have my devices. What's the difference?</summary>
<p><code>get-task-allow</code>. Development profiles set it <code>true</code> (the app is debuggable and signed with a <em>development</em> cert); Ad-Hoc sets it <code>false</code> (release behaviour, signed with the <em>distribution</em> cert). Same device list, different runtime posture and certificate.</p></details>

<details class="faq"><summary>How long do these last?</summary>
<p>Provisioning profiles typically expire after one year; certificates similarly. They expire independently, so always check <code>ExpirationDate</code> rather than assuming "it worked before."</p></details>

<h2 id="part12">Glossary</h2>
<dl class="gloss">
<dt>Team ID</dt><dd>Identifier for your Apple Developer account (e.g. <code>ABCDE12345</code>). The scope for certificates.</dd>
<dt>Certificate</dt><dd>A public/private key pair endorsed by Apple, proving who signed an app. Development (per-dev) or Distribution (team-shared).</dd>
<dt>Private key</dt><dd>The secret half of a certificate, kept in the Keychain. Without it you cannot sign — which is why CI needs it shared (see match).</dd>
<dt>App ID</dt><dd>A registered bundle id plus its allowed capabilities. Explicit or wildcard.</dd>
<dt>Bundle id</dt><dd>The app's unique reverse-DNS identifier, e.g. <code>com.example.designkit.ShowCase</code>.</dd>
<dt>Entitlements</dt><dd>Runtime permissions the app requests; must be a subset of what the App ID and profile grant.</dd>
<dt>UDID</dt><dd>Unique identifier of a physical device. Listed in Development and Ad-Hoc profiles.</dd>
<dt>Provisioning profile</dt><dd>Apple-signed file binding certificate(s) + App ID + (maybe) devices + entitlements + team. Embedded in the shipped app as <code>embedded.mobileprovision</code>.</dd>
<dt>get-task-allow</dt><dd>Entitlement flag; <code>true</code> = debuggable (Development), <code>false</code> = release (Ad-Hoc / App Store).</dd>
<dt>ProvisionedDevices</dt><dd>The UDID allowlist inside a profile. Present ⇒ Development or Ad-Hoc. Absent ⇒ App Store.</dd>
<dt>Ad-Hoc</dt><dd>Distribution profile with a device allowlist; for direct OTA installs, not TestFlight.</dd>
<dt>App Store profile</dt><dd>Distribution profile with no device list; required for TestFlight and the App Store.</dd>
<dt>TestFlight</dt><dd>Apple's beta distribution service. Accepts App-Store-signed builds; testers join by email, no UDID.</dd>
<dt>fastlane match</dt><dd>Stores the shared certificate and profiles in an encrypted git repo so all machines install the same signing identity. Names profiles <code>match {Type} {bundleid}</code>.</dd>
<dt>codesign</dt><dd>The macOS tool that signs an app bundle with your private key and embeds the profile.</dd>
<dt>local_provisioning_profile</dt><dd>The rules_apple Bazel rule that finds an installed profile by its Name field.</dd>
</dl>

</div>
