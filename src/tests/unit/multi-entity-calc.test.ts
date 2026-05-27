import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";

vi.mock("$lib/wasm/loader", () => ({
  getService: vi.fn(),
}));

import { getService } from "$lib/wasm/loader";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { LibdedxError } from "$lib/wasm/types";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { createCalculatorState } from "$lib/state/calculator.svelte";
import { createMultiEntityState } from "$lib/state/multi-entity.svelte";
import { setupMultiEntityCalculation } from "$lib/state/multi-entity-calc.svelte";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { runInEffectRoot } from "../helpers/effect-root.svelte";

describe("setupMultiEntityCalculation — material mode", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;
  let multiEntityState: ReturnType<typeof createMultiEntityState>;
  let cleanupEffect: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LibdedxServiceImpl();
    vi.mocked(getService).mockResolvedValue(service);

    const matrix = buildCompatibilityMatrix(service);
    entityState = createEntitySelectionState(matrix);
    // MSTAR (program 4) supports both Water (276) and Air (267) in the mock
    entityState.selectProgram(4);
    calcState = createCalculatorState(entityState, service);
    calcState.updateRowText(0, "100");

    // Enter material multi-select mode and add air alongside water
    entityState.setAcross("material");
    entityState.toggleMulti("material", 267); // add Air

    multiEntityState = createMultiEntityState("material", (id) => String(id));

    cleanupEffect = runInEffectRoot(() => {
      setupMultiEntityCalculation(
        () => calcState,
        () => entityState,
        () => multiEntityState,
        () => null,
        () => JSON.stringify(advancedOptions.value),
      );
    });
    flushSync();
  });

  afterEach(() => {
    cleanupEffect?.();
    vi.useRealTimers();
    isAdvancedMode.value = false;
    advancedOptions.value = {};
  });

  it("calls service.calculate for each built-in material", async () => {
    const spy = vi.spyOn(service, "calculate");

    await vi.runAllTimersAsync();

    // Water (276) and Air (267)
    expect(spy).toHaveBeenCalledTimes(2);
    expect(multiEntityState.comparisonResults.size).toBe(2);
    expect(multiEntityState.comparisonResults.has(276)).toBe(true);
    expect(multiEntityState.comparisonResults.has(267)).toBe(true);
  });

  it("stores CalculationResult for both materials after calculation", async () => {
    await vi.runAllTimersAsync();

    expect(multiEntityState.comparisonResults.size).toBe(2);
    for (const result of multiEntityState.comparisonResults.values()) {
      expect(result).not.toBeInstanceOf(LibdedxError);
      expect(result).toHaveProperty("energies");
      expect(result).toHaveProperty("stoppingPowers");
    }
  });

  it("routes custom compound to calculateCustomCompound", async () => {
    const created = customCompounds.create({
      name: "TestCC-multi-entity",
      density: 1.5,
      elements: [
        { atomicNumber: 6, atomCount: 1 },
        { atomicNumber: 8, atomCount: 2 },
      ],
      phase: "condensed",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const spy = vi.spyOn(service, "calculateCustomCompound");
    // Switch anchor to custom compound; setAcross is a no-op when already in
    // "material" mode, so use setMultiMaterial to seed the list directly.
    entityState.selectMaterial(created.compound.id);
    entityState.setMultiMaterial([created.compound.id]);
    flushSync();

    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalled();
    customCompounds.delete(created.compound.id);
  });

  it("does not run when entity selection is incomplete", async () => {
    const spy = vi.spyOn(service, "calculate");
    entityState.clearParticle();

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not run when there are no valid energy rows", async () => {
    const spy = vi.spyOn(service, "calculate");
    calcState.updateRowText(0, "invalid");

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("stores LibdedxError for external-only material ID in material mode", async () => {
    const extEntityIds = ["ext:some:mat1"];
    const fakeEntityState = {
      ...entityState,
      get isComplete() {
        return true;
      },
      get multiSelected() {
        return { material: extEntityIds, particle: [], program: [] };
      },
      get selectedParticle() {
        return entityState.selectedParticle;
      },
      get selectedMaterial() {
        return entityState.selectedMaterial;
      },
      get resolvedProgramId() {
        return 4;
      },
      get across() {
        return "material" as const;
      },
    };

    const results = new Map<string | number, unknown>();
    const fakeMultiEntityState = {
      dimension: "material" as const,
      get comparisonResults() {
        return results as ReturnType<typeof createMultiEntityState>["comparisonResults"];
      },
      entityName: (id: string | number) => String(id),
      quantityFocus: "stp" as const,
      setComparisonResults(r: Map<string | number, unknown>) {
        for (const [k, v] of r) results.set(k, v);
      },
      setQuantityFocus() {},
    };

    const cleanup2 = runInEffectRoot(() => {
      setupMultiEntityCalculation(
        () => calcState,
        () => fakeEntityState as ReturnType<typeof createEntitySelectionState>,
        () => fakeMultiEntityState as ReturnType<typeof createMultiEntityState>,
        () => null,
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(results.get("ext:some:mat1")).toBeInstanceOf(LibdedxError);
    cleanup2();
  });
});

describe("setupMultiEntityCalculation — particle mode", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;
  let multiEntityState: ReturnType<typeof createMultiEntityState>;
  let cleanupEffect: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LibdedxServiceImpl();
    vi.mocked(getService).mockResolvedValue(service);

    const matrix = buildCompatibilityMatrix(service);
    entityState = createEntitySelectionState(matrix);
    // MSTAR (program 4) supports H(1), He(2), C(6) in the mock
    entityState.selectProgram(4);
    calcState = createCalculatorState(entityState, service);
    calcState.updateRowText(0, "100");

    // Multi-particle mode: proton is anchor, add helium
    entityState.setAcross("particle");
    entityState.toggleMulti("particle", 2); // add Helium

    multiEntityState = createMultiEntityState("particle", (id) => String(id));

    cleanupEffect = runInEffectRoot(() => {
      setupMultiEntityCalculation(
        () => calcState,
        () => entityState,
        () => multiEntityState,
        () => null,
        () => JSON.stringify(advancedOptions.value),
      );
    });
    flushSync();
  });

  afterEach(() => {
    cleanupEffect?.();
    vi.useRealTimers();
    advancedOptions.value = {};
  });

  it("calls service.calculate for each built-in particle", async () => {
    const spy = vi.spyOn(service, "calculate");

    await vi.runAllTimersAsync();

    // Proton (1) and Helium (2)
    expect(spy).toHaveBeenCalledTimes(2);
    expect(multiEntityState.comparisonResults.has(1)).toBe(true);
    expect(multiEntityState.comparisonResults.has(2)).toBe(true);
  });

  it("does not run when URL version mismatch is non-null", async () => {
    // Drain the pending initial timer first so it does not trip the spy below
    await vi.runAllTimersAsync();

    const spy = vi.spyOn(service, "calculate");

    const cleanup2 = runInEffectRoot(() => {
      setupMultiEntityCalculation(
        () => calcState,
        () => entityState,
        () => multiEntityState,
        () => "v1-mismatch",
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
    cleanup2();
  });

  it("does not run when program ID is an external string", async () => {
    // Drain the pending initial timer first so it does not trip the spy below
    await vi.runAllTimersAsync();

    const spy = vi.spyOn(service, "calculate");
    const fakeEntityState = {
      ...entityState,
      get isComplete() {
        return true;
      },
      get resolvedProgramId() {
        return "ext:srim:prog";
      },
      get multiSelected() {
        return { material: [276], particle: [1, 2], program: [] };
      },
    };

    const cleanup2 = runInEffectRoot(() => {
      setupMultiEntityCalculation(
        () => calcState,
        () => fakeEntityState as ReturnType<typeof createEntitySelectionState>,
        () => multiEntityState,
        () => null,
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
    cleanup2();
  });
});
