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

### Plotting requirements (from `docs/04-feature-specs/plot.md`)

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
`JsrootPlot.svelte` wrapper component (see `docs/03-architecture.md` §4).

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

- **DOM ownership.** JSROOT writes into a container `<div>` directly;
  it does not use the virtual DOM or Svelte's rendering. The `JsrootPlot.svelte`
  wrapper must guard against Svelte trying to reconcile JSROOT-owned DOM nodes.
  Managed via `$effect` with explicit container reference (see
  `docs/03-architecture.md` §4).
- **Bundle size.** JSROOT is not small (~500 kB minified+gzipped). Given that
  the WASM binary is already several MB, this is acceptable — physics-correct
  output is worth the cost.
- **Not tree-shakeable** in the same way Chart.js is. The entire JSROOT module
  is imported. Mitigated by loading JSROOT lazily (only on the Plot page).
- **Styling constraints.** JSROOT's visual style is ROOT-derived; customizing
  fonts, line widths, and color palettes requires JSROOT-specific APIs, not
  CSS. The implementation spec (`docs/04-feature-specs/plot.md`) is explicit
  about required style parameters to avoid ambiguity when implementing.
- **Version coupling.** JSROOT breaking changes may require updates to the
  `JsrootPlot.svelte` wrapper. Pin to a minor version in `package.json`.

---

## References

- `docs/04-feature-specs/plot.md` — full plot page specification
- `docs/03-architecture.md` §4 — `JsrootPlot.svelte` wrapper design
- `src/Components/Pages/Plot/JSRootGraph.js` — legacy JSROOT usage (reference only)
- `docs/02-tech-stack.md` — JSROOT version pin
