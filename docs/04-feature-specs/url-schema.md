# URL Schema v2 — Canonical Query-Parameter Reference

> **Status:** v1 (2026-05-22) · Canonical design doc for the calculator-table redesign
>
> **Part of:** master epic #526 (calculator-table redesign)
>
> **Blocks:** #555, #556, #557, #558, #559, #560, #561
>
> **Supersedes:** `shareable-urls.md` §3–§5 for calculator-page params;
> `shareable-urls-formal.md` ABNF grammar and canonicalization — those files
> remain authoritative for plot-page and shared entity params until they are
> updated to reference this doc.
>
> **Cross-check rule:** If this file conflicts with `shareable-urls.md` or
> `shareable-urls-formal.md`, this file wins **for the calculator route**. For
> the plot route and shared entity params, the formal contract wins until a
> plot-schema v2 is written.

---

## 1. Why a Separate Schema Doc

The calculator-table redesign (#526) introduces new query params, renames
existing ones, and drops one entirely. Letting each implementation issue (#555–
#561) make ad-hoc URL decisions would produce inconsistency. This document is
the single source of truth that every dependent issue MUST reference.

**Scope of this document:**

- Every query parameter accepted by the Calculator route (`/calculator`).
- Migration rules from the current `master` URL format (v1, `urlv=1`).
- One worked URL example per parameter.
- Explicit coverage of the two highest-risk formats: **inline-unit suffix in row
  values** (`100,10:keV,2:GeV`) and the **inverse-STP branch sticky flag**
  (`istpbranch=hi|lo|both`).

**Out of scope:**

- Plot-route params that don't change (series-strip encoding stays as-is).
- Any actual UI behaviour — those land in #555 onwards.

---

## 2. Schema Delta Table (v1 → v2)

This table is the canonical sign-off for all calculator-route URL changes.
Dependent issues must not deviate from it without updating this doc first.

| Param | v2 Status | Notes |
|---|---|---|
| `urlv=` | **bumped to 2** | Major version bump; triggers migration path on old v1 URLs |
| `particleId=` | **renamed** | Was `particle=` in v1; same semantics |
| `materialId=` | **renamed** | Was `material=` in v1; same semantics (still accepts `"custom"`) |
| `programId=` | **renamed** | Was `program=` in v1 basic mode; same semantics |
| `programs=` | unchanged | Advanced-mode program list; value format unchanged |
| `across=none\|programs\|materials\|particles` | **new URL param** | Was UI state only in v1; now in URL |
| `mode=forward\|range\|inverse-stp` | **new** (replaces `imode=`) | Calculator operation mode; replaces the `imode=csda\|stp` param |
| `hidden=` | **removed** | Silently dropped on read; column visibility now from picker selection |
| `qshow=stp\|range` | **replaces `qfocus=`** | 3-state → 2-state; values renamed (see §6) |
| `uanchor=mev\|mev-nucl\|mev-u` | **new** | Energy unit anchor; replaces `eunit=` in canonical output |
| `runit=nm\|um\|mm\|cm\|m` | **new** | Range unit anchor (Range → mode and CSDA range display) |
| `sunit=kev-um\|mev-cm\|mev-cm2-g` | **new** | STP unit anchor (STP → mode and stopping-power display) |
| `energies=100,10:keV,2:GeV` | **extended** | Inline `:unit` suffix per row; same `:` separator |
| `ivalues=` | **extended** | Same inline `:unit` suffix syntax; used in Range → and STP → modes |
| `istpbranch=hi\|lo\|both` | **new** | Sticky inverse-STP branch column state |
| `tip_seen=inline_unit` | **new (optional)** | Tip-dismissal hint flag; omit unless the user has seen it |

> **Params not listed above** (e.g. `extdata=`, `mat_*`, `agg_state`,
> `interp_scale`, etc.) are unchanged from `shareable-urls-formal.md` v6.

---

## 3. Full Parameter Reference

### 3.1 `urlv` — URL Contract Version

| Attribute | Value |
|---|---|
| Type | Positive integer |
| v2 canonical value | `2` |
| Default if absent | `1` (legacy) |

**v2 behaviour:** The canonicalisation step always emits `urlv=2`. On read, if
`urlv=1` is detected, run the v1→v2 migration chain (§7) before applying
defaults. Unknown future versions trigger the major-mismatch warning from
`shareable-urls.md` §8.2.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100&uanchor=mev
```

---

### 3.2 `particleId` — Particle Identity

| Attribute | Value |
|---|---|
| Type | Positive integer |
| v1 name | `particle=` |
| Default if absent | `1` (proton) |
| Invalid | Fall back to `1` |

Both `particleId=` (v2) and `particle=` (v1, migration input) are accepted on
read; only `particleId=` is emitted in canonical output.

**Worked example:**

```
?urlv=2&particleId=6&materialId=276&programId=auto&energies=10&uanchor=mev-nucl
```

→ Carbon-12 (Z=6) in water at 10 MeV/nucl.

---

### 3.3 `materialId` — Material Identity

| Attribute | Value |
|---|---|
| Type | Positive integer or literal `"custom"` |
| v1 name | `material=` |
| Default if absent | `276` (water liquid) |
| Invalid / incompatible | Fall back to `276` |

`"custom"` sentinel requires `mode=advanced` and valid `mat_*` params; see
`shareable-urls-formal.md` §3.8 for the custom-compound constraint rules
(unchanged in v2).

**Worked example — built-in material:**

```
?urlv=2&particleId=1&materialId=104&programId=auto&energies=100&uanchor=mev
```

→ PMMA (ID 104) as the target material.

**Worked example — custom compound:**

```
?urlv=2&particleId=1&materialId=custom&programs=9&energies=100&uanchor=mev&mode=advanced&qshow=stp&mat_name=PMMA&mat_density=1.2&mat_elements=1:8,6:5,8:2
```

---

### 3.4 `programId` — Program (Basic Mode)

| Attribute | Value |
|---|---|
| Type | Positive integer or literal `"auto"` |
| v1 name | `program=` |
| Default if absent | `"auto"` |
| Mode | **Basic mode only** |

In advanced mode this param is absent; `programs=` is used instead. Both
`programId=` (v2) and `program=` (v1) are accepted on read; only `programId=`
is emitted in canonical basic-mode output.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programId=9&energies=100,200&uanchor=mev
```

→ Explicit ICRU 90 (program ID 9), basic mode.

---

### 3.5 `programs` — Program List (Advanced Mode)

| Attribute | Value |
|---|---|
| Type | Comma-separated list of positive integers (or `ext-ref` for external) |
| v1 name | `programs=` (unchanged) |
| Mode | **Advanced mode only** |

Value format and external-entity `ext:label:id` encoding are **unchanged** from
`shareable-urls-formal.md` v6. First ID in the list is the default program.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programs=9,2,101&energies=100&uanchor=mev&mode=advanced&qshow=stp
```

---

### 3.6 `across` — Compare-Across Dimension

| Attribute | Value |
|---|---|
| Type | `"none"` \| `"programs"` \| `"materials"` \| `"particles"` |
| v1 equivalent | Was UI state only; no URL param existed |
| Default if absent | `"none"` (single-entity mode) |
| Mode | **Advanced mode only**; silently ignored in basic mode |

Controls which entity axis is used for the multi-entity comparison columns.
When `"none"`, the table shows a single entity column set. When non-`"none"`,
the table shows one column set per selected entity along the chosen axis.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programs=9,2&energies=100,200&uanchor=mev&mode=advanced&across=programs&qshow=stp
```

→ Advanced mode, comparing programs 9 and 2 across two energy rows.

---

### 3.7 `mode` — Calculator Operation Mode

| Attribute | Value |
|---|---|
| Type | `"forward"` \| `"range"` \| `"inverse-stp"` |
| v1 equivalent | Implicit (always `"forward"`); inverse modes used `imode=csda\|stp` |
| Default if absent | `"forward"` |

Specifies which calculator operation is active:

| Token | Meaning | Old equivalent |
|---|---|---|
| `forward` | Energy → STP + CSDA Range | default (no `imode`) |
| `range` | CSDA Range → Energy | `imode=csda` |
| `inverse-stp` | Stopping Power → Energy | `imode=stp` |

The `imode=` param is removed in v2; `mode=` covers all three modes. The
advanced/basic **picker** mode is a separate concept stored in app state and
is not encoded in the URL (it is derived from the presence of `programs=`).

**Worked example — forward (default):**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=10,100,1000&uanchor=mev
```

**Worked example — range lookup:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=7.72:cm,20:cm&runit=cm&mode=range&mode=advanced&qshow=range
```

Wait — `mode=advanced` and `mode=range` would conflict. See §3.10 for how
`mode=` encodes the calculator tab.  The picker advanced/basic state is
determined by the presence of `programs=` vs `programId=`.

**Corrected worked example — range lookup in advanced:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=7.72:cm,20:cm&runit=cm&uanchor=mev&mode=range
```

**Worked example — inverse STP:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=10.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

---

### 3.8 `uanchor` — Energy Unit Anchor (Energy → Mode)

| Attribute | Value |
|---|---|
| Type | `"mev"` \| `"mev-nucl"` \| `"mev-u"` |
| v1 equivalent | `eunit=MeV\|MeV/nucl\|MeV/u` |
| Default if absent | `"mev"` |

Maps to display units for the Energy column header and determines how
unsuffixed rows in `energies=` are interpreted.

| Token | Display label | Conversion |
|---|---|---|
| `mev` | MeV | base |
| `mev-nucl` | MeV/nucl | per nucleon (÷ mass number A) |
| `mev-u` | MeV/u | per atomic mass unit |

Note: for proton (A=1), `mev` and `mev-nucl` are numerically identical. For
proton + `mev-u`, the value differs by ~0.1% (proton mass ≠ 1 u exactly) — see
the `(≠MeV)` badge in #558.

The `eunit=` param is accepted on read for v1 migration (§7); only `uanchor=`
is emitted in canonical v2 output.

**Worked example:**

```
?urlv=2&particleId=6&materialId=276&programId=auto&energies=10,50,200&uanchor=mev-nucl
```

→ Carbon-12, energies interpreted as 10/50/200 MeV/nucl.

---

### 3.9 `runit` — Range Unit Anchor

| Attribute | Value |
|---|---|
| Type | `"nm"` \| `"um"` \| `"mm"` \| `"cm"` \| `"m"` |
| v1 equivalent | `iunit=` (for `imode=csda`) |
| Default if absent | `"cm"` |

Controls:
1. The unit shown in the CSDA Range column header (Energy → mode).
2. How unsuffixed rows in `ivalues=` are interpreted when `mode=range`.
3. The anchor shown in the range unit-anchor strip (Range → mode).

Note: individual result cells auto-scale to an appropriate SI prefix even when
`runit=cm` (the default). `runit=` anchors the user's **input** interpretation
and the column header; per-cell rendering uses auto-prefix logic from #556.

**Worked example — basic:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,200&uanchor=mev&runit=mm
```

→ Range results displayed in mm (header says "CSDA Range [mm]").

**Worked example — range lookup (Range →):**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=7.72,20.5&runit=cm&uanchor=mev&mode=range
```

→ Lookup energies for CSDA ranges 7.72 cm and 20.5 cm (unsuffixed rows
   inherit `runit=cm`).

---

### 3.10 `sunit` — STP Unit Anchor

| Attribute | Value |
|---|---|
| Type | `"kev-um"` \| `"mev-cm"` \| `"mev-cm2-g"` |
| v1 equivalent | `stp_unit=` (plot page) / `iunit=` (for `imode=stp`) |
| Default if absent | `"kev-um"` (condensed material); `"mev-cm2-g"` (gas) |

Controls:
1. The unit shown in the STP column header (Energy → mode).
2. How unsuffixed rows in `ivalues=` are interpreted when `mode=inverse-stp`.
3. The anchor shown in the STP unit-anchor strip (STP → mode).

| Token | Display label |
|---|---|
| `kev-um` | keV/µm |
| `mev-cm` | MeV/cm |
| `mev-cm2-g` | MeV·cm²/g |

**Worked example — display unit override:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,200&uanchor=mev&sunit=mev-cm
```

**Worked example — inverse STP (STP →):**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=4.55,10.0&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

---

### 3.11 `energies` — Energy Input Values (Extended)

| Attribute | Value |
|---|---|
| Type | Comma-separated `energy-item` list |
| Grammar | `energy-item = number [":" energy-unit-token]` |
| v1 name | `energies=` (unchanged; syntax extended) |

Each row is either a bare number (inherits `uanchor=`) or a number with an
explicit per-row `:unit` suffix. The `:` character is a valid unencoded query
component character per RFC 3986 §3.4.

Valid per-row unit tokens: `eV`, `keV`, `MeV`, `GeV`, `TeV`, `MeV/nucl`,
`keV/nucl`, `GeV/nucl`, `MeV/u`, `keV/u`, `GeV/u`.

Unknown unit tokens: treat as invalid row; exclude from calculation; show
validation message.

**Worked example — master unit only:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,200,500&uanchor=mev
```

→ Three rows: 100, 200, 500 MeV.

**Worked example — mixed inline units:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,10:keV,2:GeV,250&uanchor=mev
```

→ Four rows: 100 MeV (from `uanchor`), 10 keV (explicit), 2 GeV (explicit),
   250 MeV (from `uanchor`).

**Worked example — per-nucleon anchor with mixed prefixes:**

```
?urlv=2&particleId=6&materialId=276&programId=auto&energies=10,400:MeV/nucl,0.5:GeV/nucl&uanchor=mev-nucl
```

→ Carbon-12: 10 MeV/nucl, 400 MeV/nucl (explicit matches anchor — no suffix
   in canonical output), 500 MeV/nucl.

---

### 3.12 `ivalues` — Inverse Lookup Input Values (Extended)

| Attribute | Value |
|---|---|
| Type | Comma-separated `ivalue-item` list |
| Grammar | `ivalue-item = number [":" ivalue-unit-token]` |
| v1 name | `ivalues=` (unchanged; syntax extended) |
| Mode | Only parsed when `mode=range` or `mode=inverse-stp` |

When `mode=range`: per-row unit is a length token (`nm`/`um`/`mm`/`cm`/`m`);
master unit from `runit=`. When `mode=inverse-stp`: per-row unit is a STP
token (`kev-um`/`mev-cm`/`mev-cm2-g`); master unit from `sunit=`.

**Worked example — range lookup, mixed length units:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=7.718:cm,45:um,1.5:mm&runit=cm&uanchor=mev&mode=range
```

→ Three range-lookup rows: 7.718 cm, 45 µm, 1.5 mm.

**Worked example — STP inverse lookup, master unit:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=45.76,10.00&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

→ Two STP-inverse rows: 45.76 keV/µm and 10.00 keV/µm (both from `sunit`).

---

### 3.13 `qshow` — Quantity Display Toggle

| Attribute | Value |
|---|---|
| Type | `"stp"` \| `"range"` |
| v1 name | `qfocus=stp\|csda\|both` |
| Default if absent | both quantities shown (equivalent to old `qfocus=both`) |
| Mode | **Advanced mode only**; ignored in basic mode (basic always shows both) |

The old three-state `qfocus=` is replaced by the two-state `qshow=`. CSV export
always includes both quantities regardless of `qshow=`.

| v2 `qshow=` | v1 `qfocus=` | Meaning |
|---|---|---|
| `stp` | `stp` | Show stopping power columns only |
| `range` | `csda` | Show CSDA range columns only |
| *(absent)* | `both` | Show both (default) |

Note: `qshow=` is NOT emitted in the canonical URL when both quantities are
visible (absence = default). This differs from v1 where `qfocus=both` was
always emitted explicitly in advanced mode.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programs=9,2&energies=100,200&uanchor=mev&mode=forward&qshow=range
```

→ Advanced mode, CSDA range columns only visible.

---

### 3.14 `istpbranch` — Inverse-STP Branch Sticky Flag

| Attribute | Value |
|---|---|
| Type | `"hi"` \| `"lo"` \| `"both"` |
| Default if absent | `"hi"` |
| Mode | Only relevant when `mode=inverse-stp` |

Controls the column visibility state for the dual-branch inverse-STP table.
Some STP values have two corresponding energies (high-E and low-E branches).

| Token | Meaning |
|---|---|
| `hi` | Show high-energy branch only (default) |
| `lo` | Show low-energy branch only (reserved — not implemented in #560; schema stub) |
| `both` | Both branch columns visible (sticky state after user has seen a dual-solution row) |

The `both` state is sticky: once a dual-solution row is encountered the column
reveals; `istpbranch=both` in the URL keeps that column visible on reload even
before any row resolves to two energies.

**Worked example — default (hi branch only):**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=10.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

**Worked example — sticky both-branch state:**

```
?urlv=2&particleId=1&materialId=276&programs=9&ivalues=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

---

### 3.15 `tip_seen` — Tip Dismissal Flag (Optional)

| Attribute | Value |
|---|---|
| Type | Literal `"inline_unit"` (the only valid value currently) |
| Default if absent | Tip not yet seen |

When the user has dismissed the "type a unit too — e.g. `10 keV`" one-time
hint, `tip_seen=inline_unit` may appear in the URL. It is NOT required for
round-trip fidelity; it is an optional optimisation to prevent re-showing the
hint when a shared URL is opened by someone who has already seen it.

Persistence is primarily via `localStorage` key `dedx_tip_inline_unit_seen`.
The URL param supplements this for cross-device link-sharing.

**Worked example:**

```
?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,10:keV&uanchor=mev&tip_seen=inline_unit
```

---

### 3.16 Params Unchanged from v1

The following params retain their v1 semantics and ABNF grammar. See
`shareable-urls-formal.md` v6 for full details.

| Param | Unchanged from | Notes |
|---|---|---|
| `urlv=` | §2 | Value bumped to `2` in canonical output |
| `extdata=` | §2 formal ABNF | External source label+URL; multiple allowed |
| `mode=advanced` | — | **Not emitted in v2.** Advanced mode is inferred from `programs=` vs `programId=`. The `mode=advanced` literal is accepted on v1 migration read but not emitted. |
| `hidden_programs=` | §5 (was v1) | Silently dropped on read in v2 (see §5 migration) |
| `agg_state=` | §3.7 advanced options | Unchanged |
| `interp_scale=` | §3.7 | Unchanged |
| `interp_method=` | §3.7 | Unchanged |
| `mstar_mode=` | §3.7 | Unchanged |
| `density=` | §3.7 | Unchanged |
| `ival=` | §3.7 | Unchanged |
| `mat_name=` | §3.8 | Unchanged |
| `mat_density=` | §3.8 | Unchanged |
| `mat_elements=` | §3.8 | Unchanged |
| `mat_ival=` | §3.8 | Unchanged |
| `mat_phase=` | §3.8 | Unchanged |

---

## 4. Canonical URL Form (v2)

### 4.1 Parameter Order

Canonical v2 Calculator URL:

```
/calculator
  ?urlv=2
  [&extdata={label}:{url}]           ← one per source, declaration order
  &particleId={id}
  &materialId={id|"custom"}
  &{programId={id|"auto"} | programs={ids}}   ← exactly one, by mode
  [&across={dimension}]              ← omit when "none"
  &energies={csv}
  &uanchor={token}                   ← always emitted
  [&runit={token}]                   ← omit when "cm" (default)
  [&sunit={token}]                   ← omit when default for material phase
  [&mode={forward|range|inverse-stp}] ← omit when "forward" (default)
  [&ivalues={csv}]                   ← only when mode=range or mode=inverse-stp
  [&qshow={stp|range}]               ← omit when both visible (default)
  [&istpbranch={hi|lo|both}]         ← omit when "hi" (default)
  [&tip_seen=inline_unit]            ← omit unless tip dismissed
  [&agg_state=...] [&interp_scale=...] ...  ← advanced options (§3.16)
  [&mat_name=...] ...                ← custom compound (§3.16)
```

### 4.2 Advanced Mode vs Basic Mode in v2

In v2, advanced/basic mode is no longer stored as a `mode=advanced|basic`
URL param. Instead:

- **Basic mode:** URL contains `programId=` (one program param).
- **Advanced mode:** URL contains `programs=` (multi-program param).

This removes the redundancy of a separate `mode=` advanced-mode marker and
makes the URL more self-describing.

The literal `mode=advanced` or `mode=basic` is **accepted but ignored** on read
(for v1 migration compatibility only); it is never emitted in canonical v2 output.

### 4.3 When `qshow=` is Omitted

Unlike v1 which always emitted `qfocus=both`, in v2:
- `qshow=stp` → emit `qshow=stp`
- `qshow=range` → emit `qshow=range`
- Both visible (default) → **omit `qshow=`** from the URL

### 4.4 Worked Canonical Examples

**Basic mode — single energy:**

```
/calculator?urlv=2&particleId=1&materialId=276&programId=auto&energies=100&uanchor=mev
```

**Basic mode — mixed inline units:**

```
/calculator?urlv=2&particleId=1&materialId=276&programId=auto&energies=100,10:keV,2:GeV&uanchor=mev
```

**Advanced mode — multi-program, STP only:**

```
/calculator?urlv=2&particleId=1&materialId=276&programs=9,2&energies=100,200&uanchor=mev&qshow=stp
```

**Advanced mode — range lookup:**

```
/calculator?urlv=2&particleId=1&materialId=276&programs=9&ivalues=7.718:cm,20:cm&runit=cm&uanchor=mev&mode=range
```

**Advanced mode — inverse STP, sticky both-branch:**

```
/calculator?urlv=2&particleId=1&materialId=276&programs=9&ivalues=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

**Advanced mode — compare-across programs:**

```
/calculator?urlv=2&particleId=1&materialId=276&programs=9,2,101&energies=100,200&uanchor=mev&across=programs&qshow=range
```

**Advanced mode — carbon, heavy-ion energy anchor:**

```
/calculator?urlv=2&particleId=6&materialId=276&programs=9&energies=10,100,400:MeV/nucl&uanchor=mev-nucl
```

---

## 5. Removed Params

### 5.1 `hidden=` / `hidden_programs=`

Previously used to hide program columns in multi-entity Advanced mode. The
Columns dropdown is removed in #561; column visibility is entirely governed
by entity selection in the picker (selected = visible, deselected = absent).

**On read (migration):** silently drop any `hidden=` or `hidden_programs=`
parameter. Do not show a warning. Do not restore hidden-column state.

---

## 6. Migration Rules: v1 → v2

When loading a URL with `urlv=1` (or no `urlv`):

| v1 param | v2 behaviour |
|---|---|
| `particle={id}` | read as `particleId={id}` |
| `material={id}` | read as `materialId={id}` |
| `program={id\|auto}` | read as `programId={id\|auto}` |
| `eunit={token}` | read as `uanchor=` with mapped token (MeV→mev, MeV/nucl→mev-nucl, MeV/u→mev-u) |
| `qfocus=both` | treat as `qshow=` absent (both visible, default) |
| `qfocus=stp` | treat as `qshow=stp` |
| `qfocus=csda` | treat as `qshow=range` |
| `imode=csda` | treat as `mode=range` |
| `imode=stp` | treat as `mode=inverse-stp` |
| `iunit=` | treat as `runit=` (when old `imode=csda`) or `sunit=` (when old `imode=stp`) |
| `mode=advanced` | infer advanced mode from `programs=` param (discard `mode=advanced` literal) |
| `hidden=` or `hidden_programs=` | silently drop |
| `energies=` without `:unit` suffixes | load with `uanchor=` default; values unchanged |
| Any unknown param | silently drop (forward-compat rule) |

After applying migration, the parser emits a canonical v2 URL via `replaceState`,
bumping `urlv` to `2`.

---

## 7. Inline-Unit Suffix Grammar (Risk Analysis)

The inline `:unit` suffix uses a literal colon inside the query component.
RFC 3986 §3.4 permits `:` unencoded within a query string; `URLSearchParams`
preserves literal colons inside values. This is safe because:

1. The query string is split on raw `&` and raw `=` first (per ABNF tokenisation
   in `shareable-urls-formal.md` §2).
2. After extracting the `energies=` or `ivalues=` value, the CSV is split on `,`
   (also literal and safe per RFC 3986 §3.4).
3. Each item is then split on the **last** `:` to separate the number from the
   unit token. The "last" colon rule is important for per-nucleon tokens like
   `MeV/nucl` — but those tokens do not contain colons, so any colon in an
   item is unambiguously the number-unit separator.

**Known conflict:** If a unit token itself contained `:`, the last-colon rule
would be ambiguous. The current token set (`MeV`, `keV`, `GeV`, `MeV/nucl`,
`keV/nucl`, `GeV/nucl`, `MeV/u`, `keV/u`, `GeV/u`, `nm`, `um`, `mm`, `cm`,
`m`, `kev-um`, `mev-cm`, `mev-cm2-g`) contains no colons. Future tokens must
not include colons.

**The `|` in `istpbranch=hi|lo|both`:** This is not a URL issue — `istpbranch`
carries a single token value (`hi`, `lo`, or `both`); the `|` only appears in
the spec table as a grammar alternative notation.

---

## 8. Test-Plan Summary

Per the issue #554 scope, this issue ships **documentation only**. No Playwright
tests are added here. Unit-test fixtures are updated to reference this doc.

| Test coverage | Where |
|---|---|
| Round-trip parse → serialise → parse for new params | `calculator-url.test.ts` (updated in this issue to reference this doc; behavioural coverage added in #555–#561) |
| Schema validator | Added in #555 (first implementation issue) |
| Inline-unit round-trips | `inline-unit.test.ts` (new in #557) |
| `istpbranch` sticky logic | `inverse-stp.spec.ts` E2E (new in #560) |

---

## 9. Cross-Spec Consistency Checklist

- [ ] `particleId=`, `materialId=`, `programId=` rename accepted by `calculator-url.ts`
      encoder/decoder (implementation in #555).
- [ ] `uanchor=` replaces `eunit=` in canonical output; migration reads `eunit=`
      and maps tokens (implementation in #555).
- [ ] `qshow=stp|range` (2-state) replaces `qfocus=stp|csda|both` (3-state);
      `multi-program.svelte.ts` and `multi-entity.svelte.ts` state shape updated
      in #561.
- [ ] `mode=forward|range|inverse-stp` replaces `imode=csda|stp`; Calculator page
      route param handling updated in #558.
- [ ] `across=` URL param wired to entity-selection `across` state in #561.
- [ ] `istpbranch=` param round-trips through `calculator-url.ts` in #560.
- [ ] `hidden=` / `hidden_programs=` silently dropped in #561 migration.
- [ ] `shareable-urls-formal.md` ABNF grammar updated with v2 params after #561.
- [ ] `shareable-urls.md` §3–§5 updated to reference this doc after #561.
- [ ] `docs/04-feature-specs/README.md` status table updated after #561.
