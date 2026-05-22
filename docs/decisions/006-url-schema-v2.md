# ADR 006 — URL Schema v2: param renames, `hidden=` removal, `qfocus=` → `qshow=`

**Status:** Accepted (2026-05-22)

**Context:** Calculator-table redesign (#526). The redesigned table removes the
Columns dropdown and replaces the three-state quantity-focus toggle with a
two-state one. Several existing URL params are renamed for clarity. These
changes require a major `urlv` bump and explicit migration rules.

---

## Decision

Adopt the v2 URL schema described in `docs/04-feature-specs/url-schema.md`
for the Calculator route.  The three key decisions that need justification here
are:

1. **Drop `hidden=` / `hidden_programs=`**
2. **Replace `qfocus=stp|csda|both` with `qshow=stp|range`**
3. **Rename `particle=` → `particleId=`, `material=` → `materialId=`,
   `program=` → `programId=`**

---

## Rationale

### 1. Drop `hidden=` / `hidden_programs=`

**Problem:** In v1, `hidden_programs=` stored the set of program columns the
user had manually hidden via the Columns dropdown. The redesign removes the
Columns dropdown entirely: column membership = entity selection in the picker.
A deselected entity is simply absent from the URL.

**Why not keep it for backward compatibility?** Restoring hidden columns would
require re-adding the hidden-column concept to the new table implementation,
which contradicts the goal of the redesign. Silently dropping it is safe: a
loaded v1 URL will show all selected columns (no columns hidden). The user
can deselect programs in the picker if they want fewer columns.

**Migration:** `hidden=` and `hidden_programs=` are silently dropped on read.
No warning shown; no data loss (column selection is easily reproduced via
the picker).

### 2. Replace `qfocus=stp|csda|both` → `qshow=stp|range`

**Problem:** The old `qfocus=` three-state toggle (`stp`, `csda`, `both`)
mapped to "show stopping power only", "show CSDA range only", or "show both".
The redesign simplifies this to a two-button segmented control (Stopping Power
/ CSDA Range), with "both" removed as a user-selectable UI state. CSV export
always includes both quantities regardless of the on-screen toggle.

**Why `stp|range` instead of `stp|csda`?**

- The user-facing label is "CSDA Range", shortened as "Range" in the UI.
  Using `csda` as the URL token when the UI says "Range" creates a
  learnability gap (users who look at URLs shouldn't need to know that CSDA
  stands for Continuous Slowing-Down Approximation to understand what the param does).
- `range` is shorter and maps directly to the visible button label.

**Why omit `qshow=` when both are visible (vs. v1's always-emit policy)?**

- In v1, `qfocus=both` was always emitted in advanced mode for canonical
  consistency. In v2, the default state (both quantities visible) is
  represented by the absence of `qshow=`. This keeps shared URLs shorter
  and aligns with the general principle: default values are omitted.
- The parser treats the absent `qshow=` param as "show both" — this is
  unambiguous and forward-compatible.

**Migration rules:**
- `qfocus=stp` → `qshow=stp`
- `qfocus=csda` → `qshow=range`
- `qfocus=both` → omit `qshow=` (both visible, default)

### 3. Rename `particle=` → `particleId=`, `material=` → `materialId=`, `program=` → `programId=`

**Problem:** The param names `particle`, `material`, `program` are ambiguous
when reading raw URL query strings: it is unclear whether the value is a
numeric ID, a slug, or a name. The `Id` suffix makes the semantics explicit
to developers inspecting URLs.

**Alternatives considered:**

| Option | Rejected because |
|---|---|
| Keep old names | No clarity gain; misses the opportunity of the v2 bump |
| Use slugs (`particle=proton`) | Would require a slug registry and make URLs fragile across libdedx versions where entity names can change |
| Use `p=`, `m=`, `prog=` abbreviations | Too cryptic; worse than the original names |

**Migration:** Both old (`particle=`) and new (`particleId=`) param names are
accepted on read. Only the new names are emitted in canonical v2 output.
Old URLs continue to load correctly through the v1→v2 migration path.

---

## Consequences

**Positive:**
- Cleaner two-state `qshow=` toggle that matches the UI labels.
- Shorter canonical URLs (no `qshow=` when both visible, no `hidden_programs=`).
- URL params now unambiguously communicate numeric IDs.
- `mode=forward|range|inverse-stp` clarifies calculator operation vs
  `imode=csda|stp` which required knowing what "imode" meant.

**Negative / trade-offs:**
- Old bookmarked URLs with `qfocus=csda` will silently migrate to `qshow=range`
  — the meaning is preserved but the URL changes on first load.
- Old URLs with `hidden_programs=2` will load with all columns visible —
  acceptable data loss given the Columns dropdown is removed.
- A `urlv` bump to `2` is required; the version-mismatch warning UI (from
  `shareable-urls.md` §8.2.2) must be implemented to handle URLs from
  hypothetical future versions.

---

## Alternatives Considered

### Keep `urlv=1` and add the new params as extensions

Rejected: the param renames (`particle=` → `particleId=`) and the `qfocus=`
value-set change (3 values → 2 values with different names) are semantically
breaking. Keeping `urlv=1` would mean the old parser would silently misinterpret
`programId=9` as an unknown param and fall back to `programId=null` (auto-select).
A version bump + explicit migration is safer.

### Use a single `qshow=both|stp|range` (keep "both" state)

Rejected: the redesign explicitly removes the "both-columns simultaneously"
toggle from the UI. The on-screen segmented control has exactly two buttons
(`[Stopping Power] [CSDA Range]`). Adding a third URL-only `both` value with
no UI counterpart would be confusing. CSV export always includes both, so the
"both" use-case is covered without needing a URL param.

---

## References

- `docs/04-feature-specs/url-schema.md` — canonical v2 schema
- `shareable-urls.md` — v1 baseline and backward-compat rules
- `shareable-urls-formal.md` — ABNF grammar (to be updated after #561)
- Issue #526 (master epic), #554 (this design doc), #561 (Columns dropdown removal + `qshow=`)
