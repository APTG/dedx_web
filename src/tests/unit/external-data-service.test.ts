/**
 * Tests for ExternalDataService — caching, deduplication, and lookup methods.
 * The loader module is mocked so no real HTTP requests are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExternalDataService } from "$lib/external-data/service";
import { ExternalDataError } from "$lib/external-data/errors";
import type { ExternalStoreMetadata } from "$lib/external-data/schema";

// ── Mock the loader module ────────────────────────────────────────────────────

vi.mock("$lib/external-data/loader", () => ({
  loadStoreMetadata: vi.fn(),
  loadStpSlice: vi.fn(),
  loadCsdaSlice: vi.fn(),
}));

import { loadStoreMetadata, loadStpSlice, loadCsdaSlice } from "$lib/external-data/loader";

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeMetadata(
  label: string,
  hasCsdaRange = false,
  energyUnit: ExternalStoreMetadata["energyUnit"] = "MeV",
): ExternalStoreMetadata {
  return {
    label,
    url: `https://example.com/${label}.webdedx`,
    name: `Test Store ${label}`,
    programs: [{ id: "prog1", name: "Program 1" }],
    particles: [
      { id: "p", name: "Proton", symbol: "H", Z: 1, A: 1, atomicMass: 1.008, index: 0 },
      { id: "alpha", name: "Alpha", symbol: "He", Z: 2, A: 4, atomicMass: 4.003, index: 1 },
    ],
    materials: [
      { id: "water", name: "Water", density: 1.0, index: 0, linearUnitsAvailable: true },
      { id: "air", name: "Air", index: 1, linearUnitsAvailable: false },
    ],
    energyGrid: [1.0, 10.0, 100.0],
    energyUnit,
    stpUnit: "MeV·cm²/g",
    hasCsdaRange,
  };
}

// ── ExternalDataService ───────────────────────────────────────────────────────

describe("ExternalDataService", () => {
  let svc: ExternalDataService;
  const mockLoadStoreMetadata = vi.mocked(loadStoreMetadata);
  const mockLoadStpSlice = vi.mocked(loadStpSlice);
  const mockLoadCsdaSlice = vi.mocked(loadCsdaSlice);

  beforeEach(() => {
    svc = new ExternalDataService();
    vi.clearAllMocks();
  });

  // ── loadSource ───────────────────────────────────────────────────────────

  describe("loadSource", () => {
    it("loads and caches metadata", async () => {
      const meta = makeMetadata("srim");
      mockLoadStoreMetadata.mockResolvedValueOnce(meta);

      const result = await svc.loadSource({
        label: "srim",
        url: "https://example.com/srim.webdedx",
      });
      expect(result).toBe(meta);
      expect(mockLoadStoreMetadata).toHaveBeenCalledOnce();
    });

    it("returns cached result on second call without re-fetching", async () => {
      const meta = makeMetadata("srim");
      mockLoadStoreMetadata.mockResolvedValueOnce(meta);

      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });

      expect(mockLoadStoreMetadata).toHaveBeenCalledOnce();
    });

    it("deduplicates concurrent calls for the same label", async () => {
      const meta = makeMetadata("srim");
      let resolveLoad!: (value: ExternalStoreMetadata) => void;
      mockLoadStoreMetadata.mockReturnValueOnce(
        new Promise<ExternalStoreMetadata>((r) => {
          resolveLoad = r;
        }),
      );

      const p1 = svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      const p2 = svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      resolveLoad(meta);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(meta);
      expect(r2).toBe(meta);
      expect(mockLoadStoreMetadata).toHaveBeenCalledOnce();
    });

    it("removes in-flight promise after load completes", async () => {
      const meta = makeMetadata("srim");
      mockLoadStoreMetadata.mockResolvedValue(meta);

      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      // A second call should use the cache, not the in-flight map.
      const result = await svc.loadSource({
        label: "srim",
        url: "https://example.com/srim.webdedx",
      });
      expect(result).toBe(meta);
      expect(mockLoadStoreMetadata).toHaveBeenCalledOnce();
    });

    it("removes in-flight promise on failure and allows retry", async () => {
      const err = new ExternalDataError("not-found", "missing");
      mockLoadStoreMetadata.mockRejectedValueOnce(err);
      const meta = makeMetadata("srim");
      mockLoadStoreMetadata.mockResolvedValueOnce(meta);

      await expect(
        svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" }),
      ).rejects.toThrow();
      // Second attempt should succeed.
      const result = await svc.loadSource({
        label: "srim",
        url: "https://example.com/srim.webdedx",
      });
      expect(result).toBe(meta);
      expect(mockLoadStoreMetadata).toHaveBeenCalledTimes(2);
    });

    it("throws validation-error when MAX_SOURCES is reached", async () => {
      mockLoadStoreMetadata.mockImplementation(async (d) => makeMetadata(d.label));

      for (let i = 0; i < 5; i++) {
        await svc.loadSource({ label: `src${i}`, url: `https://example.com/src${i}.webdedx` });
      }

      await expect(
        svc.loadSource({ label: "src5", url: "https://example.com/src5.webdedx" }),
      ).rejects.toMatchObject({ code: "validation-error" });
    });

    it("counts in-flight loads toward MAX_SOURCES", async () => {
      mockLoadStoreMetadata.mockImplementation(
        (d) =>
          new Promise<ExternalStoreMetadata>((resolve) => {
            setTimeout(() => resolve(makeMetadata(d.label)), 0);
          }),
      );

      const pending = Array.from({ length: 5 }, (_, i) =>
        svc.loadSource({ label: `src${i}`, url: `https://example.com/src${i}.webdedx` }),
      );

      await expect(
        svc.loadSource({ label: "src5", url: "https://example.com/src5.webdedx" }),
      ).rejects.toMatchObject({ code: "validation-error" });

      await Promise.all(pending);
    });
  });

  // ── getMetadata / isLoaded ───────────────────────────────────────────────

  describe("getMetadata / isLoaded", () => {
    it("returns undefined before load", () => {
      expect(svc.getMetadata("srim")).toBeUndefined();
    });

    it("returns metadata after load", async () => {
      const meta = makeMetadata("srim");
      mockLoadStoreMetadata.mockResolvedValueOnce(meta);
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      expect(svc.getMetadata("srim")).toBe(meta);
    });

    it("isLoaded returns false before load, true after", async () => {
      expect(svc.isLoaded("srim")).toBe(false);
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      expect(svc.isLoaded("srim")).toBe(true);
    });
  });

  // ── evict ────────────────────────────────────────────────────────────────

  describe("evict", () => {
    it("removes metadata from cache", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });

      svc.evict("srim");

      expect(svc.isLoaded("srim")).toBe(false);
    });

    it("allows re-loading after eviction", async () => {
      mockLoadStoreMetadata.mockResolvedValue(makeMetadata("srim"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });

      svc.evict("srim");
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });

      expect(svc.isLoaded("srim")).toBe(true);
      expect(mockLoadStoreMetadata).toHaveBeenCalledTimes(2);
    });

    it("evict is a no-op for unknown label", () => {
      expect(() => svc.evict("nonexistent")).not.toThrow();
    });

    it("does not cache metadata when an in-flight load is evicted before it resolves", async () => {
      let resolveLoad!: (value: ExternalStoreMetadata) => void;
      mockLoadStoreMetadata.mockReturnValueOnce(
        new Promise<ExternalStoreMetadata>((resolve) => {
          resolveLoad = resolve;
        }),
      );

      const pending = svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      svc.evict("srim");
      const meta = makeMetadata("srim");
      resolveLoad(meta);

      await expect(pending).resolves.toBe(meta);
      expect(svc.getMetadata("srim")).toBeUndefined();
      expect(svc.isLoaded("srim")).toBe(false);
    });
  });

  // ── clear ────────────────────────────────────────────────────────────────

  describe("clear", () => {
    it("removes all sources", async () => {
      mockLoadStoreMetadata.mockImplementation(async (d) => makeMetadata(d.label));
      await svc.loadSource({ label: "s1", url: "https://example.com/s1.webdedx" });
      await svc.loadSource({ label: "s2", url: "https://example.com/s2.webdedx" });

      svc.clear();

      expect(svc.isLoaded("s1")).toBe(false);
      expect(svc.isLoaded("s2")).toBe(false);
    });
  });

  // ── getStp ───────────────────────────────────────────────────────────────

  describe("getStp", () => {
    beforeEach(async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
    });

    it("returns null when label not loaded", async () => {
      const result = await svc.getStp("unknown", "prog1", "p", "water");
      expect(result).toBeNull();
    });

    it("returns null for unknown particle", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));
      const result = await svc.getStp("srim", "prog1", "unknown_particle", "water");
      expect(result).toBeNull();
    });

    it("returns null for unknown material", async () => {
      const result = await svc.getStp("srim", "prog1", "p", "unknown_material");
      expect(result).toBeNull();
    });

    it("loads and returns STP table entry", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));

      const entry = await svc.getStp("srim", "prog1", "p", "water");
      expect(entry).not.toBeNull();
      expect(entry!.energyGridMev).toHaveLength(3);
      expect(entry!.values).toHaveLength(3);
      expect(mockLoadStpSlice).toHaveBeenCalledWith(
        "https://example.com/srim.webdedx",
        "prog1",
        0, // particle index
        0, // material index
      );
    });

    it("converts energy grid: MeV identity for proton (A=1)", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));
      const entry = await svc.getStp("srim", "prog1", "p", "water");
      // Energy grid [1,10,100] MeV, proton A=1 → same values
      expect(Array.from(entry!.energyGridMev)).toEqual([1.0, 10.0, 100.0]);
    });

    it("converts energy grid for alpha (A=4): grid values are unchanged (MeV total)", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));
      // alpha particle: energyUnit=MeV, A=4 → no multiplication (already total MeV)
      const entry = await svc.getStp("srim", "prog1", "alpha", "water");
      expect(Array.from(entry!.energyGridMev)).toEqual([1.0, 10.0, 100.0]);
    });

    it("converts per-nucleon energy grid to total MeV for alpha (A=4)", async () => {
      svc = new ExternalDataService();
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", false, "MeV/nucl"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));

      const entry = await svc.getStp("srim", "prog1", "alpha", "water");
      expect(Array.from(entry!.energyGridMev)).toEqual([4.0, 40.0, 400.0]);
    });

    it("caches result on second call", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));

      const e1 = await svc.getStp("srim", "prog1", "p", "water");
      const e2 = await svc.getStp("srim", "prog1", "p", "water");
      expect(e1).toBe(e2);
      expect(mockLoadStpSlice).toHaveBeenCalledOnce();
    });

    it("evict clears the STP cache", async () => {
      mockLoadStpSlice.mockResolvedValue(new Float32Array([10.0, 5.0, 2.5]));
      await svc.getStp("srim", "prog1", "p", "water");

      svc.evict("srim");

      // After evict, metadata is gone so getStp returns null.
      const result = await svc.getStp("srim", "prog1", "p", "water");
      expect(result).toBeNull();
    });
  });

  // ── getCsda ──────────────────────────────────────────────────────────────

  describe("getCsda", () => {
    it("returns null when metadata not loaded", async () => {
      expect(await svc.getCsda("srim", "prog1", "p", "water")).toBeNull();
    });

    // ── hasCsdaRange=true: load from zarr store ──────────────────────────

    it("loads and caches CSDA range when hasCsdaRange=true", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", true));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadCsdaSlice.mockResolvedValueOnce(new Float32Array([0.1, 5.0, 100.0]));

      const entry = await svc.getCsda("srim", "prog1", "p", "water");
      expect(entry).not.toBeNull();
      expect(entry!.values).toHaveLength(3);
      expect(mockLoadCsdaSlice).toHaveBeenCalledOnce();
    });

    it("caches null when zarr slice returns null (hasCsdaRange=true)", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", true));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadCsdaSlice.mockResolvedValueOnce(null);

      const r1 = await svc.getCsda("srim", "prog1", "p", "water");
      const r2 = await svc.getCsda("srim", "prog1", "p", "water");
      expect(r1).toBeNull();
      expect(r2).toBeNull();
      expect(mockLoadCsdaSlice).toHaveBeenCalledOnce();
    });

    it("caches positive result on second call (hasCsdaRange=true)", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", true));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadCsdaSlice.mockResolvedValueOnce(new Float32Array([0.1, 5.0, 100.0]));

      const e1 = await svc.getCsda("srim", "prog1", "p", "water");
      const e2 = await svc.getCsda("srim", "prog1", "p", "water");
      expect(e1).toBe(e2);
      expect(mockLoadCsdaSlice).toHaveBeenCalledOnce();
    });

    // ── hasCsdaRange=false: derive from STP integration ──────────────────

    it("computes CSDA from STP when hasCsdaRange=false", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", false));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 5.0, 2.5]));

      const entry = await svc.getCsda("srim", "prog1", "p", "water");

      expect(entry).not.toBeNull();
      expect(entry!.values).toHaveLength(3);
      // First CSDA value is 0 by convention (no integral accumulated yet).
      expect(entry!.values[0]).toBe(0);
      // Subsequent values must be non-null and increasing.
      expect(entry!.values[1]).not.toBeNull();
      expect(entry!.values[2]).not.toBeNull();
      expect(entry!.values[2]! as number).toBeGreaterThan(entry!.values[1]! as number);
      // Never calls the CSDA loader for STP-only stores.
      expect(mockLoadCsdaSlice).not.toHaveBeenCalled();
    });

    it("shares energy grid with the STP entry when deriving CSDA", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", false));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadStpSlice.mockResolvedValue(new Float32Array([10.0, 5.0, 2.5]));

      const stpEntry = await svc.getStp("srim", "prog1", "p", "water");
      const csdaEntry = await svc.getCsda("srim", "prog1", "p", "water");

      expect(csdaEntry!.energyGridMev).toBe(stpEntry!.energyGridMev);
    });

    it("caches STP-derived CSDA and does not recompute", async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", false));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
      mockLoadStpSlice.mockResolvedValue(new Float32Array([10.0, 5.0, 2.5]));

      const e1 = await svc.getCsda("srim", "prog1", "p", "water");
      const e2 = await svc.getCsda("srim", "prog1", "p", "water");

      expect(e1).toBe(e2);
      // getStp itself is cached too; only one slice fetch regardless of call count.
      expect(mockLoadStpSlice).toHaveBeenCalledOnce();
    });
  });

  // ── interpolateAt ────────────────────────────────────────────────────────

  describe("interpolateAt", () => {
    beforeEach(async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim", true));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
    });

    it("propagates STP slice load errors", async () => {
      // getStp will fail: loadStpSlice throws
      mockLoadStpSlice.mockRejectedValueOnce(new Error("network fail"));
      mockLoadCsdaSlice.mockResolvedValueOnce(null);

      await expect(svc.interpolateAt("srim", "prog1", "p", "water", 5.0)).rejects.toThrow();
    });

    it("returns interpolated stp and null csda when no csda data", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 1.0, 0.1]));
      mockLoadCsdaSlice.mockResolvedValueOnce(null);

      const result = await svc.interpolateAt("srim", "prog1", "p", "water", 5.0);
      expect(result.stp).not.toBeNull();
      expect(result.csda).toBeNull();
    });

    it("returns both stp and csda when both present", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 1.0, 0.1]));
      mockLoadCsdaSlice.mockResolvedValueOnce(new Float32Array([0.01, 0.5, 20.0]));

      const result = await svc.interpolateAt("srim", "prog1", "p", "water", 5.0);
      expect(result.stp).not.toBeNull();
      expect(result.csda).not.toBeNull();
    });

    it("returns null stp when energy out of range", async () => {
      mockLoadStpSlice.mockResolvedValueOnce(new Float32Array([10.0, 1.0, 0.1]));
      mockLoadCsdaSlice.mockResolvedValueOnce(null);

      const result = await svc.interpolateAt("srim", "prog1", "p", "water", 0.001);
      expect(result.stp).toBeNull();
    });
  });

  // ── findParticle / findMaterial ──────────────────────────────────────────

  describe("findParticle / findMaterial", () => {
    beforeEach(async () => {
      mockLoadStoreMetadata.mockResolvedValueOnce(makeMetadata("srim"));
      await svc.loadSource({ label: "srim", url: "https://example.com/srim.webdedx" });
    });

    it("findParticle returns particle by local id", () => {
      const p = svc.findParticle("srim", "p");
      expect(p).not.toBeUndefined();
      expect(p!.name).toBe("Proton");
    });

    it("findParticle returns undefined for unknown id", () => {
      expect(svc.findParticle("srim", "unknown")).toBeUndefined();
    });

    it("findParticle returns undefined for unknown label", () => {
      expect(svc.findParticle("unknown", "p")).toBeUndefined();
    });

    it("findMaterial returns material by local id", () => {
      const m = svc.findMaterial("srim", "water");
      expect(m).not.toBeUndefined();
      expect(m!.name).toBe("Water");
    });

    it("findMaterial returns undefined for unknown id", () => {
      expect(svc.findMaterial("srim", "unknown")).toBeUndefined();
    });
  });
});
