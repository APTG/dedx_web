import { describe, it, expect, beforeEach } from "vitest";
import {
  createMultiProgramState,
  computeMultiProgramDerived,
  encodeMultiProgramUrl,
  decodeMultiProgramUrl,
} from "$lib/state/multi-program.svelte";
import { LibdedxError, type CalculationResult } from "$lib/wasm/types";
import type { ExtRef } from "$lib/external-data/types";

const EXT_SRIM = "ext:srim:srim-2013-gui" as ExtRef;
const EXT_SRIM2 = "ext:srim:srim-2016-mc" as ExtRef;

describe("MultiProgramState — core functionality", () => {
  let state: ReturnType<typeof createMultiProgramState>;

  beforeEach(() => {
    state = createMultiProgramState();
  });

  describe("initial state", () => {
    it("starts in basic mode with empty selections", () => {
      expect(state.advancedMode).toBe(false);
      expect(state.quantityFocus).toBe("stp");
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

    it("sets quantity focus to range", () => {
      state.setQuantityFocus("range");
      expect(state.quantityFocus).toBe("range");
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

  it("showStoppingPowerGroup is true only for stp", () => {
    state.setQuantityFocus("stp");
    expect(computeMultiProgramDerived(state).showStoppingPowerGroup).toBe(true);

    state.setQuantityFocus("range");
    expect(computeMultiProgramDerived(state).showStoppingPowerGroup).toBe(false);
  });

  it("showCsdaRangeGroup is true only for range", () => {
    state.setQuantityFocus("range");
    expect(computeMultiProgramDerived(state).showCsdaRangeGroup).toBe(true);

    state.setQuantityFocus("stp");
    expect(computeMultiProgramDerived(state).showCsdaRangeGroup).toBe(false);
  });
});

describe("MultiProgramState — external program (EntityId) support", () => {
  let state: ReturnType<typeof createMultiProgramState>;

  beforeEach(() => {
    state = createMultiProgramState();
  });

  it("accepts ExtRef string IDs in addProgram", () => {
    state.addProgram(9);
    state.addProgram(EXT_SRIM);
    expect(state.selectedProgramIds).toEqual([9, EXT_SRIM]);
  });

  it("does not add duplicate ExtRef IDs", () => {
    state.addProgram(EXT_SRIM);
    state.addProgram(EXT_SRIM);
    expect(state.selectedProgramIds.length).toBe(1);
  });

  it("sets column visibility for external program", () => {
    state.addProgram(EXT_SRIM);
    expect(state.columnVisibility.get(EXT_SRIM)).toBe(true);
  });

  it("removes ExtRef ID from selection", () => {
    state.addProgram(9);
    state.addProgram(EXT_SRIM);
    state.removeProgram(EXT_SRIM);
    expect(state.selectedProgramIds).toEqual([9]);
  });

  it("sets ExtRef as default program", () => {
    state.addProgram(EXT_SRIM);
    state.addProgram(9);
    state.setDefaultProgram(EXT_SRIM);
    expect(state.selectedProgramIds[0]).toBe(EXT_SRIM);
    expect(state.programDisplayOrder[0]).toBe(EXT_SRIM);
  });

  it("toggles column visibility for ExtRef ID", () => {
    state.addProgram(EXT_SRIM);
    state.addProgram(9);
    state.toggleColumnVisibility(9);
    expect(state.columnVisibility.get(9)).toBe(false);
  });

  it("stores and retrieves comparison results for ExtRef ID", () => {
    const result: CalculationResult = { energies: [100], stoppingPowers: [5.0], csdaRanges: [20] };
    state.addProgram(EXT_SRIM);
    state.setComparisonResults(new Map([[EXT_SRIM, result]]));
    expect(state.comparisonResults.get(EXT_SRIM)).toBe(result);
  });

  it("computeMultiProgramDerived works with mixed IDs", () => {
    state.addProgram(9);
    state.addProgram(EXT_SRIM);
    state.setProgramDisplayOrder([9, EXT_SRIM]);
    const derived = computeMultiProgramDerived(state);
    expect(derived.visibleProgramIds).toEqual([9, EXT_SRIM]);
    expect(derived.defaultProgramId).toBe(9);
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
    expect(params.programs).toBe("9~2");
    expect(params.qshow).toBeUndefined(); // stp is default — omitted per ADR 006
  });

  it("does not encode hidden programs (dropped in v2)", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.addProgram(2);
    state.addProgram(101);
    state.setProgramDisplayOrder([9, 2, 101]);
    state.columnVisibility.set(101, false);

    const params = encodeMultiProgramUrl(state);
    expect((params as Record<string, unknown>).hidden_programs).toBeUndefined();
  });

  it("omits qshow when quantity focus is stp (default)", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.setQuantityFocus("stp");

    const params = encodeMultiProgramUrl(state);
    expect(params.qshow).toBeUndefined(); // stp is default — omitted per ADR 006
  });

  it("encodes qshow=range when quantity focus is range", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.setQuantityFocus("range");

    const params = encodeMultiProgramUrl(state);
    expect(params.qshow).toBe("range");
  });

  it("encodes mixed built-in and external programs using formatEntityIdList", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.addProgram(EXT_SRIM);
    state.setProgramDisplayOrder([9, EXT_SRIM]);

    const params = encodeMultiProgramUrl(state);
    expect(params.programs).toBe("9~ext:srim:srim-2013-gui");
  });

  it("round-trips mixed IDs through encode/decode", () => {
    state.setAdvancedMode(true);
    state.addProgram(9);
    state.addProgram(EXT_SRIM);
    state.addProgram(EXT_SRIM2);
    state.setProgramDisplayOrder([9, EXT_SRIM, EXT_SRIM2]);

    const encoded = encodeMultiProgramUrl(state);
    const urlParams = new URLSearchParams();
    if (encoded.programs) urlParams.set("programs", encoded.programs);

    const decoded = decodeMultiProgramUrl(urlParams);
    expect(decoded.parsedProgramEntityIds).toEqual([9, EXT_SRIM, EXT_SRIM2]);
    // Backward-compat numeric-only subset
    expect(decoded.parsedProgramIds).toEqual([9]);
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

  it("silently drops hidden_programs (dropped in v2)", () => {
    const params = new URLSearchParams("?hidden_programs=101");
    const decoded = decodeMultiProgramUrl(params);
    expect((decoded as Record<string, unknown>).parsedHiddenIds).toBeUndefined();
    expect((decoded as Record<string, unknown>).hidden_programs).toBeUndefined();
  });

  it("parses qshow", () => {
    const params = new URLSearchParams("?qshow=range");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qshow).toBe("range");
  });

  it("ignores invalid qshow values", () => {
    const params = new URLSearchParams("?qshow=invalid");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qshow).toBeUndefined();
  });

  it("migrates legacy qfocus=csda to qshow=range (ADR 006 migration rule)", () => {
    const params = new URLSearchParams("?mode=advanced&qfocus=csda");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qshow).toBe("range");
  });

  it("migrates legacy qfocus=stp to qshow=stp (ADR 006 migration rule)", () => {
    const params = new URLSearchParams("?mode=advanced&qfocus=stp");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qshow).toBe("stp");
  });

  it("migrates legacy qfocus=both to omitted qshow (ADR 006 migration rule)", () => {
    const params = new URLSearchParams("?mode=advanced&qfocus=both");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.qshow).toBeUndefined();
  });

  it("filters invalid program IDs", () => {
    const params = new URLSearchParams("?programs=abc,9,xyz");
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.parsedProgramIds).toEqual([9]);
  });

  it("parses mixed numeric and ExtRef program IDs", () => {
    const params = new URLSearchParams(`?programs=9,${EXT_SRIM},2`);
    const decoded = decodeMultiProgramUrl(params);
    expect(decoded.parsedProgramEntityIds).toEqual([9, EXT_SRIM, 2]);
    expect(decoded.parsedProgramIds).toEqual([9, 2]); // numeric-only subset
  });

  it("silently drops ExtRef in hidden_programs (dropped in v2)", () => {
    const params = new URLSearchParams(`?hidden_programs=${EXT_SRIM}`);
    const decoded = decodeMultiProgramUrl(params);
    expect((decoded as Record<string, unknown>).parsedHiddenEntityIds).toBeUndefined();
  });
});
