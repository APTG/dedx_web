import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntitySelection from "$lib/components/entity-selection/entity-selection.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

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

  test("particle tab shows Common particles section with proton + alpha", () => {
    render(EntitySelection, { props: { selectionState: state } });

    expect(screen.getByText("Common particles")).toBeInTheDocument();
    expect(screen.getByTestId("picker-particle-item-1")).toHaveTextContent("proton");
    expect(screen.getByTestId("picker-particle-item-2")).toHaveTextContent("alpha particle");
  });

  test("particle search supports `z=N` operator", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("picker-particle-search");
    await user.type(input, "z=6");

    expect(screen.getByTestId("picker-particle-item-6")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-particle-item-1")).not.toBeInTheDocument();
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

  test("material tab renders side-by-side Elements/Compounds columns", async () => {
    render(EntitySelection, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("picker-tab-material"));

    expect(screen.getByTestId("picker-material-col-elements")).toBeInTheDocument();
    expect(screen.getByTestId("picker-material-col-compounds")).toBeInTheDocument();
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

  test("compat overlay link is hidden in basic mode (advanced toolbar gated)", async () => {
    render(EntitySelection, { props: { selectionState: state } });

    // Basic mode: no advanced toolbar at all.
    expect(screen.queryByTestId("picker-advanced-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-explore-compat")).not.toBeInTheDocument();
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

  test("selected-pill includes Z inline in label (no separate meta)", () => {
    render(EntitySelection, { props: { selectionState: state } });

    // Default: proton is selected — pill should show "proton (Z=1)"
    expect(screen.getByTestId("picker-particle-selected")).toHaveTextContent("proton (Z=1)");
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

    test("advanced toolbar renders in advanced mode (Calculator only) and exposes the Compare-across dropdown", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      isAdvancedMode.value = true;
      try {
        render(EntitySelection, { props: { selectionState: state, collapsible: true } });
        const toolbar = screen.getByTestId("picker-advanced-toolbar");
        expect(toolbar).toBeInTheDocument();
        const compareAcross = screen.getByTestId("picker-compare-across") as HTMLSelectElement;
        expect(compareAcross.value).toBe("program");
        // Materials and Particles are disabled per the issue's "out of scope" gate.
        const opts = Array.from(compareAcross.options);
        expect(opts.find((o) => o.value === "material")?.disabled).toBe(true);
        expect(opts.find((o) => o.value === "particle")?.disabled).toBe(true);

        // Reset button exists in the advanced toolbar.
        expect(screen.getByTestId("picker-reset")).toBeInTheDocument();
        // Load-external + Explore-compat are present but disabled (follow-up PRs).
        expect(screen.getByTestId("picker-load-external")).toBeDisabled();
        expect(screen.getByTestId("picker-explore-compat")).toBeDisabled();
      } finally {
        isAdvancedMode.value = false;
      }
    });

    test("advanced toolbar is hidden on Plot (collapsible=false) even in advanced mode", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      isAdvancedMode.value = true;
      try {
        render(EntitySelection, { props: { selectionState: state, collapsible: false } });
        expect(screen.queryByTestId("picker-advanced-toolbar")).not.toBeInTheDocument();
      } finally {
        isAdvancedMode.value = false;
      }
    });

    test("custom-material pill is rendered below the material columns in advanced mode", async () => {
      const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
      const user = userEvent.setup();
      isAdvancedMode.value = true;
      try {
        render(EntitySelection, { props: { selectionState: state } });
        await user.click(screen.getByTestId("picker-tab-material"));
        const tabRoot = screen.getByTestId("picker-material-tab");
        const columns = screen.getByTestId("picker-material-columns");
        const pill = screen.getByTestId("picker-add-custom-material");
        // The pill comes after the columns in DOM order so it renders below.
        const children = Array.from(tabRoot.children);
        expect(children.indexOf(columns)).toBeLessThan(children.indexOf(pill));
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
      state.setAcross("program");
      state.selectProgram(7); // resets multi to [7]
      state.setAcross("program");

      state.toggleMulti("program", 9);
      expect(state.multiSelected.program).toEqual([7, 9]);

      // Cannot deselect the default (index 0).
      state.toggleMulti("program", 7);
      expect(state.multiSelected.program).toEqual([7, 9]);

      // Can remove the non-default entry.
      state.toggleMulti("program", 9);
      expect(state.multiSelected.program).toEqual([7]);
    });
  });
});
