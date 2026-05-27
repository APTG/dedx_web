import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { flushSync } from "svelte";

vi.mock("$lib/wasm/loader", () => ({
  getService: vi.fn(),
}));
vi.mock("$lib/external-data/service", () => ({
  externalDataService: {
    interpolateAt: vi.fn(),
  },
}));

import { getService } from "$lib/wasm/loader";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { createPlotState } from "$lib/state/plot.svelte";
import { setupPlotPreviewCalculation } from "$lib/state/plot-preview-calc.svelte";
import { advancedOptions } from "$lib/state/advanced-options.svelte";
import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
import { customCompounds } from "$lib/state/custom-compounds.svelte";
import { runInEffectRoot } from "../helpers/effect-root.svelte";

describe("setupPlotPreviewCalculation", () => {
  let service: LibdedxServiceImpl;
  let entityState: ReturnType<typeof createEntitySelectionState>;
  let plotState: ReturnType<typeof createPlotState>;
  let previewError: string | null;
  let cleanup: () => void;

  function setPreviewError(msg: string | null) {
    previewError = msg;
  }

  beforeEach(() => {
    service = new LibdedxServiceImpl();
    vi.mocked(getService).mockResolvedValue(service);

    const matrix = buildCompatibilityMatrix(service);
    entityState = createEntitySelectionState(matrix);
    plotState = createPlotState();
    previewError = null;
  });

  afterEach(() => {
    cleanup?.();
    isAdvancedMode.value = false;
    advancedOptions.value = {};
  });

  it("calls getPlotData and sets preview on plotState", async () => {
    const spy = vi.spyOn(service, "getPlotData");

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => null,
        () => JSON.stringify(advancedOptions.value),
        setPreviewError,
      );
    });
    flushSync();

    // getService() is async but not behind a setTimeout — flush promises
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.any(Number), // programId
      expect.any(Number), // particleId
      expect.any(Number), // materialId
      500,
      true, // logScale
      expect.anything(),
    );
    expect(plotState.preview).not.toBeNull();
    expect(previewError).toBeNull();
  });

  it("clears preview when entity selection is incomplete", async () => {
    entityState.clearParticle();

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => null,
        () => "{}",
        setPreviewError,
      );
    });
    flushSync();
    await Promise.resolve();

    expect(plotState.preview).toBeNull();
  });

  it("clears preview when URL version mismatch is set", async () => {
    const spy = vi.spyOn(service, "getPlotData");

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => "v1-mismatch",
        () => "{}",
        setPreviewError,
      );
    });
    flushSync();
    await Promise.resolve();

    expect(spy).not.toHaveBeenCalled();
    expect(plotState.preview).toBeNull();
  });

  it("invokes setPreviewError callback when getPlotData throws", async () => {
    vi.spyOn(service, "getPlotData").mockImplementation(() => {
      throw new Error("WASM crashed");
    });

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => null,
        () => "{}",
        setPreviewError,
      );
    });
    flushSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(previewError).toBe("WASM crashed");
    expect(plotState.preview).toBeNull();
  });

  it("routes custom compound to getPlotDataCustomCompound", async () => {
    const created = customCompounds.create({
      name: "TestCC-plot-preview",
      density: 1.8,
      elements: [
        { atomicNumber: 6, atomCount: 6 },
        { atomicNumber: 1, atomCount: 12 },
        { atomicNumber: 8, atomCount: 1 },
      ],
      phase: "condensed",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    entityState.selectMaterial(created.compound.id);
    const spy = vi.spyOn(service, "getPlotDataCustomCompound");
    const regularSpy = vi.spyOn(service, "getPlotData");

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => null,
        () => "{}",
        setPreviewError,
      );
    });
    flushSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ density: 1.8, numPoints: 500, logScale: true }),
    );
    expect(regularSpy).not.toHaveBeenCalled();
    expect(plotState.preview).not.toBeNull();

    customCompounds.delete(created.compound.id);
  });

  it("re-runs and updates preview when entity selection changes", async () => {
    const spy = vi.spyOn(service, "getPlotData");

    cleanup = runInEffectRoot(() => {
      setupPlotPreviewCalculation(
        () => plotState,
        () => entityState,
        () => null,
        () => JSON.stringify(advancedOptions.value),
        setPreviewError,
      );
    });
    flushSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(1);

    // Change particle — effect should re-run
    entityState.selectProgram(4); // MSTAR
    flushSync();
    await Promise.resolve();
    await Promise.resolve();

    expect(spy.mock.calls.length).toBeGreaterThan(1);
  });
});
