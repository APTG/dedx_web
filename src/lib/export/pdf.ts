import type { CalculatedRow } from "$lib/state/calculator.svelte";
import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
import { formatSigFigs } from "$lib/utils/unit-conversions";

/**
 * PDF filename for basic-mode Calculator export.
 *
 * Format: dedx_calculator_{particle}_{material}_{program}.pdf
 */
export function buildPdfFilename(
  particle: ParticleEntity | null,
  material: MaterialEntity | null,
  program: ProgramEntity | null,
): string {
  function slug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "_");
  }

  const p = particle ? slug(particle.name) : "unknown_particle";
  const m = material ? slug(material.name) : "unknown_material";
  const pr = program ? slug(program.name) : "unknown_program";
  return `dedx_calculator_${p}_${m}_${pr}.pdf`;
}

/**
 * Options for PDF generation.
 */
export interface PdfExportContext {
  rows: CalculatedRow[];
  stpUnit: string;
  particle: ParticleEntity | null;
  material: MaterialEntity | null;
  program: ProgramEntity | null;
  filename: string;
  url: string;
}

type JsdocPdf = import("jspdf").jsPDF;

/**
 * Generate a basic-mode Calculator PDF and download it.
 *
 * Layout (export.md §6.2):
 *   1. Header: app name, generated timestamp (ISO 8601 UTC), clickable URL
 *   2. Entity summary line (particle in material — program)
 *   3. Five-column results table (no error rows)
 *   4. Page-number footer "Page n / N"
 */
export async function generateCalculatorPdf(ctx: PdfExportContext): Promise<void> {
  const { rows, particle, material, program, filename, url } = ctx;

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const isValidRows = rows.filter((r) => r.status === "valid");

  // --- Header block ---
  const headerLeft = margin;
  let y = margin;

  // App name
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.text("dEdx Web \u2014 Calculator", headerLeft, y);
  y += 8;

  // Generated timestamp
  const generatedAt = new Date().toISOString();
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.text(`Generated: ${generatedAt}`, headerLeft, y);
  y += 5;

  // URL (hyperlinked)
  doc.addLink(url);
  doc.setTextColor(0, 0, 180);
  doc.text(url, headerLeft, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Entity summary
  const particleName = particle?.name ?? "Unknown particle";
  const materialName = material?.name ?? "Unknown material";
  const programName = program?.name ?? "Unknown program";
  const summary = `${particleName} in ${materialName} \u2014 ${programName}`;
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text(summary, headerLeft, y);
  y += 8;

  // Add a horizontal rule
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- Table ---
  const tableTop = y;
  const colLabels = [
    "Typed",
    "Norm (MeV/nucl)",
    "Unit",
    "STP",
    "CSDA",
  ];
  // Adjust "CSDA" column header to include unit suffix from range units
  // but keep CSDA column header without unit per spec (# CSDA Range column header carries no unit)

  // Column widths (mm) — fit 5 columns in contentWidth
  const colWidths = [28, 28, 14, 38, 38];

  // Table header row
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  let cellX = margin;
  for (const label of colLabels) {
    doc.text(label, cellX + 1, tableTop + 3, { align: "left" });
    cellX += colWidths[colLabels.indexOf(label)];
  }
  doc.line(margin, tableTop + 5, pageWidth - margin, tableTop + 5);
  doc.setFont(undefined, "normal");

  let rowY = tableTop + 9;
  const cellHeight = 4.5;
  const maxRowsPerPage = Math.floor((pageHeight - rowY - 12) / cellHeight); // 12mm bottom margin for page number

  const totalPages = calcTotalPages(isValidRows.length, maxRowsPerPage, rowY, pageHeight, 12);

  for (let i = 0; i < isValidRows.length; i++) {
    const r = isValidRows[i];

    // Check if we need a new page
    if (rowY + cellHeight > pageHeight - 12) {
      // Add page number footer before page break
      addPageFooter(doc, margin, pageWidth, i + 1, totalPages);
      doc.addPage();
      rowY = margin + 5;
    }

    const energyStr = r.normalizedMevNucl !== null ? formatSigFigs(r.normalizedMevNucl, 4) : "";
    const typedValue = r.rawInput.trim();
    const unit = r.unit ?? "";
    const csdaStr = r.csdaRangeCm !== null ? formatSigFigs(r.csdaRangeCm, 4) : "";
    const stpStr = r.stoppingPower !== null ? formatSigFigs(r.stoppingPower, 4) : "";

    const cellValues = [typedValue, energyStr, unit, stpStr, csdaStr];
    cellX = margin;
    for (let ci = 0; ci < colLabels.length; ci++) {
      const val = ci === 4 && r.csdaRangeCm !== null ? formatCsdarangeWithUnit(r.csdaRangeCm) : cellValues[ci];
      // Check if value needs wrapping (multi-line)
      const lines = wrapText(val, colWidths[ci] - 2, 8);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], cellX + 1, rowY + cellHeight - 1 - (lines.length - 1 - li) * 3.5, { align: "left" });
      }
      cellX += colWidths[ci];
    }
    rowY += cellHeight;
  }

  // Add page footer to the last page
  addPageFooter(doc, margin, pageWidth, totalPages, totalPages);

  // Save PDF
  doc.save(filename);
}

/**
 * Format CSDA range with unit suffix (e.g., "7.718 cm").
 */
function formatCsdarangeWithUnit(value: number): string {
  // Determine the range unit based on the material
  // For water-liquid, results are in cm
  return `${formatSigFigs(value, 4)} cm`;
}

/**
 * Calculate total number of pages needed for a table.
 */
function calcTotalPages(
  rowCount: number,
  maxRowsPerPage: number,
  initialY: number,
  pageHeight: number,
  bottomMargin: number,
): number {
  if (rowCount === 0) return 1;
  const availableHeight = pageHeight - initialY - bottomMargin;
  const rowsPerPage = Math.floor(availableHeight / 4.5);
  if (rowsPerPage <= 0) return rowCount + 1;
  return Math.ceil(rowCount / rowsPerPage);
}

/**
 * Split text into lines that fit within the given width.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // Rough character width estimation: fontSize * 0.4 pixels per char, in mm: fontSize * 0.4 * 0.2646
  const charWidth = fontSize * 0.22;
  const charsPerLine = Math.floor(maxWidth / charWidth);

  if (text.length <= charsPerLine) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line === "" ? word : `${line} ${word}`;
    if (test.length > charsPerLine && line !== "") {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Add page number footer to the current PDF page.
 */
function addPageFooter(doc: JsdocPdf, margin: number, pageWidth: number, page: number, total: number): void {
  const footerY = doc.internal.pageSize.getHeight() - 8;
  const pageNumText = `Page ${page} / ${total}`;
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  doc.text(pageNumText, pageWidth - margin, footerY, { align: "right" });
}
