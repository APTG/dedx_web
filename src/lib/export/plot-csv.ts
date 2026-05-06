import type { PlotSeries } from "$lib/state/plot.svelte";
import type { StpUnit } from "$lib/wasm/types";
import { convertStpForDisplay } from "$lib/utils/plot-utils";
import { makeCsvCell } from "$lib/export/csv";

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
 * Determine if all visible series share the same energy-point count AND
 * none has a programName starting with "ext:".
 *
 * Returns true for Case A (single shared Energy column), false for Case B
 * (each series gets its own Energy column).
 */
function isSharedEnergyGrid(series: PlotSeries[]): boolean {
  if (series.length === 0) return true;
  if (series.length === 1) return true;

  const firstCount = series[0]!.result.energies.length;
  for (const s of series) {
    // Case B if any series has ext: prefix
    if (s.programName.startsWith("ext:")) {
      return false;
    }
    // Case B if any series has different point count
    if (s.result.energies.length !== firstCount) {
      return false;
    }
  }
  return true;
}

/**
 * Format numeric values to 4 significant figures.
 */
function formatValue(value: number): string {
  // Use the same approach as unit-conversions.formatSigFigs
  if (!isFinite(value)) {
    return "";
  }
  const abs = Math.abs(value);
  if (abs === 0 || (abs >= 0.001 && abs < 10000)) {
    // Standard formatting with 4 sig figs
    const str = value.toPrecision(4);
    // Remove trailing zeros after decimal point
    return str.replace(/\.?0+$/, "") || "0";
  } else {
    // Scientific notation for very large/small numbers
    return value.toExponential(3);
  }
}

/**
 * Format Plot series data as CSV string per export.md §4.2/§4.3.
 *
 * - UTF-8 with BOM
 * - CRLF line endings
 * - Case A: single shared Energy column if all series have same point count AND no ext: prefix
 * - Case B: each series gets its own Energy column before its Stp column
 * - Hidden series (visible === false) are excluded
 * - Shorter series in Case B are padded with empty cells
 */
export function formatPlotCsv(series: PlotSeries[], stpUnit: StpUnit): string {
  // Filter out hidden series
  const visibleSeries = series.filter((s) => s.visible);

  if (visibleSeries.length === 0) {
    // Return just BOM if no visible series
    return "\uFEFF";
  }

  const caseA = isSharedEnergyGrid(visibleSeries);

  // Build header
  const headerCells: string[] = [];
  if (caseA) {
    headerCells.push(makeCsvCell(`Energy [MeV/nucl]`));
  }

  for (const s of visibleSeries) {
    if (!caseA) {
      // Case B: each series gets its own Energy column
      const energyHeader = `Energy ${s.programName} [MeV/nucl]`;
      headerCells.push(makeCsvCell(sanitizeCsvCell(energyHeader)));
    }
    const stpHeader = `Stp ${s.programName} — ${s.particleName} in ${s.materialName} (${stpUnit})`;
    headerCells.push(makeCsvCell(sanitizeCsvCell(stpHeader)));
  }

  // Build data rows
  const maxRows = Math.max(...visibleSeries.map((s) => s.result.energies.length));
  // Pre-convert stopping powers to the requested display unit for each series.
  // Done once per series here rather than inside the inner loop to avoid
  // redundant calls to convertStpForDisplay on every row.
  const displayValues = visibleSeries.map((s) =>
    convertStpForDisplay(s.result.stoppingPowers, s.density, stpUnit),
  );
  const rows: string[] = [];

  for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
    const rowCells: string[] = [];

    if (caseA) {
      // Case A: single shared Energy column (from first series)
      const firstSeries = visibleSeries[0]!;
      if (rowIdx < firstSeries.result.energies.length) {
        rowCells.push(formatValue(firstSeries.result.energies[rowIdx] ?? 0));
      } else {
        rowCells.push("");
      }
    }

    // Add columns for each series
    for (let si = 0; si < visibleSeries.length; si++) {
      const s = visibleSeries[si]!;
      const energyCount = s.result.energies.length;

      if (!caseA) {
        // Case B: each series gets its own Energy column
        if (rowIdx < energyCount) {
          rowCells.push(formatValue(s.result.energies[rowIdx] ?? 0));
        } else {
          rowCells.push("");
        }
      }

      // Stp column for this series (in the requested display unit)
      if (rowIdx < energyCount) {
        const stpVal = displayValues[si]?.[rowIdx] ?? 0;
        rowCells.push(formatValue(stpVal));
      } else {
        rowCells.push("");
      }
    }

    rows.push(rowCells.join(","));
  }

  // Build final CSV content (no BOM - added by downloadCsv())
  const content = [headerCells.join(","), ...rows].join("\r\n");
  return content;
}

/**
 * Trigger a browser file download for the Plot CSV data.
 *
 * Filename: dedx_plot_data.csv (per export.md §4.2)
 */
export function downloadPlotCsv(series: PlotSeries[], stpUnit: StpUnit): void {
  // Import here to avoid circular dependency issues
  void import("$lib/export/csv").then(({ downloadCsv }) => {
    const content = formatPlotCsv(series, stpUnit);
    downloadCsv(content, "dedx_plot_data.csv");
  });
}
