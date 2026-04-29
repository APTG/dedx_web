import { describe, test, expect } from "vitest";
import { generateCalculatorCsv, generateLegacyCsv, downloadCsv, type CsvExportMeta } from "$lib/export/csv";
import type { CalculatedRow } from "$lib/state/calculator.svelte";

// --- generateCalculatorCsv tests ---

const mockMeta: CsvExportMeta = {
  particle: { id: 1, name: "Proton", massNumber: 1, atomicMass: 1.007, symbol: "p", aliases: ["proton"] },
  material: { id: 276, name: "Water (liquid)", density: 0.997, isGasByDefault: false, atomicNumber: 0 },
  program: { id: 2, name: "PSTAR", version: "1.0" },
};

const mockValidRows: CalculatedRow[] = [
  { id: "1", rawInput: "100", normalizedMevNucl: 100, unit: "MeV", unitFromSuffix: false, status: "valid", stoppingPower: 5.278, csdaRangeCm: 0.02345 },
  { id: "2", rawInput: "200 keV", normalizedMevNucl: 0.2, unit: "keV", unitFromSuffix: true, status: "valid", stoppingPower: 12.34, csdaRangeCm: 0.0005678 },
  { id: "3", rawInput: "abc", normalizedMevNucl: null, unit: "MeV", unitFromSuffix: false, status: "invalid", message: "parse error", stoppingPower: null, csdaRangeCm: null },
  { id: "4", rawInput: "", normalizedMevNucl: null, unit: "MeV", unitFromSuffix: false, status: "empty", stoppingPower: null, csdaRangeCm: null },
];

const mockEmptyRows: CalculatedRow[] = [];

describe("generateCalculatorCsv — column structure", () => {
  test("produces 5-column header with correct labels", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    const header = content.split("\r\n")[0];
    expect(header).toContain("Normalized Energy (MeV/nucl)");
    expect(header).toContain("Typed Value");
    expect(header).toContain("Unit");
    expect(header).toContain("CSDA Range");
    expect(header).toContain("Stopping Power (keV/µm)");
  });

  test("uses correct Stopping Power header unit for gas materials", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "MeV·cm²/g", mockMeta);
    const header = content.split("\r\n")[0];
    expect(header).toContain("Stopping Power (MeV·cm²/g)");
  });

  test("uses CRLF line endings", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    expect(content).toContain("\r\n");
  });

  test("produces header + N data rows for N valid rows", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    const lines = content.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(3); // 1 header + 2 valid data rows
  });

  test("omits invalid and empty rows", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    // "abc" and "" rows should be excluded
    expect(content).not.toContain("abc");
    // Only the two valid rows should produce data
    const lines = content.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(3);
  });

  test("all data rows have exactly 5 comma-separated cells", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    const dataLines = content.split("\r\n").slice(1).filter(Boolean);
    dataLines.forEach((line) => {
      const cells = line.match(/"[^"]*"/g);
      expect(cells).toHaveLength(5);
    });
  });

  test("all cells are double-quoted", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    const dataLine = content.split("\r\n")[1]!;
    dataLine.split(",").forEach((cell) => {
      expect(cell.trim()).toMatch(/^".*"$/);
    });
  });

  test("produces header only for empty rows", () => {
    const { content } = generateCalculatorCsv([], "keV/µm", mockMeta);
    const lines = content.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
  });

  test("values are formatted to 4 significant figures", () => {
    const { content } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    expect(content).toContain("100"); // 100 → "100"
    expect(content).toContain("5.278");
  });
});

describe("generateCalculatorCsv — filename", () => {
  test("produces correct filename format", () => {
    const { filename } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    expect(filename).toBe("dedx_calculator_proton_water_(liquid)_pstar.csv");
  });

  test("all lowercase with underscores", () => {
    const { filename } = generateCalculatorCsv(mockValidRows, "keV/µm", mockMeta);
    expect(filename).not.toMatch(/[\s]/);
  });
});

describe("generateCalculatorCsv — sanitization", () => {
  test("prefers single-quote prefix for values starting with =", () => {
    const rows: CalculatedRow[] = [
      { id: "1", rawInput: "=CMD", normalizedMevNucl: 100, unit: "MeV", unitFromSuffix: false, status: "valid", stoppingPower: 5.278, csdaRangeCm: 0.02345 },
    ];
    const { content } = generateCalculatorCsv(rows, "keV/µm", mockMeta);
    expect(content).toContain("'=CMD");
  });
});

// --- generateLegacyCsv tests (backward compat) ---

const legacyEnergies = [1.0, 10.0, 100.0];
const legacyStps = [5.5, 3.2, 1.8];
const legacyCsda = [0.001, 0.1, 10.0];

describe("generateLegacyCsv — structure", () => {
  test("uses CRLF line endings", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda);
    expect(csv).toContain("\r\n");
  });

  test("includes header row by default", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda);
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).toContain("Energy");
    expect(firstLine).toContain("Stopping Power");
    expect(firstLine).toContain("CSDA Range");
  });

  test("omits header when includeHeader is false", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda, { includeHeader: false });
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).not.toContain("Energy");
  });

  test("produces header + N data rows for N energies", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(4); // 1 header + 3 data
  });

  test("produces 0 data rows for empty arrays", () => {
    const csv = generateLegacyCsv([], [], []);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  test("all cells are double-quoted", () => {
    const csv = generateLegacyCsv([1.0], [5.5], [0.001]);
    const dataLine = csv.split("\r\n")[1]!;
    dataLine.split(",").forEach((cell) => {
      expect(cell.trim()).toMatch(/^".*"$/);
    });
  });

  test("each data row has exactly three comma-separated cells", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda);
    const dataLines = csv.split("\r\n").slice(1).filter(Boolean);
    dataLines.forEach((line) => {
      const cells = line.match(/"[^"]*"/g);
      expect(cells).toHaveLength(3);
    });
  });
});

describe("generateLegacyCsv — metadata", () => {
  test("includes program, particle, material when includeMetadata + program are set", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda, {
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
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda, {
      includeMetadata: false,
      program: "ICRU 90",
    });
    expect(csv).not.toContain("Program:");
  });

  test("metadata generated date line contains ISO timestamp", () => {
    const csv = generateLegacyCsv(legacyEnergies, legacyStps, legacyCsda, {
      includeMetadata: true,
      program: "PSTAR",
    });
    expect(csv).toMatch(/Generated:.*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("generateLegacyCsv — units", () => {
  test("uses g/cm² as default CSDA unit suffix", () => {
    const csv = generateLegacyCsv([1.0], [5.5], [0.001]);
    expect(csv).toContain("g/cm²");
  });

  test("uses custom CSDA unit suffix when provided", () => {
    const csv = generateLegacyCsv([1.0], [5.5], [0.001], { csdaUnitSuffix: "cm" });
    expect(csv).toContain("cm");
    expect(csv).not.toContain("g/cm²");
  });
});

describe("generateLegacyCsv — number formatting", () => {
  test("rounds to 4 significant figures", () => {
    const csv = generateLegacyCsv([1.23456789], [1.0], [1.0]);
    expect(csv).toContain("1.235");
  });

  test("strips trailing zeros after decimal", () => {
    const csv = generateLegacyCsv([1.0], [2.0], [3.0]);
    expect(csv).not.toMatch(/"1\.000"/);
  });

  test("handles very small numbers without losing precision", () => {
    const csv = generateLegacyCsv([0.001234], [1.0], [1.0]);
    expect(csv).toContain("0.001234");
  });

  test("handles integers without spurious decimal point", () => {
    const csv = generateLegacyCsv([1000.0], [1.0], [1.0]);
    const dataLine = csv.split("\r\n")[1]!;
    expect(dataLine).not.toMatch(/"1000\."/);
  });
});
