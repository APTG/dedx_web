# ADR 006 — URL Schema v2: `hidden=` removal, `qfocus=` → `qshow=`, `ivalues=` → `lookups=`

**Status:** Accepted (2026-05-22 · revised 2026-05-23)

**Context:** Calculator-table redesign (#526 / #552). The redesigned table
removes the Columns dropdown, replaces the three-state quantity-focus toggle
with a two-state one, keeps the Basic/Advanced picker mode explicit in URLs,
and renames the inverse-lookup input param to remove a naming collision with a
Bethe-Bloch physics quantity. These changes require a `urlv` bump and explicit
migration rules.

**Revision history:**

- Earlier draft also proposed renaming `particle=` → `particleId=` (+ parallel
  renames). Rejected. See §3.
- Later round added the `ivalues=` → `lookups=` rename (§4) after reviewer
  feedback that `ivalues=` reads like a plural of `ival=` / `mat_ival=`
  (the I-value used in the Bethe-Bloch formula) even though the two are
  unrelated.

---

## Decision

Adopt the v2 URL schema described in `docs/04-feature-specs/shareable-urls.md`
for the Calculator route (formal contract: `docs/04-feature-specs/shareable-urls-formal.md`). The four accepted decisions that need justification here
are:

1. **Drop `hidden=` / `hidden_programs=`**
2. **Replace `qfocus=stp|csda|both` with `qshow=stp|range`**
3. **Keep `mode=basic|advanced` for picker mode and use `calc=` for calculator operation**
4. **Rename `ivalues=` to `lookups=`**

A previously-proposed fifth decision — renaming the entity-ID params with
an `Id` suffix — was rejected. See §3.

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

### 3. Rejected — Renaming `particle=` → `particleId=` etc.

An earlier draft proposed renaming the three entity-ID params with an `Id`
suffix to make their semantics (numeric ID) explicit:

- `particle=` → `particleId=`
- `material=` → `materialId=`
- `program=` → `programId=`

**Why this was rejected:**

- **No clear payoff.** The value of these params is always a positive integer
  (or the literal `"auto"` / `"custom"`); the param name `particle=1` is no
  more ambiguous than `particleId=1`. Users who inspect URLs are already
  primed to read the numeric value as an identifier.
- **High link-rot cost.** Every bookmarked URL, every doc example, every test
  fixture, every blog-post / paper supplement / Slack snapshot would either
  break (silent fallback to defaults if v2 only accepted the new name) or
  carry a migration cost (parser must accept both names indefinitely). The
  cost outweighs the readability gain.
- **Already-bumped `urlv` covers the real breaking changes.** The `urlv=2`
  bump is justified by the `qfocus=` value-set change and the removal of
  `hidden_programs=`. Adding three cosmetic renames on top doesn't help
  users and creates a long deprecation tail.
- **Reviewer pushback.** The PR-565 review on the v1 draft of this ADR
  explicitly flagged the rename as unnecessary churn. The decision is to
  keep the v1 names verbatim.

In v2, `particle=`, `material=`, `program=` are emitted unchanged from v1.

### 4. Keep `mode=basic|advanced`; use `calc=` for calculator operation

**Problem:** An intermediate v2 draft reused `mode=` for calculator operation
(`forward|range|inverse-stp`) and inferred Basic/Advanced from `program=` vs
`programs=`. That made `mode=` diverge from the UI's Basic/Advanced switch and
made it impossible to validate plural entity lists independently from picker
mode.

**Decision:** canonical Calculator URLs emit `mode=basic|advanced` explicitly.
The calculator operation uses `calc=forward|range|inverse-stp`. Advanced
comparison lists are separate axis-specific params (`particles=`, `materials=`,
`programs=`), gated by both `mode=advanced` and matching `across=`.

**Why:**

- The URL mirrors the visible Basic/Advanced switch instead of reconstructing it
  from unrelated entity-list params.
- Advanced mode can compare across particles, materials, or programs without
  overloading `programs=` as the only signal.
- The checker has a simple matrix: basic mode accepts singular anchors only;
  advanced mode accepts exactly the plural list selected by `across=`.

### 5. Rename `ivalues=` → `lookups=`

**Problem:** In v1 the inverse-lookup input list (the values the user types
in Range → and STP → modes — typically ranges in cm/mm/μm or stopping
powers in keV/μm) is carried by the URL param `ivalues=`. The `i` prefix
was originally chosen for "inverse". Independently, the I-value (mean
excitation potential) used by the Bethe-Bloch formula is encoded by
`ival=` (advanced options override) and `mat_ival=` (custom compound).
Reading a URL with both `ivalues=…&ival=…` invites the wrong assumption
that `ivalues=` is a plural list of I-values. The two have nothing to do
with each other.

**Decision:** rename `ivalues=` to `lookups=` in v2 canonical output.

**Why `lookups=`?**

- Describes the role: each entry is a value to _look up_ an energy for.
- Self-evident in inverse modes (Range → and STP →) where the input
  column is, semantically, a lookup query.
- Doesn't reuse the `i` prefix (avoids the I-value collision).
- Plural parallels `energies=`, the forward-mode counterpart.

**Alternatives considered and rejected:**

| Option                             | Rejected because                                                 |
| ---------------------------------- | ---------------------------------------------------------------- |
| `inputs=`                          | Too generic; collides with the colloquial sense of "input field" |
| `targets=`                         | Suggests destinations rather than queries                        |
| `invvalues=` / `invals=`           | Still I-adjacent; doesn't fully remove the collision             |
| Keep `ivalues=` and add a doc note | Doc notes don't reach users who read raw URLs                    |

**Migration:** v1 `ivalues=` is accepted on read and silently copied to
`lookups=` (value syntax — number plus optional `:unit` suffix — is
unchanged).

---

## Consequences

**Positive:**

- Cleaner two-state `qshow=` toggle that matches the UI labels.
- Shorter canonical URLs (no `qshow=` when both visible, no `hidden_programs=`).
- `mode=basic|advanced` remains aligned with the visible picker switch, while
  `calc=forward|range|inverse-stp` clarifies calculator operation vs
  `imode=csda|stp` which required knowing what "imode" meant.
- Existing `particle=` / `material=` / `program=` bookmarks continue to round-
  trip exactly without a name change.
- `lookups=` removes the I-value naming collision and makes the URL self-
  documenting in inverse modes (a reader who has never seen the calculator
  can guess what `lookups=10.0:kev-um` means).

**Negative / trade-offs:**

- Old bookmarked URLs with `qfocus=csda` will silently migrate to `qshow=range`
  — the meaning is preserved but the URL changes on first load.
- Old URLs with `hidden_programs=2` will load with all columns visible —
  acceptable data loss given the Columns dropdown is removed.
- A `urlv` bump to `2` is required; the version-mismatch warning UI (from
  `shareable-urls.md` §7.2) must be implemented to handle URLs from
  hypothetical future versions.

---

## Alternatives Considered

### Keep `urlv=1` and add the new params as extensions

Rejected: the `qfocus=` value-set change (3 values → 2 values with different
names) is semantically breaking. Keeping `urlv=1` would mean the old parser
would silently misinterpret `qshow=range` as an unknown param and fall back to
the "both" default. A version bump + explicit migration is safer.

### Use a single `qshow=both|stp|range` (keep "both" state)

Rejected: the redesign explicitly removes the "both-columns simultaneously"
toggle from the UI. The on-screen segmented control has exactly two buttons
(`[Stopping Power] [CSDA Range]`). Adding a third URL-only `both` value with
no UI counterpart would be confusing. CSV export always includes both, so the
"both" use-case is covered without needing a URL param.

---

## References

- `docs/04-feature-specs/shareable-urls.md` — canonical v2 schema + migration rules/UI
- `docs/04-feature-specs/shareable-urls-formal.md` — ABNF grammar + semantic rules + canonicalization
- Issue #552 (master epic), #554 (this design doc), #561 (Columns dropdown removal + `qshow=`)
- PR #565 review (rationale for rejecting the `Id`-suffix rename)
