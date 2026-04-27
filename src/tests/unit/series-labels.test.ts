import { describe, it, expect } from "vitest";
import { computeSeriesLabels, allocateColor, releaseColor } from "$lib/utils/series-labels";

describe("computeSeriesLabels", () => {
  it("returns full label for single series", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
    ]);
    expect(result).toEqual(["Proton in Water (liquid)"]);
  });

  it("shows only program name when only program varies", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 9,
        particleId: 1,
        materialId: 276,
        programName: "ICRU 90",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
    ]);
    expect(result).toEqual(["PSTAR", "ICRU 90"]);
  });

  it("shows only particle name when only particle varies", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 2,
        particleId: 6,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Carbon",
        materialName: "Water (liquid)",
      },
    ]);
    expect(result).toEqual(["Proton", "Carbon"]);
  });

  it("shows only material name when only material varies", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 2,
        particleId: 1,
        materialId: 267,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Air",
      },
    ]);
    expect(result).toEqual(["Water (liquid)", "Air"]);
  });

  it("shows program + particle when both vary", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 9,
        particleId: 6,
        materialId: 276,
        programName: "ICRU 90",
        particleName: "Carbon",
        materialName: "Water (liquid)",
      },
    ]);
    expect(result).toEqual(["PSTAR — Proton", "ICRU 90 — Carbon"]);
  });

  it("shows program + material when both vary", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 9,
        particleId: 1,
        materialId: 267,
        programName: "ICRU 90",
        particleName: "Proton",
        materialName: "Air",
      },
    ]);
    expect(result).toEqual(["PSTAR — Water (liquid)", "ICRU 90 — Air"]);
  });

  it("shows particle in material when particle + material vary", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 2,
        particleId: 6,
        materialId: 267,
        programName: "PSTAR",
        particleName: "Carbon",
        materialName: "Air",
      },
    ]);
    expect(result).toEqual(["Proton in Water (liquid)", "Carbon in Air"]);
  });

  it("shows program + particle in material when all three vary", () => {
    const result = computeSeriesLabels([
      {
        programId: 2,
        particleId: 1,
        materialId: 276,
        programName: "PSTAR",
        particleName: "Proton",
        materialName: "Water (liquid)",
      },
      {
        programId: 9,
        particleId: 6,
        materialId: 267,
        programName: "ICRU 90",
        particleName: "Carbon",
        materialName: "Air",
      },
    ]);
    expect(result).toEqual([
      "PSTAR — Proton in Water (liquid)",
      "ICRU 90 — Carbon in Air",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(computeSeriesLabels([])).toEqual([]);
  });
});

describe("color pool", () => {
  it("allocates colors in order from a fresh pool", () => {
    const pool = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(allocateColor(pool)).toBe(0);
    expect(pool.size).toBe(8);
    expect(allocateColor(pool)).toBe(1);
    expect(allocateColor(pool)).toBe(2);
  });

  it("wraps around when pool is empty", () => {
    const pool = new Set<number>();
    // Fill all 9 slots
    for (let i = 0; i < 9; i++) {
      allocateColor(pool);
    }
    expect(pool.size).toBe(0);
    // Next allocate should refill and return 0
    const idx = allocateColor(pool);
    expect(idx).toBe(0);
    expect(pool.size).toBe(8);
  });

  it("releases color back to pool", () => {
    const pool = new Set([0, 1, 2]);
    allocateColor(pool); // removes 0
    expect(pool.has(0)).toBe(false);
    releaseColor(pool, 0);
    expect(pool.has(0)).toBe(true);
  });

  it("reuses released color (lowest index)", () => {
    const pool = new Set([0, 1, 2]);
    allocateColor(pool); // removes 0
    allocateColor(pool); // removes 1
    releaseColor(pool, 0); // releases 0
    const idx = allocateColor(pool);
    expect(idx).toBe(0); // should get the lowest (0) back
  });
});
