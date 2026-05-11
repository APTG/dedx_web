import type { CalculatedRow } from "$lib/state/calculator.svelte";
import type { PlotSeries } from "$lib/state/plot.svelte";
import type { AdvancedOptions } from "$lib/wasm/types";
import { formatSigFigs, autoScaleLengthCm } from "$lib/utils/unit-conversions.js";

/**
 * Lightweight identity used for filename construction and entity labels in
 * exports. Only `name` is required.
 */
export interface PdfEntity {
  name: string;
  id?: number | string;
}

/**
 * Advanced mode metadata for Calculator PDF export.
 * Includes particle, material, and program details for the metadata block.
 */
export interface AdvancedPdfMetadata {
  particle: {
    name: string;
    massNumber: number;
    atomicNumber?: number;
  };
  material: {
    name: string;
    density?: number;
    densityUnit?: string;
    phase?: string;
  };
  programs: Array<{
    name: string;
    type: "built-in" | "external";
    url?: string;
  }>;
  advancedOptions?: AdvancedOptions;
  buildInfo?: {
    commit: string;
    date: string;
    branch: string;
  };
}

/**
 * PDF filename for basic-mode Calculator export.
 *
 * Format: dedx_calculator_{particle}_{material}_{program}.pdf
 */
export function buildPdfFilename(
  particle: PdfEntity | null,
  material: PdfEntity | null,
  program: PdfEntity | null,
): string {
  function slug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "_");
  }

  const p = particle ? slug(particle.name) : "unknown_particle";
  const customSuffix =
    material && typeof material.id === "string" && material.id.startsWith("cc_") ? "_custom" : "";
  const m = material ? `${slug(material.name)}${customSuffix}` : "unknown_material";
  const pr = program ? slug(program.name) : "unknown_program";
  return `dedx_calculator_${p}_${m}_${pr}.pdf`;
}

/**
 * Options for PDF generation.
 */
export interface PdfExportContext {
  rows: CalculatedRow[];
  stpUnit: string;
  particle: PdfEntity | null;
  material: PdfEntity | null;
  program: PdfEntity | null;
  filename: string;
  url: string;
  advancedMetadata?: AdvancedPdfMetadata;
}

type JsPdf = import("jspdf").jsPDF;

/**
 * Generate a basic-mode Calculator PDF and download it.
 *
 * Layout (export.md §6.2):
 *   1. Header: app name, generated timestamp (ISO 8601 UTC), clickable URL
 *   2. Entity summary line (particle in material — program)
 *   3. Five-column results table (no error rows): Normalized Energy,
 *      Typed Value, Unit, CSDA Range, Stopping Power ({unit})
 *   4. Page-number footer "Page n / N"
 */
export async function generateCalculatorPdf(ctx: PdfExportContext): Promise<void> {
  const { rows, stpUnit, particle, material, program, filename, url, advancedMetadata } = ctx;

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const validRows = rows.filter(
    (r) => r.status === "valid" && r.stoppingPower !== null && r.csdaRangeCm !== null,
  );

  // Check if we have advanced mode metadata
  const isAdvancedMode = !!advancedMetadata;

  // --- Header block ---
  const headerLeft = margin;
  let y = margin;

  // App name — include "(Advanced Mode)" when advanced metadata is provided
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const appTitle = isAdvancedMode
    ? "dEdx Web — Calculator (Advanced Mode)"
    : "dEdx Web — Calculator";
  doc.text(appTitle, headerLeft, y);
  y += 8;

  // Generated timestamp
  const generatedAt = new Date().toISOString();
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt}`, headerLeft, y);
  y += 5;

  // URL — rendered as a clickable hyperlink
  doc.setTextColor(0, 0, 180);
  doc.textWithLink(url, headerLeft, y, { url });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Entity summary
  const particleName = particle?.name ?? "Unknown particle";
  const materialName = material?.name ?? "Unknown material";
  const programName = program?.name ?? "Unknown program";
  const summary = `${particleName} in ${materialName} \u2014 ${programName}`;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(summary, headerLeft, y);
  y += 8;

  // Horizontal rule
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- Table ---
  // Column order/labels per export.md §2 acceptance checklist.
  const columns: Array<{ label: string; width: number }> = [
    { label: "Normalized Energy (MeV/nucl)", width: 38 },
    { label: "Typed Value", width: 22 },
    { label: "Unit", width: 16 },
    { label: "CSDA Range", width: 32 },
    { label: `Stopping Power (${stpUnit})`, width: 38 },
  ];

  const tableTop = y;
  const cellHeight = 4.5;
  const bottomMargin = 12;

  // Table header row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let cellX = margin;
  for (const col of columns) {
    doc.text(col.label, cellX + 1, tableTop + 3, { align: "left" });
    cellX += col.width;
  }
  doc.line(margin, tableTop + 5, pageWidth - margin, tableTop + 5);
  doc.setFont("helvetica", "normal");

  let rowY = tableTop + 9;
  for (const r of validRows) {
    // Check if we need a new page
    if (rowY + cellHeight > pageHeight - bottomMargin) {
      doc.addPage();
      rowY = margin + 5;
    }

    const energyStr = r.normalizedMevNucl !== null ? formatSigFigs(r.normalizedMevNucl, 4) : "";
    const typedValue = r.rawInput.trim();
    const unit = r.unit ?? "";
    const csdaStr = r.csdaRangeCm !== null ? formatCsdaCellFromCm(r.csdaRangeCm) : "";
    const stpStr = r.stoppingPower !== null ? formatSigFigs(r.stoppingPower, 4) : "";

    const cellValues = [energyStr, typedValue, unit, csdaStr, stpStr];

    cellX = margin;
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      const value = cellValues[ci];
      if (!col || value === undefined) continue;
      const lines = wrapText(value, col.width - 2, 8);
      for (let li = 0; li < lines.length; li++) {
        doc.text(
          lines[li] ?? "",
          cellX + 1,
          rowY + cellHeight - 1 - (lines.length - 1 - li) * 3.5,
          { align: "left" },
        );
      }
      cellX += col.width;
    }
    rowY += cellHeight;
  }

  // Add advanced mode metadata block if in advanced mode (after the table per export.md §6.3)
  if (isAdvancedMode && advancedMetadata) {
    addAdvancedMetadataBlock(doc, advancedMetadata, margin, pageWidth, rowY + 6);
  }

  stampPageFooters(doc, margin, pageWidth);

  // Save PDF
  doc.save(filename);
}

/**
 * Build an HTML table string for advanced mode metadata.
 * Used for generating the metadata block in Calculator PDF export.
 * Returns HTML markup suitable for jsPDF's html() method.
 */
export function buildMetadataTable(metadata: AdvancedPdfMetadata): string {
  const lines: string[] = [];

  // PARTICLE section
  lines.push(`<tr><td style="font-weight:bold;">PARTICLE</td><td></td></tr>`);
  const particleZ =
    metadata.particle.atomicNumber !== undefined ? `Z=${metadata.particle.atomicNumber}` : "";
  const particleA = `A=${metadata.particle.massNumber}`;
  lines.push(
    `<tr><td>${metadata.particle.name}</td><td>${[particleZ, particleA].filter(Boolean).join("  ")}</td></tr>`,
  );
  lines.push(`<tr><td colspan="2" style="height:8px;"></td></tr>`); // spacer

  // MATERIAL section
  lines.push(`<tr><td style="font-weight:bold;">MATERIAL</td><td></td></tr>`);
  const materialPhase = metadata.material.phase ? `(${metadata.material.phase})` : "";
  const materialDensity =
    metadata.material.density !== undefined
      ? `ρ = ${formatSigFigs(metadata.material.density, 4)} ${metadata.material.densityUnit || "g/cm³"}`
      : "";
  lines.push(
    `<tr><td>${metadata.material.name} ${materialPhase}</td><td>${materialDensity}</td></tr>`,
  );
  lines.push(`<tr><td colspan="2" style="height:8px;"></td></tr>`); // spacer

  // PROGRAMS section
  lines.push(`<tr><td style="font-weight:bold;">PROGRAMS</td><td></td></tr>`);
  for (const prog of metadata.programs) {
    const progType =
      prog.type === "external" ? ["(external)", prog.url].filter(Boolean).join(" ") : "(built-in)";
    lines.push(`<tr><td colspan="2">${prog.name} ${progType}</td></tr>`);
  }
  lines.push(`<tr><td colspan="2" style="height:8px;"></td></tr>`); // spacer

  // SETTINGS section (only if advanced options are provided)
  if (metadata.advancedOptions) {
    const opts = metadata.advancedOptions;
    const settings: string[] = [];
    if (opts.interpolation?.method || opts.interpolation?.scale) {
      const parts = [opts.interpolation.method, opts.interpolation.scale].filter(Boolean);
      settings.push(`Interpolation: ${parts.join(" / ")}`);
    }
    if (opts.aggregateState) {
      settings.push(`Aggregate state: ${opts.aggregateState}`);
    }
    if (opts.densityOverride !== undefined) {
      settings.push(`Density override: ${formatSigFigs(opts.densityOverride, 4)} g/cm³`);
    }
    if (opts.iValueOverride !== undefined) {
      settings.push(`I-value override: ${opts.iValueOverride} eV`);
    }
    if (settings.length > 0) {
      lines.push(`<tr><td style="font-weight:bold;">SETTINGS</td><td></td></tr>`);
      lines.push(`<tr><td colspan="2">${settings.join("; ")}</td></tr>`);
      lines.push(`<tr><td colspan="2" style="height:8px;"></td></tr>`); // spacer
    }
  }

  // SYSTEM section (browser info)
  lines.push(`<tr><td style="font-weight:bold;">SYSTEM</td><td></td></tr>`);
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const browserInfo = parseUserAgent(userAgent);
  lines.push(`<tr><td colspan="2">${browserInfo}</td></tr>`);
  lines.push(`<tr><td colspan="2" style="height:8px;"></td></tr>`); // spacer

  // BUILD section (only if build info is available)
  if (metadata.buildInfo) {
    lines.push(`<tr><td style="font-weight:bold;">BUILD</td><td></td></tr>`);
    lines.push(
      `<tr><td colspan="2">${metadata.buildInfo.commit} · ${metadata.buildInfo.date} · ${metadata.buildInfo.branch}</td></tr>`,
    );
  }

  return lines.join("");
}

/**
 * Simple user agent parser to extract browser and OS info.
 */
function parseUserAgent(userAgent: string): string {
  // Extract browser
  let browser = "Unknown Browser";
  if (/\bEdg\//.test(userAgent) || userAgent.includes("Edge")) browser = "Edge";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";

  // Extract OS
  let os = "Unknown OS";
  if (userAgent.includes("Windows")) os = "Windows";
  else if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) os = "iOS";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("Linux")) os = "Linux";

  return `${browser} / ${os}`;
}

/**
 * Add the advanced mode metadata block to the PDF.
 * Appends content after the current page, handling page breaks as needed.
 */
function addAdvancedMetadataBlock(
  doc: import("jspdf").jsPDF,
  metadata: AdvancedPdfMetadata,
  margin: number,
  pageWidth: number,
  startY: number,
): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 12;

  let y = startY;
  if (y + 18 > pageHeight - bottomMargin) {
    doc.addPage();
    y = margin;
  }

  // Section divider
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("── Advanced Mode Details ──", margin, y);
  y += 8;

  // Parse and render the HTML table
  // We'll manually render each row since jsPDF's html() method can be unreliable
  const lines = buildMetadataTable(metadata)
    .split("<tr>")
    .filter((l) => l.trim() !== "");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (const line of lines) {
    // Check if we need a new page
    if (y + 5 > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
    }

    // Extract text from <td> elements using the inner-text capture group.
    // (Avoid `m.replace(/<[^>]*>/g, "")` — CodeQL flags single-pass tag
    // stripping as incomplete sanitization because nested constructs like
    // `<<td>td>` survive one pass.)
    const cellRegex = /<td[^>]*>([^<]*)<\/td>/g;
    const cells: string[] = [];
    for (const m of line.matchAll(cellRegex)) {
      cells.push((m[1] ?? "").trim());
    }
    if (cells.length === 0) continue;

    // Check if this is a header row (bold) or data row
    const isHeader = line.includes('style="font-weight:bold;"');
    if (isHeader) {
      doc.setFont("helvetica", "bold");
      doc.text(cells[0] ?? "", margin, y);
      doc.setFont("helvetica", "normal");
      y += 6;
    } else if (cells.length === 2 && cells[0] === "" && cells[1] === "") {
      // Spacer row
      y += 4;
    } else {
      // Data row - concatenate cells
      const text = cells.join("  ");
      const wrappedLines = wrapText(text, pageWidth - 2 * margin, 9);
      for (const wrappedLine of wrappedLines) {
        if (y + 5 > pageHeight - bottomMargin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrappedLine, margin, y);
        y += 4;
      }
    }
  }
}

/**
 * Format CSDA range with auto-scaled SI unit suffix per export.md §1
 * (e.g. `0.01562 µm`, `7.718 cm`, `116.1 cm`).
 */
function formatCsdaCellFromCm(cm: number): string {
  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}

/**
 * Split text into lines that fit within the given width.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // Rough character-width estimation in mm at the given font size.
  const charWidth = fontSize * 0.22;
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));

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
 * Convert an SVG string to a PNG data URL using a browser canvas.
 * This avoids html2canvas and its inability to parse oklch() colors.
 * Returns null if the canvas context is unavailable (e.g. in unit tests).
 *
 * widthMm / heightMm are the intended PDF dimensions in mm; we render at
 * 150 DPI (≈5.91 px/mm) for good print quality.
 */
export async function svgToPng(
  svgString: string,
  widthMm: number,
  heightMm: number,
): Promise<string | null> {
  const PX_PER_MM = 150 / 25.4;
  const widthPx = Math.round(widthMm * PX_PER_MM);
  const heightPx = Math.round(heightMm * PX_PER_MM);

  return new Promise<string | null>((resolve) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Add page number footer to the current PDF page.
 */
function addPageFooter(
  doc: JsPdf,
  margin: number,
  pageWidth: number,
  page: number,
  total: number,
): void {
  const footerY = doc.internal.pageSize.getHeight() - 8;
  const pageNumText = `Page ${page} / ${total}`;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(pageNumText, pageWidth - margin, footerY, { align: "right" });
}

function stampPageFooters(doc: JsPdf, margin: number, pageWidth: number): void {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addPageFooter(doc, margin, pageWidth, page, totalPages);
  }
}

/**
 * Options for Plot PDF generation.
 */
export interface PlotPdfContext {
  svgString: string | null;
  series: PlotSeries[];
  url: string;
  filename: string;
}

/**
 * Generate a basic-mode Plot PDF and download it.
 *
 * Layout (export.md §5.2):
 *   1. Header: app name, generated timestamp (ISO 8601 UTC), clickable URL
 *   2. Chart SVG embedded at full page width
 *   3. Legend: one row per committed visible series — colour swatch + label
 *   4. Page-number footer "Page n / N"
 */
export async function generatePlotPdf(ctx: PlotPdfContext): Promise<void> {
  const { svgString, series, url, filename } = ctx;

  const { default: jsPDF } = await import("jspdf");
  // Use landscape orientation for wider canvas to accommodate the plot
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const visibleSeries = series.filter((s) => s.visible);

  // --- Header block ---
  const headerLeft = margin;
  let y = margin;

  // App name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("dEdx Web", headerLeft, y);
  y += 8;

  // Generated timestamp (ISO 8601 UTC)
  const generatedAt = new Date().toISOString();
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt}`, headerLeft, y);
  y += 5;

  // URL — rendered as a clickable hyperlink
  doc.setTextColor(0, 0, 180);
  doc.textWithLink(url, headerLeft, y, { url });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // Horizontal rule
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // --- Chart SVG ---
  // Only embed if we have SVG content.
  // We convert SVG → PNG via a canvas element rather than using doc.html(),
  // because doc.html() delegates to html2canvas which cannot parse oklch()
  // colors emitted by Tailwind CSS v4 (throws "unsupported color function").
  if (svgString) {
    const chartWidth = pageWidth - 2 * margin;
    const chartHeight = pageHeight * 0.5;

    const pngDataUrl = await svgToPng(svgString, chartWidth, chartHeight);
    if (pngDataUrl) {
      doc.addImage(pngDataUrl, "PNG", margin, y, chartWidth, chartHeight);
    }
    y += chartHeight + 5;
  }

  // --- Legend section ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Legend", headerLeft, y);
  y += 6;

  const legendRowHeight = 5;
  const swatchSize = 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const bottomMargin = 12;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - y - bottomMargin) / legendRowHeight));
  const totalPages = Math.max(1, Math.ceil(visibleSeries.length / rowsPerPage));

  let currentPage = 1;

  for (const s of visibleSeries) {
    // Check if we need a new page
    if (y + legendRowHeight > pageHeight - bottomMargin) {
      addPageFooter(doc, margin, pageWidth, currentPage, totalPages);
      doc.addPage();
      currentPage += 1;
      y = margin + 5;

      // Re-write legend header on new page
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Legend (continued)", headerLeft, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
    }

    // Draw colour swatch (small filled rectangle)
    doc.setFillColor(s.color);
    doc.rect(headerLeft, y - 3, swatchSize, swatchSize, "F");

    // Draw series label next to swatch
    doc.text(s.label, headerLeft + swatchSize + 2, y);
    y += legendRowHeight;
  }

  // Footer on the last (or only) page
  addPageFooter(doc, margin, pageWidth, currentPage, totalPages);

  // Save PDF
  doc.save(filename);
}
