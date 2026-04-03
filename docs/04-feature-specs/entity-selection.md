# Feature: Entity Selection (Ion → Material → Program)

> **Status:** Draft v3 (3 April 2026)
>
> Covers the entity selection component used on both the
> Calculator and Plot pages. This is the primary interaction point
> for choosing *what* to calculate.
>
> **v2 changes:** Reversed the visual and logical order from Program-first
> to Ion → Material → Program. Added bidirectional filtering via a
> compatibility matrix. Added support for "program-first" workflow via
> independent unselect. See [libdedx#79](https://github.com/APTG/libdedx/issues/79)
> for user feedback motivating this change.
>
> **v3 changes:** Adopted always-visible scrollable list panels (inspired by
> `libdedx_demo.html`) instead of dropdown comboboxes. Unavailable items are
> greyed out rather than hidden. Material panel split into two independently
> scrollable sub-lists (Elements / Compounds) sharing one text filter.

---

## User Story

**As a** radiation physicist,
**I want to** first choose my projectile (ion) and target (material), then see
which stopping-power programs can serve that combination,
**so that** I follow the natural mental model of a physics experiment: pick the
beam, pick the target, *then* pick the data source — rather than memorizing
which programs exist.

**As a** data quality researcher,
**I want to** select a specific program first, then see which ions and materials
it covers,
**so that** I can audit data availability per database.

---

## Compatibility Matrix

### Why it is needed

The libdedx C API exposes only program-centric queries:
`dedx_fill_ion_list(program)` and `dedx_fill_material_list(program)`.
There is no reverse lookup (e.g., "which programs support Carbon on Water").
See [libdedx#79](https://github.com/APTG/libdedx/issues/79) — a native
`dedx_get_programs_for_ion_material()` function is requested but not yet
available. Until it is, the frontend must derive valid combinations itself.

### How it is built

At WASM init time, the service iterates over every program returned by
`getPrograms()` and calls `getIons(programId)` + `getMaterials(programId)`
for each. The results are stored in an in-memory compatibility matrix:

```typescript
/**
 * Pre-computed at init. Enables O(1) lookups in any direction:
 *   "which programs support ion X?" / "which materials does program P have?"
 *   / "which programs support ion X + material Y?"
 */
interface CompatibilityMatrix {
  /** programId → Set of ion IDs supported by that program. */
  ionsByProgram: Map<number, Set<number>>;
  /** programId → Set of material IDs supported by that program. */
  materialsByProgram: Map<number, Set<number>>;
  /** ionId → Set of program IDs that support this ion. */
  programsByIon: Map<number, Set<number>>;
  /** materialId → Set of program IDs that support this material. */
  programsByMaterial: Map<number, Set<number>>;
  /** All known ions (union across all programs). */
  allIons: IonEntity[];
  /** All known materials (union across all programs). */
  allMaterials: MaterialEntity[];
  /** All known programs. */
  allPrograms: ProgramEntity[];
}
```

The matrix is built once (< 20 programs × ~120 ions × ~280 materials per
program = manageable). The data is static for the lifetime of the page.

> **Performance note**: Building the matrix requires ~20 `getIons()` +
> ~20 `getMaterials()` calls at init. These are synchronous in-memory
> lookups into the compiled WASM data tables, expected to complete in < 100 ms
> total. If profiling shows otherwise, the matrix can be built lazily on
> first use of each program.

---

## Inputs

### 1. Ion Selector (primary — top / left)

| Property | Detail |
|----------|--------|
| Type | Always-visible scrollable list panel with text filter input |
| Data source | Derived from `CompatibilityMatrix.allIons` |
| Display format | `Z=N  Name (Symbol)` — e.g., "Z=6  Carbon (C)" |
| Search aliases | Match on `name`, `aliases` (e.g., "proton" → Hydrogen, "alpha" → Helium), atomic number Z, mass number A, chemical symbol |
| Default | **Proton** (Hydrogen, Z=1) — highlighted on page load |
| Available / unavailable | All ions are always shown. Ions incompatible with the current material+program selection are **greyed out** (reduced opacity, non-interactive). Compatible ions are shown at full contrast. |
| Selected state | The selected ion has a **dark background highlight** (accent colour) with white text. Clicking a selected ion deselects it (toggle). |
| Special | Ion ID 1001 = Electron — only visible (not greyed out) when ESTAR (program 3) is a compatible program for the current selection |
| Clearable | Yes — clicking the selected item again toggles it off, or a clear (×) button in the panel header |

### 2. Material Selector (second — middle)

The material selector is **wider** than the other two panels because it
contains a split layout with two independently scrollable sub-lists.

| Property | Detail |
|----------|--------|
| Type | Always-visible **split panel**: one shared text filter on top, two side-by-side scrollable sub-lists below ("Elements" on the left, "Compounds" on the right) |
| Data source | Derived from `CompatibilityMatrix.allMaterials` |
| Display format | `ID  Name` — e.g., "276  Water (liquid)" |
| Search | A single text filter input at the top filters **both** sub-lists simultaneously. Match on `name`, material ID, common aliases (e.g., "water" → "Water (liquid)") |
| Default | **Water (liquid)** (ID 276) — highlighted on page load |
| Available / unavailable | All materials are always shown. Materials incompatible with the current ion+program selection are **greyed out** (reduced opacity, non-interactive). Compatible materials shown at full contrast. |
| Selected state | Dark background highlight with white text (same style as ion/program). Toggle off by clicking again. |
| Split layout | **Elements** (material IDs 1–98, i.e. pure chemical elements) in the left sub-list, sorted by ID (= atomic number). **Compounds** (IDs 99–278 + 906 Graphite, i.e. mixtures, tissues, plastics, etc.) in the right sub-list, sorted alphabetically by name. Each sub-list has its own independent scroll position. |
| Special | Gas-default materials (29 entries) shown with a gas indicator icon/badge |
| Clearable | Yes — click selected item to toggle off, or clear (×) button in the panel header |

### 3. Program Selector (last — bottom / right)

| Property | Detail |
|----------|--------|
| Type | Always-visible scrollable list panel with text filter input |
| Data source | Derived from `CompatibilityMatrix.allPrograms` |
| Display format | `name — description` (e.g., "PSTAR — proton stopping powers (NIST)") |
| Grouping | Two visual groups separated by a labelled divider: **"Tabulated data"** (ASTAR, PSTAR, MSTAR, ICRU family) and **"Analytical models"** (Bethe-Bloch variants). Matches demo layout. |
| Default | **"Auto-select"** — a virtual entry at the top, always available, resolves to the best ICRU dataset for the current ion/material (see §4.3 of 01-project-vision.md) |
| Available / unavailable | All programs are always shown. Programs incompatible with the current ion+material selection are **greyed out**. "Auto-select" is never greyed out. |
| Selected state | Dark background highlight with white text. Toggle to deselect; deselecting any program resets to "Auto-select". |
| Clearable | No explicit clear — deselecting returns to "Auto-select" |

---

## Behavior

### Bidirectional Filtering

Unlike v1, there is **no single root selector**. All three selectors filter
each other bidirectionally via the compatibility matrix:

```
Ion ←→ Material ←→ Program
 ↑                    ↑
 └────────────────────┘
```

When any selector changes, the available options in the other two selectors
are recomputed. The filtering logic is:

```typescript
// Pseudocode for deriving available options:
function getAvailablePrograms(ion?: number, material?: number): ProgramEntity[] {
  let candidates = matrix.allPrograms;
  if (ion != null) {
    const progs = matrix.programsByIon.get(ion);
    candidates = candidates.filter(p => progs?.has(p.id));
  }
  if (material != null) {
    const progs = matrix.programsByMaterial.get(material);
    candidates = candidates.filter(p => progs?.has(p.id));
  }
  return candidates;
}

function getAvailableIons(program?: number, material?: number): IonEntity[] {
  let candidates = matrix.allIons;
  if (program != null) {
    const ions = matrix.ionsByProgram.get(program);
    candidates = candidates.filter(i => ions?.has(i.id));
  }
  if (material != null) {
    // ions that share at least one program with this material
    const materialProgs = matrix.programsByMaterial.get(material);
    candidates = candidates.filter(i => {
      const ionProgs = matrix.programsByIon.get(i.id);
      return ionProgs && materialProgs &&
        [...ionProgs].some(p => materialProgs.has(p));
    });
  }
  return candidates;
}

// getAvailableMaterials is symmetric to getAvailableIons
```

### Step-by-Step Flow

1. **On WASM init (page load):**
   - Fetch all programs via `getPrograms()`.
   - For each program, fetch ions and materials to build the `CompatibilityMatrix`.
   - Insert a synthetic **"Auto-select"** entry at the top of the program list
     (this is a frontend construct, not from libdedx).
   - Set defaults: Ion = Proton (ID 1), Material = Liquid Water (ID 276),
     Program = "Auto-select".
   - Compute available options for each selector based on defaults.

2. **User changes ion (typical first step):**
   - Update the selected ion.
   - Recompute available materials: only materials that share at least one
     program with the new ion.
   - Recompute available programs: only programs that support the new ion
     (and the current material, if one is selected).
   - **Preserve current material** if it is still in the available list.
     Otherwise, fall back to Liquid Water if available, else the first material.
   - **Preserve current program** if still compatible. Otherwise, reset to
     "Auto-select".
   - Show a brief notification if material or program was changed
     (e.g., "PSTAR does not support Carbon; program reset to Auto-select").
   - If the ion has `massNumber === 1` (proton), the energy unit selector
     should hide "MeV/nucl" (it is numerically identical to MeV for A=1).
     See `unit-handling.md` for details.

3. **User changes material (typical second step):**
   - Update the selected material.
   - Recompute available ions: only ions that share at least one program with
     the new material.
   - Recompute available programs: only programs that support the new material
     (and the current ion, if one is selected).
   - **Preserve current ion** if still available. Otherwise, fall back to
     Proton if available, else the first ion.
   - **Preserve current program** if still compatible. Otherwise, reset to
     "Auto-select".
   - Show notification if ion or program was auto-changed.

4. **User changes program (typical third step, or "program-first" workflow):**
   - Update the selected program.
   - Recompute available ions: only ions supported by the new program (and
     compatible with the current material, if set).
   - Recompute available materials: only materials supported by the new program
     (and compatible with the current ion, if set).
   - **Preserve current ion** if still available. Otherwise, fall back to
     Proton if available, else the first ion.
   - **Preserve current material** if still available. Otherwise, fall back to
     Liquid Water if available, else the first material.
   - Show notification for any auto-changed selections.

5. **User clears ion (unselects):**
   - Remove the ion filter.
   - Recompute available materials and programs based only on the remaining
     selections (material and/or program).
   - The material and program lists expand to show all compatible options.
   - The program selection is preserved. This allows the "program-first"
     workflow: select a program, clear the ion, and see all available
     ions/materials for that program.

6. **User clears material (unselects):**
   - Symmetric to clearing ion. Programs and ions recalculated without
     material constraint.

7. **Auto-select program resolution (display):**
   - When "Auto-select" is active, after any ion or material change, resolve
     the concrete program that would be used for the current combination.
   - Display the resolved program name, e.g., *"Auto-select → ICRU 90"*.
   - Resolution uses `DEDX_ICRU` internally; the resolution chain is:
     - Proton: ICRU 90 → PSTAR
     - Alpha: ICRU 90 → ICRU 49
     - Carbon: ICRU 90 → ICRU 73 → ICRU 73 (old)
     - Other heavy ions: ICRU 73 → ICRU 73 (old)
   - Future: a webdedx-level auto-selection layer may extend this (e.g., prefer
     MSTAR for specific heavy-ion/material combos). This is out of scope for v1
     but the data model should not preclude it.

### "Program-first" Workflow (Reverse Order)

Users may also want to explore data availability per program. This workflow
is supported without any mode toggle:

1. Clear ion and material (or start fresh).
2. Select a specific program (e.g., MSTAR).
3. The ion list shows only ions MSTAR supports. The material list shows
   only materials MSTAR supports.
4. Select an ion from the filtered list → material list narrows further.
5. Select a material → ready to calculate.

This is the reverse of the default flow but uses the same bidirectional
filtering logic. The visual order (Ion → Material → Program) remains
constant — only the user's interaction order changes.

### Text Filter Behavior

Each panel has a text filter input above its scrollable list(s):

- Typing filters the list in real time (case-insensitive substring match).
- For the material panel, the single filter applies to **both** the Elements
  and Compounds sub-lists simultaneously.
- Matching text in the results is **not** hidden — non-matching items are
  hidden, but greyed-out (unavailable) items that match the filter remain
  visible in their greyed-out state. This lets users see that an item exists
  but is currently incompatible.
- If the filter matches zero items in a list, show "No results" in that list.
- Clearing the filter input restores the full list.
- Arrow keys navigate the visible (non-hidden) items; Enter selects; Escape
  clears the filter text.
- The filter input has a small clear (×) icon when non-empty.

### Selection & Deselection Behavior

- **Clicking an available item** selects it (dark background highlight).
- **Clicking the currently selected item** deselects it (toggle behaviour),
  removing that entity's filtering constraint from the other panels.
- **Clicking a greyed-out item** does nothing (pointer events disabled).
- When an entity is deselected, other panels immediately recalculate which
  items are available/greyed-out based on the remaining selections.
- The Program panel has no explicit deselect — deselecting always returns
  to "Auto-select".
- A "Reset all" link above the panels clears all selections back to defaults
  (Proton / Liquid Water / Auto-select).

### Greyed-Out (Disabled) Items

Unavailable items are shown **greyed out** in-place rather than hidden:

- Reduced opacity (~0.4) and `pointer-events: none`.
- They maintain their position in the list so the layout doesn't jump.
- This communicates *what exists* in libdedx even when it's not compatible
  with the current selection — useful for discoverability.
- The text filter can still match greyed-out items (they remain visible
  but non-interactive).

> **Rationale:** The demo (`libdedx_demo.html`) showed that greying out
> items works well even for the ~280-item material list. Users can see the
> full data landscape and understand why certain items are unavailable.

### Search Matching Rules

| Entity | Searchable fields |
|--------|-------------------|
| Program | `name`, `version` |
| Ion | `name`, `aliases` (e.g., "proton", "alpha", "deuteron"), `Z` (atomic number as string), `A` (mass number as string) |
| Material | `name`, `id` (as string), common aliases |

For ions, the `aliases` field from `IonEntity` provides human-friendly names:

| Ion ID | Name | Aliases |
|--------|------|---------|
| 1 | Hydrogen | proton, p, H-1 |
| 2 | Helium | alpha, α, He-4 |
| 6 | Carbon | C-12 |
| 1001 | Electron | e⁻, e-, beta |

> The alias list is a frontend configuration, not from libdedx. It should be
> defined as a static lookup table in `src/lib/config/ion-aliases.ts`.

### Loading States

- While WASM is initializing and the compatibility matrix is being built,
  all entity selectors show a loading skeleton/spinner.
- If WASM init fails, show an error banner with a retry button. Entity
  selectors are disabled.

> **Note:** After init, all filtering is done in-memory against the
> compatibility matrix. There are no subsequent async fetches when the user
> changes a selector — the UI updates synchronously.

### Error States

| Error | Handling |
|-------|----------|
| WASM init failure | Error banner, all selectors disabled, retry button |
| Compatibility matrix contains a program with zero ions or materials | Omit that program from `allPrograms` (data issue in libdedx, not actionable by user) |
| Previously selected ion/material unavailable after a change in another selector | Auto-fall-back + notification |
| All three selectors cleared to a state with zero compatible programs | Show inline warning: "No program supports this combination" (should not happen with valid data) |

---

## Output

The entity selection component does not produce user-visible output on its own.
It provides the **selected state** to parent components (Calculator, Plot):

```typescript
interface EntitySelectionState {
  /** The selected program (or the "Auto-select" virtual entry). */
  program: ProgramEntity | AutoSelectProgram;
  /** The resolved program ID for C API calls (always a real program ID). */
  resolvedProgramId: number;
  /** The selected ion, or null if cleared. */
  ion: IonEntity | null;
  /** The selected material, or null if cleared. */
  material: MaterialEntity | null;
  /**
   * True when all three selections are made and the combination is valid
   * for calculation. Parent components should disable "Calculate" / "Plot"
   * buttons when this is false.
   */
  isComplete: boolean;
  /** Available options for each selector given the current constraints. */
  availablePrograms: ProgramEntity[];
  availableIons: IonEntity[];
  availableMaterials: MaterialEntity[];
}

/** The synthetic "Auto-select" program entry. */
interface AutoSelectProgram {
  id: -1;  // sentinel value, never sent to C API
  name: "Auto-select";
  /** The concrete program it resolves to for the current ion/material. */
  resolvedProgram: ProgramEntity | null;  // null when ion or material is cleared
}
```

This state is exposed via Svelte 5 `$props` / `$bindable` or a shared runes-based
store (architecture TBD in `docs/03-architecture.md`).

---

## UI Layout

### Visual Order

The selectors always appear in this order, reflecting the natural physics
workflow (beam → target → data source):

1. **Ion** (projectile)
2. **Material** (target)
3. **Program** (data source / database)

Users are free to interact with them in any order. The visual order is a
hint, not an enforcement.

### Panel Style (all breakpoints)

Each panel is a **card** with:
- A header: numbered label (e.g., "① Ion / Particle"), accent colour.
- A text filter input below the header.
- A scrollable list body (fixed height, ~400px on desktop, adapts on mobile).
- A rounded border, subtle shadow, white background.

The selected item has a **dark accent background** (`#0d7377` or Tailwind
equivalent) with white text. Greyed-out items use `opacity: 0.4`.

> Design reference: `libdedx_demo.html` — the card + list + filter + highlight
> pattern from that prototype is the target aesthetic.

### Desktop (≥900px)

Three panels in a **horizontal grid row**:

```
┌──────────────────┐ ┌───────────────────────────────────┐ ┌──────────────────┐
│ ① Ion / Particle │ │ ② Target Material                 │ │ ③ Method/Program │
│ [Filter... ]     │ │ [Filter...                      ] │ │ [Filter... ]     │
│ ┌──────────────┐ │ │ ┌───────────────┬─────────────────┐│ │ ┌──────────────┐ │
│ │ Z=1  Proton  │ │ │ │ ELEMENTS      │ COMPOUNDS       ││ │ │ ─Tabulated─  │ │
│ │ Z=2  Alpha   │ │ │ │ 1  Hydrogen   │ 99  A-150 Plast ││ │ │ ASTAR        │ │
│ │ Z=3  Lithium │ │ │ │ 2  Helium     │ 101 Acetylene   ││ │ │ PSTAR        │ │
│ │ Z=4  Beryll. │ │ │ │ ...           │ ...             ││ │ │ MSTAR        │ │
│ │ ...          │ │ │ │ (scroll ↕)    │ (scroll ↕)      ││ │ │ ICRU 49      │ │
│ │ (scroll ↕)   │ │ │ └───────────────┴─────────────────┘│ │ │ ...          │ │
│ └──────────────┘ │ └───────────────────────────────────┘ │ │ ─Analytical─ │ │
└──────────────────┘                                       │ │ Bethe-Bloch  │ │
                                                           │ └──────────────┘ │
                                                           └──────────────────┘
```

- Grid: `grid-template-columns: 1fr 2fr 1fr` — the Material panel is **twice
  as wide** as Ion and Program because it contains two sub-lists side by side.
- Inside the Material panel, the two sub-lists split the space 50/50
  horizontally, each with its own scroll position.
- Each sub-list has a small uppercase group header ("Elements" / "Compounds")
  that stays pinned at the top (sticky).
- The "Auto-select → ICRU 90" resolved label appears below the program
  panel's list (or as a subtle line inside the panel header).

### Tablet (600–899px)

Same three-panel row, but `grid-template-columns: 1fr 1.5fr 1fr`.
The material panel's sub-lists stack narrower but remain side-by-side.
List height reduces to ~300px.

### Mobile (<600px)

Three panels **stacked vertically**, full width. The material panel's
Elements and Compounds sub-lists remain **side by side** (each taking 50% width)
but with a reduced height (~200px each).

```
┌──────────────────────────────────────┐
│ ① Ion / Particle                     │
│ [Filter...                        ]  │
│ ┌──────────────────────────────────┐  │
│ │ Z=1  Proton (H)                  │  │
│ │ Z=2  Alpha (He)                  │  │
│ │ ...                    scroll ↕  │  │
│ └──────────────────────────────────┘  │
├──────────────────────────────────────┤
│ ② Target Material                    │
│ [Filter...                        ]  │
│ ┌────────────────┬───────────────────┐│
│ │ ELEMENTS       │ COMPOUNDS         ││
│ │ 1 Hydrogen     │ 276 Water (liq.)  ││
│ │ ...  scroll ↕  │ ...    scroll ↕   ││
│ └────────────────┴───────────────────┘│
├──────────────────────────────────────┤
│ ③ Method / Program                   │
│ [Filter...                        ]  │
│ ┌──────────────────────────────────┐  │
│ │ Auto-select → ICRU 90            │  │
│ │ PSTAR            ...   scroll ↕  │  │
│ └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## Accessibility

- Each panel has a visible heading (`<h2>` or `<label>`) associated with its list.
- The text filter input has `role="searchbox"` and `aria-controls` pointing to
  the list(s) it filters. For the material panel, `aria-controls` references
  both sub-lists.
- Each scrollable list has `role="listbox"`; each item has `role="option"`.
- Greyed-out items have `aria-disabled="true"`.
- The selected item has `aria-selected="true"`.
- Arrow keys navigate the visible (non-hidden) items within a focused list;
  Enter selects; Escape clears the filter text.
- Screen readers announce the number of available (non-greyed) results
  (e.g., "3 of 12 ions available").
- Color is not the sole indicator for gas-default materials (icon + text badge).
- Greyed-out state is communicated via both opacity and `aria-disabled`,
  not colour alone.

---

## Acceptance Criteria

### Layout & Panels
- [ ] Three panels are displayed: Ion, Material, Program — in that visual order.
- [ ] On desktop (≥900px), panels are in a horizontal grid with the Material panel taking 2× width.
- [ ] On mobile (<600px), panels stack vertically; material sub-lists remain side-by-side.
- [ ] The Material panel contains two independently scrollable sub-lists: Elements (IDs 1–98) and Compounds (IDs 99+).
- [ ] Each sub-list has a sticky group header ("Elements" / "Compounds").

### Defaults & Init
- [ ] On page load, entity selectors populate from WASM data within 2 seconds (after WASM init).
- [ ] Default state is Proton / Water (liquid) / Auto-select with no user interaction required.
- [ ] The compatibility matrix is built at init from all programs' ion/material lists.

### Bidirectional Filtering
- [ ] Selecting an ion greys out incompatible materials and programs.
- [ ] Selecting a material greys out incompatible ions and programs.
- [ ] Selecting a program greys out incompatible ions and materials.
- [ ] Greyed-out items have reduced opacity (~0.4) and are non-interactive (`pointer-events: none`).
- [ ] Greyed-out items remain in their original list position (no layout shift).
- [ ] Deselecting (toggling off) an entity removes its filtering constraint; other panels update immediately.

### Preserve / Fallback
- [ ] Changing a selector preserves the current selections in other panels if they remain compatible.
- [ ] If a previously selected ion or material becomes incompatible, the selector falls back to the default (Proton / Water) if available, else the first available entry, and a notification is shown.

### Text Filter
- [ ] Typing in any panel's filter input filters that panel's list with case-insensitive substring matching.
- [ ] The Material panel's single filter input filters both Elements and Compounds sub-lists simultaneously.
- [ ] Ion filter matches on name, aliases ("proton", "alpha"), Z, A, and chemical symbol.
- [ ] Material filter matches on name and numeric ID.
- [ ] Greyed-out items that match the filter remain visible (greyed out, not hidden).
- [ ] Non-matching items are hidden from view.

### Selection UX
- [ ] Clicking an available item selects it with a dark accent background and white text.
- [ ] Clicking the selected item again deselects it (toggle).
- [ ] Clicking a greyed-out item does nothing.
- [ ] The "Auto-select" program displays the resolved concrete program name (e.g., "Auto-select → ICRU 90").
- [ ] Resolved program updates when ion or material changes while "Auto-select" is active.
- [ ] A "Reset all" link restores defaults (Proton / Water / Auto-select).

### Program Panel
- [ ] Programs are grouped into "Tabulated data" and "Analytical models" with labelled dividers.
- [ ] "Auto-select" is always shown at the top and never greyed out.

### Keyboard & Accessibility
- [ ] Each panel is keyboard-navigable (Tab to filter, Arrow keys to navigate list, Enter to select, Escape to clear filter).
- [ ] ARIA attributes: `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`, `role="searchbox"` on filters.
- [ ] Screen readers announce available item counts.
- [ ] Loading state is shown while WASM initializes.
- [ ] Error state with retry is shown if WASM init fails.

### Special Cases
- [ ] Electron (ion ID 1001) appears in the ion list only when ESTAR is a compatible program.
- [ ] Gas-default materials are visually indicated with an icon and text badge, not colour alone.

---

## Dependencies

- `LibdedxService` interface (see [docs/06-wasm-api-contract.md](../06-wasm-api-contract.md)):
  `getPrograms()`, `getIons(programId)`, `getMaterials(programId)`
- Ion alias configuration: `src/lib/config/ion-aliases.ts` (to be created)
- Svelte 5 runes for reactive state (`$state`, `$derived`, `$effect`)
- Tailwind CSS for layout and responsive breakpoints

---

## Open Questions

1. **Auto-select resolution visibility:** Should the resolved program be shown
   only as a subtle label, or also as a tooltip on the program selector?
   *Current decision: subtle label below the program list inside the panel.*

2. ~~**Material grouping**~~ **Resolved.** Materials are split into two
   side-by-side sub-lists (Elements / Compounds) with a shared text filter.
   Each sub-list scrolls independently.

3. **Panel scroll height:** ~400px on desktop, ~300px on tablet, ~200px on
   mobile. Exact values to be refined during implementation.
   *Inspired by `libdedx_demo.html` which uses `height: 400px`.*

4. **Graphite (ID 906):** This is a special allotrope of Carbon (element 6)
   with its own material ID. Should it appear in the Elements sub-list
   (alongside Carbon) or in the Compounds sub-list? The demo places it at
   the end of the full list.
   *Current decision: place in Compounds sub-list (ID ≥ 99 rule), with a
   note "(allotrope of Carbon)" in the display name.*

5. **Sort order within Elements sub-list:** By atomic number (= material ID)
   or alphabetically? *Current decision: by ID (= atomic number), matching
   periodic table order, as in the demo.*
