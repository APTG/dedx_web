# Non-Functional Requirements

> **Status:** Draft v1 (13 April 2026)
>
> Covers the system-wide quality attributes for the dEdx Web redesign.
> Feature-level acceptance criteria (specific `aria-label` values,
> keyboard behaviour, component-level a11y) live in the individual
> feature specs under `docs/04-feature-specs/`. This document records
> the **project-level commitments** that every spec and every
> implementation must satisfy.

---

## 1. Accessibility — WCAG 2.1 Level AA

The application **must** conform to
[WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/) across all pages
(Calculator, Plot) and all interactive states (basic mode, advanced mode,
error states, loading states).

### 1.1 Target Standard

| Attribute | Requirement |
|-----------|-------------|
| Standard | WCAG 2.1 |
| Conformance level | **AA** (all Level A and Level AA success criteria) |
| Scope | All user-facing pages and interactive components |
| Testing | Automated (axe-core via Playwright) + manual screen-reader verification |

### 1.2 Key Success Criteria (non-exhaustive)

| WCAG SC | Criterion | Notes |
|---------|-----------|-------|
| 1.1.1 | Text alternatives for non-text content | SVG chart must have `role="img"` + `aria-label`; colour swatches must have text labels |
| 1.3.1 | Info and relationships | Table headers correctly associated via `<th scope>`; form controls labelled |
| 1.3.3 | Sensory characteristics | Instructions must not rely on colour or shape alone (e.g., error states must have text, not just red border) |
| 1.4.1 | Use of colour | Series distinguishability must not rely on colour alone — use distinct line styles (`solid`, `dashed`, `dotted`) as a second channel |
| 1.4.3 | Contrast (minimum) | Normal text: ≥ 4.5:1; Large text: ≥ 3:1 against background |
| 1.4.4 | Resize text | UI usable at 200% zoom without loss of content or functionality |
| 1.4.10 | Reflow | Single-column content at 320 CSS px width (no horizontal scroll, except data tables which are exempt) |
| 1.4.11 | Non-text contrast | UI components (buttons, inputs, focus indicators): ≥ 3:1 |
| 2.1.1 | Keyboard | All functionality operable via keyboard; no keyboard traps |
| 2.1.2 | No keyboard trap | Focus must not become locked in any component |
| 2.4.3 | Focus order | Focus order matches visual reading order |
| 2.4.7 | Focus visible | Keyboard focus indicator clearly visible on all interactive elements |
| 3.2.2 | On input | Changing a control does not trigger unexpected context changes (e.g., entity combobox change does not navigate away) |
| 3.3.1 | Error identification | Validation errors identified in text (not colour alone) |
| 4.1.2 | Name, role, value | All interactive components have correct `role`, `aria-label`/`aria-labelledby`, and state attributes (`aria-expanded`, `aria-disabled`, `aria-live`) |
| 4.1.3 | Status messages | Toast messages and loading states announced via `aria-live` regions |

### 1.3 Screen Reader Support

Primary targets (test matrix):

| Browser | Screen Reader | Priority |
|---------|--------------|----------|
| Chrome (latest) | NVDA (Windows) | High |
| Firefox (latest) | NVDA (Windows) | High |
| Safari (latest) | VoiceOver (macOS) | High |
| Chrome (latest) | VoiceOver (iOS) | Medium |
| Chrome (latest) | TalkBack (Android) | Medium |

### 1.4 JSROOT Chart Accessibility

The JSROOT canvas is inherently low-accessibility (Canvas/WebGL). Mitigations:

- The canvas element carries `role="img"` and `aria-label` describing the
  currently plotted series (e.g., "Stopping power vs energy chart: Proton in
  Water — ICRU 90, PSTAR").
- The series list below the canvas acts as an accessible data table substitute:
  screen reader users can navigate the series list and read values via the
  data export (CSV).
- The "Export CSV ↓" function provides a fully accessible tabular
  representation of all plotted data.

### 1.5 Automated Testing

- **Vitest / Svelte Testing Library:** `aria-label`, role, and state assertions
  in unit tests for every interactive component.
- **Playwright + axe-core:** `@axe-core/playwright` run on all E2E test pages.
  Zero violations at Level AA are required for CI to pass.

---

## 2. Content Priority (UX Principle)

**Primary content — the chart and results table — must always appear first.**
Supporting details (advanced mode metadata, settings summaries) appear below.

### 2.1 In the Application

| Context | Primary (top) | Secondary (below / collapsed) |
|---------|--------------|-------------------------------|
| Calculator — basic | Entity selection + results table | Validation summary |
| Calculator — advanced | Entity selection + results table | Advanced Options accordion (collapsed by default) |
| Plot | Chart canvas + series list | Advanced Options accordion (collapsed by default) |

The Advanced Options accordion is collapsed on first load and on mode switch.
It does **not** insert content between the entity selection and the results.

### 2.2 In PDF Exports

The same principle applies to exported PDFs:

| PDF | Page content order |
|-----|--------------------|
| Plot — basic | Header → Chart → Legend |
| Plot — advanced | Header → Chart → Legend → *Advanced Mode Details* block |
| Calculator — basic | Header → Entity summary → Results table |
| Calculator — advanced | Header → Entity summary → Results table → *Advanced Mode Details* block |

The "Advanced Mode Details" block is visually separated by a horizontal
rule and heading so it reads as a reference appendix, not as content
that competes with the results.

> Normative PDF layout: [`export.md`](04-feature-specs/export.md) §5.3 and §6.3.

---

## 3. Performance

| Metric | Target | Notes |
|--------|--------|-------|
| First Contentful Paint (FCP) | ≤ 1.5 s (3G Fast) | WASM not yet loaded; UI shell is usable |
| Time to Interactive (TTI) | ≤ 3.5 s (3G Fast) | WASM initialized, first calculation possible |
| WASM module load + init | ≤ 2 s (broadband) | Cached after first load |
| Debounced calculation latency | ≤ 300 ms after keystroke | Per `calculator.md` §5 |
| Plot re-render on series add | ≤ 500 ms | 500-point log grid per series |
| CSV/PDF generation | ≤ 2 s for ≤ 200 rows / ≤ 10 series | Client-side jsPDF + CSV serialisation |

Performance is measured against Lighthouse in CI on a simulated 3G Fast
network throttling profile.

### 3.1 Browser caching

The largest assets are `libdedx.wasm` (~1–3 MB) and `libdedx.data` (~2–4 MB).
These live in `static/wasm/` and are served as **un-hashed filenames** — unlike
SvelteKit's `_app/immutable/` assets (which use content hashes and receive
`max-age=31536000`), the WASM files cannot be given long-lived cache headers
safely unless the filename embeds a hash.

GitHub Pages applies `Cache-Control: max-age=600, must-revalidate` to all
files it serves. The practical impact:

| Visit | Network behavior |
|-------|-----------------|
| First load (cold) | Full download: ~3–7 MB total payload |
| Repeat visit within 10 min | Served from browser cache — no network request |
| Repeat visit after 10 min | Conditional request (ETag); 304 Not Modified if unchanged → loaded from cache, no re-download |
| After a new deployment | New ETag → full re-download of changed files only |

**Re-validation is cheap** (the 304 round-trip is a few ms on fast connections)
but adds a network hop on every session restart after the 10-minute window.
For a scientific tool that is not used in rapid-session bursts, this is
acceptable.

**Service Worker — not implemented in v1.** A Service Worker with a
cache-first strategy for `static/wasm/` assets would eliminate the re-validation
hop entirely and enable offline use. Implementing one is deferred: offline
support is not a v1 requirement, and a buggy SW can serve stale WASM after a
data-table update (physics data changes between libdedx releases). If a SW is
added in a future stage, it must include a versioned cache key that is
invalidated on every deployment.

`site.webmanifest` is present (used for Android home-screen and PWA install
prompts) but without a SW the app is not a full installable PWA in the Service
Worker sense.

---

## 4. Browser Support

| Browser | Version | Support level |
|---------|---------|---------------|
| Chrome / Chromium | Latest 2 releases | **Full** — primary target |
| Firefox | Latest 2 releases | **Full** |
| Safari | Latest 2 releases | **Full** |
| Edge (Chromium) | Latest 2 releases | **Full** |
| iOS Safari | Latest 2 releases | **Full** |
| Chrome for Android | Latest release | **Full** |
| IE 11 / Legacy Edge | — | **Not supported** |

Requirements:
- WebAssembly (MVP) support is required.
- ES2020 + dynamic `import()` required (no transpilation to ES5).
- `navigator.clipboard.writeText` used for Share URL (secure context
  required; fallback provided per `shareable-urls.md` §8.4).
- `navigator.userAgent` used for PDF metadata (best-effort, no polyfill
  needed).

---

## 5. Responsive Design

| Breakpoint | Behaviour |
|-----------|-----------|
| < 600px (mobile) | Single-column layout; entity selectors stack vertically; table scrolls horizontally; chart minimum height 300px |
| 600–899px (tablet) | Same as desktop but full-width; entity comboboxes may wrap to two rows |
| ≥ 900px (desktop) | Two-column layout (Calculator: centered column ≤720px; Plot: sidebar + canvas) |

Requirements:
- No horizontal overflow at any breakpoint except explicitly scrollable data tables.
- Touch targets ≥ 44×44 CSS px on mobile (WCAG 2.5.8 — Level AA in WCAG 2.2).
- Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Font size never below 14px (16px base recommended).

---

## 6. Security

| Requirement | Detail |
|-------------|--------|
| No server-side state | App is purely client-side (SvelteKit static adapter → GitHub Pages); no auth, no sessions, no server APIs |
| URL safety | Shareable URLs carry no executable payloads; all parameters are validated before use (see `shareable-urls.md` §2) |
| External data URLs | `extdata` URL parameter values are fetched client-side via `fetch()`; CORS must be set by the data provider; the app validates Parquet format and physics bounds before rendering |
| CSP | Because the production build is deployed to GitHub Pages/static hosting, CSP must be enforced via `<meta http-equiv="Content-Security-Policy">` in the app HTML template (or by an external hosting layer if one is added later), restricting script sources to `'self'` and the approved CDN origins for JSROOT/jsPDF |
| No sensitive data | No user PII is collected, stored, or transmitted; `navigator.userAgent` appears only in user-triggered PDF exports |
