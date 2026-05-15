import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CalculatedRow } from "$lib/state/calculator.svelte";
import { generateCalculatorPdf } from "$lib/export/pdf";

const pdfState = vi.hoisted(() => ({
  currentPage: 1,
  pageCount: 1,
  savedFilename: "",
  textCalls: [] as Array<{ page: number; text: string }>,
  reset() {
    this.currentPage = 1;
    this.pageCount = 1;
    this.savedFilename = "";
    this.textCalls = [];
  },
}));

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 100,
        },
      },
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      setTextColor: vi.fn(),
      textWithLink: vi.fn(),
      line: vi.fn(),
      text: vi.fn((text: string) => {
        pdfState.textCalls.push({ page: pdfState.currentPage, text });
      }),
      addPage: vi.fn(() => {
        pdfState.pageCount += 1;
        pdfState.currentPage = pdfState.pageCount;
      }),
      setPage: vi.fn((page: number) => {
        pdfState.currentPage = page;
      }),
      getNumberOfPages: vi.fn(() => pdfState.pageCount),
      save: vi.fn((filename: string) => {
        pdfState.savedFilename = filename;
      }),
    };
  }),
}));

function makeValidRow(): CalculatedRow {
  return {
    id: 1,
    rawInput: "100 MeV",
    normalizedMevNucl: 100,
    unit: "MeV",
    unitFromSuffix: true,
    status: "valid",
    stoppingPower: 4.2,
    csdaRangeCm: 7.7,
  };
}

describe("generateCalculatorPdf", () => {
  beforeEach(() => {
    pdfState.reset();
  });

  test("stamps page footers after advanced metadata pages are added", async () => {
    await generateCalculatorPdf({
      rows: [makeValidRow()],
      stpUnit: "MeV cm²/g",
      particle: { name: "Proton" },
      material: { name: "Water" },
      program: { name: "PSTAR" },
      filename: "calculator.pdf",
      url: "https://example.test/calculator",
      advancedMetadata: {
        particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
        material: { name: "Water", density: 1 },
        programs: Array.from({ length: 40 }, (_, index) => ({
          name: `Program ${index + 1}`,
          type: "built-in",
        })),
      },
    });

    const footers = pdfState.textCalls.filter(({ text }) => /^Page \d+ \/ \d+$/.test(text));

    expect(pdfState.pageCount).toBeGreaterThan(1);
    expect(footers).toEqual(
      Array.from({ length: pdfState.pageCount }, (_, index) => ({
        page: index + 1,
        text: `Page ${index + 1} / ${pdfState.pageCount}`,
      })),
    );
    expect(pdfState.savedFilename).toBe("calculator.pdf");
  });
});
