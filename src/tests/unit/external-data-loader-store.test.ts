import { describe, it, expect, vi, beforeEach } from "vitest";

const { openMock, rootMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  rootMock: vi.fn((store: unknown) => ({
    store,
    resolve: (path: string) => ({ store, path }),
  })),
}));

vi.mock("zarrita", () => ({
  FetchStore: vi.fn(),
  get: vi.fn(),
  open: openMock,
  root: rootMock,
}));

import { loadStoreMetadataFromStore } from "$lib/external-data/loader";

function minimalAttrs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": { name: "Local Store" },
    "webdedx.units": { energy: "MeV", stoppingPower: "MeV·cm²/g" },
    "webdedx.energyGrid": [1.0, 10.0, 100.0],
    "webdedx.programs": [{ id: "prog1", name: "Program 1" }],
    "webdedx.particles": [
      { id: "p", name: "Proton", symbol: "H", Z: 1, A: 1, atomicMass: 1.0072, pdgCode: 2212 },
    ],
    "webdedx.materials": [{ id: "water", name: "Water", density: 1.0, phase: "liquid" }],
    ...overrides,
  };
}

describe("loadStoreMetadataFromStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads metadata from a provided store and probes csda_range arrays", async () => {
    const store = { kind: "mock-store" };
    openMock.mockImplementation(async (target: { path?: string }) => {
      if (!target.path) {
        return { attrs: minimalAttrs() };
      }
      if (target.path === "prog1/csda_range") {
        return { attrs: {} };
      }
      throw new Error(`Unexpected path: ${target.path}`);
    });

    const metadata = await loadStoreMetadataFromStore(store, { label: "local", url: "" });
    expect(metadata.label).toBe("local");
    expect(metadata.hasCsdaRange).toBe(true);
    expect(openMock).toHaveBeenCalledTimes(2);
  });

  it("sets hasCsdaRange=false when csda_range probe fails", async () => {
    const store = { kind: "mock-store" };
    openMock.mockImplementation(async (target: { path?: string }) => {
      if (!target.path) {
        return { attrs: minimalAttrs() };
      }
      throw new Error("Not found");
    });

    const metadata = await loadStoreMetadataFromStore(store, { label: "local", url: "" });
    expect(metadata.hasCsdaRange).toBe(false);
  });
});
