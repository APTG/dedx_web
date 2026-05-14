import { describe, it, expect } from "vitest";
import { generateCalculatorCsv } from "$lib/export/csv";
import type { CalculatedRow } from "$lib/state/calculator.svelte";
import type { CsvExportMeta } from "$lib/export/csv";

// Minimal mock row for testing
const MOCK_ROW: CalculatedRow = {
  id: 1,
  rawInput: "1.0",
  unit: "MeV/nucl",
  unitFromSuffix: false,
  normalizedMevNucl: 1.0,
  stoppingPower: 100.5,
  csdaRangeCm: 0.001,
  status: "valid",
};

const META: CsvExportMeta = {
  particle: { name: "Proton" },
  material: { name: "Water" },
  program: { name: "ICRU 90" },
};

describe("CsvOptions", () => {
  describe("default options", () => {
    it("default options: comma separator, CRLF line endings", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META);
      expect(content.split("\r\n").length).toBeGreaterThan(1); // CRLF present
      expect(content).not.toContain("\n\r"); // no bare LF
    });
  });

  describe("separator options", () => {
    it("semicolon separator produces semicolon-delimited header", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "semicolon",
        lineEndings: "crlf",
      });
      const header = content.split("\r\n")[0] ?? "";
      expect(header).toContain(";");
      expect(header).not.toContain(",");
    });

    it("tab separator produces tab-delimited header", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "tab",
        lineEndings: "lf",
      });
      const header = content.split("\n")[0] ?? "";
      expect(header).toContain("\t");
    });

    it("comma separator produces comma-delimited header", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "comma",
        lineEndings: "crlf",
      });
      const header = content.split("\r\n")[0] ?? "";
      expect(header).toContain(",");
      expect(header).not.toContain(";");
      expect(header).not.toContain("\t");
    });
  });

  describe("line endings options", () => {
    it("lf line endings produce LF only (no CR)", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "comma",
        lineEndings: "lf",
      });
      expect(content).not.toContain("\r");
    });

    it("crlf line endings produce CRLF", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "comma",
        lineEndings: "crlf",
      });
      expect(content).toContain("\r\n");
    });
  });

  describe("combined options", () => {
    it("semicolon + lf produces correct combination", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "semicolon",
        lineEndings: "lf",
      });
      const lines = content.split("\n");
      expect(lines.length).toBeGreaterThan(1);
      expect(content).not.toContain("\r");
      expect(lines[0]).toContain(";");
    });

    it("tab + crlf produces correct combination", () => {
      const { content } = generateCalculatorCsv([MOCK_ROW], "keV/µm", META, {
        separator: "tab",
        lineEndings: "crlf",
      });
      const lines = content.split("\r\n");
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain("\t");
    });
  });
});
