# Feature: Shareable URLs (URL State Encoding & Restoration)

> **Status:** Draft v5 (9 April 2026)
>
> This spec defines the canonical URL state contract for the dEdx Web application.
> Every page (Calculator, Plot) encodes its full state in query parameters for
> shareability. When a user shares a URL, the recipient sees identical inputs,
> results, and rendering.
>
> **v1** (8 April 2026): Initial comprehensive draft. Covers canonical URL contract
> across pages, basic vs advanced mode behavior, Calculator and Plot URL encoding,
> validation and normalization, backward-compatibility strategy, and shareability
> guarantees.
>
> **v2** (8 April 2026): Consistency fixes. Added explicit `mode=advanced` to the
> advanced-mode contract example, unified canonicalization policy to always include
> explicit defaulted page-state params, and corrected fixture/example program IDs to
> match `ProgramEntity.id` constants from `06-wasm-api-contract.md`.
>
> **v3** (8 April 2026): Added explicit URL-contract versioning via `urlv` query
> parameter, including major-version compatibility rules, migration behavior, and
> user-warning requirements for incompatible/legacy URL formats.
>
> **v4** (8 April 2026): Seven-item consistency pass. Reordered §5 and §10.2 snippets
> to canonical param order, made energy normalization conditional on particle type
> (ions → MeV/nucl, electron → MeV), aligned Scenario 4 with unit-availability
> contract, and reconciled qfocus always-emit rule with multi-program.md.
>
> **v5** (9 April 2026): §7.2 unit token list corrected to include `GeV/nucl`. §7.3
> canonicalization ordering clarified: explicit `program` vs `programs` by mode,
> advanced-mode param sub-order (`mode` → `hidden_programs` → `qfocus`), `extdata`
> placement. Added canonical example showing `hidden_programs` when non-empty.

---

## Related Specs

- [`01-project-vision.md`](../01-project-vision.md) § 3 — Core use cases requiring shareability.
- [`calculator.md`](calculator.md) — Basic-mode Calculator, entity selection, energy input, result table, unit handling.
- [`multi-program.md`](multi-program.md) — Advanced-mode Calculator URL extensions (`mode`, `programs`, `hidden_programs`, `qfocus`).
- [`plot.md`](plot.md) — Plot page, series management, axis controls, URL encoding.
- [`unit-handling.md`](unit-handling.md) — Energy and stopping-power unit conversion, SI prefixes.
- [`entity-selection.md`](entity-selection.md) — Particle, material, program selectors.
- [`06-wasm-api-contract.md`](../06-wasm-api-contract.md) — Entity and result types.
- [`shareable-urls-formal.md`](shareable-urls-formal.md) — Formal ABNF grammar + semantic validation/canonicalization contract.

---

## 1. Purpose & Design Principles

### 1.1 Purpose

URLs are the primary mechanism for **state sharing** in dEdx Web:

1. **Scientific collaboration:** A researcher sends a colleague a link including
   the exact particle, material, energy values, and program used for a calculation.
   The colleague clicks the link and sees identical results.
2. **Bookmarking & reproducibility:** A physicist bookmarks a calculation URL;
   clicking it 6 months later restores the full calculation state.
3. **Publication & documentation:** A plot URL is embedded in supplementary material.
   Readers can click and compare multiple curves interactively without installing software.
4. **Social sharing (future):** Users may share results on Slack, email, or other media.

### 1.2 Design Principles

- **Deterministic and complete:** The URL encodes *all* necessary state to reproduce
  exactly the same output. No hidden state in `localStorage` affects rendered results.
- **Canonical form:** URLs are normalized to a single canonical representation.
  Equivalent URLs (logically identical state) produce identical canonical strings.
- **Backward-compatible:** If parameter names or semantics change, old URLs still
  work (via migration rules in §8.2).
- **Safe:** The URL is safe to share publicly (no sensitive data, no executable
  payloads). Safe to decode without risk of code injection.
- **Compact:** URLs are kept short to be shareable in tweets, Slack, etc. Avoid
  extraneous parameters or base-64-encoded blobs.

---

## 2. URL Scope & Exclusions

### 2.1 In Scope — Persisted State

Encoded in URL query parameters:
- **Entity selection:** Particle, material, program (shared across pages).
- **Energy inputs & units** (Calculator): Comma-separated energy values, master
  energy unit, per-row unit suffixes (mixed-unit mode).
- **Advanced mode settings** (when advanced mode is on): `mode=advanced`, list of
  selected programs (`programs`), hidden program IDs (`hidden_programs`), quantity
  focus (`qfocus`).
- **Stopping power display unit** (Plot page): `stp_unit`.
- **Axis scale settings** (Plot page): `xscale`, `yscale` (log / linear).
- **Series list** (Plot page): Encoded triplets of (program, particle, material).

### 2.2 Out of Scope — Not Persisted

NOT encoded in the URL:
- **Series visibility toggles** (Plot page). Hidden series are always restored as
  visible. See [`plot.md`](plot.md): "Visibility state is not persisted in the URL."
- **User preferences / settings** (`localStorage` only): theme, dark mode, onboarding
  hint dismissal, localStorage-only persistence flag for advanced mode.
- **Scroll position** or other UI ephemera.
- **Calculation cache or intermediate results.** The state is sufficient to re-run
  calculations from the WASM API.
- **Error states or validation messages.** These are derived from the persisted
  state on load.

---

## 3. Canonical URL State Contract

### 3.1 Global (Shared Across Pages)

These parameters are present on both Calculator and Plot pages and encode shared
entity selection state:

```
?urlv={major}&particle={id}&material={id}&program={id|"auto"}
```

| Parameter | Type | Example | Rules |
|-----------|------|---------|-------|
| `urlv` | Integer major version | `1` | **URL contract major version.** Current Stage 1 value is `1`. If missing, parser assumes `1` for backward compatibility. Canonical URL writing always includes it explicitly. |
| `particle` | Numeric ID or omitted | `1`, `6`, `1001` | **Required.** Particle ID from `ParticleEntity`. Default if omitted: `1` (proton). Validation: must exist in compatibility matrix. Invalid → use `1`. |
| `material` | Numeric ID or omitted | `276`, `104` | **Required.** Material ID from `MaterialEntity`. Default if omitted: `276` (water liquid). Validation: must be compatible with `particle` and `program`. Invalid → use `276`. |
| `program` | `"auto"` or numeric ID, or omitted | `"auto"`, `2`, `9` | **Optional.** Specifies which program to use (or `"auto"` for auto-select). Default if omitted: `"auto"`. Validation: if numeric, must be compatible with `particle` and `material`. Incompatible → silently fall back to `"auto"`. |

### 3.2 Basic Mode (Calculator & Plot pages, no `mode=advanced`)

When `mode` parameter is absent or `mode=basic`, the Calculator and Plot pages
ignore any multi-program parameters (`programs`, `hidden_programs`, `qfocus`).
They display in single-program mode using only `particle`, `material`, `program`.

**Calculator basic mode** adds:
```
?urlv={major}&particle={id}&material={id}&program={id|"auto"}&energies={csv}&eunit={unit}
```

**Plot basic mode** adds:
```
?urlv={major}&particle={id}&material={id}&program={id|"auto"}&series={triplets}&stp_unit={token}&xscale={scale}&yscale={scale}
```

### 3.3 Advanced Mode (Extensions to Basic)

When `mode=advanced` is present:

```
?urlv={major}&particle={id}&material={id}&programs={ids}&...page-specific params...&mode=advanced&hidden_programs={ids}&qfocus={focus}
```

- `particle`, `material` remain (shared entity selection).
- `program` is replaced by `programs` (multi-select list).
- `hidden_programs`, `qfocus` are added.
- Advanced-mode parameters are ignored if `mode` is absent or `mode=basic`.

See [`multi-program.md`](multi-program.md) § URL Persistence for details.

### 3.4 Forward/Back Navigation Behavior

**History semantics:**

- **Navigation to Calculator from Plot (or vice versa):** When the user clicks
  the navigation link to switch pages, the browser history entry is preserved.
  Clicking the back button returns the user to the previous page with its state
  intact. Example flow:
  ```
  1. User on /calculator?urlv=1&particle=1&material=276&energies=100,200&eunit=MeV
  2. Clicks "Plot" in nav
  3. Browser navigates to /plot?urlv=1&particle=1&material=276&series=...
  4. History entry added: [calc URL, plot URL]
  5. Clicking browser back → /calculator?urlv=1&particle=1&...&energies=100,200
  ```

- **State changes on same page:** When the user modifies inputs (entity selection,
  energies, programs, etc.) without navigating, the URL is updated via
  `replaceState` (not `pushState`) — this **does not** create a new history entry.
  This prevents history pollution from intermediate typing. For example:
  ```
  Initial: /calculator?urlv=1&particle=1&material=276&energies=100
  User types "200" → /calculator?urlv=1&particle=1&material=276&energies=100,200  (replaceState)
  User types "300" → /calculator?urlv=1&particle=1&material=276&energies=100,200,300  (replaceState)
  Browser history still shows only one entry (the initial URL).
  ```

- **Deep linking:** A user receives a URL via email or Slack. Clicking it (cold load)
  navigates directly to that page and state. The browser history contains only that
  URL (no "back" entry above it).

- **Sharing from intermediate state:** On Calculator, user types "100 MeV". The URL
  is `...&energies=100`. User opens link in new tab → same state. User shares this
  URL → recipient loads identical state.

### 3.5 Precedence Rules

When conflicting parameters exist, apply these rules:

| Conflict | Resolution |
|----------|------------|
| Missing `urlv` | Assume `urlv=1` and continue parsing as v1 contract |
| Unsupported `urlv` major | Attempt registered migration to current major; if migration unavailable, show blocking warning with reset action |
| Both `program` and `programs` present | If `mode=advanced`, use `programs` and ignore `program`. If `mode=basic`, use `program` and ignore `programs`. |
| Missing but required entity parameter (e.g., `particle` missing) | Use default: `particle=1` |
| Invalid entity (e.g., `particle=999` doesn't exist) | Fall back to default: `particle=1` `material=276` `program=auto` |
| Incompatible combination (e.g., `particle=1&material=999`) | Silently drop conflicting param; use valid fallback per compatibility matrix |
| Invalid energy unit in `energies` suffix (e.g., `100:bebok`) | Treat as invalid row; exclude from calculation; show validation message |
| Both `eunit` and per-row energy units present | Per-row suffixes take precedence; `eunit` is fallback for unsuffixed values |

---

## 4. Calculator URL Contract (Basic Mode)

### 4.1 Basic-Mode Parameters

```
?urlv={major}&particle={id}&material={id}&program={id|"auto"}&energies={csv}&eunit={unit}
```

| Parameter | Example | Type | Required? | Notes |
|-----------|---------|------|-----------|-------|
| `urlv` | `1` | Integer | Implicit (default parser assumption: 1) | URL contract major version. Canonical URLs include `urlv=1` in Stage 1. |
| `particle` | `1` | Numeric | Implicit (default: 1) | Particle ID (proton, heavy ion, electron) |
| `material` | `276` | Numeric | Implicit (default: 276) | Material ID |
| `program` | `auto`, `2` | String or numeric | Implicit (default: `auto`) | `"auto"` or program ID |
| `energies` | `100,200:keV,500` | CSV string | Optional | Comma-separated energy values with optional per-value unit suffixes |
| `eunit` | `MeV` | String | Optional (default: `MeV`) | Master energy unit (MeV, MeV/nucl, MeV/u) |

### 4.2 Energy & Unit Encoding

#### Master Mode (all rows same unit)

When all energy values use the same unit (master mode), encode as:

```
?energies=100,200,500&eunit=MeV
```

**Parsing on load:**
- `100` → interpreted as 100 MeV
- `200` → interpreted as 200 MeV
- `500` → interpreted as 500 MeV

#### Per-Row Mode (mixed units)

When per-row unit detection is active (at least one row has a unit suffix),
encode with per-value suffixes using colon separator:

```
?energies=100,200:keV,50:GeV/nucl,300&eunit=MeV
```

**Parsing on load:**
- `100` → interpreted as 100 MeV (from `eunit`)
- `200:keV` → interpreted as 200 keV (overrides `eunit`)
- `50:GeV/nucl` → interpreted as 50 GeV/nucl (overrides `eunit`)
- `300` → interpreted as 300 MeV (from `eunit`)

**URL generation:**
- If all rows have the same unit: omit per-value suffixes.
  ```
  energies=100,200,500&eunit=GeV
  ```
- If mixed: append `:unit` to values that differ from `eunit`.
  ```
  energies=100:MeV,200:keV&eunit=MeV  → only "200" has a suffix (differs from eunit)
  ```

#### Supported Unit Tokens in URL

| Token | Resolves to | Notes |
|-------|------------|-------|
| `MeV` | MeV | Base unit (3-char token for clarity) |
| `MeV/nucl` | MeV/nucl | 8-char token; slash allowed in URI query |
| `MeV/u` | MeV/u | 5-char token |
| `keV` | keV (×0.001 MeV) | Prefix variant of MeV |
| `GeV` | GeV (×1000 MeV) | Prefix variant of MeV |
| `keV/nucl`, `GeV/nucl`, `keV/u`, `GeV/u` | Respective per-nucleon / per-u units with prefixes | |

**Canonical rule:** When writing the URL (state → URL), use the base unit tokens
without SI prefixes in `eunit`: always `MeV`, `MeV/nucl`, or `MeV/u`. Per-value
suffixes may include prefixes (e.g., `100:keV`). This keeps the master unit compact.

Example canonical forms:
```
?energies=100,200,500&eunit=MeV           → all MeV
?energies=100:keV,200,500&eunit=MeV       → mixed; 100 is keV, others MeV
?energies=100&eunit=MeV/nucl               → master unit is per-nucleon
```

**Invalid/unknown unit token:**
- Parse error → treat as invalid row, exclude from calculation, show validation message.

### 4.3 Defaults & Fallbacks

If parameters are missing or invalid on page load:

| Scenario | Fallback |
|----------|----------|
| `urlv` missing | Assume `1` and parse using v1 rules |
| `urlv` invalid (non-integer or <=0) | Treat as unsupported version; show warning and offer Reset to defaults |
| `particle` missing | Use 1 (proton) |
| `particle` invalid (e.g., 999) | Use 1 |
| `material` missing | Use 276 (water liquid) |
| `material` invalid | Use 276 |
| `program` missing | Use `"auto"` (auto-select) |
| `program` incompatible with particle/material | Use `"auto"`. Brief toast: "Program not available; using auto-select." |
| `energies` missing | Pre-fill with `100` (single row) → shows default result |
| `energies` empty string | Pre-fill with `100` |
| `eunit` missing | Use `MeV` |
| `eunit` invalid (e.g., `"meevee"`) | Use `MeV` |
| `energies` contains only invalid/empty rows | Show table with empty rows; validation summary below |

### 4.4 Mixed-Unit Transition Rules

**On page load with URL encoding:**

1. Parse all parameters.
2. Expand `energies` CSV → array of energy values with detected units.
3. Count distinct units in the values:
   - **All same:** activate master mode. Show master unit selector as active.
   - **Mixed:** activate per-row mode. Disable master selector. Show per-row dropdowns.
4. Do **not** trigger unit detection from typed text (URL values are already explicit).

**On user interaction (typing in rows):**

- Unit detection runs per [`unit-handling.md`](unit-handling.md) § 3.
- Transitions between master and per-row mode as rows are edited.

---

## 5. Calculator URL Contract (Advanced Mode)

See [`multi-program.md`](multi-program.md) § URL Persistence for the full contract.

**Summary:** Advanced-mode parameters extend basic mode:

```
?urlv={major}&particle={id}&material={id}&programs={ids}&energies={csv}&eunit={unit}&mode=advanced&hidden_programs={ids}&qfocus={focus}
```

Canonical ordering places page-specific params (`energies`, `eunit`) before the
advanced-mode params (`mode`, `hidden_programs`, `qfocus`), matching §7.3.

| Parameter | Example | Notes |
|-----------|---------|-------|
| `mode` | `advanced` | Always emitted in advanced mode. Absence or `basic` → single-program mode. |
| `programs` | `9,2,101` | Comma-separated program IDs in display order. First is always the auto-selected default. Replaces `program`. |
| `hidden_programs` | `2` | Comma-separated program IDs (subset of `programs`) whose columns are currently hidden. Omitted when empty. |
| `qfocus` | `stp`, `csda`, `both` | Quantity focus (which column groups visible). Always emitted in advanced mode for canonical consistency, even when `both` (the default). |

Validation:
- Invalid program IDs → silently drop; show toast if any dropped.
- All programs invalid → fall back to auto-select only.
- `hidden_programs` references a program not in `programs` → ignore silently.

---

## 6. Plot URL Contract

### 6.1 Plot-Page Parameters

```
?urlv={major}&particle={id}&material={id}&program={id|"auto"}&series={triplets}&stp_unit={token}&xscale={scale}&yscale={scale}
```

| Parameter | Example | Type | Required? | Notes |
|-----------|---------|------|-----------|-------|
| `urlv` | `1` | Integer | Implicit | URL contract major version. Canonical URLs include `urlv=1` in Stage 1. |
| `particle` | `1` | Numeric | Implicit | Current entity selection (shared with Calculator) |
| `material` | `276` | Numeric | Implicit | Current entity selection |
| `program` | `auto`, `2` | String or numeric | Implicit | Current entity selection (selector in sidebar) |
| `series` | `2.1.276,9.6.276` | CSV triplets | Optional | Committed series: `programId.particleId.materialId` triplets |
| `stp_unit` | `kev-um` | Token | Optional (default: `kev-um`) | Stopping power display unit: `kev-um`, `mev-cm`, `mev-cm2-g` |
| `xscale` | `log` or `lin` | String | Optional (default: `log`) | X-axis scale |
| `yscale` | `log` or `lin` | String | Optional (default: `log`) | Y-axis scale |

### 6.2 Series Encoding

Each series is a dot-separated triplet: `programId.particleId.materialId`.

Multiple series are comma-separated:
```
?series=2.1.276,9.6.276,2.6.276
```

→ Series 1: program 2, particle 1 (proton), material 276 (water)
→ Series 2: program 9, particle 6 (carbon), material 276
→ Series 3: program 2, particle 6, material 276

**Auto-select resolution:** If the UI state currently uses auto-select, resolve it
at encoding time to the actual numeric program ID before constructing each series
triplet. `series` always encodes numeric `programId.particleId.materialId` triplets;
the literal token `auto` never appears inside `series`.

**Validation on load:**
1. Parse each triplet.
2. Check compatibility via the matrix.
3. Fetch plot data via `getPlotData()`.
4. **Partial load:** If one series is invalid, skip it and load the others. Show a
   brief toast: "1 series could not be loaded (may no longer be available)."
5. Empty `series` → no committed series plotted; only the preview is shown.

### 6.3 Stopping Power Unit Encoding

Tokens:
```
kev-um     → keV/µm
mev-cm     → MeV/cm
mev-cm2-g  → MeV·cm²/g
```

**Parsing:**
- `stp_unit=kev-um` → display unit is keV/µm (default).
- Missing → default to `kev-um`.
- Invalid token (e.g., `stp_unit=foo`) → default to `kev-um`. No error shown.

**Generation:**
- Always use the canonical token form (lowercase, hyphen separators).

### 6.4 Axis Scale Encoding

```
xscale=log     → logarithmic X-axis
xscale=lin     → linear X-axis
yscale=log     → logarithmic Y-axis
yscale=lin     → linear Y-axis
```

**Parsing:**
- Missing → default to `log`.
- Invalid → default to `log`.

**Generation:**
- Always use lowercase token.

---

## 7. Validation & Normalization Rules

### 7.1 Entity Validation

On page load or URL change, validate entities via the compatibility matrix:

```
if (!matrix.programs.has(program)) → invalid program
if (!matrix.particles.has(particle)) → invalid particle
if (!matrix.materials.has(material)) → invalid material
if (!matrix.programsByParticle.get(particle).has(program)) → incompatible
if (!matrix.materialsByProgram.get(program).has(material)) → incompatible
```

**Action:**
- Silently fall back to ([1], [276], [auto]). Do not show an error.
- Exception: if a user manually selects an entity that becomes incompatible
  (via bidirectional filtering in entity-selection.md), the component handles
  re-filtering and fallback per [`entity-selection.md`](entity-selection.md).

### 7.2 Energy Parsing

For each energy value in `energies`:

1. Split by `:` → (value_str, unit_str_if_any).
2. Parse value_str as a number (int, decimal, or scientific notation, e.g., `1e3`).
   - Invalid → treat as invalid row.
   - Negative or zero → treat as out-of-range.
3. Parse unit_str (if present):
   - Match against supported unit tokens (MeV, keV, GeV, MeV/nucl, keV/nucl, GeV/nucl, MeV/u, keV/u, GeV/u).
   - Unknown → treat as invalid row.
4. Normalize value to the particle's internal energy unit:
   - **Ions (A ≥ 1):** convert to MeV/nucl (using particle mass number A).
   - **Electron (particle ID 1001, A = 0):** convert to MeV only.
   See [`unit-handling.md`](unit-handling.md) § 2 and [`06-wasm-api-contract.md`](../06-wasm-api-contract.md) for the conditional rule.
5. Check bounds: 0 < E ≤ max_energy for the program.
   - Out of bounds → mark as out-of-range (row excluded, validation message shown).

**Numeric precision:**
- Parse floats as IEEE 754 double-precision (JavaScript number type).
- No arbitrary precision arithmetic required.

### 7.3 Canonical URL Form

When writing the URL (state → URL), normalize to this form:

```
/calculator?urlv={major}&particle={id}&material={id}&program={id|"auto"}&energies={csv}&eunit={unit}
/plot?urlv={major}&particle={id}&material={id}&program={id|"auto"}&series={triplets}&stp_unit={token}&xscale={scale}&yscale={scale}
```

**Ordering of parameters:**
1. `urlv`.
2. `extdata` (one per source, label-declaration order) — omitted when absent.
3. `particle`, `material`.
4. Exactly one program param, depending on mode:
   - Basic mode: `program` (always present; value `auto` or numeric ID).
   - Advanced mode: `programs` (always present; `program` never emitted).
5. Page-specific params: `energies`, `eunit` (calc); `series`, `stp_unit`, `xscale`, `yscale` (plot).
6. Advanced-mode params, in sub-order: `mode=advanced`, then `hidden_programs` (omit if empty), then `qfocus` (always emit in advanced mode, even when `both`).

See [`shareable-urls-formal.md`](shareable-urls-formal.md) §4 for the normative canonicalization algorithm.

**Example canonical forms:**

Calculator basic mode:
```
/calculator?urlv=1&particle=1&material=276&program=auto&energies=100,200,500&eunit=MeV
```

Calculator advanced mode — no hidden programs:
```
/calculator?urlv=1&particle=1&material=276&programs=9,2&energies=100,200&eunit=MeV&mode=advanced&qfocus=both
```

Calculator advanced mode — with hidden programs:
```
/calculator?urlv=1&particle=1&material=276&programs=9,2,101&energies=100,200&eunit=MeV&mode=advanced&hidden_programs=2&qfocus=both
```

Plot:
```
/plot?urlv=1&particle=1&material=276&program=auto&series=2.1.276,9.6.276&stp_unit=kev-um&xscale=log&yscale=log
```

**Canonical comparison:**
- Different param orderings → different strings (not canonical equivalent).
- Whitespace in values → inconsistent. Avoid.
- Canonical URLs always include explicit defaulted page-state params (e.g., `eunit=MeV`, `xscale=log`, `yscale=log`) for deterministic sharing and round-trip stability.

**Whitespace:** URLs must not contain unencoded spaces. Query tokenization splits on raw `&` and the first raw `=` in each pair, then percent-decoding is applied to each key/value component (or an equivalent `URLSearchParams` implementation is used). Do not percent-decode the full query string before splitting, because encoded delimiters such as `%26` must remain inside a value until after tokenization.

### 7.4 URL Normalization on Page Load

When a page loads with URL parameters:

1. Parse all parameters.
2. Validate and apply fallbacks per § 4.3, § 6.1–6.4, § 7.1–7.2.
3. Once state is resolved, immediately write a normalized URL via `replaceState`.
   This ensures bookmarks and sharing links are always in canonical form.

Example:
- User visits: `?particle=1&program=auto&material=276` (minimal, legacy)
- System loads, applies defaults.
- System writes: `?urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV` (canonical)
- Bookmark now has the full canonical form.

---

## 8. Shareability & Compatibility

### 8.1 Deterministic Links

**Goal:** Two users, same URL, see identical results.

**Implementation:**
- URL encodes all inputs needed for calculation: particle, material, program, energies,
  units, series.
- No `localStorage` state affects visible output.
- WASM initialization is deterministic (no randomness in algorithm selection or ordering).
- Results are deterministic (no rounding differences or platform variations expected).

**Guarantee:** Given the same URL on two browsers (or two machines), both will show
the same data rows, stopping powers, CSDA ranges, plots, and colors.

### 8.2 Backward Compatibility

**Strategy:** URL contracts are versioned by `urlv` (major integer). When parameter
names, formats, or semantics change in future versions, old URLs must still be
parseable when a migration exists.

**Current contract major:** `urlv=1`.

### 8.2.1 Version Negotiation Rules

Define app constants:
- `CURRENT_URL_MAJOR = 1`
- `MIN_SUPPORTED_URL_MAJOR = 1`

On URL load:
1. Read `urlv`.
2. If missing, treat as `1` (legacy v1 links).
3. If `urlv === CURRENT_URL_MAJOR`, parse normally.
4. If `MIN_SUPPORTED_URL_MAJOR <= urlv < CURRENT_URL_MAJOR`, run migration chain
   (`migrateUrlV{n}ToV{n+1}`) until current version is reached.
5. If `urlv < MIN_SUPPORTED_URL_MAJOR` or `urlv > CURRENT_URL_MAJOR`, do not silently
   reinterpret parameters. Show explicit warning UI (see 8.2.2).

### 8.2.2 User Warning Requirements (Major-Version Mismatch)

When a URL cannot be safely interpreted due to major mismatch:

- Show a prominent warning banner/dialog:
  - "This link uses URL format v{urlv}, but this app supports v{MIN_SUPPORTED_URL_MAJOR}–v{CURRENT_URL_MAJOR}."
- Provide actions:
  1. `Try migration` (enabled only when migration path exists)
  2. `Load defaults` (resets to canonical default state, writes `urlv={CURRENT_URL_MAJOR}`)
  3. `View raw URL` (read-only, for debugging/support)
- Do not execute calculations from ambiguous/unparsed parameters until user chooses
  a recovery action.

This is required to avoid silent scientific misinterpretation from incompatible URL formats.

**Migration example:** If in v2 the energy unit token `MeV` is renamed to `mev`:

1. Accept both `eunit=MeV` and `eunit=mev` on load.
2. Normalize to canonical form `eunit=mev` in new URLs.
3. Bump `urlv` to `2` in canonical output.
4. Provide migration function: `migrateURLv1Tov2(url)`.

**No breaking changes promised in Stage 1.** This spec is the v1 baseline. If
parameter changes are needed, they will be addressed in a future spec
(`docs/04-feature-specs/shareable-urls-migration.md`).

### 8.3 URL Length Guidance

**Typical URL length:**
- Basic calculator: ~80 bytes (particle, material, program, 1–5 energies, units)
- Advanced calculator with 6 programs and 10 energies: ~200 bytes
- Plot with 3–5 series: ~150 bytes

**Browser limits:**
- Most browsers support URLs up to ~2000 bytes (some support >8000).
- Email clients: often truncate at ~2000 characters.
- Slack: unfurled URLs are truncated; click to expand works.

**Guidance:** Keep URLs under 1500 bytes for maximum compatibility. If a URL exceeds
this:

1. **For calculator:** Limit energy inputs to ~20 values.
2. **For plot:** Limit series to ~10 triplets.
3. **Future enhancement:** Support a "share" feature that stores state in a database
   and provides a short URL (e.g., `dedx.web/s/abc123`). Not in Stage 1 scope.

**Behavior if URL exceeds limit:**
- Not truncated by the app. The full URL is sent.
- If the URL is too long for certain channels (email, Slack), users will see
  truncation at the channel level. No app-level warning is needed.

---

## 9. Security & Robustness

### 9.1 Safe Decoding Guarantees

**No code execution risk:**
- URL parameters are treated as strings and numbers only.
- No `eval()` or dynamic code execution.
- User inputs (from URL or form) are escaped before rendering (no XSS risk).

**Safe energy parsing:**
- Numeric parse: JavaScript `Number()` function (standard, safe).
- Unit string match: whitelist of expected tokens; unknown tokens are rejected.
- No regular expressions with user input (fixed regex).

**Safe series triplet parsing:**
- Split, map to numeric IDs, validate against compatibility matrix.
- Invalid IDs → silently ignored (partial load).

### 9.2 No Payload Interpretation

URLs do not store or interpret:
- User code or configuration files.
- Serialized objects (no JSON blobs in URL).
- Commands or operations beyond the physics domain (particle, material, energy).

URLs are safe to click from untrusted sources (though the content may be nonsensical
if parameters are garbage).

### 9.3 Injection Prevention

**XSS prevention:**
- Entity selection values (particle/material/program names) come from the WASM
  library's fixed data tables, not from user input via URLs.
- Energy values are rendered as text (no HTML interpretation).
- Series labels are constructed from entity names (safe).

**URL parameter names:** Fixed by the spec, not user-supplied.

---

## 10. Acceptance Criteria & Fixtures

All examples assume (matching [`06-wasm-api-contract.md`](../06-wasm-api-contract.md) program constants):
- Proton (particle ID 1), Hydrogen
- Water liquid (material ID 276)
- ICRU 90 (program ID 9)
- PSTAR (program ID 2)
- Bethe-Ext00 (program ID 101)
- URL contract version `urlv=1`

### 10.1 Basic Calculator URL Examples

#### Single-value calculation

**Input state:**
- Particle: Proton
- Material: Water (liquid)
- Program: Auto-select → ICRU 90
- Energy: 100 MeV

**URL:**
```
/calculator?urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV
```

**Expected output:** One row: 100 MeV, stopping power, CSDA range in keV/µm and cm respectively.

#### Multiple energies (master mode — all same unit)

**Input state:**
- Particle: Proton
- Material: Water (liquid)
- Program: PSTAR (explicit)
- Energies: 50 MeV, 100 MeV, 200 MeV, 500 MeV
- Unit: MeV

**URL:**
```
/calculator?urlv=1&particle=1&material=276&program=2&energies=50,100,200,500&eunit=MeV
```

**Expected output:** Four rows with results.

#### Mixed-unit energies (per-row mode)

**Input state:**
- Particle: Proton
- Material: PMMA (plastic, ID 99)
- Program: Auto-select
- Energies:
  - 100 MeV
  - 200 keV (per-row unit)
  - 50 GeV/nucl (per-row unit, but proton has A=1 so per-nucleon = MeV)
  - 300 MeV
- Master unit: MeV

**URL:**
```
/calculator?urlv=1&particle=1&material=99&program=auto&energies=100,200:keV,50:GeV/nucl,300&eunit=MeV
```

**Expectation:** Parsing correctly normalizes to [100, 0.2, 50000, 300] MeV. Per-row
mode is active (selector greyed out).

#### Heavy ion with per-nucleon unit

**Input state:**
- Particle: Carbon-12 (particle ID 6, mass number 12)
- Material: Water (liquid)
- Program: Auto-select
- Energies: 10 MeV/nucl, 100 MeV/nucl
- Unit: MeV/nucl

**URL:**
```
/calculator?urlv=1&particle=6&material=276&program=auto&energies=10,100&eunit=MeV/nucl
```

**Expected output:** Two rows. Values normalized to 10 and 100 MeV/nucl in the app.

### 10.2 Advanced Calculator URL Examples

#### Multi-program comparison

**Input state:**
- Particle: Proton
- Material: Water (liquid)
- Advanced mode: ON
- Selected programs: ICRU 90 (default, ID 9), PSTAR (ID 2)
- Hidden programs: none
- Quantity focus: Both (default)
- Energies: 100 MeV, 200 MeV
- Unit: MeV

**URL:**
```
/calculator?urlv=1&particle=1&material=276&programs=9,2&energies=100,200&eunit=MeV&mode=advanced&qfocus=both
```

**Expected output:** Five columns (Typed, Normalized, Unit, Stp Power, CSDA Range) for default program (ICRU 90), plus additional Stp Power and CSDA Range columns for PSTAR. Both quantity groups visible.

#### Advanced mode — stopping power only

**Input state:**
- Same as above, but `qfocus=stp` (hide CSDA range columns)

**URL:**
```
/calculator?urlv=1&particle=1&material=276&programs=9,2&energies=100,200&eunit=MeV&mode=advanced&qfocus=stp
```

**Expected output:** Only stopping power columns visible for both programs.

#### Advanced mode — hidden programs

**Input state:**
- Selected programs: ICRU 90 (default, ID 9), PSTAR (ID 2), Bethe-Ext00 (ID 101)
- Hidden: PSTAR (ID 2)
- Quantity focus: Both (default)

**URL:**
```
/calculator?urlv=1&particle=1&material=276&programs=9,2,101&energies=100&eunit=MeV&mode=advanced&hidden_programs=2&qfocus=both
```

**Expected output:** Columns for ICRU 90 (visible) and Bethe-Ext00 (visible); PSTAR column is hidden (users can toggle via eye icon). Both stopping-power and CSDA-range quantity groups visible.

### 10.3 Plot Page URL Examples

#### Single series

**Input state:**
- Entity selection: Proton in Water, auto-select
- Committed series: ICRU 90, Proton, Water
- Stopping power unit: keV/µm
- Axis scales: Log-Log

**URL:**
```
/plot?urlv=1&particle=1&material=276&program=auto&series=9.1.276&stp_unit=kev-um&xscale=log&yscale=log
```

**Expected output:** One curve (solid black line) labeled "ICRU 90 – Proton in Water" plotted on a log-log plot.

#### Multiple series with mixed axes

**Input state:**
- Committed series:
  - ICRU 90, Proton, Water
  - PSTAR, Proton, Water
  - ICRU 90, Carbon, Water
- Stopping power unit: MeV·cm²/g
- Axis scales: Linear X, Log Y

**URL:**
```
/plot?urlv=1&particle=1&material=276&program=auto&series=9.1.276,2.1.276,9.6.276&stp_unit=mev-cm2-g&xscale=lin&yscale=log
```

**Expected output:** Three curves (different colors); Y-axis log, X-axis linear; Y-label shows "Stopping Power [MeV·cm²/g]".

#### Series with auto-select program

**Note:** Auto-select is **resolved** at encoding time.

**Input state:**
- Entity selection: Proton in Water, auto-select → ICRU 90 (ID 9)
- Series: Proton in Water via auto-select

**URL (outgoing):**
```
/plot?urlv=1&particle=1&material=276&program=auto&series=9.1.276&...
```

The `series` triplet encodes the **resolved** program ID (9), not "auto", ensuring
the URL is self-contained.

### 10.4 Round-Trip Tests

**Test: state → URL → restored state (determinism)**

**Calculator round-trip:**

1. Load default calculator: `/calculator`
2. Select: Proton, Water, auto-select, type 100 and 200 MeV.
3. Expected URL: `/calculator?urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV`
4. Copy URL.
5. Open in new window.
6. Verify: Same entity selection, same energies, same results.
7. Modify: Type 300 MeV.
8. Expected new URL: `/calculator?...&energies=100,200,300&...`
9. Copy URL, open in new window, verify. ✓

**Plot round-trip:**

1. Load Plot page.
2. Add series: ICRU 90 + Proton + Water.
3. Add series: PSTAR + Proton + Water.
4. Change unit to MeV/cm.
5. Expected URL: `/plot?urlv=1&particle=1&material=276&program=auto&series=9.1.276,2.1.276&stp_unit=mev-cm&xscale=log&yscale=log`
6. Copy URL.
7. Open in new window.
8. Verify: Same two series, same unit, same colors, same plot appearance. ✓

### 10.5 Invalid URL Recovery

**Test: invalid params → fallback to defaults + toast**

**Scenario 1: Nonexistent particle**

URL:
```
/calculator?urlv=1&particle=999&energies=100
```

Expected:
- Load fails validation.
- Fallback to particle=1 (proton).
- Show toast: "Particle not found; using Proton."
- Canonical URL rewritten: `/calculator?urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV`

**Scenario 2: Incompatible combination**

URL:
```
/calculator?urlv=1&particle=1&material=99&program=50
```

(Assume program 50 doesn't exist or doesn't support particle 1 + material 99.)

Expected:
- Fallback program to auto-select.
- If auto-select is incompatible, fall back to particle=1, material=276, program=auto.
- Brief toast: "Program not available; using auto-select."

**Scenario 3: Invalid energy (non-numeric)**

URL:
```
/calculator?urlv=1&particle=1&material=276&energies=abc,100,xyz
```

Expected:
- Row 1 (abc): invalid, excluded from calculation, validation message "Non-numeric value 'abc'".
- Row 2 (100): valid, shows results.
- Row 3 (xyz): invalid, excluded.
- Validation summary below table: "2 of 3 values invalid".

**Scenario 4: Per-row unit incompatible with particle**

URL:
```
/calculator?urlv=1&particle=1&energies=100:MeV/nucl
```

(Proton A=1; per [`unit-handling.md`](unit-handling.md) § 2, only MeV is available for protons.
MeV/nucl is not a valid unit for this particle.)

Expected:
- Row treated as invalid (unit `MeV/nucl` not in the proton's available-unit set).
- Row excluded from calculation; validation message shown:
  "Unit 'MeV/nucl' is not available for Proton."
- Canonical URL rewrites the page with the invalid row excluded.

---

## 11. Cross-Spec Consistency Checklist

### 11.1 Alignment with calculator.md

- [ ] Calculator URL params (`particle`, `material`, `program`, `energies`, `eunit`) match the contract in [`calculator.md`](calculator.md) § URL State Encoding.
- [ ] Energy unit tokens (MeV, MeV/nucl, MeV/u, keV, GeV, …) are consistent with [`unit-handling.md`](unit-handling.md) § 3 Supported Suffixes.
- [ ] Mixed-unit encoding (per-row suffixes) matches the algorithm in [`calculator.md`](calculator.md).
- [ ] Fallback behavior (missing params, defaults) aligns with § Default State on First Load in [`calculator.md`](calculator.md).

### 11.2 Alignment with multi-program.md

- [ ] Advanced-mode params (`mode`, `programs`, `hidden_programs`, `qfocus`) are documented in this spec and cross-referenced to [`multi-program.md`](multi-program.md) § URL Persistence.
- [ ] Program display order in `programs` list matches the drag-and-drop column order in [`multi-program.md`](multi-program.md).
- [ ] Quantity focus values (`both`, `stp`, `csda`) are the same.

### 11.3 Alignment with plot.md

- [ ] Plot URL params (`particle`, `material`, `program`, `series`, `stp_unit`, `xscale`, `yscale`) match [`plot.md`](plot.md) § URL State Encoding.
- [ ] Series encoding (triplets with dots) matches [`plot.md`](plot.md) § Series Encoding.
- [ ] Stopping power unit tokens (`kev-um`, `mev-cm`, `mev-cm2-g`) are canonical and match [`plot.md`](plot.md).
- [ ] Axis scale tokens (`log`, `lin`) are correct.
- [ ] Note that series visibility is NOT persisted (as per [`plot.md`](plot.md) § Toggle Series Visibility).

### 11.4 Alignment with unit-handling.md

- [ ] Energy unit conversions (MeV ↔ MeV/nucl ↔ MeV/u) use the same formulas as [`unit-handling.md`](unit-handling.md) § 4 Conversion Formulas.
- [ ] SI prefix multipliers (e.g., keV = ×0.001 MeV) match § 3 Supported Suffixes.
- [ ] Stopping power unit conversions (keV/µm ↔ MeV/cm ↔ MeV·cm²/g) use material density per [`unit-handling.md`](unit-handling.md) § 5.0.

### 11.5 Alignment with entity-selection.md

- [ ] Entity IDs (particle, material, program) are numeric IDs from the WASM library's entity lists.
- [ ] Auto-select (program = "auto") behavior matches [`entity-selection.md`](entity-selection.md) § Auto-Select Mechanism.
- [ ] Entity validation against the compatibility matrix is consistent.

### 11.6 Alignment with 06-wasm-api-contract.md

- [ ] Entity IDs (ParticleEntity.id, MaterialEntity.id, ProgramEntity.id) are numeric and match the WASM contract types.
- [ ] Energy unit definitions (MeV, MeV/nucl, MeV/u) match the EnergyUnit type in [`06-wasm-api-contract.md`](../06-wasm-api-contract.md) § 2.1 Units.
- [ ] Stopping power units (MeV·cm²/g, MeV/cm, keV/µm) match the StpUnit type.

### 11.7 Known Issues & Follow-Up Edits

**No mismatches found in Stage 1 spec review.** All cross-references are consistent.

**Future enhancements (not blocking v1):**
- Short URL storage (database) for very long plot URLs — to be defined in a future spec.
- User-defined custom compounds in URL state — requires enhancement to entity encoding.

---

## 12. Acceptance Criteria

- [ ] **Calculator basic mode:** URL encodes particle, material, program, energies (CSV with optional per-value unit suffixes), and master unit. On load with URL, state is restored identically.
- [ ] **Calculator advanced mode:** URL encodes `mode=advanced`, `programs` list (comma-separated, first = default), and `qfocus`. Invalid programs are silently dropped with a toast.
- [ ] **Plot page:** URL encodes particle, material, program, series list (dot-separated triplets), stopping power unit, and axis scales. On load, series are fetched and plotted with correct colors and labels.
- [ ] **Energy parsing:** Per-row unit suffixes (e.g., `200:keV`) are parsed correctly. Round-trip: state → URL → restored state produces identical results (deterministic).
- [ ] **Entity validation:** Invalid entity IDs (e.g., particle=999) cause fallback to defaults with a brief toast message. Incompatible combinations fall back to auto-select.
- [ ] **URL normalization:** On page load, the URL is normalized to canonical form via `replaceState`. Subsequent bookmarks and shares use the canonical form.
- [ ] **Versioned URL contract:** Canonical URLs include `urlv={CURRENT_URL_MAJOR}`. Missing `urlv` is interpreted as legacy v1 only.
- [ ] **Major mismatch warning:** If `urlv` is outside supported range, the app warns the user and requires explicit recovery action (`Try migration` or `Load defaults`) before calculating.
- [ ] **Forward/back navigation:** Switching pages via navigation preserves browser history. State changes on the same page use `replaceState` (no history pollution). Back button returns to previous page/state.
- [ ] **Shareability:** Two users with identical URLs see identical results (deterministic rendering). No `localStorage` state affects visible output.
- [ ] **Security:** URLs are safe to click from untrusted sources. No code execution, XSS, or injection risks.
- [ ] **Backward compatibility:** Old URL formats can be parsed when migration path exists; otherwise explicit warning is shown. Stage 1 current major is `urlv=1`.

---

## 13. Appendix: Token Reference

### 13.1 Energy Unit Tokens

| Token | Resolves to | Example |
|-------|------------|---------|
| `MeV` | MeV | `energies=100&eunit=MeV` |
| `keV` | keV (×0.001 MeV) | `energies=100:keV` → 0.1 MeV |
| `GeV` | GeV (×1000 MeV) | `energies=100:GeV` → 100000 MeV |
| `MeV/nucl` | MeV/nucl | `energies=100&eunit=MeV/nucl` |
| `keV/nucl` | keV/nucl (×0.001 MeV/nucl) | `energies=100:keV/nucl` |
| `GeV/nucl` | GeV/nucl (×1000 MeV/nucl) | `energies=100:GeV/nucl` |
| `MeV/u` | MeV/u | `energies=100&eunit=MeV/u` |
| `keV/u` | keV/u (×0.001 MeV/u) | `energies=100:keV/u` |
| `GeV/u` | GeV/u (×1000 MeV/u) | `energies=100:GeV/u` |

### 13.2 Stopping Power Unit Tokens (Plot)

| Token | Resolves to |
|-------|-------------|
| `kev-um` | keV/µm |
| `mev-cm` | MeV/cm |
| `mev-cm2-g` | MeV·cm²/g |

### 13.3 Quantity Focus Tokens (Advanced Calculator)

| Token | Meaning |
|-------|---------|
| `both` | Show all columns (stopping power + CSDA range) |
| `stp` | Show stopping power columns only |
| `csda` | Show CSDA range columns only |

### 13.4 Axis Scale Tokens (Plot)

| Token | Meaning |
|-------|---------|
| `log` | Logarithmic scale |
| `lin` | Linear scale |
