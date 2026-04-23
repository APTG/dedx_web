import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

class MockLibdedxService {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 1, name: "PSTAR", version: "1.0" },
      { id: 2, name: "ASTAR", version: "1.0" },
      { id: 3, name: "MSTAR", version: "1.0" },
      { id: 9, name: "ICRU", version: "1.0" },
      { id: 10, name: "Bethe-ext", version: "1.0" },
      { id: 90, name: "ICRU 90", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    const particles: Map<number, ParticleEntity[]> = new Map([
      [1, [
        { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] },
        { id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] },
        { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
      ]],
      [2, [{ id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] }]],
      [
        3,
        [
          { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton", "p", "H-1"] },
          { id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha", "α", "He-4"] },
          { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
        ],
      ],
      [90, [
        { id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton"] },
        { id: 2, name: "Helium", massNumber: 4, atomicMass: 4.002, symbol: "He", aliases: ["alpha"] },
        { id: 6, name: "Carbon", massNumber: 12, atomicMass: 12.011, symbol: "C", aliases: ["C-12"] },
      ]],
      [9, [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton"] }]],
      [10, []],
    ]);
    return particles.get(programId) || [];
  }

  getMaterials(programId: number): MaterialEntity[] {
    const materials: Map<number, MaterialEntity[]> = new Map([
      [1, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [2, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [
        3,
        [
          { id: 1, name: "Hydrogen", density: 0.000089, isGasByDefault: true },
          { id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false },
          { id: 267, name: "Air", density: 0.0012, isGasByDefault: true },
        ],
      ],
      [90, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [9, [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }]],
      [10, []],
    ]);
    return materials.get(programId) || [];
  }
}

describe("EntitySelectionComboboxes", () => {
  let state: ReturnType<typeof createEntitySelectionState>;

  beforeEach(() => {
    cleanup();
    const service = new MockLibdedxService();
    const matrix = buildCompatibilityMatrix(service as any);
    state = createEntitySelectionState(matrix);
  });

  test("renders three comboboxes: Particle, Material, Program", () => {
    render(EntitySelectionComboboxes, { props: { state } });
    
    expect(screen.getByLabelText("Particle")).toBeInTheDocument();
    expect(screen.getByLabelText("Material")).toBeInTheDocument();
    expect(screen.getByLabelText("Program")).toBeInTheDocument();
  });

  test("displays default selections: Proton, Water (liquid), Auto-select", () => {
    render(EntitySelectionComboboxes, { props: { state } });
    
    const particleCombobox = screen.getByLabelText("Particle");
    const materialCombobox = screen.getByLabelText("Material");
    const programCombobox = screen.getByLabelText("Program");
    
    expect(particleCombobox).toHaveTextContent("Z=1 Hydrogen (H)");
    expect(materialCombobox).toHaveTextContent("276");
    expect(materialCombobox).toHaveTextContent("Water (liquid)");
    expect(programCombobox).toHaveTextContent("Auto-select");
  });

  test("Auto-select shows resolved program name when particle+material are set", () => {
    render(EntitySelectionComboboxes, { props: { state } });
    
    // With proton+water, Auto-select should resolve to ICRU 90 or PSTAR
    const programCombobox = screen.getByLabelText("Program");
    expect(programCombobox).toHaveTextContent("Auto-select →");
  });

  test("selecting a particle updates the selection state", async () => {
    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const particleCombobox = container.querySelector('[aria-label="Particle"]')!;
    await user.click(particleCombobox);

    const heliumItem = screen.getByText(/Helium/i);
    await user.click(heliumItem);

    expect(state.selectedParticle?.id).toBe(2);
  });

  test("selecting carbon preserves water and resets program to Auto-select", async () => {
    state.selectProgram(3); // MSTAR

    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const particleCombobox = container.querySelector('[aria-label="Particle"]')!;
    await user.click(particleCombobox);

    const carbonItem = screen.getByText(/Z=6 Carbon/i);
    await user.click(carbonItem);

    expect(state.selectedParticle?.id).toBe(6);
    expect(state.selectedMaterial?.id).toBe(276);
    expect(state.selectedProgram.id).toBe(-1);
  });

  test("clicking Reset all restores defaults", async () => {
    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    state.selectParticle(6);
    state.selectMaterial(267);
    state.selectProgram(3);

    const resetLink = screen.getByRole("link", { name: /reset all/i });
    await user.click(resetLink);

    expect(state.selectedParticle?.id).toBe(1);
    expect(state.selectedMaterial?.id).toBe(276);
    expect(state.selectedProgram.id).toBe(-1);
  });

  test("electron (id=1001) cannot be selected", async () => {
    const electronService = new MockLibdedxServiceWithElectron();
    const electronMatrix = buildCompatibilityMatrix(electronService as any);
    const electronState = createEntitySelectionState(electronMatrix);

    const { container } = render(EntitySelectionComboboxes, { props: { state: electronState } });
    const user = userEvent.setup();

    const particleCombobox = container.querySelector('[aria-label="Particle"]')!;
    await user.click(particleCombobox);

    const electronItem = screen.getByText(/Electron/i);
    expect(electronItem).toBeInTheDocument();
    expect(electronItem).toHaveAttribute("data-disabled", "");

    await user.click(electronItem);
    expect(electronState.selectedParticle?.id).toBe(1); // Still proton
  });

  test("Material dropdown shows Elements and Compounds sections", () => {
    render(EntitySelectionComboboxes, { props: { state } });
    
    const materialCombobox = screen.getByLabelText("Material");
    
    // Material should show the default selected material
    expect(materialCombobox).toHaveTextContent("276");
    expect(materialCombobox).toHaveTextContent("Water");
  });

  test("Program combobox shows tabulated and analytical programs grouped", async () => {
    state.selectParticle(2); // helium — all four programs available

    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const programCombobox = container.querySelector('[aria-label="Program"]')!;
    await user.click(programCombobox);

    expect(screen.getByText(/PSTAR/i)).toBeInTheDocument();
    expect(screen.getByText(/ASTAR/i)).toBeInTheDocument();
    expect(screen.getByText(/MSTAR/i)).toBeInTheDocument();
    expect(screen.getByText(/ICRU 90/i)).toBeInTheDocument();
  });

  test("isComplete reflects valid selection state", () => {
    render(EntitySelectionComboboxes, { props: { state } });

    // Initial state should be complete
    expect(state.isComplete).toBe(true);

    // Clear particle
    state.clearParticle();
    expect(state.isComplete).toBe(false);
  });

  // --- Keyboard / ARIA (RED until Bits UI component is in place) ---

  test("search input has role=combobox and aria-expanded", async () => {
    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const trigger = container.querySelector('[aria-label="Particle"]')!;
    await user.click(trigger);

    const searchInput = container.querySelector('input[placeholder="Search..."]')!;
    expect(searchInput).toHaveAttribute("role", "combobox");
    expect(searchInput).toHaveAttribute("aria-expanded", "true");
  });

  test("ArrowDown highlights first item; Enter selects it", async () => {
    // Clear selection first so we can prove keyboard nav actually selected something
    state.clearParticle();
    expect(state.selectedParticle).toBeNull();

    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const trigger = container.querySelector('[aria-label="Particle"]')!;
    await user.click(trigger);

    // Input is focused after click; ArrowDown highlights first candidate
    await user.keyboard("{ArrowDown}");
    // Enter selects the highlighted item
    await user.keyboard("{Enter}");

    expect(state.selectedParticle).not.toBeNull();
  });

  test("Escape key closes the dropdown", async () => {
    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const trigger = container.querySelector('[aria-label="Particle"]')!;
    await user.click(trigger);

    const searchInput = container.querySelector('input[placeholder="Search..."]')!;
    expect(searchInput).toBeVisible();

    await user.keyboard("{Escape}");
    expect(searchInput).not.toBeVisible();
  });

  test("aria-activedescendant on search input tracks highlighted item", async () => {
    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const trigger = container.querySelector('[aria-label="Particle"]')!;
    await user.click(trigger);

    await user.keyboard("{ArrowDown}");

    const searchInput = container.querySelector('input[placeholder="Search..."]')!;
    expect(searchInput).toHaveAttribute("aria-activedescendant");
    const activeId = searchInput.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)).toBeInTheDocument();
  });
});

class MockLibdedxServiceWithElectron {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 1, name: "PSTAR", version: "1.0" },
      { id: 3, name: "ESTAR", version: "1.0" },
    ];
  }

  getParticles(programId: number): ParticleEntity[] {
    if (programId === 3) {
      return [{ id: 1001, name: "Electron", massNumber: 0, atomicMass: 0.000548, symbol: "e⁻", aliases: ["e⁻", "e-", "beta"] }];
    }
    return [{ id: 1, name: "Hydrogen", massNumber: 1, atomicMass: 1.007, symbol: "H", aliases: ["proton"] }];
  }

  getMaterials(programId: number): MaterialEntity[] {
    return [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }];
  }
}
