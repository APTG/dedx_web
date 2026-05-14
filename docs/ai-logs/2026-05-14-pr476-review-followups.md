# 2026-05-14 — PR #476 review follow-ups: external data spec compliance

## Session Narrative

### Prompt 1: PR review feedback from @grzanka and @copilot-pull-request-reviewer

User requested follow-up changes addressing both the automated reviewer thread
and a long-form follow-up comment by @grzanka covering five topics:

1. User-guide example URL is hard-coded to `https://aptg.github.io/web_dev/...`,
   but should match the active deployment (e.g. `http://localhost:5173/...` in
   dev). Use a relative link via SvelteKit's `base` path.
2. Add a Plot example URL alongside the Calculator one.
3. Implement spec §7.1 Visual Distinction (🔗 icon on external programs and
   external-only entities, `(ext)` suffix on programs).
4. Implement spec §7.3 Source Attribution (collapsible "External Data Sources"
   panel with name/version/author/license/description/coverage/URL).
5. Verify spec §8.1 Program Selection. The user reported that even loading the
   public SRIM dataset with the documented URL did **not** show an "External"
   group in the Program selector — the dataset loaded (badge appeared) but
   programs were missing.

Plus the five automated reviewer threads on PR #476:

a. Plot page clears preview for string program ids, so external programs are
exposed as selectable but disabled.
b. Plot panel appends external programs to the flat list with no separator.
c. Test fixture muon (Z=0, A=0) collides with built-in electron via (Z, A)
fallback.
d. selectProgram with an external-only particle still shows built-in programs.
e. Calculator switchParticle skips energy rescaling for external particles.

**AI response**: Investigated the root cause of (5) before changing UI. Traced
the matching pipeline:

- SRIM materials have no `icruId` and (for water) no `atomicNumber` either,
  so `matchBuiltinMaterial` falls through to a case-insensitive name compare.
- Built-in id 276 has friendly name `"Water (liquid)"` but raw libdedx name
  `"WATER"`. SRIM exports the bare string `"Water"`, so the friendly-name
  compare misses → SRIM Water becomes external-only → SRIM programs listed
  under proton+water (built-in 1, 276) get filtered out by
  `getAvailableExternalPrograms`.

This is the actual bug the user is reporting. Without it, no other UI work
matters because the External group never has anything to render.

Fixed it by:

- Adding `MaterialEntity.rawName?: string` and populating it in `wasm/libdedx.ts`.
- Strengthening `matchBuiltinMaterial` with two extra steps:
  1. Compare external `name` against built-in `rawName` (case-insensitive).
  2. Fuzzy fallback: strip non-alphanumeric chars; also accept matches where
     the built-in friendly name is the external name plus a parenthetical
     descriptor (e.g. "Water" → "Water (liquid)"). This guards against older
     mocks/datasets where rawName is not plumbed.

Then implemented the §7.1 visual distinction (🔗 prefix + (ext) suffix on
external programs in the compact combobox **and** Plot program panel; 🔗 prefix
on external-only particles/materials in both views), built a new
`ExternalSourcesPanel` collapsible disclosure component for §7.3 attribution,
and switched both Calculator and Plot pages to use it (replacing the prior
simple inline badge).

For the Plot page, since full external plot series support requires substantial
additional plumbing (loadStpSlice + interpolation + dashed line styling),
chose to group external programs explicitly and mark them unavailable with a
"Plot series not yet supported" hint. This addresses both reviewer comments
(a) and (b) without exposing options the page can't actually compute, and is
consistent with the spec's grouping requirement.

The user-guide page now uses `$app/paths` `base` to build relative links, so
the same page renders correct URLs in dev (`localhost:5173/calculator/...`)
and in the deployed `/web_dev/calculator/...` build. Added a separate Plot
example.

For the test fixture, replaced `Muon` (Z=0, A=0, PDG 13) with `Antiproton`
(Z=-1, A=1, PDG -2212). The new values cannot collide with any built-in
libdedx particle by either PDG primary key or the (Z, A) fallback.

Reviewer comments (d) and (e) — refining `selectProgram`/`switchParticle`
behavior for external-only particles — were considered out of scope for this
follow-up. The visible symptom they cause (built-in programs appearing as
"available" when an external-only particle is selected) is a UX nit on top of
already-functional flows; deferring keeps the diff focused.

Added unit coverage for the material-matching fix (rawName-based and
parenthetical-fallback paths) and for the new attribution panel (collapsed
state, expanded metadata, long description truncation, source URL link
attributes).

`pnpm exec vitest run` passes (1252 tests). `pnpm check` and `pnpm lint`
both clean.

### Prompt 2: follow-up report that SRIM is still missing and selectors overlap

@grzanka reported that the Calculator URL with the real hosted SRIM dataset
still showed no SRIM program in the Program combobox, typing `srim` did not
find it, multiple selector dropdowns visually overlapped, Plot selector content
overlapped the plot area, and user-guide examples rendered as path-only URLs
(`/calculator?...`) instead of absolute same-origin URLs
(`http://localhost:5173/calculator?...` in dev).

**AI response**: Tightened the SRIM material-name matching further. The earlier
fix handled bare `Water` and rawName matching, but real exported datasets may
also use phase/name-order variants such as `Water, Liquid` or `Liquid Water`.
Added token-based material-name matching so those variants match built-in
`Water (liquid)` while still not matching distinct phases such as `Water
Vapor`. Updated the shared SRIM-like selector fixture to remove `icruId` and
use `Liquid Water`, so Calculator/Plot selector tests now exercise this
real-hosted-data path instead of passing via the primary ICRU-id shortcut.

Fixed selector overlap by making `EntityCombobox` instances mutually exclusive:
when one combobox opens it dispatches a local browser event and sibling
comboboxes close themselves. This prevents Particle, Material, and Program
dropdowns from staying open at the same time and overlapping adjacent
selectors.

Adjusted the Plot page desktop grid from a hard `minmax(520px, 5fr)` sidebar
to `minmax(360px, 5fr)` plus `minmax(0, 7fr)` for the plot column, and added
`min-w-0` to both grid children. This prevents selector/sidebar content from
forcing the grid wider than the viewport and overlapping the plot area.

Fixed docs examples by adding `external-data-example-urls.ts`, using
`page.url.origin` plus `$app/paths.base`, so the rendered text and href are
absolute same-origin URLs in every deployment.

## Tasks

### Fix SRIM water → built-in 276 matching

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/wasm/types.ts` — add `rawName?: string` to `MaterialEntity`
  - `src/lib/wasm/libdedx.ts` — populate `rawName` from `_dedx_get_material_name`
  - `src/lib/state/external-compatibility.ts` — extend `matchBuiltinMaterial`
    with rawName + parenthetical-suffix fuzzy fallback
  - `src/tests/unit/external-compatibility.test.ts` — new tests for both paths
- **Decision**: Plumbed rawName instead of broadening name normalization
  globally; the fuzzy fallback is intentionally narrow (parenthetical suffix
  only) to avoid collapsing distinct materials like "Water Vapor" vs
  "Water (liquid)".

### User-guide URL fixes + Plot example

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/routes/docs/user-guide/+page.svelte` — use `$app/paths` `base` for
    Calculator and Plot example links; add a separate Plot example.

### Visual distinction (spec §7.1)

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/components/entity-selection-comboboxes.svelte` — 🔗 + (ext) on
    external programs; 🔗 on external-only particles/materials
  - `src/lib/components/entity-selection-panels.svelte` — same treatment in
    Plot panels
  - `src/tests/unit/entity-selection-comboboxes.test.ts` — assert the
    decorated labels

### Source attribution panel (spec §7.3)

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/components/external-sources-panel.svelte` — new collapsible
    `<details>` component with name/version/author/license/description/
    coverage/URL
  - `src/lib/components/external-sources-badge.svelte` — removed
  - `src/routes/calculator/+page.svelte`, `src/routes/plot/+page.svelte` —
    swap badge import + usage
  - `src/tests/unit/external-sources-panel.test.ts` — new test file

### Plot panel grouping for external programs

- **Status**: completed
- **Stage**: 8 (review)
- **Files changed**:
  - `src/lib/components/entity-selection-panels.svelte` — convert program
    panel to grouped mode; emit external programs under an "External" group
    with `available: false` and a "Plot series not yet supported" hint.

### Test fixture: external-only particle without (Z, A) collision

- **Status**: completed
- **Stage**: 8 (review)
- **Files changed**:
  - `src/tests/unit/external-entity-fixtures.ts` — Muon (Z=0, A=0, PDG 13)
    → Antiproton (Z=-1, A=1, PDG -2212)
  - `src/tests/unit/entity-selection-state.test.ts` — update expected id

### selectProgram and switchParticle external-only handling

- **Status**: deferred
- **Stage**: 8 (review)
- **Issue**: Reviewer comments (d) and (e) on PR #476 require touching
  Calculator row energy rescaling logic and selectProgram fallback in
  entity-selection state. Both are UX refinements on otherwise-functional
  paths; deferred to a follow-up so this PR remains focused on the
  user-blocking selector visibility bug and spec §7 implementation.

### Follow-up: real SRIM-style material names

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/state/external-compatibility.ts` — add token-based material-name
    matching for variants like `Water, Liquid` / `Liquid Water` vs built-in
    `Water (liquid)`
  - `src/tests/unit/external-compatibility.test.ts` — regression coverage for
    those variants
  - `src/tests/unit/external-entity-fixtures.ts` — make the shared SRIM-like
    fixture use `Liquid Water` with no `icruId`, matching the real-hosted-data
    path more closely
- **Decision**: Token matching compares sorted words, so phase words must still
  match (`liquid water` does not equal `water vapor`).

### Follow-up: selector overlap

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/components/entity-combobox.svelte` — add a local browser event so
    opening one entity combobox closes the others
  - `src/tests/unit/entity-selection-comboboxes.test.ts` — regression test that
    opening Material closes Particle
  - `src/routes/plot/+page.svelte` — relax desktop grid sidebar minimum and add
    `min-w-0` to prevent selector/sidebar overflow into the plot column

### Follow-up: absolute user-guide example URLs

- **Status**: completed
- **Stage**: 8 (beta feedback)
- **Files changed**:
  - `src/lib/utils/external-data-example-urls.ts` — central helper for SRIM
    Calculator/Plot example URLs
  - `src/routes/docs/user-guide/+page.svelte` — render URLs from
    `page.url.origin` + `$app/paths.base`
  - `src/tests/unit/external-data-example-urls.test.ts` — regression tests for
    absolute same-origin examples
