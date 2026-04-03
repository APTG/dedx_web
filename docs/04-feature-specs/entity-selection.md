# Feature: Entity Selection (Cascading Program / Ion / Material)

> **Status:** Draft v1 (3 April 2026)
>
> Covers the cascading entity selection component used on both the
> Calculator and Plot pages. This is the primary interaction point
> for choosing *what* to calculate.

---

## User Story

**As a** radiation physicist,
**I want to** select a stopping-power program, ion, and material with minimal
effort and immediate feedback,
**so that** I can quickly set up calculations without memorizing libdedx IDs
or guessing which combinations are valid.

---

## Inputs

### 1. Program Selector

| Property | Detail |
|----------|--------|
| Type | Searchable dropdown (typeahead / autocomplete) |
| Data source | `LibdedxService.getPrograms()` → `ProgramEntity[]` |
| Display format | `name` + `version` (e.g., "PSTAR (v1.0)") |
| Default | **"Auto-select"** — a virtual program entry that resolves to the best available ICRU dataset for the current ion/material combination (see §4.3 of 01-project-vision.md) |
| Constraint | Always populated; the list is static after WASM init |

### 2. Ion Selector

| Property | Detail |
|----------|--------|
| Type | Searchable dropdown (typeahead / autocomplete) |
| Data source | `LibdedxService.getIons(programId)` → `IonEntity[]` |
| Display format | `name` (Z, A) — e.g., "Carbon (Z=6, A=12)" |
| Search aliases | Match on `name`, `aliases` (e.g., "proton" → Hydrogen, "alpha" → Helium), atomic number Z, mass number A |
| Default | **Proton** (Hydrogen, Z=1) |
| Constraint | List depends on the selected program; re-fetched on program change |
| Special | Ion ID 1001 = Electron (ESTAR program only) |

### 3. Material Selector

| Property | Detail |
|----------|--------|
| Type | Searchable dropdown (typeahead / autocomplete) |
| Data source | `LibdedxService.getMaterials(programId)` → `MaterialEntity[]` |
| Display format | `name` (ID) — e.g., "Liquid Water (276)" |
| Search | Match on `name`, material ID, common aliases (e.g., "water" → "Liquid Water") |
| Default | **Liquid Water** (ID 276) |
| Constraint | List depends on the selected program; re-fetched on program change |
| Special | Gas-default materials (29 entries) shown with a gas indicator icon/badge |

---

## Behavior

### Cascading Dependency Chain

```
Program → { valid ions, valid materials }
          ↓                    ↓
      Ion selector       Material selector
```

**Program is the root.** Changing the program re-fetches both the ion list and
the material list. Ion and material selectors are independent siblings — changing
one does not affect the other's available options.

### Step-by-Step Flow

1. **On WASM init (page load):**
   - Fetch programs via `getPrograms()`.
   - Insert a synthetic **"Auto-select"** entry at the top of the program list
     (this is a frontend construct, not from libdedx).
   - Set the default program to "Auto-select".
   - When "Auto-select" is the active program, use `DEDX_ICRU` (ID 9) as the
     `programId` for fetching ions and materials, since ICRU is the union of
     the best available data.
   - Fetch ions and materials for the resolved program ID.
   - Set default ion to Proton (ID 1), default material to Liquid Water (ID 276).

2. **User changes program:**
   - Re-fetch ion list via `getIons(newProgramId)`.
   - Re-fetch material list via `getMaterials(newProgramId)`.
   - **Preserve current ion selection** if the new program supports it (same ion ID exists in the new list). Otherwise, fall back to the first ion in the new list.
   - **Preserve current material selection** if the new program supports it (same material ID exists in the new list). Otherwise, fall back to the first material in the new list.
   - Show a brief notification if the previously selected ion or material was not available in the new program (e.g., "Carbon is not available in PSTAR; switched to Proton").

3. **User changes ion:**
   - Update the selected ion.
   - No cascade — the material list is not affected by ion choice.
   - If the ion has `massNumber === 1` (proton), the energy unit selector
     should hide "MeV/nucl" (it is numerically identical to MeV for A=1).
     See `unit-handling.md` for details.

4. **User changes material:**
   - Update the selected material.
   - No cascade — the ion list is not affected by material choice.

5. **Auto-select program resolution (display):**
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

### Typeahead / Autocomplete Behavior

- The dropdown opens on focus (click or keyboard focus).
- Typing filters the list in real time (case-insensitive substring match).
- Matching text in the results is highlighted (bold or underline).
- Arrow keys navigate the filtered list; Enter selects; Escape closes.
- If the filter matches zero items, show "No results" message.
- Clearing the search input restores the full list.
- The component is usable with **keyboard only** (Tab → type → Arrow → Enter).

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

- While WASM is initializing, entity selectors show a loading skeleton/spinner.
- While ion/material lists are being re-fetched after a program change, show
  an inline loading indicator on the affected selectors. The program selector
  remains interactive.
- If WASM init fails, show an error banner with a retry button. Entity
  selectors are disabled.

### Error States

| Error | Handling |
|-------|----------|
| WASM init failure | Error banner, all selectors disabled, retry button |
| `getIons()` / `getMaterials()` returns empty | Show "No data available for this program" in the dropdown |
| Previously selected ion/material unavailable after program change | Auto-fall-back + notification (see step 2) |

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
  /** The selected ion. */
  ion: IonEntity;
  /** The selected material. */
  material: MaterialEntity;
}

/** The synthetic "Auto-select" program entry. */
interface AutoSelectProgram {
  id: -1;  // sentinel value, never sent to C API
  name: "Auto-select";
  /** The concrete program it resolves to for the current ion/material. */
  resolvedProgram: ProgramEntity;
}
```

This state is exposed via Svelte 5 `$props` / `$bindable` or a shared runes-based
store (architecture TBD in `docs/03-architecture.md`).

---

## UI Layout

### Desktop (≥768px)

Three selectors in a **horizontal row**: `[Program ▾] [Ion ▾] [Material ▾]`

- Each selector takes roughly one-third of the available width.
- Dropdown panels open below the input, full width of the selector.
- The "Auto-select → ICRU 90" resolved label appears as a subtle subtitle
  below the program selector.

### Mobile (<768px)

Three selectors **stacked vertically**, full width:

```
[Program ▾          ]
  → Auto-select → ICRU 90
[Ion ▾               ]
[Material ▾          ]
```

- Dropdown panels take full viewport width on small screens.
- Virtual keyboard does not obscure the dropdown results (the dropdown
  panel scrolls within the visible area above the keyboard).

---

## Accessibility

- Each selector has a visible `<label>` associated via `for`/`id`.
- The typeahead input has `role="combobox"`, `aria-expanded`, `aria-activedescendant`.
- The dropdown list has `role="listbox"`; each option has `role="option"`.
- Focus is trapped within the open dropdown; Escape returns focus to the input.
- Screen readers announce the number of filtered results (e.g., "3 of 12 ions").
- Color is not the sole indicator for gas-default materials (icon + text badge).

---

## Acceptance Criteria

- [ ] On page load, entity selectors populate from WASM data within 2 seconds (after WASM init).
- [ ] Default state is Auto-select / Proton / Liquid Water with no user interaction required.
- [ ] Changing the program re-fetches ion and material lists; previously selected ion/material are preserved if available in the new program.
- [ ] If the previously selected ion or material is unavailable after a program change, the selector falls back to the first available entry and a notification is shown.
- [ ] Typing in any selector filters the list with case-insensitive substring matching.
- [ ] Ion selector matches on name, aliases ("proton", "alpha"), Z, and A.
- [ ] Material selector matches on name and numeric ID.
- [ ] The "Auto-select" program displays the resolved concrete program name (e.g., "Auto-select → ICRU 90").
- [ ] Resolved program updates when ion or material changes while "Auto-select" is active.
- [ ] Each selector is fully keyboard-navigable (Tab, type, Arrow, Enter, Escape).
- [ ] ARIA attributes are present: `role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`, `aria-activedescendant`.
- [ ] Loading state is shown while WASM initializes or lists are being fetched.
- [ ] Error state with retry is shown if WASM init fails.
- [ ] On mobile (<768px), selectors stack vertically and dropdowns use full width.
- [ ] Electron (ion ID 1001) appears in the ion list only when ESTAR (program ID 3) is selected.
- [ ] Gas-default materials are visually indicated with an icon and text badge, not color alone.

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
   *Current decision: subtle label below the selector.*

2. **Material grouping:** Should materials be grouped by category (elements vs.
   compounds) in the dropdown, or shown as a flat alphabetical list?
   *Leaning toward flat list with search — grouping adds complexity and
   the search typeahead makes browsing unnecessary.*

3. **Max dropdown height:** How many items should be visible before scrolling?
   Material lists can have ~280 entries.
   *Suggested: 8–10 visible items with scrolling.*
