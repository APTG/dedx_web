import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { LibdedxError } from "$lib/wasm/types";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { createCalculatorState } from "$lib/state/calculator.svelte";
import { createMultiProgramState, type MultiProgramState } from "$lib/state/multi-program.svelte";
import { createMultiEntityState } from "$lib/state/multi-entity.svelte";
import ResultTable from "$lib/components/result-table.svelte";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { CalculationResult } from "$lib/wasm/types";
import type { EntityId } from "$lib/external-data/types";

describe("ResultTable with multiProgramState (advanced mode)", () => {
  let service: LibdedxServiceImpl;
  let entitySelection: EntitySelectionState;
  let calcState: CalculatorState;
  let multiProgState: MultiProgramState;

  beforeEach(() => {
    cleanup();
    service = new LibdedxServiceImpl();
    const matrix = buildCompatibilityMatrix(service);
    entitySelection = createEntitySelectionState(matrix);
    calcState = createCalculatorState(entitySelection, service);

    // Set up entity selection for valid calculation
    // Using particle ID 1 (Hydrogen/Proton) which is supported by programs 2 (PSTAR) and 4 (MSTAR)
    entitySelection.selectParticle(1); // Hydrogen/Proton
    entitySelection.selectMaterial(276); // Water

    // Create multi-program state with 2 programs
    multiProgState = createMultiProgramState();
    multiProgState.setAdvancedMode(true);
    multiProgState.addProgram(2); // PSTAR (default)
    multiProgState.addProgram(4); // MSTAR
    multiProgState.setDefaultProgram(2);

    // Add valid energy row
    calcState.updateRowText(0, "100");
  });

  function createComparisonResults(
    programIds: number[],
    options?: { failProgramId?: number },
  ): Map<number, CalculationResult | LibdedxError> {
    const results = new Map<number, CalculationResult | LibdedxError>();

    for (const programId of programIds) {
      if (options?.failProgramId === programId) {
        results.set(programId, new LibdedxError(42, "Test error for program " + programId));
      } else {
        results.set(programId, {
          energies: [100],
          stoppingPowers: [25.0 * programId], // Different values per program for testing
          csdaRanges: [1000.0 * programId],
        });
      }
    }

    return results;
  }

  it("renders STP group header in advanced mode with 2 programs (default quantityFocus=stp)", () => {
    const comparisonResults = createComparisonResults([2, 4]);
    multiProgState.setComparisonResults(comparisonResults);

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // Default quantityFocus="stp": only Stopping Power group is visible
    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();
    expect(screen.queryByText(/CSDA Range/)).not.toBeInTheDocument();

    // Both program columns should be present in the STP sub-header row
    const thead = document.querySelector("thead");
    const thElements = thead?.querySelectorAll("th") || [];
    const thTexts = Array.from(thElements).map((th) => th.textContent);
    const programHeaders = thTexts.filter((t) => t?.includes("PSTAR") || t?.includes("MSTAR"));
    expect(programHeaders.filter((t) => t?.includes("PSTAR"))).toHaveLength(1);
    expect(programHeaders.filter((t) => t?.includes("MSTAR"))).toHaveLength(1);
  });

  it("shows 2 STP result cells per row in advanced mode (default quantityFocus=stp) with 2 programs", async () => {
    const comparisonResults = createComparisonResults([9, 2]);
    multiProgState.setComparisonResults(comparisonResults);
    await calcState.triggerCalculation();
    calcState.flushCalculation();
    await Promise.resolve();

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // Default quantityFocus="stp": only STP cells visible, no CSDA range cells
    const stpCells = document.querySelectorAll("[data-testid^='stp-cell']");
    const rangeCells = document.querySelectorAll("[data-testid^='range-cell']");

    expect(stpCells.length).toBeGreaterThanOrEqual(2);
    expect(rangeCells.length).toBe(0);
  });

  it("hides CSDA group header and cells when quantityFocus='stp'", async () => {
    multiProgState.setQuantityFocus("stp");
    const comparisonResults = createComparisonResults([9, 2]);
    multiProgState.setComparisonResults(comparisonResults);
    await calcState.triggerCalculation();
    calcState.flushCalculation();
    await Promise.resolve();

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // Stopping Power group should be present
    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();

    // CSDA Range group header should NOT be in the DOM
    const csdaHeader = screen.queryByText(/CSDA Range/);
    expect(csdaHeader).not.toBeInTheDocument();
  });

  it("hides STP group header and cells when quantityFocus='range'", async () => {
    multiProgState.setQuantityFocus("range");
    const comparisonResults = createComparisonResults([9, 2]);
    multiProgState.setComparisonResults(comparisonResults);
    await calcState.triggerCalculation();
    calcState.flushCalculation();
    await Promise.resolve();

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // CSDA Range group should be present
    expect(screen.getByText(/CSDA Range/)).toBeInTheDocument();

    // Stopping Power group header should NOT be in the DOM
    const stpHeader = screen.queryByText(/Stopping Power/);
    expect(stpHeader).not.toBeInTheDocument();
  });

  it("shows '—' text and ⚠ icon for program with LibdedxError", () => {
    const comparisonResults = createComparisonResults([9, 2], { failProgramId: 2 });
    multiProgState.setComparisonResults(comparisonResults);

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // Error cells should show "—" (em dash)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    // Warning icon should be present with error title
    const warningIcon = document.querySelector('[title*="Test error"]');
    expect(warningIcon).toBeInTheDocument();
  });

  it("applies bold class to default program column sub-header", () => {
    const comparisonResults = createComparisonResults([9, 2]);
    multiProgState.setComparisonResults(comparisonResults);

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // Find the ICRU 90 header cell (default program) and check for bold styling
    const defaultHeader = document.querySelector("th[scope='col']");
    expect(defaultHeader).toBeInTheDocument();

    // Check that the default program header contains the bold class or font-bold
    const boldElements = document.querySelectorAll(".font-bold, [class*='font-bold']");
    expect(boldElements.length).toBeGreaterThan(0);
  });

  it("does not render hidden program columns when columnVisibility.get(id) === false", () => {
    // Reset to fresh state - programs 2 and 4 selected
    multiProgState = createMultiProgramState();
    multiProgState.setAdvancedMode(true);
    multiProgState.addProgram(2); // PSTAR (default)
    multiProgState.addProgram(4); // MSTAR
    multiProgState.setDefaultProgram(2);

    multiProgState.toggleColumnVisibility(4); // Hide MSTAR (program 4)
    const comparisonResults = createComparisonResults([2, 4]);
    multiProgState.setComparisonResults(comparisonResults);

    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
        multiProgramState: multiProgState,
        comparisonResults,
      },
    });

    // MSTAR column should not be in DOM
    const mstarParams = document.querySelectorAll("[data-program-id='4']");
    expect(mstarParams.length).toBe(0);

    // PSTAR (default) should still be visible
    const pstarElements = document.querySelectorAll("[data-program-id='2']");
    expect(pstarElements.length).toBeGreaterThan(0);
  });
});

describe("ResultTable basic mode (no multi-program props)", () => {
  let service: LibdedxServiceImpl;
  let entitySelection: EntitySelectionState;
  let calcState: CalculatorState;

  beforeEach(() => {
    cleanup();
    service = new LibdedxServiceImpl();
    const matrix = buildCompatibilityMatrix(service);
    entitySelection = createEntitySelectionState(matrix);
    calcState = createCalculatorState(entitySelection, service);
  });

  it("renders standard 5-column layout without group headers", () => {
    render(ResultTable, {
      props: {
        calcState: calcState,
        entitySelection,
      },
    });

    // Should have basic mode headers, no group headers
    expect(screen.getByText(/Energy \(MeV\)/)).toBeInTheDocument();
    expect(screen.getByText(/→ MeV\/nucl/)).toBeInTheDocument();
    expect(screen.getByText(/Unit/)).toBeInTheDocument();
    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();
    expect(screen.getByText(/CSDA Range/)).toBeInTheDocument();

    // Should NOT have group headers in basic mode
    const allHeaders = document.querySelectorAll("thead th");
    // In basic mode, we have 5 columns, no grouping
    expect(allHeaders.length).toBe(5);
  });
});

describe("ResultTable multi-entity mode", () => {
  let service: LibdedxServiceImpl;
  let entitySelection: EntitySelectionState;
  let calcState: CalculatorState;

  beforeEach(() => {
    cleanup();
    service = new LibdedxServiceImpl();
    const matrix = buildCompatibilityMatrix(service);
    entitySelection = createEntitySelectionState(matrix);
    calcState = createCalculatorState(entitySelection, service);
    calcState.updateRowText(0, "100");
    entitySelection.setAcross("material");
    entitySelection.toggleMulti("material", 267);
  });

  it("renders grouped headers and uses per-material densities for STP/CSDA cells", () => {
    const multiEntityState = createMultiEntityState("material", (id) => {
      if (id === 276) return "Water (liquid)";
      if (id === 267) return "Air";
      return String(id);
    });
    multiEntityState.setComparisonResults(
      new Map<EntityId, CalculationResult | LibdedxError>([
        [
          276,
          {
            energies: [100],
            stoppingPowers: [10],
            csdaRanges: [100],
          },
        ],
        [267, { energies: [100], stoppingPowers: [10], csdaRanges: [100] }],
      ]),
    );

    render(ResultTable, {
      props: {
        calcState,
        entitySelection,
        multiEntityState,
        multiEntityIds: [276, 267],
      },
    });

    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();
    expect(screen.getByText(/CSDA Range/)).toBeInTheDocument();
    expect(screen.getAllByText(/Water \(liquid\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Air/).length).toBeGreaterThan(0);

    expect(screen.getByTestId("stp-entity-cell-276-0")).toHaveTextContent("1");
    expect(screen.getByTestId("stp-entity-cell-267-0")).toHaveTextContent("0.0012");
    expect(screen.getByTestId("range-entity-cell-276-0")).toHaveTextContent("1 m");
    expect(screen.getByTestId("range-entity-cell-267-0")).toHaveTextContent("833.3 m");
  });

  it("renders explicit error marker for entity-level calculation failures", () => {
    const multiEntityState = createMultiEntityState("material", (id) => String(id));
    multiEntityState.setComparisonResults(
      new Map<EntityId, CalculationResult | LibdedxError>([
        [
          276,
          {
            energies: [100],
            stoppingPowers: [10],
            csdaRanges: [100],
          },
        ],
        [267, new LibdedxError(-1, "Material not supported")],
      ]),
    );

    render(ResultTable, {
      props: {
        calcState,
        entitySelection,
        multiEntityState,
        multiEntityIds: [276, 267],
      },
    });

    expect(screen.getByTestId("stp-entity-cell-267-0")).toHaveTextContent("⚠️");
    expect(screen.getByTestId("range-entity-cell-267-0")).toHaveTextContent("⚠️");
  });
});
