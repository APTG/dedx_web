# Terminology Glossary

> **Status:** Final v3 (14 April 2026)
>
> **v3:** Developer/stack section expanded with four new terms: ADR, CI/CD, CORS, SSG.
> **v2:** Terms sorted alphabetically within each section; term index added at top of page.
> **v1:** Initial glossary — two-section structure, 29 terms.

This glossary has two sections:

- **§1 Physics & end-user terms** — domain vocabulary used in the UI, tooltips,
  user documentation, and feature specs. Audience: physicists, students, shielding
  engineers.
- **§2 Developer & stack terms** — technical vocabulary used in code, commit
  messages, PR descriptions, and internal docs. Audience: developers implementing
  the app.

Cross-references between terms are marked with "→ see also".

---

## Index

### §1 Physics & End-User Terms

| Term | One-line summary |
|------|-----------------|
| [Aggregate State](#aggregate-state) | Gas vs condensed treatment of a material for I-value selection |
| [Bragg Additivity Rule](#bragg-additivity-rule) | Compound stopping power as weighted sum of elemental contributions |
| [Bragg Peak](#bragg-peak) | Sharp dose maximum near the end of a charged particle's track |
| [CSDA Range](#csda-range) | Path length to rest; integral of reciprocal stopping power |
| [Custom Compound](#custom-compound) | User-defined material by elemental composition + density |
| [ICRU 73 / ICRU 90](#icru-73--icru-90) | ICRU tabulated stopping-power reports for heavy ions and protons |
| [Mass Stopping Power](#mass-stopping-power) | Stopping power divided by density; unit MeV·cm²/g |
| [Mean Excitation Energy (I-value)](#mean-excitation-energy-i-value) | Material constant in Bethe formula; unit eV |
| [MeV/nucl vs MeV/u](#mevnucl-vs-mevu) | Energy per integer nucleon vs per actual atomic mass unit |
| [MSTAR](#mstar) | Stopping-power program for heavy ions; 6 calculation modes |
| [Normalized Energy](#normalized-energy) | Kinetic energy expressed per unit particle mass |
| [Particle](#particle) | Any charged projectile (proton, ion, electron); preferred over "ion" |
| [PSTAR / ESTAR / ASTAR](#pstar--estar--astar) | NIST stopping-power programs for protons, electrons, alphas |
| [Stopping Power](#stopping-power) | Rate of energy loss per unit path length; electronic + nuclear components |

### §2 Developer & Stack Terms

| Term | One-line summary |
|------|-----------------|
| [ADR](#adr) | Short document recording one significant architectural choice with context and rationale |
| [Advanced Mode / Basic Mode](#advanced-mode--basic-mode) | App-wide toggle controlling advanced-feature visibility |
| [Canonicalization](#canonicalization) | Algorithm normalizing URL state to a single deterministic form |
| [CI/CD](#cicd) | Automated lint → test → build → deploy pipeline running on GitHub Actions |
| [Compatibility Matrix](#compatibility-matrix) | Pre-computed bidirectional program ↔ particle ↔ material lookup |
| [CORS](#cors) | Browser policy blocking cross-origin fetches; relevant for user-hosted `extdata` files |
| [dedx_config](#dedx_config) | Stateful C config struct; required for overrides and custom compounds |
| [dedx_extra.{h,c}](#dedx_extrahc) | Local C files exposing internal libdedx data and custom-compound wrappers |
| [dedx_wrappers.h](#dedx_wrappersh) | Local C header providing stateless wrappers for Emscripten export |
| [Emscripten / WASM](#emscripten--wasm) | Compiler toolchain producing .wasm + .mjs from libdedx C source |
| [Entity](#entity) | Union type: `ParticleEntity \| MaterialEntity \| ProgramEntity` |
| [extdata](#extdata) | URL param pointing to user-hosted external stopping-power data |
| [libdedx](#libdedx) | C library (git submodule) providing all stopping-power tables |
| [qfocus](#qfocus) | URL param selecting quantity columns: `both` / `stp` / `csda` |
| [Runes](#runes) | Svelte 5 reactive primitives: `$state`, `$derived`, `$effect`, `$props`, `$bindable` |
| [Series](#series) | A (particle, material, program) triplet producing one plot curve |
| [SSG](#ssg) | Build strategy pre-rendering all pages to static HTML at build time; enables GitHub Pages |
| [StoredCompound](#storedcompound) | localStorage type for user compounds; distinct from WASM `CustomCompound` |
| [urlv](#urlv) | URL contract major-version sentinel parameter |

---

## Section 1 — Physics & End-User Terms

---

### Aggregate State

Whether a material is treated as a **gas** or **condensed matter** (solid or
liquid) for the purpose of selecting the mean excitation energy I. The same
chemical substance (e.g., water vapour vs. liquid water) has a different I-value
in gas vs. condensed phase, which affects stopping power at intermediate energies
by a few percent.

libdedx marks 29 materials as gaseous by default (`isGasByDefault = true` in
`MaterialEntity`). The default phase is passed to the C library via
`dedx_config.compound_state`. In Advanced mode, the user can override the
phase with a Gas / Condensed toggle.

The effective phase also sets the default stopping-power display unit:
gas → MeV·cm²/g, condensed → keV/µm.

→ see also: [Stopping Power](#stopping-power), [Mean Excitation Energy (I-value)](#mean-excitation-energy-i-value)

Used in: [`advanced-options.md`](04-feature-specs/advanced-options.md) §3,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.6

---

### Bragg Additivity Rule

The principle that the mass stopping power of a compound material equals the
linear combination of elemental mass stopping powers weighted by elemental weight
fractions:

```
S_compound(E) = Σ_i  w_i · S_i(E)
```

where `w_i` is the weight fraction of element `i` and `S_i` is its elemental
mass stopping power. This approximation neglects chemical-binding effects on the
mean excitation energy; the error is typically a few percent for organic
compounds.

In webdedx, Bragg additivity is the calculation method used for **custom
compound materials** when no tabulated compound data exists and no explicit
I-value is provided by the user.

→ see also: [Custom Compound](#custom-compound), [Mean Excitation Energy (I-value)](#mean-excitation-energy-i-value)

Used in: [`custom-compounds.md`](04-feature-specs/custom-compounds.md) §2,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.5

---

### Bragg Peak

The sharp maximum in the dose deposition (or stopping power vs. depth) curve
near the end of a charged particle's track. As the particle slows down its
stopping power rises steeply; the peak occurs just before the particle comes to
rest. The position of the Bragg peak in tissue depth corresponds approximately
to the CSDA range.

The webdedx API exposes `getBraggPeakStp()` which returns the maximum stopping
power value, used in the Inverse STP feature to hint at the valid energy range
for each branch.

→ see also: [CSDA Range](#csda-range), [Stopping Power](#stopping-power)

Used in: [`inverse-lookups.md`](04-feature-specs/inverse-lookups.md) §5,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §3

---

### CSDA Range

*Continuous Slowing Down Approximation range.* The total path length a charged
particle travels before coming to rest, under the assumption that energy loss is
continuous and equal to the mean stopping power at each point. Calculated by
integrating the reciprocal stopping power from the minimum tabulated energy to
the particle's initial energy:

```
R(E) = ∫_{E_min}^{E} 1/S(E') dE'
```

The C library computes CSDA range via adaptive Gaussian quadrature in
`dedx_tools.c`. CSDA range is not table-interpolated — it is an integral of the
stopping power function. The interpolation axis-scale setting affects accuracy
because it controls how S(E') is evaluated at each integration point.

**Unit:** g/cm² (mass range, geometry-independent); alternatively cm (requires
density for conversion: `R_cm = R_gcm2 / ρ`).

→ see also: [Stopping Power](#stopping-power), [Bragg Peak](#bragg-peak)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.3,
[`inverse-lookups.md`](04-feature-specs/inverse-lookups.md),
[`advanced-options.md`](04-feature-specs/advanced-options.md) §4

---

### Custom Compound

A user-defined compound material, specified by:
1. A display name
2. Elemental composition: atomic numbers Z + atom count per formula unit
   (or weight fractions converted to atom counts via `n_i = w_i / M_i`)
3. Material density in g/cm³
4. Optional mean excitation potential (I-value) in eV
5. Aggregate phase (Gas / Condensed) for display-unit defaulting

Stopping powers for custom compounds are computed via the Bragg additivity rule
using the elemental data available to the selected program. Programs that lack
elemental data for any constituent element are greyed out in the program selector.

Custom compounds are stored in `localStorage` as `StoredCompound` objects and
appear in the material selector alongside built-in materials when Advanced mode
is active. The WASM layer uses the stateful `dedx_config` API path for custom
compound calculations.

→ see also: [Bragg Additivity Rule](#bragg-additivity-rule),
[Mean Excitation Energy (I-value)](#mean-excitation-energy-i-value),
[Aggregate State](#aggregate-state)

Used in: [`custom-compounds.md`](04-feature-specs/custom-compounds.md),
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.5, §3

---

### ICRU 73 / ICRU 90

Two ICRU (International Commission on Radiation Units and Measurements) reports
providing tabulated stopping powers for heavy ions and protons:

| Report | Coverage | Notes |
|--------|----------|-------|
| **ICRU 73** | Heavy ions (Z > 2) in many materials | Available as a program in libdedx |
| **ICRU 90** | Protons and alpha particles, updated I-values | Preferred over ICRU 49 (PSTAR) when available |

libdedx exposes a meta-program `DEDX_ICRU` that resolves at runtime to the best
available ICRU dataset for the selected particle. The webdedx auto-select layer
starts from this resolver and may extend it with app-level rules (e.g., prefer
MSTAR for heavy ions lacking ICRU 73 coverage).

→ see also: [PSTAR / ESTAR / ASTAR](#pstar--estar--astar)

Used in: [`01-project-vision.md`](01-project-vision.md) §4.3,
[`entity-selection.md`](04-feature-specs/entity-selection.md)

---

### Mass Stopping Power

The stopping power divided by the density of the target material:
`S_mass = S_linear / ρ`. Expressed in MeV·cm²/g. This unit is preferred in
databases because it is geometry-independent and approximately constant across
materials with similar atomic composition.

**Unit:** MeV·cm²/g

→ see also: [Stopping Power](#stopping-power), [Aggregate State](#aggregate-state)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.1,
[`unit-handling.md`](04-feature-specs/unit-handling.md)

---

### Mean Excitation Energy (I-value)

The mean excitation potential **I** of a target material, appearing in the
Bethe stopping power formula as the logarithmic mean of all ionisation and
excitation energies of the target atoms, weighted by their oscillator strengths.
A higher I-value means lower electronic stopping power at a given energy.

I-values are material constants tabulated by ICRU (e.g., I = 75.0 eV for water).
Users can override the built-in I-value in Advanced Options to study its effect
or to use a measured value from their specific sample.

For custom compounds without an explicit I-value, the WASM layer applies Bragg
additivity to derive an effective I-value from elemental contributions.

**Unit:** eV

→ see also: [Bragg Additivity Rule](#bragg-additivity-rule),
[Custom Compound](#custom-compound)

Used in: [`advanced-options.md`](04-feature-specs/advanced-options.md) §2,
[`custom-compounds.md`](04-feature-specs/custom-compounds.md) §1.1

---

### MeV/nucl vs MeV/u

Two distinct units for expressing kinetic energy of a multi-nucleon particle,
often confused:

- **MeV/nucl** — energy divided by the integer **mass number** A (number of
  nucleons). The C libdedx API uses MeV/nucl internally.
- **MeV/u** — energy divided by the particle's **actual atomic mass** in unified
  atomic mass units (u / daltons), obtained from `dedx_get_ion_atom_mass()`.

For a proton: A = 1, atomic mass = 1.007 94 u, so MeV/nucl ≠ MeV/u (differ by
~0.8%). For a carbon-12 ion: A = 12, atomic mass = 12.000 00 u exactly, so
MeV/nucl = MeV/u. The distinction matters most for CSDA range calculations where
errors accumulate through integration.

**In the app:** MeV/nucl is the default for ions (A > 1) and is shown in Basic
mode. MeV/u is available in Advanced mode only, as the difference matters
primarily for precision work.

→ see also: [Normalized Energy](#normalized-energy), [Particle](#particle)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1 Design
Decisions (Energy units), [`unit-handling.md`](04-feature-specs/unit-handling.md),
[`01-project-vision.md`](01-project-vision.md) §4.1

---

### MSTAR

A stopping-power calculation program for heavy ions (Z > 2) in various materials,
written by H. Paul. Implements several empirical and semi-empirical models. In
webdedx it is accessible as one of the selectable programs when the selected
particle is a heavy ion.

**MSTAR modes** (selected in Advanced Options when MSTAR is the active program):

| Mode | Meaning |
|------|---------|
| **A** | Auto base: selects C for condensed targets, G for gaseous |
| **B** | Auto special: selects D for condensed targets, H for gaseous. **Default** |
| **C** | Condensed standard |
| **D** | Condensed special (downgrades to C for target Z ≤ 3) |
| **G** | Gas standard |
| **H** | Gas special (hardcoded for projectile Z = 3–11 and 16–18; downgrades to G otherwise) |

Modes E and F are not supported by the current WASM contract.

→ see also: [Aggregate State](#aggregate-state)

Used in: [`advanced-options.md`](04-feature-specs/advanced-options.md) §5,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.6

---

### Normalized Energy

Kinetic energy expressed per unit of particle mass, typically MeV/nucl or MeV/u.
Normalizing by mass number allows stopping-power curves for different particles to
be compared on a common horizontal axis — a proton at 100 MeV/nucl and a carbon-12
ion at 100 MeV/nucl have the same velocity (to a good approximation), so their
stopping powers per nucleon are comparable.

The WASM API always receives energies in MeV/nucl; conversion from user-selected
units is performed on the JavaScript side before calling `calculate()`.

→ see also: [MeV/nucl vs MeV/u](#mevnucl-vs-mevu)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1,
[`unit-handling.md`](04-feature-specs/unit-handling.md)

---

### Particle

Any charged projectile whose stopping power is calculated by the app: protons,
alpha particles, other heavy ions, and electrons. The correct physics term; used
throughout the web application and all TypeScript types (`ParticleEntity`).

**Note:** The libdedx C API uses the term **"ion"** for the same concept
(including electrons), via functions like `dedx_fill_ion_list()` and
`dedx_get_ion_name()`. This is a legacy naming convention in the C API — calling
an electron an "ion" is physically incorrect. In dedx_web the C API's "ion"
naming is confined to the WASM wrapper layer that calls C functions directly.

→ see also: [MeV/nucl vs MeV/u](#mevnucl-vs-mevu), [PSTAR / ESTAR / ASTAR](#pstar--estar--astar)

Used in: [`entity-selection.md`](04-feature-specs/entity-selection.md) (preamble
terminology note), [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.2

---

### PSTAR / ESTAR / ASTAR

Three NIST stopping-power programs included in libdedx:

| Program | Particle | ICRU reference |
|---------|----------|----------------|
| **PSTAR** | Proton (Z = 1) | ICRU Report 49 |
| **ESTAR** | Electron (particle ID 1001 in libdedx) | Berger et al. |
| **ASTAR** | Alpha particle (He-4, Z = 2) | ICRU Report 49 |

ESTAR covers all ~280 libdedx materials and is exposed in the UI as the
"Electron" particle entry. Energy input for ESTAR uses MeV (not MeV/nucl — the
per-nucleon concept is undefined for leptons).

→ see also: [Particle](#particle), [ICRU 73 / ICRU 90](#icru-73--icru-90)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1,
[`entity-selection.md`](04-feature-specs/entity-selection.md),
[`01-project-vision.md`](01-project-vision.md) §4.3

---

### Stopping Power

The rate at which a charged particle loses energy per unit path length as it
traverses a material. Expressed as a positive quantity (energy lost per distance
or per areal density).

**Three components:**

- **Electronic stopping power** — energy loss via inelastic collisions with target
  electrons (excitation and ionisation). Dominant from ~keV/nucl to ~GeV/nucl.
- **Nuclear stopping power** — energy loss via elastic Coulomb collisions with
  target nuclei. Dominant at very low energies (below ~10 keV/nucl for protons).
- **Total stopping power** — sum of electronic and nuclear contributions.
  `S_total = S_electronic + S_nuclear`.

The C library returns total stopping power via `dedx_get_stp_table()`.

**Unit:** MeV·cm²/g (mass stopping power, geometry-independent);
alternatively keV/µm or MeV/cm (linear stopping power, requires material
density for conversion).

→ see also: [CSDA Range](#csda-range), [Aggregate State](#aggregate-state),
[Normalized Energy](#normalized-energy)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.1,
[`unit-handling.md`](04-feature-specs/unit-handling.md),
[`calculator.md`](04-feature-specs/calculator.md)

---

## Section 2 — Developer & Stack Terms

---

### ADR

An **Architecture Decision Record** — a short document that captures the
context, decision, and consequences for one significant, hard-to-reverse
architectural choice. Each ADR is numbered sequentially and stored in
`docs/decisions/`. ADRs are written before implementation begins so that
future contributors understand *why* a choice was made, not just what was
chosen.

Once an ADR is accepted it constrains future work — a change requires a new
superseding ADR, not a silent edit to the existing one.

**Format used in this project:** Title / Status / Context / Decision /
Consequences.

**Type/file:** `docs/decisions/` — all ADR files

Used in: [`00-redesign-plan.md`](00-redesign-plan.md) §8,
[`progress/stage-2.md`](progress/stage-2.md)

---

### Advanced Mode / Basic Mode

An app-wide toggle that controls which features are visible. Stored in
`localStorage` and reflected in the URL parameter `mode=advanced`.

| Mode | Visible features |
|------|-----------------|
| **Basic** (default) | Entity selection, single program, energy input, forward stopping power + CSDA range table, CSV/PDF export, Share URL |
| **Advanced** | Everything in Basic + multi-program comparison columns, MSTAR modes, aggregate state override, density/I-value overrides, MeV/u energy unit, inverse lookups (Range + Inverse STP tabs), custom compounds |

The toggle is placed in the top-right action bar on every page, alongside Share
and Export buttons. Enabling Advanced mode on one page enables it app-wide.

**Type/file:** `mode` URL param; `advancedMode` Svelte `$state` in the root
layout or shared store

→ see also: [qfocus](#qfocus)

Used in: [`01-project-vision.md`](01-project-vision.md) §4.4,
[`multi-program.md`](04-feature-specs/multi-program.md) §2,
[`advanced-options.md`](04-feature-specs/advanced-options.md) Panel Overview

---

### Canonicalization

The algorithm that normalizes a URL query string to a single deterministic
**canonical form**, so that logically identical states always produce identical
URL strings. Implemented on every state change before writing to the browser's
address bar.

The algorithm runs as a multi-step pipeline:

1. Parse raw query string into key/value pairs.
2. Apply semantic defaults (fill in omitted params with their default values).
3. Drop params that equal their default value (unless explicitly required).
4. Validate each param; replace invalid values with defaults silently.
5. Resolve `mode` (`basic` / `advanced`) and select the correct set of
   mode-specific params.
6. Encode entity selection (particle, material, program/programs).
7. Encode Advanced Options params (agg_state, interp_scale, interp_method,
   mstar_mode, density, ival).
8. Encode inverse-lookup params (imode, ivalues, iunit) if applicable.
9. Encode custom compound params (material=custom, mat_name, mat_density,
   mat_elements, mat_ival, mat_phase) if applicable.
10. Emit params in the specified canonical order (urlv first, extdata last within
    its group, unknown params stripped).

The full formal algorithm is in
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §4.

**Type/file:** `src/lib/stores/url-sync.ts` (planned)

→ see also: [urlv](#urlv)

Used in: [`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §4,
[`shareable-urls.md`](04-feature-specs/shareable-urls.md) §7

---

### CI/CD

**Continuous Integration / Continuous Deployment** — the planned Stage 8
automated pipeline for this project, intended to run via **GitHub Actions**.

| Phase | Planned trigger | Planned steps |
|-------|-----------------|---------------|
| **CI** | On PRs / pushes (planned) | `eslint` → `prettier --check` → `svelte-check` → `vitest run` → `playwright test` |
| **CD** | On merge to `master` (planned) | `pnpm build` → deploy `build/` to GitHub Pages |

When implemented, the CI phase will catch regressions before merge, and the CD
phase will publish the rebuilt static site automatically. See
[`08-deployment.md`](08-deployment.md) for the planned workflow specification
and current source of truth.

**Type/file:** `.github/workflows/` (GitHub Actions YAML);
[`08-deployment.md`](08-deployment.md) (full workflow specification)

→ see also: [SSG](#ssg)

Used in: [`02-tech-stack.md`](02-tech-stack.md) §11,
[`08-deployment.md`](08-deployment.md)

---

### Compatibility Matrix

An in-memory data structure pre-computed at WASM init time by iterating over
every program and calling `getParticles(programId)` + `getMaterials(programId)`
for each. Stores bidirectional maps (program ↔ particles, program ↔ materials)
enabling O(1) lookups in any direction without per-interaction C API calls.

The compatibility matrix is the backbone of the bidirectional filtering in entity
selection: when a particle is selected, only compatible programs are shown active;
when a program is selected, only its supported materials appear. There is no
native libdedx reverse-lookup function (as of the time of writing), so this
JS-side matrix is the only source of truth for cross-entity compatibility.

**Type/file:** `src/lib/wasm/types.ts` — `CompatibilityMatrix` interface;
`src/lib/wasm/libdedx.ts` — populated during `init()`

→ see also: [Entity](#entity)

Used in: [`entity-selection.md`](04-feature-specs/entity-selection.md) §2,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.2

---

### CORS

**Cross-Origin Resource Sharing** — a browser security policy that blocks
JavaScript from fetching a resource from a different **origin** (scheme + host
+ port combination) unless the server explicitly opts in via an
`Access-Control-Allow-Origin` response header.

Relevant to webdedx in the **extdata** feature: when a user supplies a URL to
a `.webdedx` Zarr v3 store hosted on their own server, all files in the store
(`zarr.json`, shard files) must be served with:

```
Access-Control-Allow-Origin: *
```

Without this header the browser blocks the fetch silently — the app cannot
work around CORS because it is enforced at the browser networking layer, not in
application code. The external-data documentation must instruct users who host
their own data files to enable CORS on their server.

The WASM binary (`libdedx.wasm`) is loaded via `fetch()` from the same origin
as the app (`/wasm/libdedx.wasm`), so CORS does not apply to it.

→ see also: [extdata](#extdata), [SSG](#ssg)

Used in: [`external-data.md`](04-feature-specs/external-data.md) §4 (hosting
requirements)

---

### dedx_config

The stateful C configuration struct in libdedx (`struct dedx_config` or
equivalent internal type). Used when a calculation requires non-default settings
that cannot be passed as simple function arguments to the stateless wrappers —
specifically: aggregate state override, density override, I-value override,
MSTAR mode, and interpolation scale. Also required for **custom compounds**
because the compound's elemental composition (`elements_id` + `elements_atoms`)
must be loaded into the config before calling the calculation routines.

The WASM wrapper allocates a config workspace, loads the settings, evaluates the
calculation, and frees the workspace. See `LibdedxService.calculate()` JSDoc for
the decision tree between stateless and stateful paths.

**Type/file:** `libdedx/include/dedx.h` (struct definition),
`src/lib/wasm/libdedx.ts` (TypeScript wrapper using it)

→ see also: [dedx_wrappers.h](#dedx_wrappersh), [Custom Compound](#custom-compound)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1, §3

---

### dedx_extra.{h,c}

Local C header + implementation files that expose libdedx **internal data** not
accessible through the main libdedx public API:

- `dedx_get_ion_nucleon_number()` — mass number A for unit conversion
- `dedx_get_ion_atom_mass()` — atomic mass in u for MeV/u conversion
- `dedx_get_density()` — material density in g/cm³ for display-unit conversion
- `dedx_get_is_gas()` — whether a material is gaseous by default

Also adds **thin C wrappers for custom compound inverse lookups** (not in the
main libdedx API):
- `getInverseStpCustomCompound()` — inverse stopping power for a custom compound
- `getInverseCsdaCustomCompound()` — inverse CSDA range for a custom compound
- `getBraggPeakStpCustomCompound()` — Bragg peak stopping power for a custom compound

These files are compiled alongside libdedx in the Emscripten build and do not
modify the libdedx submodule.

**Type/file:** `wasm/dedx_extra.h`, `wasm/dedx_extra.c`

→ see also: [dedx_wrappers.h](#dedx_wrappersh), [Custom Compound](#custom-compound)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1,
[`custom-compounds.md`](04-feature-specs/custom-compounds.md)

---

### dedx_wrappers.h

A local C header (not part of the libdedx submodule) providing **stateless
wrapper functions** around libdedx's internal APIs. These functions expose the
core stopping-power and entity-list queries as simple C functions suitable for
Emscripten `ccall`/`cwrap` export, without requiring the caller to manage a
`dedx_config` lifecycle. Used as the primary call path when no `AdvancedOptions`
override is active.

**Type/file:** `wasm/dedx_wrappers.h` (C header, local to the repo)

→ see also: [dedx_config](#dedx_config), [dedx_extra.{h,c}](#dedx_extrahc)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1

---

### Emscripten / WASM

**Emscripten** is the compiler toolchain (`emcc`) that cross-compiles libdedx C
source to WebAssembly. It produces two output artefacts:

- **`.wasm`** — the binary WebAssembly module containing compiled libdedx code
  and embedded data tables (stopping power tables, material/particle lists).
- **`.mjs`** — the Emscripten-generated JavaScript ES module that bootstraps the
  WASM runtime, exposes `ccall`/`cwrap` for calling C functions from JavaScript,
  and manages the linear memory heap.

**WebAssembly (WASM)** is the binary instruction format executed by the browser's
WASM runtime at near-native speed. The `.wasm` module is loaded once at app
startup and remains resident in browser memory.

The WASM module size is several MB because it includes embedded stopping-power
tables. A loading indicator is required.

**Type/file:** `build_wasm.sh` (build script), `src/lib/wasm/libdedx.ts`
(TypeScript wrapper), `src/lib/wasm/loader.ts` (lazy init)

→ see also: [libdedx](#libdedx), [dedx_wrappers.h](#dedx_wrappersh)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1,
[`00-redesign-plan.md`](00-redesign-plan.md) §6

---

### Entity

In dedx_web TypeScript code, an **entity** is any of the three principal libdedx
objects: a particle, a material, or a program. All three extend `LibdedxEntity`
(base interface: `id: number`, `name: string`). The union type is:

```typescript
type Entity = ParticleEntity | MaterialEntity | ProgramEntity;
```

The C API uses more specific names for the same concepts (ion, material, program).
The TypeScript abstraction unifies them for use in the compatibility matrix,
entity-selection UI, and URL encoding.

**Type/file:** `src/lib/wasm/types.ts` — `LibdedxEntity`, `ParticleEntity`,
`MaterialEntity`, `ProgramEntity`

→ see also: [Compatibility Matrix](#compatibility-matrix)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.2,
[`entity-selection.md`](04-feature-specs/entity-selection.md)

---

### extdata

The `extdata` URL parameter activates the **external data** feature: it points
to the root of a user-hosted `.webdedx` Zarr v3 store (a directory of files
containing stopping-power and CSDA-range arrays). The parameter format is
`extdata={label}:{url}` where `{label}` is a short user-visible name and
`{url}` is the HTTPS URL of the store root (the URL at which `zarr.json` is
served as `{url}/zarr.json`).

External entities (particles, materials, programs) from the file are merged with
the built-in libdedx lists and visually distinguished in selectors, tables, and
plot legends. The `extdata` parameter is preserved in shared URLs so recipients
see the same external data overlaid on built-in curves.

**Type/file:** URL query param; defined in
[`external-data.md`](04-feature-specs/external-data.md),
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §2

→ see also: [Series](#series)

Used in: [`external-data.md`](04-feature-specs/external-data.md),
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §2,
[`01-project-vision.md`](01-project-vision.md) §4.7

---

### libdedx

The C library that provides all stopping-power tables and calculation routines.
Included in the repository as a Git submodule at `libdedx/`. Compiled to
WebAssembly via Emscripten. All stopping-power and CSDA range data in the app
originates from this library.

**Type/file:** `libdedx/` (submodule), `libdedx/include/dedx.h` (public API),
`libdedx/src/dedx_tools.c` (CSDA integrator)

→ see also: [Emscripten / WASM](#emscripten--wasm), [dedx_wrappers.h](#dedx_wrappersh),
[dedx_extra.{h,c}](#dedx_extrahc)

Used in: [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §1,
[`00-redesign-plan.md`](00-redesign-plan.md) §11

---

### qfocus

The `qfocus` URL parameter controls which **quantity columns** are shown in the
multi-program comparison table on the Calculator page (Advanced mode only).

| Value | Columns shown |
|-------|--------------|
| `both` | All stopping power columns + all CSDA range columns (default) |
| `stp` | Stopping power columns only |
| `csda` | CSDA range columns only |

`qfocus` is emitted in every canonical Advanced-mode Calculator URL, even when
set to the default `both`, to make the URL self-describing. It does not gate the
Inverse STP or Range tabs — those depend solely on Advanced mode being active.

**Type/file:** URL query param; defined in
[`multi-program.md`](04-feature-specs/multi-program.md) §4,
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §2

→ see also: [Advanced Mode / Basic Mode](#advanced-mode--basic-mode)

Used in: [`multi-program.md`](04-feature-specs/multi-program.md),
[`shareable-urls.md`](04-feature-specs/shareable-urls.md) §3.3,
[`inverse-lookups.md`](04-feature-specs/inverse-lookups.md) §1

---

### Runes

Svelte 5's **reactive primitives**, replacing Svelte 4 stores and reactive
statements. This project uses **Svelte 5 only** — Svelte 4 patterns are
prohibited.

| Rune | Purpose |
|------|---------|
| `$state` | Declares reactive mutable state (replaces `let` + `$:`) |
| `$derived` | Declares a value computed from reactive state (replaces `$:` assignments) |
| `$effect` | Runs a side-effect when reactive dependencies change (replaces `onMount`/`onDestroy` + `$:`) |
| `$props` | Declares component props (replaces `export let`) |
| `$bindable` | Declares a prop that the parent can bind to |

The `svelte/store` module and `$` auto-subscription syntax are replaced by
runes-based fine-grained reactivity.

**Type/file:** Any `.svelte` file; authoritative guidance in
[`00-redesign-plan.md`](00-redesign-plan.md) §2 and
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md)

Used in: [`00-redesign-plan.md`](00-redesign-plan.md) §2

---

### Series

A single **(particle, material, program)** triplet on the Plot page that
produces one stopping-power-vs-energy curve. Multiple series can be overlaid on
a single JSROOT chart. Each series is independently colored and labelled.

In the URL, series are encoded as comma-separated triplets in the `series`
parameter, e.g. `series=1.276.2,6.276.9` (particleId.materialId.programId).
External-data entities use the `ext:{label}:{id}` notation within a triplet.

**Type/file:** `src/lib/stores/` — series state; defined in
[`plot.md`](04-feature-specs/plot.md)

→ see also: [Entity](#entity)

Used in: [`plot.md`](04-feature-specs/plot.md),
[`shareable-urls.md`](04-feature-specs/shareable-urls.md) §3.2,
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §2

---

### SSG

**Static Site Generation** — a build strategy where all pages are pre-rendered
to plain HTML files at build time, rather than rendered per-request on a server.
webdedx uses SSG via `@sveltejs/adapter-static`: `pnpm build` produces a
`build/` directory of static HTML + JS + CSS that can be served by any static
host — GitHub Pages in this project.

Architectural consequences:

- All SvelteKit routes must declare `export const prerender = true`.
- No server-side logic. All computation is WASM (client-side).
- WASM initialization must **not** run in `+layout.ts` during prerender.
  Instead, browser-targeted startup is deferred to browser-only code in
  `+layout.svelte` (via a `$effect`), so the SSG prerender pass does not
  execute the Emscripten `ENVIRONMENT='web'` module where browser globals
  and runtime support are unavailable.
- URL state is encoded in the query string; no server-side routing is available
  to parse clean paths.

**Type/file:** `svelte.config.js` (`adapter-static` config),
`src/routes/*/+page.ts` (`prerender = true` exports)

→ see also: [CI/CD](#cicd), [CORS](#cors)

Used in: [`03-architecture.md`](03-architecture.md) §10,
[`02-tech-stack.md`](02-tech-stack.md) §1

---

### StoredCompound

The TypeScript interface for a user-defined compound as persisted in
`localStorage` (key: `customCompounds`). Contains the user-facing display name,
elemental composition (`atomicNumber` + `atomCount` per element), density,
optional I-value, phase, a stable UUID `id`, and a creation timestamp.

Distinct from **`CustomCompound`** (the WASM-layer type passed to
`calculateCustomCompound()`), which is a stripped-down object containing only
the fields the C API needs (name, elements, density, optional iValue) and has no
UUID or timestamp.

Conversion: the WASM wrapper constructs a `CustomCompound` from a `StoredCompound`
before each calculation call.

**Type/file:** `src/lib/wasm/types.ts` — `StoredCompound`; defined in
[`custom-compounds.md`](04-feature-specs/custom-compounds.md) §1.1

→ see also: [Custom Compound](#custom-compound), [dedx_config](#dedx_config)

Used in: [`custom-compounds.md`](04-feature-specs/custom-compounds.md) §1.1,
[`06-wasm-api-contract.md`](06-wasm-api-contract.md) §2.5

---

### urlv

The `urlv` URL query parameter is the **URL contract major version sentinel**.
It is written to every canonical URL and read back on load to detect breaking
schema changes.

Current value: **`1`** (Stage 1). If a URL omits `urlv`, the parser assumes `1`
for backward compatibility. If a received URL has a higher major version than
the running app supports, a user-visible warning is shown with a "Use anyway"
fallback.

Example: `?urlv=1&particle=1&material=276&…`

**Type/file:** URL query string; defined in
[`shareable-urls.md`](04-feature-specs/shareable-urls.md) §3.1,
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md) §2

→ see also: [Canonicalization](#canonicalization)

Used in: [`shareable-urls.md`](04-feature-specs/shareable-urls.md) §3.1,
[`shareable-urls-formal.md`](04-feature-specs/shareable-urls-formal.md)
