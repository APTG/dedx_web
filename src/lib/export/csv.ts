import type { CalculatedRow } from "$lib/state/calculator.svelte";
import { formatSigFigs, autoScaleLengthCm } from "$lib/utils/unit-conversions";

/**
 * CSV injection prevention: values starting with =, +, -, @ are prefixed
 * with a single quote to stop spreadsheet apps from executing them.
 */
function sanitizeCsvCell(value: string): string {
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${value}`;
  }
  return value;
}

/**
 * RFC 4180 quoting: only wrap in double quotes when the value contains
 * `"`, `,`, CR, or LF; escape inner quotes by doubling them.
 */
function makeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\r") || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * Lightweight identity used for filename construction and entity labels in
 * exports. Only `name` is required — the richer entity types are not needed
 * here and would force unsafe casts on callers.
 */
export interface CsvExportMeta {
  particle: { name: string } | null;
  material: { name: string } | null;
  program: { name: string } | null;
}

/**
 * Format CSDA range (input in cm) with auto-scaled SI unit suffix per
 * `export.md` §1/§2 (e.g. `0.01562 µm`, `7.718 cm`).
 */
function formatCsdaCellFromCm(cm: number): string {
  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}

/**
 * Generate a 5-column Calculator CSV per export.md §2.
 *
 * Columns: Normalized Energy (MeV/nucl), Typed Value, Unit, CSDA Range,
 * Stopping Power ({active unit})
 */
export function generateCalculatorCsv(
  rows: CalculatedRow[],
  stpUnit: string,
  meta: CsvExportMeta,
): { content: string; filename: string } {
  const header = [
    makeCsvCell("Normalized Energy (MeV/nucl)"),
    makeCsvCell("Typed Value"),
    makeCsvCell("Unit"),
    makeCsvCell("CSDA Range"),
    makeCsvCell(`Stopping Power (${stpUnit})`),
  ].join(",");

  const lines: string[] = [header];

  for (const row of rows) {
    if (row.status !== "valid") continue;
    if (row.stoppingPower === null || row.csdaRangeCm === null) continue;

    const energyStr = row.normalizedMevNucl !== null ? formatSigFigs(row.normalizedMevNucl, 4) : "";
    const typedValue = row.rawInput.trim();
    const unit = row.unit ?? "";
    const csdaStr = formatCsdaCellFromCm(row.csdaRangeCm);
    const stpStr = formatSigFigs(row.stoppingPower, 4);

    lines.push(
      [
        makeCsvCell(sanitizeCsvCell(energyStr)),
        makeCsvCell(sanitizeCsvCell(typedValue)),
        makeCsvCell(sanitizeCsvCell(unit)),
        makeCsvCell(sanitizeCsvCell(csdaStr)),
        makeCsvCell(sanitizeCsvCell(stpStr)),
      ].join(","),
    );
  }

  const filename = buildCsvFilename(meta.particle, meta.material, meta.program);

  return { content: lines.join("\r\n"), filename };
}

/**
 * Build filename per export.md: dedx_calculator_{particle}_{material}_{program}.csv
 */
function buildCsvFilename(
  particle: { name: string } | null,
  material: { name: string } | null,
  program: { name: string } | null,
): string {
  function slug(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "_");
  }

  const p = particle ? slug(particle.name) : "unknown_particle";
  const m = material ? slug(material.name) : "unknown_material";
  const pr = program ? slug(program.name) : "unknown_program";

  return `dedx_calculator_${p}_${m}_${pr}.csv`;
}

/**
 * Generate a CSV string from raw arrays (legacy API for backward compat).
 * Kept for any existing callers that still use this shape.
 */
export function generateLegacyCsv(
  energies: number[],
  stoppingPowers: number[],
  csdaRanges: number[],
  options?: {
    includeHeader?: boolean;
    includeMetadata?: boolean;
    program?: string;
    particle?: string;
    material?: string;
    csdaUnitSuffix?: string;
  },
): string {
  const lines: string[] = [];

  if (options?.includeMetadata && options.program) {
    lines.push(makeCsvCell(`# Program: ${options.program}`));
    lines.push(makeCsvCell(`# Particle: ${options.particle || "N/A"}`));
    lines.push(makeCsvCell(`# Material: ${options.material || "N/A"}`));
    lines.push(makeCsvCell(`# Generated: ${new Date().toISOString()}`));
    lines.push("");
  }

  const csdaUnitSuffix = options?.csdaUnitSuffix ?? "g/cm²";

  if (options?.includeHeader !== false) {
    lines.push(
      [
        makeCsvCell("Energy (MeV/nucl)"),
        makeCsvCell("Stopping Power (MeV·cm²/g)"),
        makeCsvCell("CSDA Range"),
      ].join(","),
    );
  }

  for (let i = 0; i < energies.length; i++) {
    const e = energies[i];
    const s = stoppingPowers[i];
    const r = csdaRanges[i];
    if (e !== undefined && s !== undefined && r !== undefined) {
      lines.push(
        [
          makeCsvCell(formatSigFigs(e)),
          makeCsvCell(formatSigFigs(s)),
          makeCsvCell(`${formatSigFigs(r)} ${csdaUnitSuffix}`),
        ].join(","),
      );
    }
  }

  return lines.join("\r\n");
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
