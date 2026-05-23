/**
 * Tests for the external data loader, validation, units, and interpolation.
 *
 * Network calls are mocked via vi.stubGlobal('fetch', ...) so no real
 * HTTP requests are made. Zarr v3 regular chunking (non-sharded) is used
 * in test fixtures to keep mock responses simple.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { validateRootAttrs } from "$lib/external-data/validation";
import { ExternalDataError } from "$lib/external-data/errors";
import {
  energyToMev,
  stpToInternal,
  csdaToInternal,
  convertStpColumn,
} from "$lib/external-data/units";
import { interpolate } from "$lib/external-data/interpolation";
import { loadStoreMetadata } from "$lib/external-data/loader";

// ── Helper: build minimal valid root attrs ────────────────────────────────────

function minimalAttrs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": { name: "Test Store" },
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

function rootZarrJson(attrs: Record<string, unknown>): string {
  return JSON.stringify({ zarr_format: 3, node_type: "group", attributes: attrs });
}

// ── validateRootAttrs ────────────────────────────────────────────────────────

describe("validateRootAttrs", () => {
  it("accepts valid minimal STP-only metadata", () => {
    const meta = validateRootAttrs(minimalAttrs(), "srim", "https://example.com/srim.webdedx");
    expect(meta.name).toBe("Test Store");
    expect(meta.programs).toHaveLength(1);
    expect(meta.particles).toHaveLength(1);
    expect(meta.materials).toHaveLength(1);
    expect(meta.energyGrid).toEqual([1.0, 10.0, 100.0]);
    expect(meta.energyUnit).toBe("MeV");
    expect(meta.stpUnit).toBe("MeV·cm²/g");
    expect(meta.csdaUnit).toBeUndefined();
    expect(meta.hasCsdaRange).toBe(false);
  });

  it("accepts optional csdaRange unit", () => {
    const attrs = minimalAttrs({
      "webdedx.units": { energy: "MeV", stoppingPower: "MeV·cm²/g", csdaRange: "g/cm²" },
    });
    const meta = validateRootAttrs(attrs, "srim", "https://example.com/");
    expect(meta.csdaUnit).toBe("g/cm²");
  });

  it("accepts missing material density", () => {
    const attrs = minimalAttrs({
      "webdedx.materials": [{ id: "air", name: "Air" }],
    });
    const meta = validateRootAttrs(attrs, "srim", "https://example.com/");
    expect(meta.materials[0]!.density).toBeUndefined();
    expect(meta.materials[0]!.linearUnitsAvailable).toBe(false);
  });

  it("sets particle.index to match array position", () => {
    const attrs = minimalAttrs({
      "webdedx.particles": [
        { id: "p", name: "Proton", symbol: "H", Z: 1, A: 1, atomicMass: 1.008 },
        { id: "alpha", name: "Alpha", symbol: "He", Z: 2, A: 4, atomicMass: 4.0026 },
      ],
    });
    const meta = validateRootAttrs(attrs, "srim", "https://example.com/");
    expect(meta.particles[0]!.index).toBe(0);
    expect(meta.particles[1]!.index).toBe(1);
  });

  it("rejects wrong magic", () => {
    const attrs = minimalAttrs({ "webdedx.magic": "wrong" });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
    try {
      validateRootAttrs(attrs, "srim", "https://x.com/");
    } catch (e) {
      expect((e as ExternalDataError).code).toBe("invalid-format");
    }
  });

  it("rejects unsupported formatVersion", () => {
    const attrs = minimalAttrs({ "webdedx.formatVersion": 99 });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
    try {
      validateRootAttrs(attrs, "srim", "https://x.com/");
    } catch (e) {
      expect((e as ExternalDataError).code).toBe("unsupported-version");
    }
  });

  it("rejects invalid energy unit", () => {
    const attrs = minimalAttrs({
      "webdedx.units": { energy: "eV", stoppingPower: "MeV·cm²/g" },
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects non-strictly-increasing energy grid", () => {
    const attrs = minimalAttrs({ "webdedx.energyGrid": [1.0, 1.0, 10.0] });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects energy grid shorter than 2", () => {
    const attrs = minimalAttrs({ "webdedx.energyGrid": [1.0] });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects non-positive energy grid values", () => {
    const attrs = minimalAttrs({ "webdedx.energyGrid": [0, 1.0, 10.0] });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects duplicate program IDs", () => {
    const attrs = minimalAttrs({
      "webdedx.programs": [
        { id: "prog1", name: "P1" },
        { id: "prog1", name: "P2 dupe" },
      ],
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects duplicate particle IDs", () => {
    const attrs = minimalAttrs({
      "webdedx.particles": [
        { id: "p", name: "Proton", symbol: "H", Z: 1, A: 1, atomicMass: 1.008 },
        { id: "p", name: "Dupe", symbol: "H", Z: 1, A: 1, atomicMass: 1.008 },
      ],
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects duplicate material IDs", () => {
    const attrs = minimalAttrs({
      "webdedx.materials": [
        { id: "water", name: "Water", density: 1.0 },
        { id: "water", name: "Water dupe", density: 1.0 },
      ],
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("rejects both icruId and atomicNumber on same material", () => {
    const attrs = minimalAttrs({
      "webdedx.materials": [{ id: "si", name: "Silicon", icruId: 14, atomicNumber: 14 }],
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });

  it("accepts optional pdgCode on particles", () => {
    const attrs = minimalAttrs({
      "webdedx.particles": [
        {
          id: "p",
          name: "Proton",
          symbol: "H",
          Z: 1,
          A: 1,
          atomicMass: 1.008,
          pdgCode: 2212,
        },
      ],
    });
    const meta = validateRootAttrs(attrs, "srim", "https://example.com/");
    expect(meta.particles[0]!.pdgCode).toBe(2212);
  });

  it("rejects duplicate pdgCode across particles", () => {
    const attrs = minimalAttrs({
      "webdedx.particles": [
        { id: "p1", name: "P1", symbol: "H", Z: 1, A: 1, atomicMass: 1.008, pdgCode: 2212 },
        { id: "p2", name: "P2", symbol: "H", Z: 1, A: 1, atomicMass: 1.008, pdgCode: 2212 },
      ],
    });
    expect(() => validateRootAttrs(attrs, "srim", "https://x.com/")).toThrow(ExternalDataError);
  });
});

// ── energyToMev ───────────────────────────────────────────────────────────────

describe("energyToMev", () => {
  it("MeV: identity", () => expect(energyToMev(100, "MeV", 1)).toBeCloseTo(100));
  it("keV: /1000", () => expect(energyToMev(1000, "keV", 1)).toBeCloseTo(1.0));
  it("GeV: *1000", () => expect(energyToMev(0.5, "GeV", 1)).toBeCloseTo(500));
  it("MeV/nucl: *A", () => expect(energyToMev(10, "MeV/nucl", 12)).toBeCloseTo(120));
  it("MeV/u: *A", () => expect(energyToMev(10, "MeV/u", 4)).toBeCloseTo(40));
  it("MeV/nucl with A=0 treats as 1", () => expect(energyToMev(10, "MeV/nucl", 0)).toBeCloseTo(10));
});

// ── stpToInternal ─────────────────────────────────────────────────────────────

describe("stpToInternal", () => {
  it("MeV·cm²/g: identity", () => expect(stpToInternal(5.0, "MeV·cm²/g")).toBe(5.0));
  it("MeV/cm: divides by density", () =>
    expect(stpToInternal(5.0, "MeV/cm", 2.0)).toBeCloseTo(2.5));
  it("MeV/cm: null when density missing", () => expect(stpToInternal(5.0, "MeV/cm")).toBeNull());
  it("keV/µm: *10/density", () => expect(stpToInternal(5.0, "keV/µm", 1.0)).toBeCloseTo(50.0));
  it("keV/µm: null when density missing", () => expect(stpToInternal(5.0, "keV/µm")).toBeNull());
});

// ── csdaToInternal ─────────────────────────────────────────────────────────────

describe("csdaToInternal", () => {
  it("g/cm²: identity", () => expect(csdaToInternal(3.0, "g/cm²")).toBe(3.0));
  it("cm: *density", () => expect(csdaToInternal(2.0, "cm", 1.5)).toBeCloseTo(3.0));
  it("cm: null when density missing", () => expect(csdaToInternal(2.0, "cm")).toBeNull());
});

// ── convertStpColumn ─────────────────────────────────────────────────────────

describe("convertStpColumn", () => {
  it("converts mass stopping power identity", () => {
    const raw = new Float32Array([1.0, 2.0, 3.0]);
    const out = convertStpColumn(raw, "MeV·cm²/g");
    expect(out).toEqual([1.0, 2.0, 3.0]);
  });

  it("returns null for non-finite values", () => {
    const raw = new Float32Array([1.0, NaN, 3.0]);
    const out = convertStpColumn(raw, "MeV·cm²/g");
    expect(out[1]).toBeNull();
  });
});

// ── interpolate ───────────────────────────────────────────────────────────────

describe("interpolate — log-log", () => {
  const grid = [1.0, 10.0, 100.0];
  const vals = [10.0, 1.0, 0.1]; // stp decreases with energy

  it("returns exact value at grid points", () => {
    expect(interpolate(grid, vals, 1.0)).toBeCloseTo(10.0);
    expect(interpolate(grid, vals, 10.0)).toBeCloseTo(1.0);
    expect(interpolate(grid, vals, 100.0)).toBeCloseTo(0.1);
  });

  it("interpolates mid-point on log-log scale", () => {
    // On log-log scale, midpoint of [1,10] in log space = sqrt(10) ≈ 3.162
    // The midpoint value should be geometric mean of 10 and 1 = sqrt(10) ≈ 3.162
    const result = interpolate(grid, vals, Math.sqrt(10));
    expect(result).toBeCloseTo(Math.sqrt(10), 3);
  });

  it("returns null for out-of-range energy (below)", () => {
    expect(interpolate(grid, vals, 0.5)).toBeNull();
  });

  it("returns null for out-of-range energy (above)", () => {
    expect(interpolate(grid, vals, 200.0)).toBeNull();
  });

  it("returns null for non-positive energy", () => {
    expect(interpolate(grid, vals, 0)).toBeNull();
    expect(interpolate(grid, vals, -1)).toBeNull();
  });
});

describe("interpolate — lin-lin", () => {
  const grid = [0.0, 10.0, 20.0]; // need non-zero grid for lin-lin

  it("should not work with zero-origin grid on log-log", () => {
    expect(interpolate(grid, [1.0, 2.0, 3.0], 5.0, "log-log")).toBeNull();
  });

  it("lin-lin works with any positive values", () => {
    const vals = [1.0, 2.0, 3.0];
    // midpoint of [0, 10] = 5 → linear mid of [1.0, 2.0] = 1.5
    const result = interpolate(grid, vals, 5.0, "lin-lin");
    expect(result).toBeCloseTo(1.5);
  });

  it("lin-lin extrapolation is not allowed (out-of-range returns null)", () => {
    expect(interpolate(grid, [1.0, 2.0, 3.0], 25.0, "lin-lin")).toBeNull();
  });
});

// ── loadStoreMetadata (mocked fetch) ─────────────────────────────────────────

describe("loadStoreMetadata — mocked fetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(responses: Record<string, { status: number; body: string }>) {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      // FetchStore passes a Request object, not a string/URL
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      // Use the longest (most specific) matching pattern to avoid
      // "/zarr.json" shadowing "/prog1/csda_range/zarr.json".
      const match = Object.entries(responses)
        .filter(([pattern]) => url.endsWith(pattern))
        .sort((a, b) => b[0].length - a[0].length)[0];
      if (!match) {
        return new Response(null, { status: 404 });
      }
      const [, { status, body }] = match;
      return new Response(body, { status, headers: { "content-type": "application/json" } });
    });
  }

  it("loads valid metadata and hasCsdaRange=false when no csda_range", async () => {
    mockFetch({
      "/zarr.json": { status: 200, body: rootZarrJson(minimalAttrs()) },
      "/prog1/stp/zarr.json": {
        status: 200,
        body: JSON.stringify({
          zarr_format: 3,
          node_type: "array",
          shape: [1, 1, 3],
          data_type: "float32",
          chunk_grid: { name: "regular", configuration: { chunk_shape: [1, 1, 3] } },
          chunk_key_encoding: { name: "default", separator: "/" },
          fill_value: 0.0,
          codecs: [{ name: "bytes", configuration: { endian: "little" } }],
          attributes: {},
        }),
      },
    });

    const meta = await loadStoreMetadata({
      label: "srim",
      url: "https://example.com/srim.webdedx",
    });

    expect(meta.name).toBe("Test Store");
    expect(meta.programs[0]!.id).toBe("prog1");
    expect(meta.hasCsdaRange).toBe(false);
  });

  it("sets hasCsdaRange=true when csda_range array is present", async () => {
    mockFetch({
      "/zarr.json": { status: 200, body: rootZarrJson(minimalAttrs()) },
      "/prog1/csda_range/zarr.json": {
        status: 200,
        body: JSON.stringify({
          zarr_format: 3,
          node_type: "array",
          shape: [1, 1, 3],
          data_type: "float32",
          chunk_grid: { name: "regular", configuration: { chunk_shape: [1, 1, 3] } },
          chunk_key_encoding: { name: "default", separator: "/" },
          fill_value: 0.0,
          codecs: [{ name: "bytes", configuration: { endian: "little" } }],
          attributes: {},
        }),
      },
    });

    const meta = await loadStoreMetadata({
      label: "srim",
      url: "https://example.com/srim.webdedx",
    });

    expect(meta.hasCsdaRange).toBe(true);
  });

  it("throws ExternalDataError with invalid-format for wrong magic", async () => {
    const attrs = minimalAttrs({ "webdedx.magic": "wrong-magic" });
    mockFetch({ "/zarr.json": { status: 200, body: rootZarrJson(attrs) } });

    await expect(
      loadStoreMetadata({ label: "srim", url: "https://example.com/srim.webdedx" }),
    ).rejects.toMatchObject({ code: "invalid-format" });
  });

  it("throws ExternalDataError with not-found on 404", async () => {
    vi.stubGlobal("fetch", async () => new Response("Not Found", { status: 404 }));

    await expect(
      loadStoreMetadata({ label: "srim", url: "https://example.com/missing.webdedx" }),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
