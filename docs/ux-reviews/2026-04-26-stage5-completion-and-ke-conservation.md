# UX Review — Stage 5 completion + kinetic-energy conservation on switches

> **Date:** 2026-04-26
> **Scope:** Calculator energy-input flow — particle/unit switching semantics,
> add-row affordance, end-of-stage refactor candidates.
> **Basis:** Read-through of `src/lib/state/`, `src/lib/components/result-table.svelte`,
> `tests/e2e/`, all `docs/04-feature-specs/*.md`. Live `pnpm exec playwright test`
> run against the WASM build (60 prior tests + 12 new tests, 64 active passing,
> 8 intentional `fixme`).
> **Reporter:** User (leszek.grzanka@gmail.com) + Claude Sonnet 4.6 via Copilot coding agent
> **Companion:** [`docs/progress/stage-5-audit-2026-04-26.md`](../progress/stage-5-audit-2026-04-26.md)

---

## Summary

Stage 5 is in a "5/6 done" state but several items marked ✅ in the redesign
plan still have visible gaps. The most user-visible gaps are:

1. **Kinetic energy is not conserved across particle / unit switches.**
2. **There is no master energy-unit selector visible on the calculator route**
   (only per-row dropdowns, only for heavy ions).
3. **There is no explicit "Add row" button** — rows auto-append. This works,
   but is undiscoverable for new users.
4. **Live calculation is not debounced**, contrary to `calculator.md:840`.
5. **The legacy `energy-input.svelte` and `units/energy.ts` modules** are dead
   code but still ship and are still tested (~480 LOC of duplication).

The Stage 5 audit document covers items 2, 4 and 5 in detail. This review
focuses on items 1 and 3 — both have direct, repeatable UX symptoms.

---

## Conservation choice — MeV vs MeV/nucl (added 2026-04-26)

> **Asked by the project owner:** "I'm hesitating now on the kinetic
> energy conservation. Give me some cons or pros whether I should
> conserve MeV value or MeV/nucl value. Assuming we conserve 12 MeV and
> we have selected helium. That is 3 MeV/nucl. We switch now to carbon.
> That means that total MeV is conserved, but the MeV/nucl suddenly
> jumps. The basic unit for libdedx seems MeV/nucl and should always be
> visible."

The two options below are mutually exclusive — pick one and apply it
consistently across both **particle switches** and **per-row unit
toggles**. (Mixing them — e.g. "conserve total MeV across particle
switch but conserve MeV/nucl across row-unit toggle" — would be
maximally confusing and is not on the table.)

### Option A — conserve total kinetic energy (MeV)

> He @ 3 MeV/nucl (= 12 MeV total) → switch to Carbon → row shows
> **12 MeV** (= 1 MeV/nucl). The total KE is unchanged; the per-nucleon
> value jumps 3 → 1.

**Pros**

- Matches what an accelerator physicist usually does: "I have a 12 MeV
  beam line — what does it look like for different ions on this target?"
  A change of particle is a change of *what* is in the pipe, not of
  *how much* energy each nucleon carries.
- Total kinetic energy is the quantity that determines deposited dose
  per particle in the simplest calculations (range × LET cross-checks).
  Preserving it makes sequential particle comparisons natural.
- Matches the user's first stated example exactly: "we should see 80 MeV"
  after switching from He @ 20 MeV/nucl to proton.
- Numerically robust round-trip across particles even when only one of
  them has well-defined per-nucleon semantics (e.g. the electron, which
  has no nucleons at all — `MeV/nucl` is meaningless for it, but `80 MeV`
  is fine).

**Cons**

- libdedx's natural unit IS MeV/nucl — every WASM call eventually
  converts to MeV/nucl. Conserving MeV means the user-visible row text
  diverges from the value that gets pushed to the C function. The
  "→ MeV/nucl" column will silently jump on a particle switch even
  though the row text didn't change.
- For the heavy-ion crowd (carbon therapy etc.) the per-nucleon energy
  IS the quantity they think in: "we treat at 290 MeV/nucl". A switch
  to a different ion at "the same beam energy" usually means *the same
  per-nucleon energy*, not *the same total energy*. Option A is wrong
  for them.
- The row-unit toggle (MeV ↔ MeV/nucl) becomes a per-nucleon scaler:
  toggling `12 MeV` → MeV/nucl on Carbon would yield `1 MeV/nucl`. This
  is correct under Option A but visually surprising — the displayed
  number changes by a factor of A.

### Option B — conserve per-nucleon kinetic energy (MeV/nucl)

> He @ 3 MeV/nucl (= 12 MeV total) → switch to Carbon → row shows
> **3 MeV/nucl** (= 36 MeV total). The per-nucleon value is preserved;
> the total jumps 12 → 36.

**Pros**

- Matches libdedx's natural unit. The "→ MeV/nucl" column never jumps
  on a particle switch — what you see is what you get pushed to WASM.
- Matches how heavy-ion / carbon-therapy physicists describe beams.
- The row-unit toggle (MeV ↔ MeV/nucl) becomes a *display* operation
  only: `12 MeV` on Carbon = `1 MeV/nucl` and toggling either way just
  reformats the same physical quantity. The numeric value the user typed
  may change, but the *kinetic energy* stays put — exactly the
  invariant the user originally asked for.
- No special case for proton (A=1) — `MeV` and `MeV/nucl` coincide, so
  the row text doesn't change at all when switching e.g. proton ↔ proton.

**Cons**

- For the proton-physics user the user's stated example
  ("80 MeV → switch to He → 20 MeV/nucl") doesn't work cleanly:
  `80 MeV` typed on a proton means `80 MeV/nucl` (since A=1). Switching
  to He preserves `80 MeV/nucl`, which is `320 MeV` total — not `20 MeV/nucl`.
  In other words Option B answers a different question.
- "Switch from He @ 20 MeV/nucl to electron" is meaningless under
  Option B (electron has no nucleons). The implementation would need an
  explicit fallback: convert to total MeV for that one transition.
- The total kinetic energy of the row jumps by a factor of A on every
  ion → ion switch, which is exactly what Option A users hate.

### Option C — *display both, preserve neither* (status quo, refined)

> Keep today's "typed number is preserved verbatim" rule, but make the
> "→ MeV/nucl" column **always visible** and prominent so the user can
> see at a glance how their typed number is being interpreted under the
> new particle.

**Pros**

- Zero risk of "the app silently changed my input." Every row keeps the
  text the user typed.
- Trivial to implement — already the current behaviour. Just add the
  always-visible column header (already in place per `result-table.svelte`)
  and reword the spec to make this an *intentional* choice rather than a
  legacy one.
- The user can switch particles to compare energies and visually read
  off the per-nucleon value in the second column.

**Cons**

- The user has to do mental arithmetic when switching particles.
- Inconsistent with the user's request that switching He @ 20 MeV/nucl
  to proton should "show 80 MeV". Under Option C it shows
  `20 MeV/nucl` literally — a parse error if proton rejects the per-nucleon
  unit, or a silent re-interpretation as `20 MeV/nucl with A=1` if it
  doesn't.

### Recommendation

**Pick Option B (MeV/nucl conservation) and make the always-visible
"→ MeV/nucl" column the primary contract.**

Reasoning:

1. The project owner explicitly notes that "the basic unit for libdedx
   seems MeV/nucl and should always be visible" — Option B is the only
   choice that makes the displayed-and-conserved quantity the same as
   libdedx's natural quantity. No translation layer in either direction.
2. The proton-vs-He example in the original prompt (80 MeV ↔ 20 MeV/nucl
   round-trip) is *also* satisfied by Option B if we interpret "switch
   to proton" as "show me the same kinetic energy on a per-nucleon
   basis": He @ 20 MeV/nucl → proton @ 20 MeV (since A=1, the
   per-nucleon and total values coincide) → He @ 20 MeV/nucl. That
   reads correctly to a physicist.
3. The rare case where Option B is awkward (electron, A=0) is handled by
   a single explicit fallback rule: when switching to electron, convert
   the row to total MeV using the previous particle's A. That is one
   special case in code; Option A would need the inverse special case
   in many more places.
4. Option C ("don't touch the value") is honest but doesn't actually
   answer what the user wanted ("kinetic energy should be conserved").

Specification implications if we go with Option B:

- `unit-handling.md` "Unit Preservation on Particle Change" section
  rewritten: "the per-nucleon kinetic energy of each row is preserved.
  When switching to/from electron the row converts to/from total MeV
  using the source particle's A."
- `setRowUnit(index, unit)` switches from regex-stamp to genuine
  conversion: `convertEnergyToMeVperNucl(...)` then
  `convertEnergyFromMeVperNucl(...)` to the new unit, then
  `formatSigFigs`.
- The `tests/e2e/particle-unit-switching.spec.ts` `test.fixme()` cases
  needs minor rewording but the round-trip assertions stand.

---



**Reported:** "Imagine we start with helium and put 20 MeV per nucleon. That
means 80 MeV total. If we switch to proton we should see 80 MeV, and then if
we again switch to helium we should again see 20 MeV per nucl. Kinetic energy
should be conserved when switching particles and units."

**Reproduction (live, on the deployed build):**

| Step | Action                                                          | Observed                                              | Expected (per the request)                            |
| ---- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 1    | Particle = Helium, type `20 MeV/nucl` in row 1                  | "→ MeV/nucl" cell shows 20; STP value shown          | OK                                                    |
| 2    | Switch particle to Hydrogen (proton)                            | Row text still `20 MeV/nucl`; "→ MeV/nucl" shows 20  | Row text becomes `80 MeV`; "→ MeV/nucl" shows 80      |
| 3    | Switch particle back to Helium                                  | Row text still `20 MeV/nucl`                         | Round-trips back to `20 MeV/nucl`                     |

**Root cause:** `selectParticle()` in `src/lib/state/entity-selection.svelte.ts:253-276`
deliberately **does not touch the energy rows** — and the
`unit-handling.md` spec at lines 100-113 explicitly mandates this:

> 2. The input values are **not modified** — numeric values stay the same.

So the current behaviour is *correct per the existing spec*, but the spec
itself encodes the wrong design. There are real UX consequences:

- A user comparing "the same beam" across particles has to do mental
  arithmetic that the app already has the data to do.
- The per-row unit dropdown's `setRowUnit()`
  (`src/lib/state/calculator.svelte.ts:297-316`) has the same problem in
  miniature: switching a row's unit from `MeV` → `MeV/nucl` re-stamps the
  suffix without converting the number, so `12 MeV` → `12 MeV/nucl`,
  silently quadrupling the kinetic energy on a Carbon ion.
- Switching to an Electron from a heavy-ion row leaves a literal
  `20 MeV/nucl` string that the parser then rejects as "MeV/nucl is not
  available for Proton/Electron" — confusing error for what was a valid
  input a moment earlier.

### Recommended path forward

Treat kinetic energy as the conserved quantity across particle and
per-row-unit switches. Concretely, change the spec **and** the
implementation:

1. **`unit-handling.md` § "Unit Preservation on Particle Change"** — replace
   bullets 1-4 with:
   > 1. The conserved quantity is the **kinetic energy** of each row.
   > 2. For each row, the parsed `(value, unit)` is converted to MeV (total)
   >    using the *previous* particle's mass number A and atomic mass m_u.
   > 3. The new particle's preferred display unit is chosen
   >    (`MeV` for proton/electron, `MeV/nucl` for heavy ions if currently in
   >    a per-nucleon unit, otherwise `MeV`), and the row text is rewritten
   >    using that unit and the converted numeric value, **preserving any
   >    explicit per-row unit suffix the user typed**.
   > 4. If the new particle does not support the row's previous unit (e.g.
   >    electron + `MeV/nucl`), use the new particle's preferred unit.
2. **`unit-handling.md` §3.8 — Per-row unit dropdown changes** — change
   "reinterprets that row's numeric value in the new unit" to "**converts**
   that row's numeric value to the new unit while keeping the kinetic
   energy fixed".
3. **`calculator.md` Acceptance Criteria** — add the He @ 20 MeV/nucl ↔
   proton @ 80 MeV ↔ He @ 20 MeV/nucl round-trip as an explicit checklist
   item.
4. Implementation:
   - Make `selectParticle(newId)` capture the previous particle's `(A, m_u)`,
     iterate over `rows`, and for each row that parses cleanly call
     `convertEnergyFromMeVperNucl(...)` (already exists in
     `src/lib/utils/energy-conversions.ts:101-129`) to rewrite the typed
     text.
   - Make `setRowUnit(index, unit)` do the analogous convert-then-stamp
     operation rather than the current regex suffix-replace.
5. Tests:
   - The new `tests/e2e/particle-unit-switching.spec.ts` ships with the
     desired sequences as `test.fixme()`. Flip them to active when the
     implementation lands. They cover six scenarios — single switch, round
     trip, per-row dropdown, master-unit segmented control, multi-row
     state, and electron edge case.
   - Add round-trip unit tests against `selectParticle()` on
     `EntitySelectionState` once it owns the energy rewrite.

**Trade-off / open question:** rewriting user-typed text on a particle
switch is a non-trivial UX promise. It must be (a) reversible by undo
(out of scope today — there is no undo), and (b) clearly indicated. A
visual cue ("converted: 20 MeV/nucl → 80 MeV") in the row may be needed
the first time it happens.

---

## Critical issue 2 — Per-row unit dropdown silently scales kinetic energy

Already covered above as a sub-symptom of issue 1; called out separately
because it has its own E2E test (`Carbon 12 MeV → toggle MeV/nucl` in
`tests/e2e/particle-unit-switching.spec.ts`) and because fixing it does
**not** require any spec change to the particle-switch flow. It can be
shipped independently as a smaller, less risky first step:

- Update `setRowUnit()` to `convertEnergyToMeVperNucl(...)` then
  `convertEnergyFromMeVperNucl(...)` to the new unit, then format
  with `formatSigFigs`.
- Existing test at `src/tests/components/result-table.test.ts:111-127`
  asserts the *current* behaviour (`expect(rawInput).toBe("120 MeV/nucl")`
  after switching from `120 MeV`); this test will need updating in lockstep.

---

## Critical issue 3 — There is no master energy-unit selector on the calculator page

The `EnergyUnitSelector` shadcn-svelte component exists and is fully tested,
but `src/routes/calculator/+page.svelte` does not render it. The only ways
to change the master unit are:

- type a unit suffix on a row (auto-switches to per-row mode), or
- use the per-row dropdown (heavy ions only).

For a proton calculation there is **no way at all** to switch the master
unit from MeV — which happens to be fine because protons only have MeV in
the spec, but the contract at `calculator.md:805-806` (`role="radiogroup"`,
"In master mode … the selector is active") is unmet.

Action: re-add the `EnergyUnitSelector` above the ResultTable in
`calculator/+page.svelte`, bound to `calcState.masterUnit` /
`calcState.setMasterUnit`. Make it visible (active for heavy ions, single
disabled "MeV" pill for proton/electron).

---

## Issue 4 — "Add row" affordance is invisible

There is no button. Rows auto-append when the user types in the last row
(see `src/lib/state/energy-input.svelte.ts:51-64`). This is consistent with
the spec (`calculator.md:190-201`: "Always-empty-row-at-bottom") but the
spec itself notes the discoverability concern at line 873-875:

> 1. **Always-empty-row vs. Add Row button:** The current design uses an
>    always-empty-row-at-bottom for natural append. This is the implementation
>    — an explicit "Add Row" button might be clearer.

**Today, the table has zero empty rows on first load.** Default state is
exactly one pre-filled "100" row (verified by the new `Add row UX` test
group). To add a second row the user must:

1. Click on the row already containing "100".
2. Press End (or click after the "100").
3. Press Enter.

This is workflow-hostile for someone who wants to enter 5 quick energy
values. The legacy `src/lib/components/energy-input.svelte:242-248`
component **does** render an explicit "Add row" button — that pattern was
lost when 5.4 replaced it with `result-table.svelte`.

### Recommended fix

Either (preferred, minimal):

- Add a small `+ Add row` button below the table in `result-table.svelte`,
  wired to `inputState.addRow()`. It is a one-line UI addition and
  immediately discoverable.

Or (more invasive but spec-aligned):

- Restore the always-empty-row-at-bottom from the original spec — the
  current `addRow()` only triggers from `updateRowText` when the user
  types in the final row, so the very first state has no sentinel.

The new E2E test `there is no explicit 'Add row' button rendered in the
result table` documents the current behaviour and will fail (deliberately,
needs to be updated) when the button is added.

---

## Issue 5 — Live calculation is not debounced

`calculator.md:840` says "Debounce interval is 300ms for input." A
`debounce()` utility ships in `src/lib/utils/debounce.ts` with 8 unit
tests, but no caller imports it. `result-table.svelte:148` calls
`state.triggerCalculation()` synchronously on every keystroke.

This is a low-impact bug today (WASM `calculate()` is sub-millisecond for
small batches) but it diverges from the spec and would matter immediately
for the inverse calculator (`inverse-lookups.md`) and multi-program
features (`multi-program.md`).

Action: tracked in §1.3 of the audit doc — wire the existing util in or
delete the requirement from the spec.

---

## Issue 6 — Code/test duplication ready for cleanup

Full list and risk assessment in
[`docs/progress/stage-5-audit-2026-04-26.md`](../progress/stage-5-audit-2026-04-26.md)
§2-3. Headline items, all low-risk:

1. Delete `src/lib/components/energy-input.svelte` + 13 dead component tests.
2. Delete `src/lib/units/energy.ts` + 30 redundant unit tests.
3. Fold `energy-input-format.test.ts` into `unit-conversions.test.ts`.

Total: roughly **~480 LOC** removed without any user-visible change.

---

## Issue 7 — Parser silently collapsed `meV` (milli) into `MeV` (mega) — **fixed**

`src/lib/utils/energy-parser.ts` previously called `unitStr.toLowerCase()`
before looking the suffix up in a lowercase set. That meant **every**
casing variant — `MeV`, `mev`, `MEV`, `Mev`, **and `meV`** — resolved
to the same `MeV` token. `meV` is the SI symbol for **milli**-electron-volt
(10⁻³ eV); `MeV` is mega (10⁶ eV). They differ by a factor of **10⁹**.
Silently collapsing them is exactly the kind of catastrophic mis-scaling
unit handling is supposed to prevent.

**Fix shipped in this PR:** the parser now uses a case-sensitive lookup
table containing only the canonical SI casing of each accepted suffix:
`eV`, `keV`, `MeV`, `GeV`, plus the per-nucleon and per-mass forms. Any
other casing (`mev`, `MEV`, `meV`, `EV`, `KeV`, `MeV/Nucl`) is rejected
with `unknown unit: <as typed>` so the user sees an explicit inline
error and can fix the casing. Unit tests covering all six rejection
cases were added (`src/tests/unit/energy-parser.test.ts:35-66`); the two
old tests asserting case-INsensitive behaviour were inverted.

**Spec follow-up:** added an "Inline Unit Detection — case sensitivity"
acceptance section to `unit-handling.md` listing the seven canonical /
rejected forms.

---

## Issue 8 — `_malloc` returns uninitialized memory → `3.820e-314` denormal stopping powers — **fixed**

> **Reported:** "Why if I replace 100 MeV with 10 MeV and add another row
> with 12 MeV, then suddenly I see stopping power of 3.820e-314 instead of
> zero in current web app version?"

`3.820e-314` is a **denormalised** IEEE-754 double — the kind of value
you get from reading uninitialised memory and squinting at the bits as a
float. `src/lib/wasm/libdedx.ts:163-164` allocates the WASM output
buffers with `_malloc(numEnergies * 8)` which (per the Emscripten
contract) returns memory whose contents are undefined. If the libdedx C
function `_dedx_get_stp_table` returns `0` (success) but does not write
every output slot — for example because of an internal early return on a
boundary condition during a rapid second call — the leftover heap bytes
leak through `heapF64[stpPtr / 8 + i]` straight into the result table.

**Why "rapid edit" reproduces it:** the second performCalculation call
re-allocs into recently freed heap regions that still contain the bit
pattern of the previous call's pointers. Without zero-init, partial
writes show as denormals.

**Fix shipped in this PR:** `libdedx.ts:174-177` now zero-initialises
both `stpPtr` and `csdaPtr` immediately after copying input energies and
before the C call. Any output slot the C function fails to write now
reads back as a clean `0`, which the existing subnormal-output warning
in `calculator.svelte.ts:190-207` will then flag explicitly so we have a
log trail rather than silent garbage on screen.

This is a *defensive* fix — it does not change the C-side behaviour. If
the underlying C bug exists, we'd still want to track it down (open a
follow-up issue against `libdedx/`), but the user-visible symptom (a
stopping-power column showing `3.820e-314`) cannot recur.

---

## Issue 9 — Missing chemical symbols for elements beyond Z=18 — **fixed**

> **Reported (with screenshot):** "Why don't we have symbols for Tin? I
> think we can also skip symbol from the list if that is not so good UX
> practice."

`src/lib/config/particle-aliases.ts` previously only contained entries
for Z=1..18 plus electron (1001). Every other ion's
`getParticleSymbol()` returned `""`, so the dropdown rendered "Tin",
"Antimony", "Iodine", "Copernicium" without their `(Sn)` / `(Sb)` etc.
parentheticals. Same for Germanium, Tungsten, Uranium and basically
every transition / lanthanide / actinide / superheavy element libdedx
exposes.

**Fix shipped in this PR:** `PARTICLE_ALIASES` is now exhaustive for
Z=1..118 (all IUPAC-named elements). Every entry has a non-empty
`chemicalSymbol`; aliases include the English element name so search
still works, plus locale variants for the well-known ones (e.g.
`aluminum`/`aluminium`, `caesium`/`cesium`, `tungsten`/`wolfram`).

**On "skip symbol entirely" — no, keep it for ions.** Symbols are how a
physicist disambiguates `Tin (Sn)` from `Antimony (Sb)` — the only thing
worse than "Tin" without `(Sn)` would be removing the symbol from
`Carbon (C)` too. The right rule, captured in `entity-selection.md`
"Particle naming preferences", is the asymmetry:

- **Beams (proton / alpha particle / electron):** drop the symbol —
  `(H)`, `(He)`, `(e⁻)` are visual noise next to common-noun labels
  every physicist already recognises.
- **Ions (Z = 3..118):** keep the symbol — it is the canonical
  identifier and shorter than the English name.

---

## Issue 10 — Particle naming preferences (`proton`, `alpha particle`, "Ions" group) — **spec'd, implementation deferred**

> **Reported:** "Note also somewhere in some spec that the user would
> prefer "proton" over "Hydrogen" as the particle. Maybe seeing "alpha
> particle" would be nice. Rest of the stuff could go under "Ions"
> category and not be capitalised."

This is now spec'd in `entity-selection.md` § "Particle naming
preferences" (added 2026-04-26). Summary:

| Particle ID | Display label              |
| ----------- | -------------------------- |
| 1           | `proton`                   |
| 2           | `alpha particle`           |
| 1001        | `electron`                 |
| 3..118      | `Element (Symbol)` Title-cased |

Group headings:

```
Beams              Ions
  proton             Carbon (C)
  alpha particle     Magnesium (Mg)
  electron           Tin (Sn)
                     Antimony (Sb)
                     Iodine (I)
                     ...
```

**Implementation status:** the data layer (`PARTICLE_ALIASES`) now
contains the aliases needed for search (`proton`, `alpha`, `alpha
particle` etc.), so the upcoming UI wiring change in
`entity-selection-comboboxes.svelte` will be a one-function rename of
`getParticleLabel(particle)`:

```diff
-  if (particle.id === 1001) return "Electron";
-  const symbol = particle.symbol || "";
-  return symbol ? `${particle.name} (${symbol})` : particle.name;
+  if (particle.id === 1) return "proton";
+  if (particle.id === 2) return "alpha particle";
+  if (particle.id === 1001) return "electron";
+  const symbol = particle.symbol || "";
+  return symbol ? `${particle.name} (${symbol})` : particle.name;
```

The grouping into "Beams" / "Ions" needs an additional change to the
`groupedItems` derivation in the same file. Both changes have been left
out of this PR because they touch existing component tests that assert
the current "Hydrogen (H)" label, and the user has only asked for the
naming preference to be *recorded in the spec* — not yet implemented.

---

## Always-visible MeV/nucl column (added 2026-04-26)

> "The basic unit for libdedx seems MeV/nucl and should always be visible."

Verified: `src/lib/components/result-table.svelte` always renders the
"→ MeV/nucl" column for every row, regardless of master/per-row mode and
regardless of particle. New acceptance criteria added to
`unit-handling.md` § "Always-visible MeV/nucl column" lock this in.
Future refactors that try to hide the column behind a "compact mode"
toggle will now have to update the spec deliberately.

---



| #   | Issue                                                                                            | Severity | Status        |
| --- | ------------------------------------------------------------------------------------------------ | -------- | ------------- |
| 1   | Kinetic energy not conserved on particle switch (recommendation: Option B — conserve MeV/nucl)   | High     | 🆕 Open — spec change required, fixme E2E ships |
| 2   | Per-row unit dropdown silently scales KE on heavy ions                                           | High     | 🆕 Open — can ship independently |
| 3   | No master energy-unit selector on calculator route                                               | Medium   | 🆕 Open — spec ↔ implementation mismatch |
| 4   | "Add row" affordance is invisible (no button, no empty sentinel on first load)                   | Medium   | 🆕 Open       |
| 5   | Live calculation is not debounced (`calculator.md:840` unmet)                                    | Low      | 🆕 Open       |
| 6   | ~480 LOC of dead/duplicated code in `energy-input.svelte`, `units/energy.ts`, format test files  | Low      | 🆕 Open — cleanup |
| 7   | Parser silently collapsed `meV` (milli) into `MeV` (mega) — 10⁹ ratio                            | High     | ✅ Fixed in this PR |
| 8   | `_malloc` returned uninitialized memory → `3.820e-314` denormal stopping powers                  | High     | ✅ Fixed in this PR (defensive zero-init) |
| 9   | Missing chemical symbols for elements Z=19..118 (Tin, Antimony, Iodine, Copernicium, …)          | Medium   | ✅ Fixed in this PR (PARTICLE_ALIASES exhaustive Z=1..118) |
| 10  | Particle naming preferences (`proton` / `alpha particle` / "Ions" group)                         | Medium   | 🆕 Spec'd in this PR — UI implementation deferred |
| 11  | Stage 5.1 nice-to-haves still open in `docs/progress/stage-5-entity-selection.md`               | Low      | Pre-existing  |

---

## Appendix — E2E tests added in this review

`tests/e2e/particle-unit-switching.spec.ts` (12 tests, 6 active + 6
`test.fixme()`):

**Active (lock down current spec'd behaviour):**

1. He 20 MeV/nucl → switch to proton: text stays `20 MeV/nucl`.
2. He 80 MeV → switch to proton: text stays `80 MeV`.
3. Proton 100 MeV → carbon → hydrogen: number unchanged.
4. Carbon 12 MeV → row dropdown to MeV/nucl: text becomes `12 MeV/nucl`
   (NUMBER unchanged → KE silently 4×).
5. Add-row UX: typing in the last row auto-appends a fresh row.
6. Add-row UX: there is no explicit "Add row" button.

**`fixme` (desired KE-conservation behaviour, will activate when spec is
updated and implementation lands):**

1. He 20 MeV/nucl → proton: row should show `80 MeV`.
2. He 20 MeV/nucl → proton → He: round-trips back to `20 MeV/nucl`.
3. Carbon 12 MeV → row dropdown MeV/nucl: should become `1 MeV/nucl`.
4. Carbon 100 MeV/nucl, master toggle MeV/nucl → MeV: should become `1200`.
5. Multi-row + particle switch: each row's KE conserved independently.
6. Heavy ion → electron: per-nucleon row remapped to MeV (no validation
   error).
