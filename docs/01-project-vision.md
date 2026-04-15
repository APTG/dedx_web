# Project Vision — webdedx

> **Status:** Draft v1 (3 April 2026)
>
> This document describes *what* webdedx is, *who* it serves, and *why* it exists.
> It does **not** describe how individual features work — those live in
> `docs/04-feature-specs/`.

---

## 1. Purpose

**webdedx** is a browser-based calculator and plotting tool for charged-particle
stopping powers and ranges in matter, powered by the
[libdedx](https://github.com/libdedx/libdedx) C library compiled to WebAssembly.

It replaces the broken legacy React app with a modern, fast, client-side-only
application that requires no backend, no login, and no installation.

---

## 2. Audience

| Persona | Typical task | Experience level |
|---------|-------------|-----------------|
| **Medical physicist** | "What is the range of 200 MeV protons in water?" | Expert in radiation physics, non-expert in software |
| **Radiation physicist / researcher** | Compare stopping power curves across programs or particles | Needs publication-quality plots |
| **Student** | Explore how stopping power varies with energy, particle, or material | Learning; needs clear labels and docs |
| **Shielding engineer** | Look up range in a specific material for beam-stop design | Wants quick numeric answers |

All personas share one trait: **they want answers fast, with minimal clicking.**

---

## 3. Core Use Cases (Priority Order)

### 3.1 Range Calculation (80% use case)

The user selects a particle, a material, and enters one or a few energy values.
The app returns the CSDA range. This is the **default view** on first load.

> Default state on launch: **auto-select / proton / liquid water / 100 MeV**
> — the user sees a result immediately without touching any control.

### 3.2 Stopping Power Plotting

The user builds one or more data series (program + particle + material) and views
overlaid stopping-power-vs-energy curves on an interactive plot. Common
comparisons:

- Same particle, same material, different programs (e.g., PSTAR vs ICRU90)
- Same material, different particles (e.g., proton vs carbon in water)
- Same particle, different materials (e.g., proton in water vs PMMA)

> Default state on the Plot page: selectors pre-filled with
> **auto-select / proton / liquid water**, but **no data plotted**
> until the user adds the first series.

### 3.3 Inverse Lookups (advanced)

Given a stopping power or CSDA range value, find the corresponding energy.
This is an advanced feature, not shown in the default UI.

### 3.4 Multi-Program Comparison (advanced)

Run the same query (particle + material + energy) across multiple stopping-power
programs simultaneously to compare results.

---

## 4. Design Principles

### 4.1 Correct and Clear Units

Units are critical in physics software. Getting a number without knowing
its unit — or with the wrong unit — is worse than no answer at all.

**Input units — context-aware:**
- Energy input must have an explicit, always-visible unit selector.
- The **available options depend on the selected particle:**
  - **A = 1** (proton): show only **MeV** — MeV/nucl is numerically
    identical to MeV for single-nucleon particles, so showing it adds clutter without value.
  - **A > 1** (alpha, carbon, …): show **MeV** and **MeV/nucl**.
  - **Electron** (ID 1001): show only **MeV** — per-nucleon units
    (MeV/nucl, MeV/u) are meaningless for leptons.
  - **MeV/u** is available in advanced mode only (the distinction from MeV/nucl
    matters for precision CSDA range work, but confuses most users).
- SI prefixes (keV, MeV, GeV) should be supported where applicable.
- The selected unit is shown next to the input field at all times.

**Output units — auto-scaling:**
- Numeric results must use **human-readable magnitudes**. Display `1.2 mm`,
  not `0.0012 m`. Display `34.5 µm`, not `0.0000345 m`.
- The app selects the best SI prefix automatically based on the value's
  magnitude (nm, µm, mm, cm, m for lengths; eV, keV, MeV, GeV for energies).
- Users can override the auto-scaled unit if needed.

**Plot axis labels:**
- Axis labels must include the unit in standard notation:
  *"Stopping Power [MeV·cm²/g]"*, *"Energy [MeV/nucl]"*, *"Range [g/cm²]"*.
- When the data range spans SI prefixes, axis tick labels should auto-scale
  (e.g., switch from cm to mm) and the axis label must update accordingly.

> Full unit conversion logic is specified in [`docs/04-feature-specs/unit-handling.md`](04-feature-specs/unit-handling.md).

### 4.2 Minimum Clicks

Where a choice has 2–4 options (e.g., MeV vs MeV/nucl vs MeV/u), use
**segmented controls or radio buttons** — never dropdowns. The user should see
all options at a glance and select with a single click.

For entity selection (particles, materials), the UI varies by page context:

- **Plot page** — always-visible scrollable list panels in a sidebar,
  with text filter inputs. Unavailable items are greyed out (not hidden)
  so the user can see the full data landscape. Inspired by the
  [`libdedx_demo.html`](https://github.com/APTG/libdedx/issues/79#issuecomment-4158280966)
  prototype.
- **Calculator page** — compact **typeahead/autocomplete** dropdowns
  inspired by [ATIMA](https://www.isotopea.com/webatima/): the user types
  a fragment ("car" → Carbon-12) and sees matching results with properties
  (Z, A, symbol, aliases like "alpha" → He-4) displayed inline.

Both modes use bidirectional filtering and share the same selection state.
See `docs/04-feature-specs/entity-selection.md` for the full specification.

### 4.3 "Best Available Answer" by Default

The app selects the most appropriate stopping-power program automatically
based on the chosen particle and material. The default program **adapts to the
current particle/material combination** — it is not a fixed choice. Users *can*
override the program selection, but they shouldn't *have* to.

libdedx provides a starting point via the **`DEDX_ICRU`** meta-program,
which resolves to the best available ICRU dataset at runtime:

| Particle | Resolution chain |
|----------|------------------|
| Proton (Z=1) | ICRU 90 → PSTAR (ICRU 49 era) |
| Alpha (Z=2) | ICRU 90 → ICRU 49 |
| Carbon (Z=6) | ICRU 90 → ICRU 73 → ICRU 73 (old) |
| Other heavy ions | ICRU 73 → ICRU 73 (old) |
| Electron (ID 1001) | ESTAR — **not available in libdedx v1.4.0** (greyed out in UI) |

Additionally, `dedx_get_simple_stp()` implements a two-stage fallback:
first tries `DEDX_ICRU`, then falls back to `DEDX_DEFAULT` (Bethe formula)
if no tabulated data is available.

However, `DEDX_ICRU` is not always the best choice — for example, MSTAR
may be preferred for certain heavy ions where ICRU 73 data is unavailable.
webdedx should implement a **program auto-selection layer** on top of
libdedx's resolver:

1. Start with the libdedx `DEDX_ICRU` resolution as the baseline.
2. Extend with webdedx-level rules (configurable, e.g., prefer MSTAR for
   heavy ions on specific materials).
3. Always display which concrete program was actually used
   (e.g., "ICRU 90 (auto-selected)") so the user knows the data source.
4. When the user changes particle or material, the auto-selected program
   updates accordingly — it is never stale.

The auto-select program should be the default in both the Calculator and
Plot pages. The selection rules should be defined as a configuration entity
so they can be tuned without code changes.

### 4.4 Progressive Disclosure — Basic / Advanced Mode

The default UI is simple: particle, material, energy → result. The app
operates in two modes:

| Mode | Who uses it | What is visible |
|------|-------------|-----------------|
| **Basic** (default) | 80% of users — quick lookups | Single program, core energy/unit selectors, unified result table (Calculator) or single-series workflow (Plot) |
| **Advanced** | Power users comparing programs, overriding density/state, using inverse lookups | Everything in Basic + multi-program comparison columns, MSTAR modes, aggregate state override, interpolation settings, density/I-value overrides, MeV/u energy unit, custom compounds, inverse lookups |

**Metaphor:** Like the "mode" button on an old handheld scientific
calculator — pressing it reveals extra keys, but the basic keypad stays
the same.

**Toggle placement:** The Advanced toggle lives in the **top-right action
bar** of every page, alongside the Share and Export buttons. This makes
it uniformly accessible across Calculator and Plot without taking space
from entity selectors. The same toggle controls advanced mode app-wide —
switching to Advanced on Calculator and then navigating to Plot keeps
advanced mode on.

| Position element | Left | Center | Right |
|------------------|------|--------|-------|
| **Action bar** | *(page-specific controls)* | | **Basic · Advanced** · Share · Export |

The toggle state is encoded in the URL (`mode=advanced`) so shared links
preserve the user's context. Opening a URL with `mode=advanced` activates
advanced mode for the recipient. The mode is also stored in
`localStorage` so it persists across browser sessions until the user clears site storage or explicitly switches back to Basic. This means a returning user who last used Advanced mode will resume in Advanced mode.

**What Advanced mode reveals per page:**

| Page | Basic mode | Advanced mode additions |
|------|-----------|------------------------|
| **Calculator** | Single program, five-column unified table | Multi-program comparison columns, MSTAR modes, aggregate state override, density/I-value overrides, MeV/u energy unit, inverse lookups |
| **Plot** | Standard series workflow | (Future: additional series metadata, batch operations, custom compounds) |

Advanced mode is specified per-feature in the respective feature specs:
- Multi-program comparison columns (Calculator): [`multi-program.md`](04-feature-specs/multi-program.md)
- MSTAR modes, aggregate state, density/I-value overrides: [`advanced-options.md`](04-feature-specs/advanced-options.md)
- Inverse lookups: [`inverse-lookups.md`](04-feature-specs/inverse-lookups.md)
- Custom compounds: [`custom-compounds.md`](04-feature-specs/custom-compounds.md)

### 4.5 Shareability

Every calculation state is encoded in the URL. A user can copy the URL from
the browser's address bar and share it — the recipient sees the exact same
inputs and results. No server-side state is needed.

### 4.6 Export-Friendly

Results (numeric tables and plots) can be exported for further analysis:

- **CSV** — Windows/Excel-compatible by default (UTF-8 BOM, configurable
  delimiter). Openable directly in Microsoft Excel.
- **PDF** — Vector graphics for publication-quality plot output.

### 4.7 External / User-Hosted Data

Users can bring their own stopping-power and CSDA-range tables — generated
from tools like **SRIM**, **Geant4**, **FLUKA**, or custom Monte-Carlo codes
— and view them alongside the built-in libdedx programs.

- **Activation:** A URL query parameter (`extdata=<url>`) points to a
  user-hosted binary data file in the `.webdedx` format. No UI buttons or
  file-upload dialogs are needed.
- **Hosting:** The data file can be hosted privately (localhost) or publicly
  (S3, GitHub Pages, any static web server with CORS enabled).
- **Partial reads:** The Parquet format supports row-group-level partial
  reads via HTTP Range Requests, so only the requested table is downloaded.
- **Additive:** External programs, particles, and materials are merged with
  the built-in lists — they never replace or override built-in data.
- **Shareable:** The `extdata` URL is persisted in shared links, so
  recipients see the same external data overlaid on the same built-in curves.
- **Visually distinct:** External entities are visually marked in selectors,
  tables, and plot legends so users always know the data provenance.

Full specification in [`docs/04-feature-specs/external-data.md`](04-feature-specs/external-data.md).
Converter tooling (`srim2webdedx`, `csv2webdedx`, `webdedx-inspect`) is
specified there as well. Implementation is planned for a later stage.

---

## 5. Application Structure

The app has **three top-level pages** (routes/tabs):

| Page | Purpose | Default state |
|------|---------|---------------|
| **Calculator** | Numeric range & stopping power lookup | Pre-filled with auto-select/proton/water/100 MeV, result shown |
| **Plot** | Interactive stopping-power-vs-energy chart | Selectors pre-filled with auto-select/proton/water, canvas empty |
| **Documentation** | User guide + technical reference | Static content |

The Calculator page is the **landing page** (first thing the user sees).

### 5.1 Documentation Page

The documentation page has two tiers:

- **User guide** — prominently linked from the main navigation. Covers how
  to use the calculator, plot, and advanced features. Written for the
  audience described in §2.
- **Technical reference** — accessible from within the user guide or via a
  secondary navigation section. Covers libdedx program descriptions, data
  sources, physics background, C API details, and WASM build information.
  Not hidden, but not competing for attention with the user guide.

---

## 6. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| **Client-side only** | All computation runs in the browser via WebAssembly. No backend server. |
| **Hosted on GitHub Pages** | Static site deployment. No server-side rendering or API endpoints. |
| **No authentication** | Public access, no user accounts, no saved sessions (URL sharing instead). |
| **libdedx as the engine** | All stopping power and range data come from the libdedx C library. The app is a frontend for this library. |
| **WASM module size** | The compiled WASM binary includes embedded data tables. Initial load may be several MB — must handle gracefully with a loading indicator. |

---

## 7. Device Support

All three form factors are **first-class** targets:

| Device | Considerations |
|--------|---------------|
| **Desktop** (≥1024px) | Full layout with side-by-side controls and results. Primary development target. |
| **Tablet** (768–1023px) | Stacked layout. Touch-friendly controls. Usable at beamlines. |
| **Phone** (<768px) | Single-column. Collapsible sections. Plot must be zoomable. |

---

## 8. Feature Roadmap

Features are delivered incrementally. The architecture supports all features
from the start (especially custom compounds), but UI surfaces are added
progressively.

### v1 — Core

| Feature | Spec |
|---------|------|
| Entity selection (cascading, typeahead) | `04-feature-specs/entity-selection.md` |
| Calculator (range + stopping power) | `04-feature-specs/calculator.md` |
| Plot (multi-series, interactive) | `04-feature-specs/plot.md` |
| Unit handling (energy, stopping power, range) | `04-feature-specs/unit-handling.md` |
| Shareable URLs | `04-feature-specs/shareable-urls.md` |
| CSV export | `04-feature-specs/export.md` |

### v1.5 — Comparison & Export

| Feature | Spec |
|---------|------|
| Multi-program comparison | `04-feature-specs/multi-program.md` |
| PDF export (vector) | `04-feature-specs/export.md` |
| Inverse lookups | `04-feature-specs/inverse-lookups.md` |

### v2 — Advanced

| Feature | Spec |
|---------|------|
| Custom compounds | `04-feature-specs/custom-compounds.md` |
| Advanced options (MSTAR modes, aggregate state, interpolation, density/I-value override) | `04-feature-specs/advanced-options.md` |

---

## 9. Error Philosophy

- **Standard mode:** Human-friendly messages.
  *"Energy 10 000 MeV/nucl exceeds the maximum (1 000 MeV/nucl) for PSTAR with protons."*
- **On demand:** A "Show details" link or expandable section reveals the
  technical error code from libdedx (e.g., `DEDX_ERR_ENERGY_OUT_OF_RANGE = 103`).
- Errors from one program in a multi-program query must **not** abort the
  other programs — partial results are shown with per-program error indicators.

---

## 10. Visual Identity

- **Style:** Scientific and minimal — clean typography, generous whitespace,
  no decorative elements. The data is the focus.
- **Color palette:** Neutral base with a small accent color for interactive
  elements. Plot line colors follow a perceptually distinct, colorblind-safe
  sequence.
- **Dark mode:** Not required for v1, but the design should not preclude it
  (avoid hardcoded colors).
- **Typography:** System font stack for UI; monospace for numeric results.

---

## 11. Related Documents

| Document | Purpose |
|----------|---------|
| [00-redesign-plan.md](00-redesign-plan.md) | Full implementation plan with stages |
| [06-wasm-api-contract.md](06-wasm-api-contract.md) | TypeScript interface for the libdedx WASM wrapper |
| [`09-non-functional-requirements.md`](09-non-functional-requirements.md) | WCAG 2.1 AA accessibility, performance budgets, browser support matrix, responsive breakpoints, security |
| `04-feature-specs/*.md` | Detailed per-feature specifications |
| `03-architecture.md` | Component tree, data flow, WASM lifecycle |
