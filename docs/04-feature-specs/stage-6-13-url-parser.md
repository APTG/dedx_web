# Feature: Formal URL Parser (Stage 6.13)

> **Status:** Draft v1 (2026-05-06)
>
> **Formal grammar:** [`shareable-urls-formal.md`](shareable-urls-formal.md) Final v6
> (ABNF, semantic rules, canonicalization algorithm, 21 conformance vectors)
>
> **UX behavior (warnings/messages):** [`shareable-urls.md`](shareable-urls.md) Final v6
> wins where specs conflict.
>
> **Related specs:**
>
> - [`custom-compounds.md`](custom-compounds.md) — `material=custom` + `mat_*`
>   params (required: 6.10 must be complete before 6.13)
> - [`inverse-lookups.md`](inverse-lookups.md) — `imode` / `ivalues` / `iunit`
> - URL codec contract tests:
>   [`src/tests/contracts/url-codec.contract.test.ts`](../../src/tests/contracts/url-codec.contract.test.ts)

---

<!--
  Stage 6.13 upgrades the existing URL codec (calculator-url.ts / plot-url.ts)
  to full ABNF conformance. The three implementation deltas over the current
  state are:

    1. urlv major-version negotiation + user warning banner
    2. material=custom + mat_* params (step 9 canonicalization)
    3. Parse-pipeline contract: duplicate resolution, unknown-param drop,
       canonicalization step ordering (steps 1–14 in formal spec §3.1)

  This spec does NOT cover:
    - extdata= external data (Zarr v3 .webdedx) — deferred to Stage 7
    - ext-ref entity grammar — deferred to Stage 7

  Dependency: 6.10 (Custom Compounds) must be merged before 6.13 is handed
  to the implementer, because the custom compound URL codec depends on the
  CustomCompound type and mat_* serialization logic introduced in 6.10.
-->

---

## Goal & User Story

**As a** researcher who receives a URL link shared from a future version of
the dEdx Web app (one with a higher `urlv` major version),
**I want to** see a clear warning rather than a silent misparse,
**so that** I know the link may not work correctly and can choose to load the
defaults or attempt a migration.

**As a** researcher who defines a custom compound and clicks Share URL,
**I want to** send that URL to a colleague and have them see the exact same
custom compound and calculation,
**so that** collaborative work with non-standard materials is reproducible.

**As a** developer,
**I want to** the URL encode/decode to follow a deterministic step ordering
(steps 1–14 per `shareable-urls-formal.md` §3.1) with duplicate resolution,
unknown-param dropping, and canonical output,
**so that** URL round-trips are stable and do not produce spurious history
entries.

---

## Acceptance Scenarios

### Scenario 1: urlv major-version mismatch shows warning banner @smoke

**Given** the user navigates to
`/calculator?urlv=999&particle=1&material=276&energies=100`

**Then**

- DOM: `[data-testid="url-version-warning"]` is visible within 2 s of page load
- The banner text contains the version number `"999"` and includes actionable
  options: `"Load defaults"` (and optionally `"Try migration"`)
- Calculation is **blocked** (DOM: `[data-testid="result-table"]` shows no
  numeric results — only the empty state or a blocked message)

**When** the user clicks "Load defaults" in the banner

**Then**

- DOM: `[data-testid="url-version-warning"]` is no longer visible
- The calculator loads with default selection (Proton / Water / Auto-select)
- Calculation fires and `[data-testid="stp-cell-0"]` shows a numeric value

```typescript
test("urlv mismatch: warning banner blocks calculation, load-defaults works @smoke", async ({ page }) => {
  await page.goto("/calculator?urlv=999&particle=1&material=276&energies=100");

  const banner = page.locator('[data-testid="url-version-warning"]');
  await expect(banner).toBeVisible({ timeout: 5000 });
  await expect(banner).toContainText("999");

  // Calculation must be blocked
  const stpCell = page.locator('[data-testid="stp-cell-0"]');
  const text = await stpCell.textContent();
  expect(parseFloat(text ?? "NaN")).toBeNaN(); // not a number (empty or dash)

  // Load defaults
  await page.click('[data-testid="url-version-warning-load-defaults"]');
  await expect(banner).not.toBeVisible({ timeout: 3000 });
  await expect
    .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), { timeout: 8000 })
    .toBeGreaterThan(0);
});
```

---

### Scenario 2: urlv=1 (current version) — no warning, normal parse @regression

**Given** the user navigates to
`/calculator?urlv=1&particle=1&material=276&energies=100&eunit=MeV`

**Then**

- DOM: `[data-testid="url-version-warning"]` is **not** visible
- Calculation fires normally

---

### Scenario 3: Missing urlv — assumed version 1, no warning @regression

**Given** the user navigates to `/calculator?particle=1&material=276&energies=100`
(no `urlv` parameter)

**Then**

- DOM: `[data-testid="url-version-warning"]` is **not** visible
- Calculation fires normally (assumed `urlv=1`)

---

### Scenario 4: Custom compound URL round-trip @smoke

**Given** the user is on `/calculator` in advanced mode with a custom compound
"LiF-test" (Li Z=3, F Z=9, density 2.64 g/cm³) active

**When** the user copies the Share URL from the toolbar (URL sync has fired)

**Then**

- The URL contains:
  - `material=custom`
  - `mat_name=LiF-test`
  - `mat_density=2.64`
  - `mat_elements=3%3A1%2C9%3A1` (URL-encoded `3:1,9:1` — ascending Z order)
  - `urlv=1`

**When** the user opens that URL in a new browser tab where "LiF-test" is
**not** in localStorage

**Then**

- DOM: `[data-testid="compound-from-url-banner"]` is visible (from 6.10)
- Calculation fires with the LiF compound values
- `[data-testid="result-table"]` shows non-empty stopping-power results

```typescript
test("custom compound URL round-trip: mat_* params restore compound @smoke", async ({ page }) => {
  const url =
    "/calculator?urlv=1&particle=1&material=custom&mat_name=LiF-test" +
    "&mat_density=2.64&mat_elements=3%3A1%2C9%3A1&mode=advanced&program=auto&energies=100";

  await page.goto(url);
  await expect(page.locator('[data-testid="compound-from-url-banner"]')).toBeVisible({ timeout: 5000 });
  await expect
    .poll(async () => parseFloat((await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? ""), { timeout: 10000 })
    .toBeGreaterThan(0);
});
```

---

### Scenario 5: Canonicalization — duplicate params use last value @regression

**Given** the user navigates to
`/calculator?particle=1&particle=2&material=276&energies=100`
(duplicate `particle` param)

**Then**

- The calculator uses `particle=2` (the last occurrence, per §3.2)
- The canonical URL in the address bar contains `particle=2` once only (no
  duplicate)

---

### Scenario 6: Unknown params are dropped from canonical URL @regression

**Given** the user navigates to
`/calculator?urlv=1&particle=1&material=276&energies=100&foo=bar&unknown=xyz`

**Then**

- DOM: The canonical URL in the address bar does **not** contain `foo=` or
  `unknown=`
- Calculation fires normally

---

## Reactive Triggers Matrix

URL parsing runs at page load (inside the URL `$effect`). It is not a reactive
input that triggers recalculation — it is the source from which initial state
is derived.

| Input | Calculator | Plot |
| ----- | :--------: | :--: |
| `urlv` version check | ✅ blocking + banner | ✅ blocking + banner |
| `material=custom` + `mat_*` parse | ✅ feeds compound into calculation | ✅ feeds compound into plot series |
| Duplicate param resolution | ✅ parse-time only | ✅ parse-time only |
| Unknown param drop | ✅ at canonicalization | ✅ at canonicalization |

---

## URL Round-Trip Table

### New parameters (stage 6.13 additions)

| Parameter | TypeScript type | Allowed values | Default (omitted) | Encode as |
| --------- | --------------- | -------------- | ----------------- | --------- |
| `urlv` | `number` | Positive integer; currently `1` | `1` (always emitted per canonicalization step 1) | `"1"` |

### Custom compound parameters (from 6.10, formalized in 6.13 step 9)

| Parameter | TypeScript type | Allowed values | Default (omitted) | Encode as |
| --------- | --------------- | -------------- | ----------------- | --------- |
| `material` | `"custom" \| number` | `"custom"` sentinel or numeric ID | — | `"custom"` |
| `mat_name` | `string` | Any string (percent-encoded) | Required when `material=custom` | percent-encoded |
| `mat_density` | `number` | Positive float | Required when `material=custom` | JS number string |
| `mat_elements` | `string` | `Z:count` pairs, comma-separated, ascending Z | Required when `material=custom` | e.g. `"3:1,9:1"` (percent-encoded) |
| `mat_ival` | `number \| undefined` | Positive float or absent | Absent (omitted) | JS number string |
| `mat_phase` | `"gas" \| "condensed" \| undefined` | as listed | Absent (condensed default) | `"gas"` only |

**⚠ Round-trip rule:** The `material` field used in URL encoding acts as a
discriminated union (`"custom"` vs numeric ID). Both branches must be covered
in `url-codec.contract.test.ts`:

```typescript
// Required contract test pattern (add to url-codec.contract.test.ts):
const MATERIAL_URL_ROUNDTRIP = {
  builtin: "276",       // numeric material ID
  custom: "custom",     // custom compound sentinel
} satisfies Record<"builtin" | "custom", string>;
```

---

## Cross-Page Parity Checklist

> URL parsing runs on both Calculator and Plot pages. Both must enforce the
> same version negotiation and `material=custom` handling.

### Pages affected

- [src/routes/calculator/+page.svelte](../../src/routes/calculator/+page.svelte) —
  URL `$effect` extended with `urlv` check and `material=custom` decode.
- [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte) —
  Same: `urlv` check and `material=custom` in series decode.

### Required pillars

| Pillar | Calculator | Plot |
| ------ | ---------- | ---- |
| `urlv` negotiation runs before any state decode | ✅ required | ✅ required |
| Warning banner shown for mismatch (`urlv > CURRENT` or `urlv < MIN`) | ✅ required | ✅ required |
| Calculation blocked until user dismisses mismatch | ✅ required | ✅ required |
| `material=custom` with valid `mat_*` → compound loaded before calc | ✅ required | ✅ required |
| Canonical URL emits `urlv=1` always (step 1) | ✅ required | ✅ required |
| Unknown params dropped from canonical URL (step 3) | ✅ required | ✅ required |
| Duplicate params resolved to last occurrence (§3.2) | ✅ required | ✅ required |

---

## Test Plan

### Unit tests (Vitest)

- `src/tests/unit/url-version.test.ts`
  - [ ] `negotiateVersion(1)` → `{ status: "ok" }`
  - [ ] `negotiateVersion(undefined)` → `{ status: "ok" }` (absent = assumed 1)
  - [ ] `negotiateVersion(999)` → `{ status: "mismatch", version: 999 }`
  - [ ] `negotiateVersion(0)` → `{ status: "mismatch", version: 0 }`

- Extend `src/tests/unit/calculator-url.test.ts`
  - [ ] Encode always emits `urlv=1` as first param
  - [ ] Decode with `material=custom` + valid `mat_*` → `{ materialId: "custom", customCompound: { name, density, elements } }`
  - [ ] Decode with `material=custom` + missing `mat_name` → falls back to default material
  - [ ] Duplicate `particle` param → last value used
  - [ ] Unknown param `foo=bar` → dropped from canonical output

### Contract tests (extend existing)

- `src/tests/contracts/url-codec.contract.test.ts`
  - [ ] Add `material` discriminated-union round-trip (builtin vs `"custom"` sentinel)
  - [ ] Verify `urlv` is always present in encoded output
  - [ ] Verify `mat_elements` Z-ascending order is preserved across encode→decode

- `src/tests/contracts/page-init.contract.test.ts`
  - [ ] Calculator page source contains `negotiateVersion` or equivalent `urlv` check
  - [ ] Plot page source contains same

### E2E tests (Playwright)

- `tests/e2e/url-parser.spec.ts`
  - `@smoke` — `urlv=999` shows warning banner, load-defaults restores calc
    (Scenario 1)
  - `@smoke` — custom compound URL round-trip (Scenario 4)
  - `@regression` — `urlv=1` no warning (Scenario 2)
  - `@regression` — missing `urlv` no warning (Scenario 3)
  - `@regression` — duplicate params use last value (Scenario 5)
  - `@regression` — unknown params dropped (Scenario 6)

---

## Out of Scope / Deferred

- **External data (`extdata=`) parameter** — stubbed in ABNF grammar but wiring
  deferred to Stage 7 alongside `external-data.md` implementation.
- **`ext-ref` entity grammar** — same deferral as `extdata`.
- **Migration chain for `urlv < CURRENT`** — `MIN_SUPPORTED_URL_MAJOR = 1`
  and `CURRENT_URL_MAJOR = 1`; no migration is needed yet. The infrastructure
  for registered migration functions should be scaffolded but left empty.
- **Plot page custom compound in series** — the URL `series=` param encoding
  for custom compounds (`ext:custom:...`) is not yet defined in
  `shareable-urls-formal.md`. Defer until Plot + custom compound interaction
  is fully specified.

---

## Open Questions

- [ ] **`urlv` increment policy** — when should `CURRENT_URL_MAJOR` be bumped?
  Proposal: bump only on a breaking change (param renamed, semantics changed,
  old URL cannot be migrated). Adding new params is non-breaking (unknown
  params are dropped). — @grzanka, due: before shipping 6.13.

---

## Appendix: data-testid Reference

| `data-testid` value | Element | Notes |
| ------------------- | ------- | ----- |
| `url-version-warning` | Version mismatch warning banner | Visible only on major-version mismatch; absent when version matches |
| `url-version-warning-load-defaults` | "Load defaults" button inside the banner | Dismisses banner and resets to defaults |
| `url-version-warning-try-migration` | "Try migration" button inside the banner | Optional; show only when a migration path exists |
