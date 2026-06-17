import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { buildExternalCompatibilityContext } from "$lib/state/external-compatibility";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { makeExternalEntityStore } from "./external-entity-fixtures";

class MockLibdedxService {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 1, name: "ASTAR", version: "1.0" },
      { id: 2, name: "PSTAR", version: "1.0" },
      { id: 4, name: "MSTAR", version: "1.0" },
      { id: 7, name: "ICRU 49", version: "1.0" },
      { id: 9, name: "ICRU", version: "1.0" },
      { id: 101, name: "Bethe-ext", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    const map = new Map<number, ParticleEntity[]>([
      [
        2,
        [
          {
            id: 1,
            name: "Hydrogen",
            massNumber: 1,
            atomicMass: 1.007,
            symbol: "H",
            aliases: ["proton", "p", "H-1"],
          },
        ],
      ],
      [
        4,
        [
          {
            id: 1,
            name: "Hydrogen",
            massNumber: 1,
            atomicMass: 1.007,
            symbol: "H",
            aliases: ["proton"],
          },
          {
            id: 2,
            name: "Helium",
            massNumber: 4,
            atomicMass: 4.002,
            symbol: "He",
            aliases: ["alpha"],
          },
          {
            id: 6,
            name: "Carbon",
            massNumber: 12,
            atomicMass: 12.011,
            symbol: "C",
            aliases: ["C-12"],
          },
        ],
      ],
      [
        7,
        [
          {
            id: 1,
            name: "Hydrogen",
            massNumber: 1,
            atomicMass: 1.007,
            symbol: "H",
            aliases: ["proton"],
          },
          {
            id: 2,
            name: "Helium",
            massNumber: 4,
            atomicMass: 4.002,
            symbol: "He",
            aliases: ["alpha"],
          },
        ],
      ],
      [
        101,
        [
          {
            id: 1,
            name: "Hydrogen",
            massNumber: 1,
            atomicMass: 1.007,
            symbol: "H",
            aliases: ["proton"],
          },
        ],
      ],
    ]);
    return map.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    const m = new Map<number, MaterialEntity[]>([
      [
        2,
        [
          { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
          { id: 6, name: "Carbon", density: 2.0, isGasByDefault: false },
        ],
      ],
      [
        4,
        [
          { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
          { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
          { id: 6, name: "Carbon", density: 2.0, isGasByDefault: false },
        ],
      ],
      [7, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [101, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
    ]);
    return m.get(programId) || [];
  }
}

describe("EntitySelection", () => {
  let state: ReturnType<typeof createEntitySelectionState>;

  beforeEach(() => {
    cleanup();
    const service = new MockLibdedxService();
    const matrix = buildCompatibilityMatrix(service as any);
    state = createEntitySelectionState(matrix);
  });

  test("recipe bar is gone — chrome uses tabs only", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // RecipeBar removed in the entity-selector rework.
    expect(screen.queryByTestId("picker-recipe-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-recipe-particle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-recipe-program")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-recipe-reset")).not.toBeInTheDocument();

    // Tabs still show the current selection inline.
    expect(screen.getByTestId("picker-tab-particle")).toHaveTextContent(/proton/);
    expect(screen.getByTestId("picker-tab-material")).toHaveTextContent(/Water/);
  });

  test("renders three tabs in order: Particle, Material, Program", () => {
    render(EntitySelection, { props: { selectionState: state } });

    const particleTab = screen.getByTestId("picker-tab-particle");
    const materialTab = screen.getByTestId("picker-tab-material");
    const programTab = screen.getByTestId("picker-tab-program");

    expect(particleTab).toHaveAttribute("aria-selected", "true");
    expect(materialTab).toHaveAttribute("aria-selected", "false");
    expect(programTab).toHaveAttribute("aria-selected", "false");
  });

  test("only the active-target tab renders the coral squiggle underline", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // Exactly one squiggle, and it lives inside the active (particle) tab.
    const squiggles = screen.getAllByTestId("picker-tab-squiggle");
    expect(squiggles).toHaveLength(1);
    expect(screen.getByTestId("picker-tab-particle")).toContainElement(squiggles[0]!);
    expect(screen.getByTestId("picker-tab-material")).not.toContainElement(squiggles[0]!);
  });

  test("clicking a tab activates it and renders the matching panel", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    expect(screen.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("picker-material-tab")).toBeInTheDocument();
  });

  test("clicking a tab activates it and sets activeTarget on state", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));

    expect(state.activeTarget).toBe("program");
    expect(state.expanded).toBe(true);
    expect(screen.getByTestId("picker-tab-program")).toHaveAttribute("aria-selected", "true");
  });

  test("picker-level search row is persistent and changes placeholder per active tab", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    // Persistent search row exists once at picker level (not duplicated per tab).
    expect(screen.getByTestId("picker-search-row")).toBeInTheDocument();

    // Placeholder + data-testid swap with activeTarget.
    let input = screen.getByTestId("picker-particle-search") as HTMLInputElement;
    expect(input.placeholder).toBe("Search particles…");

    await user.click(screen.getByTestId("picker-tab-material"));
    input = screen.getByTestId("picker-material-search") as HTMLInputElement;
    expect(input.placeholder).toBe("Search materials…");

    await user.click(screen.getByTestId("picker-tab-program"));
    input = screen.getByTestId("picker-program-search") as HTMLInputElement;
    expect(input.placeholder).toBe("Search programs…");
  });

  test("chevron toggle expands and collapses the panel", async () => {
    render(EntitySelection, { props: { selectionState: state, collapsible: true } });
    const user = userEvent.setup();

    const toggle = screen.getByTestId("picker-toggle");
    // Default selection is complete → collapsible mounts collapsed.
    expect(state.expanded).toBe(false);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("▼");

    await user.click(toggle);
    expect(state.expanded).toBe(true);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("▲");

    await user.click(toggle);
    expect(state.expanded).toBe(false);
  });

  test("particle tab omits electron (spec § Particle)", () => {
    render(EntitySelection, { props: { selectionState: state } });

    expect(screen.queryByTestId("picker-particle-item-1001")).not.toBeInTheDocument();
    expect(screen.queryByText(/^electron$/i)).not.toBeInTheDocument();
  });

  test("particle tab shows flat list with proton + alpha (no section headers)", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // No COMMON/IONS section headers in the new flat-list design.
    expect(screen.queryByText("Common particles")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-particle-item-1")).toHaveTextContent("proton");
    expect(screen.getByTestId("picker-particle-item-2")).toHaveTextContent("alpha particle");
    // Z tags are present on each row.
    expect(screen.getByTestId("picker-particle-item-1")).toHaveTextContent("Z=1");
  });

  test("particle search supports `z=N` operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z=6");

    expect(screen.getByTestId("picker-particle-item-6")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-1")).not.toBeInTheDocument();
  });

  test("particle search supports `z>N` inequality operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z>2");

    expect(screen.getByTestId("picker-particle-item-6")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-2")).not.toBeInTheDocument();
  });

  test("particle search supports `z>=N` inequality operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z>=2");

    expect(screen.getByTestId("picker-particle-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("picker-particle-item-6")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-1")).not.toBeInTheDocument();
  });

  test("particle search supports `z<N` inequality operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z<2");

    expect(screen.getByTestId("picker-particle-item-1")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-6")).not.toBeInTheDocument();
  });

  test("particle search supports `z<=N` inequality operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z<=2");

    expect(screen.getByTestId("picker-particle-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("picker-particle-item-2")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-6")).not.toBeInTheDocument();
  });

  test("material search supports `ρ<N` density operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));
    // Compounds sub-tab is active by default; Air (density=0.0012) and Water (density=1.0).
    await user.type(screen.getByTestId("picker-material-search"), "ρ<0.01");

    expect(screen.getByTestId("picker-material-item-267")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-material-item-276")).not.toBeInTheDocument();
  });

  test("material search supports `ρ>=N` density operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));
    // ρ>=1 should match Water (density=1.0) but not Air (density=0.0012).
    await user.type(screen.getByTestId("picker-material-search"), "ρ>=1");

    expect(screen.getByTestId("picker-material-item-276")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-material-item-267")).not.toBeInTheDocument();
  });

  test("material search supports ASCII `rho<N` alias for ρ", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));
    await user.type(screen.getByTestId("picker-material-search"), "rho<0.01");

    expect(screen.getByTestId("picker-material-item-267")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-material-item-276")).not.toBeInTheDocument();
  });

  test("material `ρ...` search excludes external-only materials without density", async () => {
    const externalStore = makeExternalEntityStore();
    externalStore.materials.push({
      id: "nodensity",
      name: "No Density Material",
      index: externalStore.materials.length,
      linearUnitsAvailable: true,
    });
    state.setExternalContext(
      buildExternalCompatibilityContext([externalStore], state.allParticles, state.allMaterials),
    );

    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();
    await user.click(screen.getByTestId("picker-tab-material"));

    const input = screen.getByTestId("picker-material-search");
    await user.type(input, "ρ>=0");
    expect(screen.queryByText("No Density Material")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "no density material");
    expect(screen.getByText("No Density Material")).toBeInTheDocument();
  });

  test("program search supports `tag=fn` operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "tag=fn");

    // Bethe-ext (id=101) is FN; ICRU 49 (id=7) is TAB — should be hidden.
    expect(screen.getByTestId("picker-program-item-101")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-7")).not.toBeInTheDocument();
  });

  test("program search supports `tag=tab` operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "tag=tab");

    expect(screen.getByTestId("picker-program-item-7")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-101")).not.toBeInTheDocument();
  });

  test("program search `tag=data` is an alias for `tag=tab`", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "tag=data");

    expect(screen.getByTestId("picker-program-item-7")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-101")).not.toBeInTheDocument();
  });

  test("program search supports `tag=ext` for external programs", async () => {
    state.setExternalContext(
      buildExternalCompatibilityContext(
        [makeExternalEntityStore()],
        state.allParticles,
        state.allMaterials,
      ),
    );
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "tag=ext");

    expect(screen.getByText(/SRIM GUI/)).toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-7")).not.toBeInTheDocument();
  });

  test("program search supports `v=` version operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "v=1.0");

    // All programs in the mock have version "1.0" — all should still be visible.
    expect(screen.getByTestId("picker-program-item-7")).toBeInTheDocument();
    expect(screen.getByTestId("picker-program-item-101")).toBeInTheDocument();
  });

  test("program search `v=` with no match hides all programs", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.type(screen.getByTestId("picker-program-search"), "v=9999");

    expect(screen.queryByTestId("picker-program-item-7")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-101")).not.toBeInTheDocument();
  });

  test("selecting a particle when all tabs are non-empty stays put (rule A.4)", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-particle-item-2"));

    expect(state.selectedParticle?.id).toBe(2);
    // Material is already selected (default Water) and Program auto-resolves →
    // all three are non-empty, so activeTarget stays on Particle per rule A.4.
    expect(state.activeTarget).toBe("particle");
  });

  test("material tab renders sub-tab pills with Compounds as default", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    // New design: sub-tab pills replace the column layout.
    expect(screen.getByTestId("material-subtab-compounds")).toBeInTheDocument();
    expect(screen.getByTestId("material-subtab-elements")).toBeInTheDocument();
    // Compounds sub-tab is the active default.
    expect(screen.getByTestId("material-subtab-compounds").getAttribute("aria-selected")).toBe(
      "true",
    );
    // Compounds list is visible.
    expect(screen.getByTestId("picker-material-list-compounds")).toBeInTheDocument();
  });

  test("material picker-sheet locks body scroll and restores on close", async () => {
    // The full-screen sheet is now opened via the search tap target.
    // On desktop (jsdom) the mobile matchMedia query returns false so
    // the search field is an input; opening the sheet requires setSheetOpen().
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    // Open sheet directly through state (mobile tap path).
    state.setSheetOpen(true);
    await tick();

    const dialog = screen.getByRole("dialog", { name: /search material/i });
    const closeButton = within(dialog).getByRole("button", { name: /close search/i });

    expect(document.body.style.overflow).toBe("hidden");

    await user.click(closeButton);
    // The sheet wrapper has a fly out-transition; poll until Svelte removes the
    // element after the transition promise resolves.
    await waitFor(() => expect(screen.queryByTestId("picker-sheet")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  test("gas materials display the (≋) inline glyph", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    // Air is gas, id 267 → compound bucket via id > 98 rule.
    const airItem = screen.getByTestId("picker-material-item-267");
    expect(airItem).toHaveTextContent("(≋)");
  });

  test("program tab renders the Auto-select hero card and a TAB/FN/EXT legend", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));

    expect(screen.getByTestId("picker-program-auto-hero")).toBeInTheDocument();
    const legend = screen.getByTestId("picker-program-legend");
    expect(within(legend).getByTestId("picker-program-tag-TAB")).toBeInTheDocument();
    expect(within(legend).getByTestId("picker-program-tag-FN")).toBeInTheDocument();
    expect(within(legend).getByTestId("picker-program-tag-EXT")).toBeInTheDocument();
  });

  test("program rows carry inline TAB tags for tabulated programs", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));

    const icru49 = screen.getByTestId("picker-program-item-7");
    expect(within(icru49).getByTestId("picker-program-tag-TAB")).toHaveTextContent("DATA");
  });

  test("program rows carry inline FN tags for analytical programs", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));

    const betheExt = screen.getByTestId("picker-program-item-101");
    expect(within(betheExt).getByTestId("picker-program-tag-FN")).toBeInTheDocument();
  });

  test("selecting a program updates state without auto-advance (Program is last)", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));
    await user.click(screen.getByTestId("picker-program-item-7"));

    expect(state.selectedProgram.id).toBe(7);
  });

  test("state.resetAll restores defaults and re-targets Particle tab", async () => {
    render(EntitySelection, { props: { selectionState: state } });

    state.selectParticle(6);
    state.selectMaterial(267);

    state.resetAll();

    expect(state.selectedParticle?.id).toBe(1);
    expect(state.selectedMaterial?.id).toBe(276);
    expect(state.selectedProgram.id).toBe(-1);
    expect(state.activeTarget).toBe("particle");
    expect(state.expanded).toBe(true);
  });

  test("advanced toolbar is hidden in basic mode", async () => {
    render(EntitySelection, { props: { selectionState: state } });

    // Basic mode: no advanced toolbar at all.
    expect(screen.queryByTestId("picker-advanced-toolbar")).not.toBeInTheDocument();
  });

  test("arrow keys on tab bar move focus / activate adjacent tab", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const particleTab = screen.getByTestId("picker-tab-particle");
    particleTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByTestId("picker-tab-material")).toHaveAttribute("aria-selected", "true");
  });

  test("particle list items show Z inline in name (no separate Z column)", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // proton → "proton (Z=1)" in the list
    expect(screen.getByTestId("picker-particle-item-1")).toHaveTextContent("proton (Z=1)");
    // alpha → "alpha particle (Z=2)"
    expect(screen.getByTestId("picker-particle-item-2")).toHaveTextContent("alpha particle (Z=2)");
    // Carbon ion → "Carbon (C, Z=6)"
    expect(screen.getByTestId("picker-particle-item-6")).toHaveTextContent("Carbon (C, Z=6)");
  });

  test("particle anchor option is disabled in multi-select compare mode", () => {
    isAdvancedMode.value = true;
    state.setAcross("particle");
    render(EntitySelection, { props: { selectionState: state } });

    expect(screen.getByTestId("picker-particle-item-1")).toBeDisabled();
    expect(screen.getByTestId("picker-particle-item-2")).not.toBeDisabled();
    isAdvancedMode.value = false;
  });

  test("selected-pill includes Z inline in label (no separate meta)", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // Default: proton is selected — pill should show "proton (Z=1)"
    expect(screen.getByTestId("picker-particle-selected")).toHaveTextContent("proton (Z=1)");
  });

  test("material anchor option is disabled in multi-select compare mode", async () => {
    isAdvancedMode.value = true;
    state.setAcross("material");
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    // Water (276) is in Compounds sub-tab (active by default) — anchor should be disabled.
    expect(screen.getByTestId("picker-material-item-276")).toBeDisabled();

    // Carbon (6) is in Elements sub-tab — switch to it and verify non-anchor is enabled.
    await user.click(screen.getByTestId("material-subtab-elements"));
    expect(screen.getByTestId("picker-material-item-6")).not.toBeDisabled();
    isAdvancedMode.value = false;
  });

  test("material summary bar remains visible when current search filters rows out", async () => {
    isAdvancedMode.value = true;
    state.setAcross("material");
    state.toggleMulti("material", 6);
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));
    await user.clear(screen.getByTestId("picker-material-search"));
    await user.type(screen.getByTestId("picker-material-search"), "zzzz-no-match");

    // Summary bar (picker-material-selected) replaces old pills — always visible.
    const summaryBar = screen.getByTestId("picker-material-selected");
    expect(summaryBar).toHaveTextContent("Water");
    expect(summaryBar).toHaveTextContent("Carbon");
    isAdvancedMode.value = false;
  });

  test("program picker offers a Selected-only filter toggle in multi-select mode (parity with particle picker)", async () => {
    isAdvancedMode.value = true;
    state.selectProgram(7);
    state.setAcross("program"); // seeds multi to [7] (anchor)
    state.toggleMulti("program", 2); // add PSTAR as a comparison program
    // Calculator mode (collapsible) enables the advanced toolbar → multi-select picker.
    render(EntitySelection, { props: { selectionState: state, collapsible: true } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-program"));

    // Default "All shown": selected + unselected compatible programs are listed.
    expect(screen.getByTestId("picker-program-item-7")).toBeInTheDocument(); // anchor, selected
    expect(screen.getByTestId("picker-program-item-2")).toBeInTheDocument(); // selected
    expect(screen.getByTestId("picker-program-item-101")).toBeInTheDocument(); // unselected

    // Flip the summary-bar filter to "Selected only".
    const summaryBar = screen.getByTestId("picker-program-selected");
    await user.click(within(summaryBar).getByRole("button", { name: "All shown" }));

    // Only the selected programs remain visible.
    expect(screen.getByTestId("picker-program-item-7")).toBeInTheDocument();
    expect(screen.getByTestId("picker-program-item-2")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-program-item-101")).not.toBeInTheDocument();

    isAdvancedMode.value = false;
  });

  describe("collapsible mode", () => {
    test("panel is hidden when collapsible=true and selection is complete (defaults)", () => {
      // Default state has proton + Water + Auto → isComplete = true
      render(EntitySelection, {
        props: { selectionState: state, collapsible: true },
      });

      // Tab bar still visible
      expect(screen.getByTestId("picker-tab-bar")).toBeInTheDocument();
      // But the panel content is gone
      expect(screen.queryByTestId("picker-tab-panel")).not.toBeInTheDocument();
    });

    test("clicking a tab re-opens the panel in collapsible mode", async () => {
      render(EntitySelection, {
        props: { selectionState: state, collapsible: true },
      });
      const user = userEvent.setup();

      // Panel starts hidden (defaults are complete)
      expect(screen.queryByTestId("picker-tab-panel")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("picker-tab-material"));

      expect(screen.getByTestId("picker-tab-panel")).toBeInTheDocument();
      expect(screen.getByTestId("picker-material-tab")).toBeInTheDocument();
    });

    test("panel is always open when collapsible=false (default)", () => {
      render(EntitySelection, { props: { selectionState: state } });

      // Even with complete defaults, panel stays visible
      expect(screen.getByTestId("picker-tab-panel")).toBeInTheDocument();
    });
  });

  describe("entity-selector rework chrome", () => {
    test("empty-tab data-testid + dashed style fires when a selection is cleared", async () => {
      render(EntitySelection, { props: { selectionState: state } });

      state.clearParticle();
      await new Promise((r) => setTimeout(r, 0));

      const badge = await screen.findByTestId("picker-tab-particle-empty");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("!");
    });

    test("advanced toolbar renders in advanced mode; compare-across dropdown replaced by strip in results area", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      isAdvancedMode.value = true;
      try {
        render(EntitySelection, { props: { selectionState: state, collapsible: true } });
        const toolbar = screen.getByTestId("picker-advanced-toolbar");
        expect(toolbar).toBeInTheDocument();
        // The compare-across dropdown has moved to the results strip — not in the picker toolbar.
        expect(screen.queryByTestId("picker-compare-across")).not.toBeInTheDocument();

        // Reset button exists in the advanced toolbar.
        expect(screen.getByTestId("picker-reset")).toBeInTheDocument();
        // Load-external is present but disabled when no handler is passed.
        expect(screen.getByTestId("picker-load-external")).toBeDisabled();
      } finally {
        isAdvancedMode.value = false;
      }
    });

    test("advanced toolbar visibility follows showAdvancedToolbar (defaults to collapsible)", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      isAdvancedMode.value = true;
      try {
        // Default: showAdvancedToolbar follows collapsible, so collapsible=false hides it.
        const { unmount } = render(EntitySelection, {
          props: { selectionState: state, collapsible: false },
        });
        expect(screen.queryByTestId("picker-advanced-toolbar")).not.toBeInTheDocument();
        unmount();

        // Plot opts in explicitly: toolbar shows even when collapsible=false.
        render(EntitySelection, {
          props: { selectionState: state, collapsible: false, showAdvancedToolbar: true },
        });
        expect(screen.getByTestId("picker-advanced-toolbar")).toBeInTheDocument();
      } finally {
        isAdvancedMode.value = false;
      }
    });

    test("custom-material button and Custom sub-tab pill appear in advanced mode", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      const user = userEvent.setup();
      isAdvancedMode.value = true;
      try {
        render(EntitySelection, { props: { selectionState: state } });
        await user.click(screen.getByTestId("picker-tab-material"));
        // Custom sub-tab and add-compound button visible in Advanced.
        expect(screen.getByTestId("material-subtab-custom")).toBeInTheDocument();
        expect(screen.getByTestId("picker-material-add-compound")).toBeInTheDocument();
      } finally {
        isAdvancedMode.value = false;
      }
    });

    test("setAcross + toggleMulti maintain the multi-selection state (reserved for follow-up)", () => {
      // The Program tab no longer renders <MultiList> (the rendering branch
      // was removed because it has no consumers — multi-program comparison
      // is still driven by MultiProgramState above the results table). The
      // state setters remain wired so the follow-up issue can light up the
      // UI without re-deriving the data model.
      state.selectProgram(7);
      state.setAcross("program"); // seeds multi to [7]

      state.toggleMulti("program", 9);
      expect(state.multiSelected.program).toEqual([7, 9]);

      // Cannot deselect the default (index 0).
      state.toggleMulti("program", 7);
      expect(state.multiSelected.program).toEqual([7, 9]);

      // Can remove the non-default entry.
      state.toggleMulti("program", 9);
      expect(state.multiSelected.program).toEqual([7]);
    });

    describe("collapseToSingle — basic-mode truncation", () => {
      // setAcross() seeds the multi-array from the *current* single selection,
      // so the single-select call must come BEFORE setAcross to establish the
      // anchor correctly.

      test("collapseToSingle keeps only the anchor particle when multiple are selected", () => {
        state.selectParticle(1);
        state.setAcross("particle"); // seeds multiParticle = [1]
        state.toggleMulti("particle", 2);
        state.toggleMulti("particle", 4);
        expect(state.multiSelected.particle).toEqual([1, 2, 4]);

        state.collapseToSingle();

        expect(state.multiSelected.particle).toEqual([1]);
      });

      test("collapseToSingle keeps only the anchor material when multiple are selected", () => {
        state.selectMaterial(1);
        state.setAcross("material"); // seeds multiMaterial = [1]
        state.toggleMulti("material", 2);
        state.toggleMulti("material", 3);
        expect(state.multiSelected.material).toEqual([1, 2, 3]);

        state.collapseToSingle();

        expect(state.multiSelected.material).toEqual([1]);
      });

      test("collapseToSingle keeps only the anchor program when multiple are selected", () => {
        state.selectProgram(7);
        state.setAcross("program"); // seeds multiProgram = [7]
        state.toggleMulti("program", 9);
        expect(state.multiSelected.program).toEqual([7, 9]);

        state.collapseToSingle();

        expect(state.multiSelected.program).toEqual([7]);
      });

      test("collapseToSingle is a no-op when only one item is selected", () => {
        state.selectParticle(1);
        state.setAcross("particle"); // seeds multiParticle = [1]
        expect(state.multiSelected.particle).toEqual([1]);

        state.collapseToSingle();

        expect(state.multiSelected.particle).toEqual([1]);
      });

      test("collapseToSingle is a no-op when nothing is selected", () => {
        // Fresh state has empty multi arrays (setAcross not yet called).
        expect(state.multiSelected.particle).toEqual([]);
        state.collapseToSingle();
        expect(state.multiSelected.particle).toEqual([]);
        expect(state.multiSelected.material).toEqual([]);
        expect(state.multiSelected.program).toEqual([]);
      });

      test("collapseToSingle truncates all three dimensions independently", () => {
        // Build up multi-selections on each axis (single-select before setAcross).
        state.selectParticle(1);
        state.setAcross("particle"); // seeds multiParticle = [1]
        state.toggleMulti("particle", 2);

        state.selectMaterial(1);
        state.setAcross("material"); // seeds multiMaterial = [1]
        state.toggleMulti("material", 2);

        state.selectProgram(7);
        state.setAcross("program"); // seeds multiProgram = [7]
        state.toggleMulti("program", 9);

        expect(state.multiSelected.particle).toEqual([1, 2]);
        expect(state.multiSelected.material).toEqual([1, 2]);
        expect(state.multiSelected.program).toEqual([7, 9]);

        state.collapseToSingle();

        expect(state.multiSelected.particle).toEqual([1]);
        expect(state.multiSelected.material).toEqual([1]);
        expect(state.multiSelected.program).toEqual([7]);
      });
    });
  });
});
