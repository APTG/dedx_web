# ADR 012 — Inverse STP: Sticky High-E Default

**Status:** Accepted (2026-05-24)

**Context:** Calculator-table redesign (#526 / #560). The inverse stopping
power (STP→) lookup computes the energy E that produces a given stopping
power value. Because the Bragg curve is non-monotonic, there are up to
**two solutions**: a low-energy branch (rising side of the Bragg peak) and
a high-energy branch (falling side). The question is how to present these
to the user.

The two obvious options are:

1. **Show both branches always** — two columns, always visible.
2. **Show one branch as the default, reveal the other on demand.**

---

## Decision

Show the **high-energy branch** (falling side) by default. The low-energy
branch column is **sticky**: it reveals with a one-time amber tint when any
row returns two solutions, and auto-collapses when all rows return to single-
solution.

The `?istpbranch=both` URL parameter pre-opens the second column without the
amber tint (restoring a saved state).

---

## Rationale

### High-E default matches the common use case

Most practical inverse-STP queries come from medical physics: given a measured
dose profile, what beam energy corresponds to a plateau dose? The plateau is on
the high-energy side of the Bragg peak. The high-energy branch is the default
answer the user expects.

The low-energy branch (rising side, close to the Bragg peak) is less commonly
needed and its existence may surprise users who are unaware that the STP
function is non-monotonic.

### Sticky reveal avoids information overload

Showing both columns immediately confronts users with a confusing pair of
values even when their query has a unique solution (the common case for
high-energy inputs far above the Bragg peak). The sticky-reveal pattern:

1. Does not show the second column until the data demands it.
2. Uses an amber tint to signal that something new appeared.
3. Auto-hides the second column when the ambiguity resolves (all single-
   solution rows), so the table returns to its minimal form without user
   action.

### URL round-trip

The `?istpbranch=both` parameter allows sharing a URL with both columns open.
On load, the second column opens without the amber tint (the user intentionally
shared this view). The `auto_collapse` timer logic is skipped on URL-restore.

---

## Consequences

- `table-inverse-stp.svelte` implements the sticky-reveal logic.
- `src/lib/utils/inverse-stp.ts` defines `HIGH_E_SIDE`, `LOW_E_SIDE`
  constants and `StpBranchState` type.
- `calculator-url.ts` encodes/decodes `istpbranch=both`.
- The plot page wires `inv_stp_branch=both` detection to render two legend
  entries per entity for the inverse-STP series.
- `inverse-lookups.md` is updated to document this behaviour.

---

## References

- `docs/04-feature-specs/inverse-lookups.md` — inverse lookup spec
- `src/lib/components/calculator/table-inverse-stp.svelte`
- `src/lib/utils/inverse-stp.ts`
- Issue #560 — inverse STP table (high-E default, sticky low-E reveal, 2-series plot)
