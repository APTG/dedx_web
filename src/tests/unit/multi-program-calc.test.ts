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
import { createMultiProgramState } from "$lib/state/multi-program.svelte";
import { setupMultiProgramCalculation } from "$lib/state/multi-program-calc.svelte";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { runInEffectRoot } from "../helpers/effect-root.svelte";

describe("setupMultiProgramCalculation", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;
  let multiProgState: ReturnType<typeof createMultiProgramState>;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LibdedxServiceImpl();
    vi.mocked(getService).mockResolvedValue(service);

    const matrix = buildCompatibilityMatrix(service);
    entityState = createEntitySelectionState(matrix);
    // Default entity: proton (1) + water (276); auto-select → PSTAR(2)
    calcState = createCalculatorState(entityState, service);
    calcState.updateRowText(0, "100");

    multiProgState = createMultiProgramState();
    // Select PSTAR (2) + MSTAR (4) — both support proton+water in the mock
    multiProgState.setSelectedProgramIds([2, 4]);

    // across must be "program" for the setup function to fire
    entityState.setAcross("program");

    cleanup = runInEffectRoot(() => {
      setupMultiProgramCalculation(
        () => calcState,
        () => entityState,
        () => multiProgState,
        () => null,
        () => JSON.stringify(advancedOptions.value),
      );
    });
    flushSync();
  });

  afterEach(() => {
    cleanup?.();
    vi.useRealTimers();
    isAdvancedMode.value = false;
    advancedOptions.value = {};
  });

  it("dispatches calculateMulti for built-in programs and stores results", async () => {
    const spy = vi.spyOn(service, "calculateMulti");

    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledOnce();
    expect(multiProgState.comparisonResults.size).toBe(2);
    expect(multiProgState.comparisonResults.has(2)).toBe(true);
    expect(multiProgState.comparisonResults.has(4)).toBe(true);
  });

  it("stores CalculationResult (not LibdedxError) for successful programs", async () => {
    await vi.runAllTimersAsync();

    for (const result of multiProgState.comparisonResults.values()) {
      expect(result).not.toBeInstanceOf(LibdedxError);
      expect(result).toHaveProperty("stoppingPowers");
    }
  });

  it("does not run when selectedProgramIds.length <= 1", async () => {
    const spy = vi.spyOn(service, "calculateMulti");
    multiProgState.setSelectedProgramIds([2]);

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not run when across !== 'program'", async () => {
    const spy = vi.spyOn(service, "calculateMulti");
    entityState.setAcross("single");

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not run when URL version mismatch is non-null", async () => {
    // Drain the pending initial timer so it does not trip the spy below
    await vi.runAllTimersAsync();

    const spy = vi.spyOn(service, "calculateMulti");

    const cleanup2 = runInEffectRoot(() => {
      setupMultiProgramCalculation(
        () => calcState,
        () => entityState,
        () => multiProgState,
        () => "v1-mismatch",
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
    cleanup2();
  });

  it("does not run when entity selection is incomplete", async () => {
    const spy = vi.spyOn(service, "calculateMulti");
    entityState.clearParticle();

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("marks out-of-range programs with LibdedxError code 101", async () => {
    // Energy above mock max (1000 MeV/nucl) — fails the range pre-check
    calcState.updateRowText(0, "9999");

    flushSync();
    await vi.runAllTimersAsync();

    for (const [, result] of multiProgState.comparisonResults) {
      expect(result).toBeInstanceOf(LibdedxError);
      expect((result as LibdedxError).code).toBe(101);
    }
  });

  it("routes custom compound to calculateCustomCompound per program", async () => {
    const created = customCompounds.create({
      name: "TestCC-multi-program",
      density: 2.0,
      elements: [
        { atomicNumber: 1, atomCount: 2 },
        { atomicNumber: 8, atomCount: 1 },
      ],
      phase: "condensed",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const spy = vi.spyOn(service, "calculateCustomCompound");
    entityState.selectMaterial(created.compound.id);

    flushSync();
    await vi.runAllTimersAsync();

    // One call per program (PSTAR=2, MSTAR=4)
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ density: 2.0 }));

    customCompounds.delete(created.compound.id);
  });
});
