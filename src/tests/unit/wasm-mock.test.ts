import { describe, test, expect, beforeEach } from "vitest";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import type { LibdedxService } from "$lib/wasm/types";

// These tests verify the mock obeys the LibdedxService contract so that
// unit/integration tests using it behave consistently across stages.

describe("LibdedxServiceImpl mock — init", () => {
  test("init() resolves without error", async () => {
    const svc = new LibdedxServiceImpl();
    await expect(svc.init()).resolves.toBeUndefined();
  });
});

describe("LibdedxServiceImpl mock — getPrograms", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("returns a non-empty array", () => {
    expect(svc.getPrograms().length).toBeGreaterThan(0);
  });

  test("each program has numeric id", () => {
    svc.getPrograms().forEach((p) => expect(typeof p.id).toBe("number"));
  });

  test("each program has non-empty name", () => {
    svc.getPrograms().forEach((p) => expect(p.name.length).toBeGreaterThan(0));
  });

  test("each program has version string", () => {
    svc.getPrograms().forEach((p) => expect(typeof p.version).toBe("string"));
  });

  test("program IDs are unique", () => {
    const ids = svc.getPrograms().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("returns the same list on repeated calls", () => {
    expect(svc.getPrograms()).toEqual(svc.getPrograms());
  });
});

describe("LibdedxServiceImpl mock — getParticles", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("returns non-empty array for every listed program", () => {
    svc.getPrograms().forEach((prog) => {
      expect(svc.getParticles(prog.id).length).toBeGreaterThan(0);
    });
  });

  test("each particle has positive massNumber", () => {
    svc.getPrograms().forEach((prog) => {
      svc.getParticles(prog.id).forEach((p) => {
        expect(p.massNumber).toBeGreaterThan(0);
      });
    });
  });

  test("each particle has positive atomicMass", () => {
    svc.getPrograms().forEach((prog) => {
      svc.getParticles(prog.id).forEach((p) => {
        expect(p.atomicMass).toBeGreaterThan(0);
      });
    });
  });

  test("each particle has aliases array (may be empty)", () => {
    svc.getPrograms().forEach((prog) => {
      svc.getParticles(prog.id).forEach((p) => {
        expect(Array.isArray(p.aliases)).toBe(true);
      });
    });
  });

  test("returns empty array for unknown programId", () => {
    expect(svc.getParticles(9999)).toEqual([]);
  });
});

describe("LibdedxServiceImpl mock — getMaterials", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("returns non-empty array for every listed program", () => {
    svc.getPrograms().forEach((prog) => {
      expect(svc.getMaterials(prog.id).length).toBeGreaterThan(0);
    });
  });

  test("each material has positive density", () => {
    svc.getPrograms().forEach((prog) => {
      svc.getMaterials(prog.id).forEach((m) => {
        expect(m.density).toBeGreaterThan(0);
      });
    });
  });

  test("each material has boolean isGasByDefault", () => {
    svc.getPrograms().forEach((prog) => {
      svc.getMaterials(prog.id).forEach((m) => {
        expect(typeof m.isGasByDefault).toBe("boolean");
      });
    });
  });

  test("returns empty array for unknown programId", () => {
    expect(svc.getMaterials(9999)).toEqual([]);
  });
});

describe("LibdedxServiceImpl mock — calculate", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("result arrays match input energy count", () => {
    const energies = [1.0, 10.0, 100.0];
    const r = svc.calculate(1, 1, 1, energies);
    expect(r.energies).toHaveLength(3);
    expect(r.stoppingPowers).toHaveLength(3);
    expect(r.csdaRanges).toHaveLength(3);
  });

  test("result.energies equals the input array", () => {
    const energies = [1.0, 10.0, 100.0];
    expect(svc.calculate(1, 1, 1, energies).energies).toEqual(energies);
  });

  test("all stopping powers are positive", () => {
    svc.calculate(1, 1, 1, [1.0, 10.0, 100.0]).stoppingPowers.forEach((sp) => {
      expect(sp).toBeGreaterThan(0);
    });
  });

  test("all CSDA ranges are positive", () => {
    svc.calculate(1, 1, 1, [1.0, 10.0, 100.0]).csdaRanges.forEach((r) => {
      expect(r).toBeGreaterThan(0);
    });
  });

  test("handles single-element energy array", () => {
    const r = svc.calculate(1, 1, 1, [100.0]);
    expect(r.energies).toHaveLength(1);
    expect(r.stoppingPowers).toHaveLength(1);
    expect(r.csdaRanges).toHaveLength(1);
  });

  test("handles empty energy array without throwing", () => {
    const r = svc.calculate(1, 1, 1, []);
    expect(r.energies).toHaveLength(0);
    expect(r.stoppingPowers).toHaveLength(0);
    expect(r.csdaRanges).toHaveLength(0);
  });
});

describe("LibdedxServiceImpl mock — getPlotData", () => {
  let svc: LibdedxService;

  beforeEach(() => {
    svc = new LibdedxServiceImpl();
  });

  test("returns exactly numPoints data points (linear scale)", () => {
    const r = svc.getPlotData(1, 1, 1, 50, false);
    expect(r.energies).toHaveLength(50);
    expect(r.stoppingPowers).toHaveLength(50);
    expect(r.csdaRanges).toHaveLength(50);
  });

  test("returns exactly numPoints data points (log scale)", () => {
    const r = svc.getPlotData(1, 1, 1, 50, true);
    expect(r.energies).toHaveLength(50);
  });

  test("energies are monotonically increasing (linear)", () => {
    const { energies } = svc.getPlotData(1, 1, 1, 10, false);
    for (let i = 1; i < energies.length; i++) {
      expect(energies[i]).toBeGreaterThan(energies[i - 1]!);
    }
  });

  test("energies are monotonically increasing (log)", () => {
    const { energies } = svc.getPlotData(1, 1, 1, 10, true);
    for (let i = 1; i < energies.length; i++) {
      expect(energies[i]).toBeGreaterThan(energies[i - 1]!);
    }
  });

  test("all energies are positive", () => {
    svc.getPlotData(1, 1, 1, 10, false).energies.forEach((e) => {
      expect(e).toBeGreaterThan(0);
    });
  });
});
