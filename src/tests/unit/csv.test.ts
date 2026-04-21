import { describe, test, expect } from "vitest";
import { generateCsv } from "$lib/export/csv";

const energies = [1.0, 10.0, 100.0];
const stps = [5.5, 3.2, 1.8];
const csdaRanges = [0.001, 0.1, 10.0];

describe("generateCsv — structure", () => {
  test("uses CRLF line endings", () => {
    const csv = generateCsv(energies, stps, csdaRanges);
    expect(csv).toContain("\r\n");
  });

  test("includes header row by default", () => {
    const csv = generateCsv(energies, stps, csdaRanges);
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).toContain("Energy");
    expect(firstLine).toContain("Stopping Power");
    expect(firstLine).toContain("CSDA Range");
  });

  test("omits header when includeHeader is false", () => {
    const csv = generateCsv(energies, stps, csdaRanges, { includeHeader: false });
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).not.toContain("Energy");
  });

  test("produces header + N data rows for N energies", () => {
    const csv = generateCsv(energies, stps, csdaRanges);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(4); // 1 header + 3 data
  });

  test("produces 0 data rows for empty arrays", () => {
    const csv = generateCsv([], [], []);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  test("all cells are double-quoted", () => {
    const csv = generateCsv([1.0], [5.5], [0.001]);
    const dataLine = csv.split("\r\n")[1]!;
    dataLine.split(",").forEach((cell) => {
      expect(cell.trim()).toMatch(/^".*"$/);
    });
  });

  test("each data row has exactly three comma-separated cells", () => {
    const csv = generateCsv(energies, stps, csdaRanges);
    const dataLines = csv.split("\r\n").slice(1).filter(Boolean);
    dataLines.forEach((line) => {
      // split on comma NOT inside quotes
      const cells = line.match(/"[^"]*"/g);
      expect(cells).toHaveLength(3);
    });
  });
});

describe("generateCsv — metadata", () => {
  test("includes program, particle, material when includeMetadata + program are set", () => {
    const csv = generateCsv(energies, stps, csdaRanges, {
      includeMetadata: true,
      program: "ICRU 90",
      particle: "Proton",
      material: "Water (liquid)",
    });
    expect(csv).toContain("Program: ICRU 90");
    expect(csv).toContain("Particle: Proton");
    expect(csv).toContain("Material: Water (liquid)");
  });

  test("skips metadata block when includeMetadata is false", () => {
    const csv = generateCsv(energies, stps, csdaRanges, {
      includeMetadata: false,
      program: "ICRU 90",
    });
    expect(csv).not.toContain("Program:");
  });

  test("metadata generated date line contains ISO timestamp", () => {
    const csv = generateCsv(energies, stps, csdaRanges, {
      includeMetadata: true,
      program: "PSTAR",
    });
    expect(csv).toMatch(/Generated:.*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("generateCsv — units", () => {
  test("uses g/cm² as default CSDA unit suffix", () => {
    const csv = generateCsv([1.0], [5.5], [0.001]);
    expect(csv).toContain("g/cm²");
  });

  test("uses custom CSDA unit suffix when provided", () => {
    const csv = generateCsv([1.0], [5.5], [0.001], { csdaUnitSuffix: "cm" });
    expect(csv).toContain("cm");
    expect(csv).not.toContain("g/cm²");
  });
});

describe("generateCsv — number formatting", () => {
  test("rounds to 4 significant figures", () => {
    const csv = generateCsv([1.23456789], [1.0], [1.0]);
    expect(csv).toContain("1.235");
  });

  test("strips trailing zeros after decimal", () => {
    const csv = generateCsv([1.0], [2.0], [3.0]);
    // 1.000 toPrecision(4) → should be "1" not "1.000"
    expect(csv).not.toMatch(/"1\.000"/);
  });

  test("handles very small numbers without losing precision", () => {
    const csv = generateCsv([0.001234], [1.0], [1.0]);
    expect(csv).toContain("0.001234");
  });

  test("handles integers without spurious decimal point", () => {
    const csv = generateCsv([1000.0], [1.0], [1.0]);
    const dataLine = csv.split("\r\n")[1]!;
    // should not end with "."
    expect(dataLine).not.toMatch(/"1000\."/);
  });
});
