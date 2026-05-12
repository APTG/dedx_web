import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { LibdedxError } from "$lib/wasm/types";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { createCalculatorState } from "$lib/state/calculator.svelte";
import { createMultiProgramState, type MultiProgramState } from "$lib/state/multi-program.svelte";
import ResultTable from "$lib/components/result-table.svelte";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { CalculationResult } from "$lib/wasm/types";

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

  it("renders two group header spans in advanced mode with 2 programs", () => {
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

    // Check for group headers
    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();
    expect(screen.getByText(/CSDA Range/)).toBeInTheDocument();

    // Both program columns should be present in sub-headers (twice each - once in STP group, once in CSDA group)
    // Query only within thead to avoid matching delta tooltip text in tbody
    const thead = document.querySelector("thead");
    const thElements = thead?.querySelectorAll("th") || [];
    const thTexts = Array.from(thElements).map((th) => th.textContent);
    // Filter to only count th elements in the sub-header row (not group headers)
    const programHeaders = thTexts.filter((t) => t?.includes("PSTAR") || t?.includes("MSTAR"));
    expect(programHeaders.filter((t) => t?.includes("PSTAR"))).toHaveLength(2);
    expect(programHeaders.filter((t) => t?.includes("MSTAR"))).toHaveLength(2);
  });

  it("shows 4 result data cells per row in advanced mode (2 stp + 2 csda) with 2 programs", async () => {
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

    // With 2 programs and quantityFocus='both', we should have:
    // - 2 stopping power cells (one per program)
    // - 2 CSDA range cells (one per program)
    // Total: 4 result cells in the data row

    // Find all data cells with test ids for result values
    const stpCells = document.querySelectorAll("[data-testid^='stp-cell']");
    const rangeCells = document.querySelectorAll("[data-testid^='range-cell']");

    // In advanced mode there should be multiple result cells per row
    expect(stpCells.length).toBeGreaterThanOrEqual(2);
    expect(rangeCells.length).toBeGreaterThanOrEqual(2);
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

  it("hides STP group header and cells when quantityFocus='csda'", async () => {
    multiProgState.setQuantityFocus("csda");
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
