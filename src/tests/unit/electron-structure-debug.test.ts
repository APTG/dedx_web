import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntitySelectionComboboxes from "$lib/components/entity-selection-comboboxes.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";

class MockLibdedxServiceWithElectron {
  getPrograms() {
    return [
      { id: 2, name: "PSTAR", version: "1.0" },
      { id: 3, name: "ESTAR", version: "1.0" },
    ];
  }

  getParticles(programId: number) {
    if (programId === 3) {
      return [
        {
          id: 1001,
          name: "Electron",
          massNumber: 0,
          atomicMass: 0.000548,
          symbol: "e⁻",
          aliases: ["e⁻", "e-", "beta"],
        },
        {
          id: 1,
          name: "Hydrogen",
          massNumber: 1,
          atomicMass: 1.007,
          symbol: "H",
          aliases: ["proton"],
        },
      ];
    }
    return [
      {
        id: 1,
        name: "Hydrogen",
        massNumber: 1,
        atomicMass: 1.007,
        symbol: "H",
        aliases: ["proton"],
      },
    ];
  }

  getMaterials(_programId: number) {
    return [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }];
  }
}

describe("Electron structure debug", () => {
  test("electron element structure", async () => {
    const service = new MockLibdedxServiceWithElectron();
    const matrix = buildCompatibilityMatrix(service as any);
    const state = createEntitySelectionState(matrix);

    const { container } = render(EntitySelectionComboboxes, { props: { state } });
    const user = userEvent.setup();

    const particleCombobox = container.querySelector('[aria-label="Particle"]')!;
    await user.click(particleCombobox);

    const electronItem = screen.getByText(/Electron/i);
    console.log(" getByText returns:", electronItem.tagName, electronItem.textContent);
    console.log("Parent:", electronItem.parentElement?.tagName, electronItem.parentElement?.getAttribute("data-disabled"));
    console.log("Parent outerHTML:", electronItem.parentElement?.outerHTML.substring(0, 500));
    
    // Try matching the test assertion pattern
    expect(electronItem).toBeInTheDocument();
    try {
      expect(electronItem).toHaveAttribute("data-disabled", "");
      console.log("PASS: electronItem has data-disabled");
    } catch (e) {
      console.log("FAIL: electronItem doesn't have data-disabled, trying parentElement...");
      expect(electronItem.parentElement).toHaveAttribute("data-disabled", "");
      console.log("PASS: parentElement has data-disabled");
    }
  });
});
