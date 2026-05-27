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
import { createInverseLookupState } from "$lib/state/inverse-lookups.svelte";
import {
  setupInverseRangeCalculation,
  setupInverseStpCalculation,
} from "$lib/state/inverse-calc.svelte";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { runInEffectRoot } from "../helpers/effect-root.svelte";

function makeBaseState() {
  const service = new LibdedxServiceImpl();
  vi.mocked(getService).mockResolvedValue(service);
  const matrix = buildCompatibilityMatrix(service);
  const entityState = createEntitySelectionState(matrix);
  // Select PSTAR (program 2) explicitly — supports proton + water
  entityState.selectProgram(2);
  const calcState = createCalculatorState(entityState, service);
  const inverseLookupState = createInverseLookupState(entityState);
  return { service, entityState, calcState, inverseLookupState };
}

describe("setupInverseRangeCalculation", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;
  let inverseLookupState: ReturnType<typeof createInverseLookupState>;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ service, entityState, calcState, inverseLookupState } = makeBaseState());

    inverseLookupState.setActiveTab("csda");
    inverseLookupState.updateRangeRowText(0, "7.718 cm");

    cleanup = runInEffectRoot(() => {
      setupInverseRangeCalculation(
        () => calcState,
        () => entityState,
        () => inverseLookupState,
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

  it("calls getInverseCsda and stores energyMevNucl on the row", async () => {
    const spy = vi.spyOn(service, "getInverseCsda");

    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledOnce();
    // Mock returns energy = range * 13 for each range value. Water density = 1.
    // Range: 7.718 cm → g/cm² = 7.718 * 1.0 = 7.718; energy = 7.718 * 13 ≈ 100.3
    expect(inverseLookupState.rangeRows[0]!.energyMevNucl).toBeCloseTo(7.718 * 13, 3);
  });

  it("converts length units before calling getInverseCsda", async () => {
    const spy = vi.spyOn(service, "getInverseCsda");
    inverseLookupState.updateRangeRowText(0, "77.18 mm");

    flushSync();
    await vi.runAllTimersAsync();

    // 77.18 mm × 0.1 cm/mm = 7.718 cm; × density 1.0 = 7.718 g/cm²
    const call = spy.mock.calls[0]!;
    expect(call[0].ranges[0]).toBeCloseTo(7.718, 3);
  });

  it("does not run when activeTab is not 'csda'", async () => {
    const spy = vi.spyOn(service, "getInverseCsda");
    inverseLookupState.setActiveTab("stp");

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("does not run when URL version mismatch is set", async () => {
    // Drain the pending initial timer so it does not trip the spy below
    await vi.runAllTimersAsync();

    const spy = vi.spyOn(service, "getInverseCsda");

    const cleanup2 = runInEffectRoot(() => {
      setupInverseRangeCalculation(
        () => calcState,
        () => entityState,
        () => inverseLookupState,
        () => "mismatch",
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
    cleanup2();
  });

  it("does not run for external programs (string program ID)", async () => {
    // Drain the pending initial timer so it does not trip the spy below
    await vi.runAllTimersAsync();

    const spy = vi.spyOn(service, "getInverseCsda");
    // Override resolvedProgramId to be a string
    const fakeEntityState = {
      ...entityState,
      get isComplete() {
        return true;
      },
      get resolvedProgramId() {
        return "ext:srim:prog";
      },
    };

    const cleanup2 = runInEffectRoot(() => {
      setupInverseRangeCalculation(
        () => calcState,
        () => fakeEntityState as ReturnType<typeof createEntitySelectionState>,
        () => inverseLookupState,
        () => null,
        () => "{}",
      );
    });
    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
    cleanup2();
  });

  it("marks rows with error status when service throws", async () => {
    vi.spyOn(service, "getInverseCsda").mockImplementation(() => {
      throw new LibdedxError(-1, "mock inverse lookup failure");
    });

    await vi.runAllTimersAsync();

    expect(inverseLookupState.rangeRows[0]!.status).toBe("error");
    expect(inverseLookupState.rangeRows[0]!.energyMevNucl).toBeNull();
  });

  it("skips rows with empty or invalid status", async () => {
    const spy = vi.spyOn(service, "getInverseCsda");
    inverseLookupState.updateRangeRowText(0, ""); // empty row

    flushSync();
    await vi.runAllTimersAsync();

    // No valid rows → no service call
    expect(spy).not.toHaveBeenCalled();
  });

  it("uses density override from advanced options", async () => {
    const spy = vi.spyOn(service, "getInverseCsda");
    isAdvancedMode.value = true;
    advancedOptions.value = { densityOverride: 2.0 };

    flushSync();
    await vi.runAllTimersAsync();

    // With density 2.0: 7.718 cm × 2.0 = 15.436 g/cm²
    const call = spy.mock.calls[0]!;
    expect(call[0].ranges[0]).toBeCloseTo(15.436, 3);
  });
});

describe("setupInverseStpCalculation", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;
  let inverseLookupState: ReturnType<typeof createInverseLookupState>;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ service, entityState, calcState, inverseLookupState } = makeBaseState());

    inverseLookupState.setActiveTab("stp");
    inverseLookupState.updateStpRowText(0, "7.286"); // 7.286 keV/µm (default master unit)

    cleanup = runInEffectRoot(() => {
      setupInverseStpCalculation(
        () => calcState,
        () => entityState,
        () => inverseLookupState,
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

  it("calls getInverseStp for LOW_E_SIDE (0) and HIGH_E_SIDE (1)", async () => {
    const spy = vi.spyOn(service, "getInverseStp");

    await vi.runAllTimersAsync();

    expect(spy).toHaveBeenCalledTimes(2);
    const sides = spy.mock.calls.map((c) => c[0].side);
    expect(sides).toContain(0); // LOW_E_SIDE
    expect(sides).toContain(1); // HIGH_E_SIDE
  });

  it("stores energyLowMevNucl and energyHighMevNucl on the row", async () => {
    await vi.runAllTimersAsync();

    const row = inverseLookupState.stpRows[0]!;
    // Mock: low = stp * 2, high = stp * 10. Distinct so no collapse.
    // 7.286 keV/µm × 10 / density(1) = 72.86 MeV·cm²/g
    // low energy = 72.86 * 2 = 145.72; high = 72.86 * 10 = 728.6
    expect(row.energyLowMevNucl).not.toBeNull();
    expect(row.energyHighMevNucl).not.toBeNull();
    expect(row.energyHighMevNucl!).toBeGreaterThan(row.energyLowMevNucl!);
  });

  it("collapses to single solution when both branches return identical energy", async () => {
    // Override both sides to return the same energy value
    vi.spyOn(service, "getInverseStp").mockImplementation((params) => {
      return params.stoppingPowers.map((stp) => ({ energy: stp * 5, stoppingPower: stp }));
    });

    await vi.runAllTimersAsync();

    const row = inverseLookupState.stpRows[0]!;
    // Both branches returned the same energy → low branch is nulled out
    expect(row.energyLowMevNucl).toBeNull();
    expect(row.energyHighMevNucl).not.toBeNull();
  });

  it("marks rows as no-solution when both branches return errors", async () => {
    vi.spyOn(service, "getInverseStp").mockImplementation((params) => {
      return params.stoppingPowers.map(() => new LibdedxError(-1, "no solution"));
    });

    await vi.runAllTimersAsync();

    const row = inverseLookupState.stpRows[0]!;
    expect(row.status).toBe("no-solution");
    expect(row.energyLowMevNucl).toBeNull();
    expect(row.energyHighMevNucl).toBeNull();
  });

  it("marks rows as error when service throws", async () => {
    vi.spyOn(service, "getInverseStp").mockImplementation(() => {
      throw new LibdedxError(-1, "unexpected failure");
    });

    await vi.runAllTimersAsync();

    expect(inverseLookupState.stpRows[0]!.status).toBe("error");
  });

  it("does not run when activeTab is not 'stp'", async () => {
    const spy = vi.spyOn(service, "getInverseStp");
    inverseLookupState.setActiveTab("csda");

    flushSync();
    await vi.runAllTimersAsync();

    expect(spy).not.toHaveBeenCalled();
  });

  it("converts unit correctly: mev-cm2-g input is passed through unchanged", async () => {
    const spy = vi.spyOn(service, "getInverseStp");
    inverseLookupState.setStpMasterUnit("mev-cm2-g");
    inverseLookupState.updateStpRowText(0, "50");

    flushSync();
    await vi.runAllTimersAsync();

    // 50 MeV·cm²/g → no unit conversion needed
    const call = spy.mock.calls[0]!;
    expect(call[0].stoppingPowers[0]).toBeCloseTo(50, 5);
  });

  it("converts keV/µm → MeV·cm²/g before the service call", async () => {
    const spy = vi.spyOn(service, "getInverseStp");
    // Default unit is keV/µm; value "10" → 10 * 10 / 1.0 = 100 MeV·cm²/g
    inverseLookupState.updateStpRowText(0, "10");

    flushSync();
    await vi.runAllTimersAsync();

    const call = spy.mock.calls[0]!;
    expect(call[0].stoppingPowers[0]).toBeCloseTo(100, 5);
  });
});
