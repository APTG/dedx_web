import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntitySelectionV8 from "$lib/components/v8/entity-selection-v8.svelte";
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

describe("EntitySelectionV8", () => {
  let state: ReturnType<typeof createEntitySelectionState>;

  beforeEach(() => {
    cleanup();
    const service = new MockLibdedxService();
    const matrix = buildCompatibilityMatrix(service as any);
    state = createEntitySelectionState(matrix);
  });

  test("renders recipe bar with current particle/material/program", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    const recipe = screen.getByTestId("v8-recipe-bar");
    expect(recipe).toHaveTextContent("proton");
    expect(recipe).toHaveTextContent("Water (liquid)");
    expect(recipe).toHaveTextContent(/Auto/);
  });

  test("renders three tabs in order: Particle, Material, Program", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    const particleTab = screen.getByTestId("v8-tab-particle");
    const materialTab = screen.getByTestId("v8-tab-material");
    const programTab = screen.getByTestId("v8-tab-program");

    expect(particleTab).toHaveAttribute("aria-selected", "true");
    expect(materialTab).toHaveAttribute("aria-selected", "false");
    expect(programTab).toHaveAttribute("aria-selected", "false");
  });

  test("clicking a tab activates it and renders the matching panel", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-material"));

    expect(screen.getByTestId("v8-tab-material")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("v8-material-tab")).toBeInTheDocument();
  });

  test("clicking a recipe-bar segment activates the matching tab", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-recipe-program"));

    expect(screen.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "true");
  });

  test("particle tab omits electron (spec §v8 Particle)", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    expect(screen.queryByTestId("v8-particle-item-1001")).not.toBeInTheDocument();
    expect(screen.queryByText(/^electron$/i)).not.toBeInTheDocument();
  });

  test("particle tab shows Common particles section with proton + alpha", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    expect(screen.getByText("Common particles")).toBeInTheDocument();
    expect(screen.getByTestId("v8-particle-item-1")).toHaveTextContent("proton");
    expect(screen.getByTestId("v8-particle-item-2")).toHaveTextContent("alpha particle");
  });

  test("particle search supports `z=N` operator", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    const input = screen.getByTestId("v8-particle-search");
    await user.type(input, "z=6");

    expect(screen.getByTestId("v8-particle-item-6")).toBeInTheDocument();
    expect(screen.queryByTestId("v8-particle-item-1")).not.toBeInTheDocument();
  });

  test("selecting a particle updates state and auto-advances the active tab", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-particle-item-2"));

    expect(state.selectedParticle?.id).toBe(2);
    // Material is already selected (default Water) → should advance to Program tab.
    expect(screen.getByTestId("v8-tab-program")).toHaveAttribute("aria-selected", "true");
  });

  test("material tab renders side-by-side Elements/Compounds columns", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-material"));

    expect(screen.getByTestId("v8-material-col-elements")).toBeInTheDocument();
    expect(screen.getByTestId("v8-material-col-compounds")).toBeInTheDocument();
  });

  test("gas materials display the (≋) inline glyph", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-material"));

    // Air is gas, id 267 → compound bucket via id > 98 rule.
    const airItem = screen.getByTestId("v8-material-item-267");
    expect(airItem).toHaveTextContent("(≋)");
  });

  test("program tab renders the Auto-select hero card and a TAB/FN/EXT legend", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-program"));

    expect(screen.getByTestId("v8-program-auto-hero")).toBeInTheDocument();
    const legend = screen.getByTestId("v8-program-legend");
    expect(within(legend).getByTestId("v8-program-tag-TAB")).toBeInTheDocument();
    expect(within(legend).getByTestId("v8-program-tag-FN")).toBeInTheDocument();
    expect(within(legend).getByTestId("v8-program-tag-EXT")).toBeInTheDocument();
  });

  test("program rows carry inline TAB tags for tabulated programs", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-program"));

    const icru49 = screen.getByTestId("v8-program-item-7");
    expect(within(icru49).getByTestId("v8-program-tag-TAB")).toHaveTextContent("DATA");
  });

  test("program rows carry inline FN tags for analytical programs", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-program"));

    const betheExt = screen.getByTestId("v8-program-item-101");
    expect(within(betheExt).getByTestId("v8-program-tag-FN")).toBeInTheDocument();
  });

  test("selecting a program updates state without auto-advance (Program is last)", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    await user.click(screen.getByTestId("v8-tab-program"));
    await user.click(screen.getByTestId("v8-program-item-7"));

    expect(state.selectedProgram.id).toBe(7);
  });

  test("recipe-bar reset restores defaults and activates Particle tab", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    state.selectParticle(6);
    state.selectMaterial(267);

    await user.click(screen.getByTestId("v8-recipe-reset"));

    expect(state.selectedParticle?.id).toBe(1);
    expect(state.selectedMaterial?.id).toBe(276);
    expect(state.selectedProgram.id).toBe(-1);
    expect(screen.getByTestId("v8-tab-particle")).toHaveAttribute("aria-selected", "true");
  });

  test("clicking the selected-pill clears the current selection", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    expect(screen.getByTestId("v8-particle-selected")).toHaveTextContent("proton");

    await user.click(screen.getByTestId("v8-particle-selected"));

    expect(state.selectedParticle).toBeNull();
  });

  test("compat overlay link is hidden in basic mode (PR #2 wiring deferred)", async () => {
    // Picker mode store default is basic
    render(EntitySelectionV8, { props: { selectionState: state } });

    expect(screen.queryByTestId("v8-recipe-compat")).not.toBeInTheDocument();
  });

  test("arrow keys on tab bar move focus / activate adjacent tab", async () => {
    render(EntitySelectionV8, { props: { selectionState: state } });
    const user = userEvent.setup();

    const particleTab = screen.getByTestId("v8-tab-particle");
    particleTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByTestId("v8-tab-material")).toHaveAttribute("aria-selected", "true");
  });

  test("particle list items show Z inline in name (no separate Z column)", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    // proton → "proton (Z=1)" in the list
    expect(screen.getByTestId("v8-particle-item-1")).toHaveTextContent("proton (Z=1)");
    // alpha → "alpha particle (Z=2)"
    expect(screen.getByTestId("v8-particle-item-2")).toHaveTextContent("alpha particle (Z=2)");
    // Carbon ion → "Carbon (C, Z=6)"
    expect(screen.getByTestId("v8-particle-item-6")).toHaveTextContent("Carbon (C, Z=6)");
  });

  test("selected-pill includes Z inline in label (no separate meta)", () => {
    render(EntitySelectionV8, { props: { selectionState: state } });

    // Default: proton is selected — pill should show "proton (Z=1)"
    expect(screen.getByTestId("v8-particle-selected")).toHaveTextContent("proton (Z=1)");
  });

  describe("collapsible mode", () => {
    test("panel is hidden when collapsible=true and selection is complete (defaults)", () => {
      // Default state has proton + Water + Auto → isComplete = true
      render(EntitySelectionV8, {
        props: { selectionState: state, collapsible: true },
      });

      // Tab bar still visible
      expect(screen.getByTestId("v8-tab-bar")).toBeInTheDocument();
      // But the panel content is gone
      expect(screen.queryByTestId("v8-tab-panel")).not.toBeInTheDocument();
    });

    test("clicking a tab re-opens the panel in collapsible mode", async () => {
      render(EntitySelectionV8, {
        props: { selectionState: state, collapsible: true },
      });
      const user = userEvent.setup();

      // Panel starts hidden (defaults are complete)
      expect(screen.queryByTestId("v8-tab-panel")).not.toBeInTheDocument();

      await user.click(screen.getByTestId("v8-tab-material"));

      expect(screen.getByTestId("v8-tab-panel")).toBeInTheDocument();
      expect(screen.getByTestId("v8-material-tab")).toBeInTheDocument();
    });

    test("panel is always open when collapsible=false (default)", () => {
      render(EntitySelectionV8, { props: { selectionState: state } });

      // Even with complete defaults, panel stays visible
      expect(screen.getByTestId("v8-tab-panel")).toBeInTheDocument();
    });
  });
});
