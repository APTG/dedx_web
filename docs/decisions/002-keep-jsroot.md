# ADR 002 — Keep JSROOT for Plotting

**Status:** Accepted (14 April 2026)

---

## Context

The application's Plot page renders interactive stopping-power-vs-energy curves.
Multi-series overlay (same particle across programs, or same program across
materials) is a first-class use case.

The old app already used **JSROOT** — the JavaScript port of CERN ROOT's
visualization layer, maintained by the ROOT team. The question is whether to
keep it or replace it with a general-purpose charting library.

The project has **direct contact with the JSROOT developer team** at GSI
Darmstadt — a unique advantage over general-purpose charting libraries where
physics-specific issues would be filed into a large open-source issue tracker
with no priority guarantees.

### Plotting requirements (from [`docs/04-feature-specs/plot.md`](../04-feature-specs/plot.md))

| Requirement | Detail |
|-------------|--------|
| Log-log axes | Stopping power vs energy plots span 4–6 orders of magnitude on both axes. |
| Multi-series overlay | Up to ~8 overlaid curves with a shared color palette (perceptually distinct, colorblind-safe). |
| Interactive | Pan, zoom (log-aware), tooltip on hover, legend toggle. |
| Publication quality | Export to SVG (lossless vector) and PNG; axis labels include physical units. |
| Axis auto-labeling | Labels update when unit selection changes: `"Energy [MeV/nucl]"`, `"Stopping Power [MeV·cm²/g]"`. |
| Dense grids | Up to 500 points per series; smooth on log-log axes. |
| ROOT format familiarity | The target audience (radiation physicists, medical physicists) regularly reads ROOT output. |

### Candidates evaluated

| Library | Notes |
|---------|-------|
| **JSROOT** | Physics-community standard. TGraph/TMultiGraph API. Native log-axis support. SVG output. Maintained by ROOT team. Familiar to the audience. |
| **Plotly.js** | Good log-axis and SVG support. Large bundle (~3 MB minified). Generic; axis labels need manual formatting. Not community-standard for physics. |
| **Chart.js** | Lightweight. Log axes supported via Chart.js 3+. No built-in SVG export. Multi-series is manual. Less suited for publication output. |
| **D3.js** | Maximum flexibility. Very high implementation cost for a production-quality log-log interactive chart. Axes and tooltips are built from scratch. |
| **Vega-Lite** | Declarative; good defaults. Log scales supported. SVG output. Less interactive zoom/pan than JSROOT. Audience unfamiliar. |
| **Observable Plot** | Modern; good log-axis defaults. SVG output. Limited built-in zoom/pan. Audience unfamiliar. |

---

## Decision

**Keep JSROOT.**

Use the `TGraph` / `TMultiGraph` API to build individual series and combine
them for the multi-series overlay. Manage JSROOT's DOM lifecycle in a dedicated
`JsrootPlot.svelte` wrapper component (see [docs/03-architecture.md §5](../03-architecture.md#5-component-tree)).

JSROOT is loaded as an ES module import; version-pinned in `package.json`.

---

## Consequences

### Positive

- **Audience recognition.** Physicists who produce ROOT plots or work at
  accelerator facilities immediately recognize and trust the axis style, legend
  format, and interactive behavior.
- **Log-log axes are native.** JSROOT's `TAxis` handles logarithmic scales
  natively — tick placement, label formatting (10¹, 10², …), and zoom
  all respect the log transform without custom code.
- **Multi-series via TMultiGraph.** Adding a series is a single
  `multiGraph.Add(tgraph)` call; JSROOT handles common-axis scaling, legend
  entries, and color assignment automatically.
- **SVG export built-in.** `JSROOT.makeSVG()` produces publication-quality
  vector output with correct axis labels and legend in one call.
- **Maintained.** The ROOT team ships regular JSROOT updates alongside ROOT
  releases.
- **Developer access.** Direct contact with the JSROOT maintainers provides
  a fast escalation path for bugs, API questions, and feature requests.
  Physics-specific edge cases (e.g., log-axis tick behaviour at sub-unity
  scales, `TMultiGraph` legend alignment) can be resolved upstream rather than
  worked around client-side.
- **Legacy code reference.** The old `JSRootGraph.js` shows the TGraph creation
  pattern already working against this codebase's data shape.

### Negative / risks

- **DOM ownership — ongoing maintenance surface.** JSROOT writes into the
  container `<div>` directly; Svelte must not reconcile JSROOT-owned DOM nodes.
  The `JsrootPlot.svelte` wrapper manages this via `$effect` + `untrack()`, and
  exposes `painter` as an `any`-typed variable — a deliberate compromise because
  JSROOT's TypeScript declarations cover the public draw API but not the internal
  frame-painter methods needed for programmatic zoom control. This is an
  **ongoing** maintenance surface, not a one-time cost: every JSROOT minor
  release may change internal painter APIs, SVG structure, or option names,
  all of which require review of the wrapper. Pin JSROOT to a minor version
  (`"jsroot": "~7.x.y"`) rather than a loose `^7.x` major range.

  **Scroll and touch behavior**: JSROOT's default wheel handler calls
  `preventDefault()` unconditionally, consuming scroll events and zooming the
  plot when the user intends to scroll the page. Per
  [`docs/04-feature-specs/plot.md` §Disabled Interactions](../04-feature-specs/plot.md),
  wheel zoom must be disabled and touch-zoom disabled on touch devices. The
  `drawPlot` helper sets `JSROOT.settings.ZoomWheel = false` and
  `JSROOT.settings.ZoomTouch = false` (on `pointer: coarse` devices) before
  calling `JSROOT.draw()`. This allows plain scroll and touch-swipe to pass
  through to the browser's native page scroll without any custom event
  interception. See [docs/03-architecture.md §5](../03-architecture.md#5-component-tree)
  for the implementation.
- **Bundle size — total payload audit.** JSROOT (~500 KB minified+gzipped) is
  additive, not substitutive. Conservative payload estimates: `libdedx.wasm`
  ~1–3 MB, `libdedx.data` (preloaded data tables) ~2–4 MB, JSROOT ~500 KB,
  SvelteKit framework + app code ~100 KB. Total: ~4–8 MB cold load. At 3G
  Fast (~375 KB/s), this is 10–20 seconds of transfer — which appears to
  violate the FCP ≤ 1.5 s and TTI ≤ 3.5 s budgets in
  [`docs/09-non-functional-requirements.md` §3](../09-non-functional-requirements.md#3-performance).
  In practice, the loading model decouples these metrics: the UI shell (HTML +
  CSS + minimal framework JS, ~100 KB) loads first and satisfies the FCP
  target; WASM is lazy-initialized in the root layout load (not at parse time),
  so TTI measures only the `.wasm` binary (~1–3 MB, ≤ ~8 s on 3G); JSROOT is
  loaded only when the Plot page is first visited and does not affect
  Calculator TTI. **After the first visit all artifacts are browser-cached** —
  the 3G penalty applies only once per deploy. The performance budget is
  consistent with this model but the ADR acknowledges the payload is large
  and any addition to the function export list or data tables must be evaluated
  against the size budget in ADR 003.
- **Not tree-shakeable** in the same way Chart.js is. The entire JSROOT module
  is imported. Mitigated by loading JSROOT lazily (only on the Plot page).
- **Styling constraints.** JSROOT's visual style is ROOT-derived; customizing
  fonts, line widths, and color palettes requires JSROOT-specific APIs, not
  CSS. The implementation spec ([`04-feature-specs/plot.md`](../04-feature-specs/plot.md)) is explicit
  about required style parameters to avoid ambiguity when implementing.
- **Accessibility — accepted conformance gap.** JSROOT renders to SVG without
  semantic ARIA structure; interactive elements (zoom handles, hover tooltips,
  legend) have no keyboard equivalents. This conflicts with WCAG 2.1 SC 2.1.1
  (keyboard), 1.1.1 (text alternatives), and 1.3.1 (info and relationships).
  The mitigations in
  [`docs/09-non-functional-requirements.md` §1.4](../09-non-functional-requirements.md#14-jsroot-chart-accessibility):
  `role="img"` + `aria-label` on the SVG container reduces the chart to a
  static description for screen readers; the accessible series list below the
  canvas provides keyboard-navigable series information; CSV export provides
  the full data in tabular form. Screen reader users cannot interact with the
  chart (pan, zoom, tooltip) but can access all data. **Interactive JSROOT
  plots are a hard project requirement** that takes precedence over full WCAG
  2.1 AA chart interactivity conformance; the gap is accepted and mitigated
  rather than resolved.
- **Version coupling.** JSROOT breaking changes may require updates to the
  `JsrootPlot.svelte` wrapper. Pin to a minor version in `package.json`.

---

## References

- [`docs/04-feature-specs/plot.md`](../04-feature-specs/plot.md) — full plot page specification
- [`docs/03-architecture.md` §5](../03-architecture.md#5-component-tree) — `JsrootPlot.svelte` wrapper design
- [`src/Components/Pages/Plot/JSRootGraph.js`](../../src/Components/Pages/Plot/JSRootGraph.js) — legacy JSROOT usage (reference only)
- [`docs/02-tech-stack.md`](../02-tech-stack.md#4-plotting) — JSROOT version pin
