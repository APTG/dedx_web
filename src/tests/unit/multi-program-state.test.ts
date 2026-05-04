import { describe, it, expect, beforeEach } from "vitest";
import {
  createMultiProgramState,
  computeMultiProgramDerived,
  encodeMultiProgramUrl,
  decodeMultiProgramUrl,
} from "$lib/state/multi-program.svelte";
import { LibdedxError, type CalculationResult } from "$lib/wasm/types";

describe("MultiProgramState — core functionality", () => {
  let state: ReturnType<typeof createMultiProgramState>;

  beforeEach(() => {
    state = createMultiProgramState();
  });

  describe("initial state", () => {
    it("starts in basic mode with empty selections", () => {
      expect(state.advancedMode).toBe(false);
      expect(state.quantityFocus).toBe("both");
      expect(state.selectedProgramIds).toEqual([]);
      expect(state.programDisplayOrder).toEqual([]);
      expect(state.columnVisibility.size).toBe(0);
      expect(state.comparisonResults.size).toBe(0);
    });
  });

  describe("addProgram", () => {
    it("adds a program to selectedProgramIds", () => {
      state.addProgram(9);
      expect(state.selectedProgramIds).toEqual([9]);
    });

    it("adds program to display order", () => {
      state.addProgram(9);
      state.addProgram(2);
      expect(state.programDisplayOrder).toEqual([9, 2]);
    });

    it("sets column visibility to true by default", () => {
      state.addProgram(9);
      expect(state.columnVisibility.get(9)).toBe(true);
    });

    it("does not add duplicate programs", () => {
      state.addProgram(9);
      state.addProgram(9);
      expect(state.selectedProgramIds).toEqual([9]);
      expect(state.selectedProgramIds.length).toBe(1);
    });
  });

  describe("removeProgram", () => {
    beforeEach(() => {
      state.addProgram(9); // default
      state.addProgram(2);
      state.addProgram(101);
    });

    it("cannot remove the only program (default)", () => {
      state.removeProgram(9);
      expect(state.selectedProgramIds).toEqual([9, 2, 101]);
    });

    it("cannot remove the first/default program when multiple exist", () => {
      state.removeProgram(9);
      expect(state.selectedProgramIds).toEqual([9, 2, 101]);
    });

    it("can remove a non-default program", () => {
      state.removeProgram(2);
      expect(state.selectedProgramIds).toEqual([9, 101]);
    });

    it("removes program from display order", () => {
      state.removeProgram(2);
      expect(state.programDisplayOrder).not.toContain(2);
    });
  });

  describe("setDefaultProgram", () => {
    beforeEach(() => {
      state.addProgram(9);
      state.addProgram(2);
      state.addProgram(101);
      state.setProgramDisplayOrder([9, 101, 2]); // reordered
    });

    it("moves existing program to first position in selectedProgramIds", () => {
      state.setDefaultProgram(101);
      expect(state.selectedProgramIds[0]).toBe(101);
    });

    it("moves existing program to first position in displayOrder", () => {
      state.setDefaultProgram(101);
      expect(state.programDisplayOrder[0]).toBe(101);
    });

    it("adds new program and sets as default", () => {
      state.setDefaultProgram(4);
      expect(state.selectedProgramIds[0]).toBe(4);
      expect(state.programDisplayOrder[0]).toBe(4);
    });

    it("ensures default program column is visible", () => {
      state.columnVisibility.set(101, false);
      state.setDefaultProgram(101);
      expect(state.columnVisibility.get(101)).toBe(true);
    });
  });

  describe("setDefaultProgram idempotency", () => {
    beforeEach(() => {
      state.addProgram(9);
      state.addProgram(2);
      state.addProgram(101);
    });

    it("does not mutate selectedProgramIds when setting the same default", () => {
      // Initial state
      state.setDefaultProgram(9);
      const beforeIds = [...state.selectedProgramIds];
      const beforeOrder = [...state.programDisplayOrder];

      // Set the same default again - should NOT mutate
      state.setDefaultProgram(9);

      expect(state.selectedProgramIds).toEqual(beforeIds);
      expect(state.programDisplayOrder).toEqual(beforeOrder);
    });

    it("does not mutate when default is already first", () => {
      state.setProgramDisplayOrder([9, 2, 101]);

      // 9 is already first
      state.setDefaultProgram(9);

      expect(state.selectedProgramIds[0]).toBe(9);
      expect(state.programDisplayOrder[0]).toBe(9);
      expect(state.programDisplayOrder).toEqual([9, 2, 101]);
    });

    it("mutates when changing to a different default", () => {
      state.setProgramDisplayOrder([9, 2, 101]);

      // Change default to 101
      state.setDefaultProgram(101);

      expect(state.selectedProgramIds[0]).toBe(101);
      expect(state.programDisplayOrder[0]).toBe(101);
    });
  });

  describe("toggleColumnVisibility", () => {
    beforeEach(() => {
      state.addProgram(9); // default
      state.addProgram(2);
    });

    it("toggles visibility from true to false", () => {
      state.toggleColumnVisibility(2);
      expect(state.columnVisibility.get(2)).toBe(false);
    });

    it("toggles visibility from false to true", () => {
      state.columnVisibility.set(2, false);
      state.toggleColumnVisibility(2);
      expect(state.columnVisibility.get(2)).toBe(true);
    });

    it("cannot hide the default program", () => {
      state.toggleColumnVisibility(9);
      expect(state.columnVisibility.get(9)).toBe(true);
    });
  });

  describe("reorderPrograms", () => {
    beforeEach(() => {
      state.addProgram(9); // default
      state.addProgram(2);
      state.addProgram(101);
      state.setProgramDisplayOrder([9, 2, 101]);
    });

    it("cannot reorder the default program", () => {
      state.reorderPrograms(9, 2);
      expect(state.programDisplayOrder[0]).toBe(9);
    });

    it("moves program to new position", () => {
      state.reorderPrograms(101, 1); // move 101 to position 1 (after default)
      expect(state.programDisplayOrder).toEqual([9, 101, 2]);
    });

    it("respects position bounds", () => {
      state.reorderPrograms(2, 10); // try to move beyond array length
      expect(state.programDisplayOrder).toEqual([9, 101, 2]);
    });
  });

  describe("setQuantityFocus", () => {
    it("sets quantity focus to stp", () => {
      state.setQuantityFocus("stp");
      expect(state.quantityFocus).toBe("stp");
    });

    it("sets quantity focus to csda", () => {
      state.setQuantityFocus("csda");
      expect(state.quantityFocus).toBe("csda");
    });

    it("sets quantity focus to both", () => {
      state.setQuantityFocus("both");
      expect(state.quantityFocus).toBe("both");
    });
  });

  describe("setAdvancedMode", () => {
    beforeEach(() => {
      state.addProgram(9);
      state.addProgram(2);
      state.comparisonResults.set(9, {
        stoppingPowers: [1, 2],
        csdaRanges: [3, 4],
      } as CalculationResult);
    });

    it("enables advanced mode", () => {
      state.setAdvancedMode(true);
      expect(state.advancedMode).toBe(true);
    });

    it("disables advanced mode and keeps only default program", () => {
      state.setAdvancedMode(false);
      expect(state.advancedMode).toBe(false);
      expect(state.selectedProgramIds).toEqual([9]);
    });

    it("clears comparison results when disabled", () => {
      state.setAdvancedMode(false);
      expect(state.comparisonResults.size).toBe(0);
    });
  });

  describe("setComparisonResults", () => {
    it("sets the results map", () => {
      const results = new Map<number, CalculationResult | LibdedxError>();
      results.set(9, { stoppingPowers: [1], csdaRanges: [2] } as CalculationResult);
      state.setComparisonResults(results);
      expect(state.comparisonResults.size).toBe(1);
      expect(state.comparisonResults.get(9)).toBe(results.get(9));
    });
  });
});

describe("computeMultiProgramDerived", () => {
  let state: ReturnType<typeof createMultiProgramState>;

  beforeEach(() => {
    state = createMultiProgramState();
    state.addProgram(9);
    state.addProgram(2);
    state.addProgram(101);
    state.setProgramDisplayOrder([9, 2, 101]);
  });

  it("computes visibleProgramIds excluding hidden", () => {
    state.columnVisibility.set(101, false);
    const derived = computeMultiProgramDerived(state);
    expect(derived.visibleProgramIds).toEqual([9, 2]);
  });

  it("computes defaultProgramId as first selected", () => {
    const derived = computeMultiProgramDerived(state);
    expect(derived.defaultProgramId).toBe(9);
  });

  it("detects failed programs", () => {
    state.comparisonResults.set(2, new LibdedxError(5, "test error"));
    const derived = computeMultiProgramDerived(state);
    expect(derived.hasAnyFailedProgram).toBe(true);
  });

  it("showStoppingPowerGroup is true for both/stp", () => {
    state.setQuantityFocus("both");
    expect(computeMultiProgramDerived(state).showStoppingPowerGroup).toBe(true);

    state.setQuantityFocus("stp");
    expect(computeMultiProgramDerived(state).showStoppingPowerGroup).toBe(true);

    state.setQuantityFocus("csda");
    expect(computeMultiProgramDerived(state).showStoppingPowerGroup).toBe(false);
  });

  it("showCsdaRangeGroup is true for both/csda", () => {
    state.setQuantityFocus("both");
    expect(computeMultiProgramDerived(state).showCsdaRangeGroup).toBe(true);

    state.setQuantityFocus("csda");
    expect(computeMultiProgramDerived(state).showCsdaRangeGroup).toBe(true);

    state.setQuantityFocus("stp");
    expect(computeMultiProgramDerived(state).showCsdaRangeGroup).toBe(false);
  });
});

describe("encodeMultiProgramUrl", () => {
  let state: ReturnType<typeof createMultiProgramState>;

  beforeEach(() => {
    state = createMultiProgramState();
  });

  it("returns empty params in basic mode", () => {
    const params = encodeMultiProgramUrl(state);
    expect(params).toEqual({});
  });

  it("encodes advanced mode params", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.addProgram(2);
    state.setProgramDisplayOrder([9, 2]);

    const params = encodeMultiProgramUrl(state);
    expect(params.mode).toBe("advanced");
    expect(params.programs).toBe("9,2");
    expect(params.qfocus).toBe("both");
  });

  it("encodes hidden programs", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.addProgram(2);
    state.addProgram(101);
    state.setProgramDisplayOrder([9, 2, 101]);
    state.columnVisibility.set(101, false);

    const params = encodeMultiProgramUrl(state);
    expect(params.hidden_programs).toBe("101");
  });

  it("encodes quantity focus", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.setQuantityFocus("stp");

    const params = encodeMultiProgramUrl(state);
    expect(params.qfocus).toBe("stp");
  });
});

describe("decodeMultiProgramUrl", () => {
  it("parses mode=advanced", () => {
    const params = new URLSearchParams("?mode=advanced");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.mode).toBe("advanced");
  });

  it("parses programs as number array", () => {
    const params = new URLSearchParams("?programs=9,2,101");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.parsedProgramIds).toEqual([9, 2, 101]);
  });

  it("parses hidden_programs as number array", () => {
    const params = new URLSearchParams("?hidden_programs=101");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.parsedHiddenIds).toEqual([101]);
  });

  it("parses qfocus", () => {
    const params = new URLSearchParams("?qfocus=csda");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qfocus).toBe("csda");
  });

  it("ignores invalid qfocus values", () => {
    const params = new URLSearchParams("?qfocus=invalid");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qfocus).toBeUndefined();
  });

  it("filters invalid program IDs", () => {
    const params = new URLSearchParams("?programs=abc,9,xyz");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.parsedProgramIds).toEqual([9]);
  });
});
