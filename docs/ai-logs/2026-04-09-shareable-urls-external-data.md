# 2026-04-09 — Shareable URLs Finalization & External Data Spec Completion

## Session Narrative

### Prompt 1: Review and finalize new specs on the branch; critical review questions
**AI response**: Investigated the branch diff and reviewed three new/in-progress specs:
`shareable-urls.md` (Draft v4), `shareable-urls-formal.md` (Draft v2), and
`external-data.md` (Draft v2). Identified seven issues needing clarification:

1. `extdata` URL parameter not yet integrated into the formal ABNF grammar.
2. §4 canonicalization used ambiguous phrasing ("program OR programs"); needed to
   specify exactly one param per mode.
3. Missing `hidden_programs` example in the canonical advanced-mode calculator URL.
4. `series-item` in ABNF only accepted numeric triplets; external entity refs
   (`ext:{label}:{id}`) were not parseable.
5. Open question on material merging strictness (exact name vs fuzzy).
6. `extdata` format used positional `sourceIndex` in `ext:0:id` references —
   fragile when source list changes.
7. `url-value` charset in ABNF needed to exclude `:` to make the `label:url`
   separator unambiguous.

### Prompt 2: Apply fixes per user answers (Q1–Q7)
**AI response**: Updated `shareable-urls-formal.md` (Draft v2 → Draft v3) and
`shareable-urls.md` (Draft v4 → Draft v5):

**Grammar (shareable-urls-formal.md):**
- Added `extdata-pair` rule with `ext-label ":" url-value` structure; first literal
  `:` is unambiguously the label/URL separator.
- Introduced `entity-id = int-pos / ext-ref` and
  `ext-ref = "ext:" ext-label ":" entity-local-id` to support external refs.
- Updated `series-item`, `programs-pair`, and `hidden-programs-pair` to use
  `entity-id` (accepting either built-in numeric IDs or `ext:` triplets).
- Tightened `url-value` charset to exclude space, `&`, `=`, and `:` (hex ranges
  `%x21-25 / %x27-39 / %x3B-3C / %x3E-FF`).

**Canonicalization (shareable-urls-formal.md §4):**
- Fully rewritten to specify exactly one program param per mode: basic → `program`
  always; advanced → `programs` always. Neither ever emits the other.
- Advanced-mode sub-order: `mode=advanced` → `hidden_programs` (omit if empty) →
  `qfocus` (always emit, even when `both`).
- `extdata` placed at position 2 in canonical order, emitted once per source in
  label-declaration order; omitted entirely when no external sources.

**Parse pipeline (shareable-urls-formal.md §3.1):**
- Added step 5: extract `extdata` label and percent-encoded URL; validate label
  uniqueness (duplicate label = parse error).

**Conformance vectors (shareable-urls-formal.md §5):**
- Added vector 3: advanced calculator with `hidden_programs`.
- Added vector 5: external data source with labeled source and mixed external/built-in
  series triplets.

**shareable-urls.md §7.2 and §7.3:**
- Added missing `GeV/nucl` to supported unit token list.
- Rewrote canonicalization ordering paragraph; added `hidden_programs` example.

**external-data.md (Draft v2 → Draft v3):**
- Changed `extdata` format from `extdata={url}` to `extdata={label}:{url}`.
- All `ext:0:id` references → `ext:{label}:id`.

### Prompt 3: PDG codes, ICRU IDs, size limits, interpolation, and offline support
**AI response**: Extended `external-data.md` (Draft v3 → Draft v4) and
`06-wasm-api-contract.md`:

**Particle merge key — PDG Monte Carlo codes:**
- Added `pdgCode` as the primary particle merge key in `external-data.md` §4 JSON
  schema and §4.2 merging rules. Priority chain: `pdgCode` → `(Z, A)` → external-only.
- Rationale: (Z, A) fails for electrons (Z=0, A=0 is ambiguous); PDG code 11
  unambiguously identifies electrons. Also handles aliases: proton = PDG 2212
  regardless of whether the external file calls it "p", "proton", or "H-1".
- Added `pdgCode?: number` to `ParticleEntity` in `06-wasm-api-contract.md` with
  documentation of the ion convention (Z×10000 + A×10 + isomer + 1000000000).
- Added six new validation rules in §6.1: `pdgCode` positive integer, no duplicate
  `pdgCode` within a source, etc.

**Material merge key — ICRU/NIST IDs and atomic numbers:**
- Added `icruId` as primary material merge key (matches libdedx's ICRU material
  numbering directly; e.g., `icruId: 276` = water liquid).
- Added `atomicNumber` for pure elemental targets (Z range 1–118), mutually exclusive
  with `icruId` on the same entry. Priority chain: `icruId` → `atomicNumber` →
  exact name match → external-only.
- Added `atomicNumber?: number` to `MaterialEntity` in `06-wasm-api-contract.md`.
- Validation: `icruId` positive integer; `atomicNumber` 1–118; no duplicate
  `icruId`/`atomicNumber` within a source; `icruId` and `atomicNumber` mutually
  exclusive on a single material entry.

**Size limits raised:**
- Particles per source: 200 → 1000.
- Materials per source: 1000 → 10000.
- Max data rows (Parquet row groups): 50,000 → 1,000,000.
- Max file size: 100 MB → 1 GB (rationale: Range Requests; full file is never downloaded).

**Interpolation (§8.2 and §13):**
- Resolved open question Q2: log-log interpolation is fixed for v1 external data;
  no per-dataset override.
- Added note: a future configurable toggle (covering both WASM `InterpolationMode`
  and JS external-data interpolation) should be specified in `advanced-options.md`.
  Mixing interpolation modes within one plot would produce scientifically invalid
  comparisons, so the toggle must be global.

**Offline support (§13 Q4):**
- Resolved: URL-only. No local file system access (`<input type="file">`) in Stage 1.

### Prompt 4: Share button specification
**AI response**: Extended `shareable-urls.md` (Draft v5 → Final v6):

- Renamed "social sharing" → "sharing via communicators" throughout (§1.1, §1.2,
  §8.3) to reflect scientific usage context (email, Slack, Teams, Mattermost).
- Added §8.4 Share Button:
  - **Placement**: upper-right corner, both Calculator and Plot pages.
  - **Three states**: Ready (default, "Copy link" label) → Copied (success color,
    "Copied" label, ~2 s auto-revert) → Updated ("Copy updated link", triggered when
    URL changes while button is in Copied state).
  - **Clipboard interaction**: Clipboard API first; `execCommand` fallback; inline
    "Press Ctrl+C" tooltip as last resort. No popup at any failure level.
  - **Discrete URL-change notification**: State transition Copied → Updated is
    strictly inline on the button. No toast, no modal, no banner. The transition
    only fires when the user has already copied (i.e., only the previously copied URL
    is stale). No notification if user has not yet copied.
  - **Accessibility**: `aria-label` per state; `aria-live="polite"` for screen readers.
- Added six acceptance criteria for the Share button in §12.

### Prompt 5: Mark all new specs Final
**AI response**: Changed status from Draft to Final in:
- `shareable-urls.md` → Final v6
- `shareable-urls-formal.md` → Final v3
- `external-data.md` → Final v4
Updated `docs/04-feature-specs/README.md` status table accordingly.
Created this AI log and updated `CHANGELOG-AI.md` and `docs/ai-logs/README.md`.

---

## Tasks

### shareable-urls-formal.md Draft v2 → Draft v3 (ABNF + canonicalization overhaul)
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls-formal.md`
  - `docs/04-feature-specs/shareable-urls.md`
  - `docs/04-feature-specs/external-data.md`
- **Decision**: `entity-id = int-pos / ext-ref` introduced so that `series`, `programs`,
  and `hidden_programs` can all reference external entities via `ext:{label}:{id}`.
- **Decision**: `url-value` charset excludes `:` — the first literal `:` in `extdata=`
  value is the unambiguous label/URL separator.
- **Decision**: Canonicalization specifies exactly one program param per mode (never
  both `program` and `programs`); advanced-mode sub-order is fixed.
- **Issue**: None.

### external-data.md Draft v3 → Draft v4 (PDG codes, ICRU IDs, size limits)
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications (implementation deferred)
- **Files changed**:
  - `docs/04-feature-specs/external-data.md`
  - `docs/06-wasm-api-contract.md`
- **Decision**: PDG Monte Carlo code is the primary particle merge key (replaces
  name-only matching for proton aliases; cleanly handles electrons via PDG 11 where
  (Z=0, A=0) is ambiguous).
- **Decision**: `icruId` is the primary material merge key for standard ICRU/NIST
  materials; `atomicNumber` is the structured key for pure elemental targets.
  Both are mutually exclusive on a single entry. Exact-name fallback retained for
  non-standard compounds.
- **Decision**: File size limit raised to 1 GB — justification is Range Requests
  (hyparquet only fetches the row groups needed; full file never downloaded).
- **Decision**: Interpolation is log-log fixed in v1; global configurable toggle
  deferred to `advanced-options.md` to keep WASM and external-data modes in sync.
- **Decision**: External data is URL-only (no local file upload) in Stage 1.
- **Issue**: Q1 (material name matching for non-ICRU compounds) and Q3 (CSDA range
  from stopping power integration) remain intentionally deferred as open questions.

### shareable-urls.md Draft v5 → Final v6 (Share button)
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md`
- **Decision**: Three-state button model (Ready / Copied / Updated) handles the
  "stale copy" case inline on the button without any popup or toast.
- **Decision**: Updated state only fires when user has already copied; no notification
  for state changes the user hasn't acted on.
- **Issue**: None.

### Finalize all new specs
- **Status**: completed
- **Stage**: Stage 1 — Requirements & Specifications
- **Files changed**:
  - `docs/04-feature-specs/shareable-urls.md` (Final v6)
  - `docs/04-feature-specs/shareable-urls-formal.md` (Final v3)
  - `docs/04-feature-specs/external-data.md` (Final v4)
  - `docs/04-feature-specs/README.md`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/README.md`
  - `docs/ai-logs/2026-04-09-shareable-urls-external-data.md`
- **Decision**: `external-data.md` is a "Later-Stage Spec" (implementation deferred)
  but the spec itself is complete and marked Final. Remaining open questions (Q1, Q3)
  are explicitly labeled as intentionally deferred.
- **Issue**: None.
