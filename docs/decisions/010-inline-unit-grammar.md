# ADR 010 — Inline Unit Grammar for Energy Inputs

**Status:** Accepted (2026-05-23)

**Context:** Calculator-table redesign (#526 / #557). The redesigned unified
input/result table allows users to type energy values with inline unit suffixes
(e.g., `100 keV`, `2.5 GeV/nucl`). The parser must decide:

- Which unit tokens to accept.
- How to handle case and whitespace.
- How to handle Unicode units typed by non-ASCII keyboards.

---

## Decision

Implement a **whitespace-tolerant, case-sensitive inline-unit parser** with
ASCII-only input and a 15-token canonical unit set.

Key rules:

1. **ASCII input only.** Users type `um` for µm, `keV/nucl` or `keV/u` for
   keV/nucleon. The parser emits the canonical Unicode symbol (µm) internally.
2. **Canonical SI casing required.** Only canonical tokens (`MeV`, `GeV`,
   `keV`, `eV`, `TeV`, and `/nucl` or `/u` suffixes with canonical case) are
   accepted. Non-canonical casing (`MEV`, `mev`, `MeV/Nucl`) is rejected with
   a validation error and optional "did you mean …?" hint when unambiguous.
3. **Whitespace-tolerant.** `100 MeV`, `100MeV`, `100  MeV` all parse to
   (100, MeV). Leading/trailing whitespace is stripped.
4. **15-token cross-product.** Five SI energy prefixes × three per-nucleon
   suffixes:
   - Prefixes: `eV`, `keV`, `MeV`, `GeV`, `TeV`
   - Suffixes: _(none)_, `/nucl`, `/u`
   - Total: 15 tokens (eV, keV, MeV, GeV, TeV, eV/nucl, keV/nucl, MeV/nucl,
     GeV/nucl, TeV/nucl, eV/u, keV/u, MeV/u, GeV/u, TeV/u)
5. **Unrecognised suffix → validation error.** The row is marked invalid with
   a human-readable message (e.g., "Unrecognised unit 'bebok'").
6. **Per-nucleon units on A=1 particles.** Accepted by the parser but
   flagged as a validation error at the row level, not a parse error.

---

## Rationale

### Why ASCII input only

Physics users work in diverse environments: LaTeX editors, terminal emulators,
spreadsheets, copy-pasted values from papers. The least common denominator is
ASCII. Requiring Unicode entry (e.g., typing µ) creates friction. The
conventional ASCII approximation (`u`, `um`) is well-established in the
physics community.

### Why case-sensitive canonical units

Energy units are scale-sensitive: `MeV` (10⁶ eV) and `meV` (10⁻³ eV) differ by
10⁹. Treating arbitrary casing as equivalent risks silent mis-scaling. Requiring
canonical SI casing makes invalid input explicit and keeps parsing behaviour
aligned with physics conventions.

### Why 15 tokens (not fewer)

The original spec considered only `eV`, `keV`, `MeV`, `MeV/nucl`, `MeV/u`.
Extending to TeV and GeV ensures the parser handles high-energy physics
use cases (accelerator physicists comparing to collider data) without the
user needing to convert to MeV first.

### Whitespace tolerance

Standard copy-paste from numeric tables includes a space between value and
unit (e.g., `100 MeV`). Requiring no space would silently accept `100MeV`
but reject `100 MeV`, which is the more common typed form.

---

## Consequences

- `src/lib/utils/energy-parser.ts` implements the parser with unit tests in
  `src/tests/unit/energy-parser.test.ts`.
- The URL encoding for per-row unit suffixes uses the same 15-token set
  (see `shareable-urls.md` §3.5).
- `unit-handling.md` §3 is the normative reference for per-row unit
  detection rules.
- The `onboarding hint` in `table-basic.svelte` documents the ASCII
  shorthand (`um` for µm, `keV/u` for keV/nucleon).

---

## References

- `docs/04-feature-specs/unit-handling.md` — §3 per-row unit detection
- `docs/04-feature-specs/shareable-urls.md` — §3.5 energy per-row unit suffix tokens
- `src/lib/utils/energy-parser.ts` — parser implementation
- `src/tests/unit/energy-parser.test.ts` — parser unit tests
- Issue #557 — inline-unit parser, Basic mode layout fix, URL v2 `lookups=` rename
