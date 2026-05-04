import type { CalculatedRow } from "$lib/state/calculator.svelte";
import type { PlotSeries } from "$lib/state/plot.svelte";
import { generateCalculatorCsv, downloadCsv } from "$lib/export/csv";

interface CalcStateView {
  readonly rows: CalculatedRow[];
  readonly stpDisplayUnit: string;
}

interface PlotStateView {
  readonly series: PlotSeries[];
}

interface ExportEntity {
  name: string;
}

interface EntitySelectionView {
  selectedParticle: ExportEntity | null;
  selectedMaterial: ExportEntity | null;
  selectedProgram: { id: number; name: string; resolvedProgram?: ExportEntity | null };
}

export const canExport = $state({ value: false });

let _calcState: CalcStateView | null = null;
let _entitySelection: EntitySelectionView | null = null;
let _plotState: PlotStateView | null = null;
let _getSvg: (() => string | null) | null = null;

/**
 * A row only counts as "exportable" once the WASM results are populated —
 * `status === "valid"` flips to true on input parse, but `stoppingPower` /
 * `csdaRangeCm` arrive asynchronously after debounced calculation.
 */
function rowHasResults(row: CalculatedRow): boolean {
  return row.status === "valid" && row.stoppingPower !== null && row.csdaRangeCm !== null;
}

export function initExportState(
  calcState: CalcStateView,
  entitySelection: EntitySelectionView,
): void {
  _calcState = calcState;
  _entitySelection = entitySelection;
  canExport.value = calcState.rows.some(rowHasResults);
}

/**
 * Initialize plot export state. Sets canExport.value to true when at least one
 * committed series is visible (per export.md §4.2 button-state rules).
 */
export function initPlotExportState(plotState: PlotStateView, getSvg: () => string | null): void {
  _plotState = plotState;
  _getSvg = getSvg;
  canExport.value = plotState.series.some((s) => s.visible);
}

/**
 * Return the entity used as `program` in export filenames/labels. For the
 * Auto-select pseudo-entry (id === -1) prefer the resolved program name
 * when available; otherwise fall back to the literal "Auto-select" label
 * so filenames carry meaningful provenance instead of `unknown_program`.
 */
function selectedProgramEntity(sp: EntitySelectionView["selectedProgram"]): ExportEntity | null {
  if (sp.id === -1) {
    return sp.resolvedProgram ?? { name: "Auto-select" };
  }
  return { name: sp.name };
}

export function exportCsv(): void {
  if (!_calcState || !_entitySelection) return;

  const rows = _calcState.rows;
  const stpUnit = _calcState.stpDisplayUnit;
  const particle = _entitySelection.selectedParticle;
  const material = _entitySelection.selectedMaterial;
  const program = selectedProgramEntity(_entitySelection.selectedProgram);

  try {
    const { content, filename } = generateCalculatorCsv(rows, stpUnit, {
      particle,
      material,
      program,
    });
    downloadCsv(content, filename);
  } catch (error) {
    console.error("Failed to export CSV.", error);
  }
}

export function exportPdf(): void {
  if (!_calcState || !_entitySelection) return;
  const calc = _calcState;
  const sel = _entitySelection;

  void import("$lib/export/pdf")
    .then((mod) => {
      const rows = calc.rows;
      const stpUnit = calc.stpDisplayUnit;
      const particle = sel.selectedParticle;
      const material = sel.selectedMaterial;
      const program = selectedProgramEntity(sel.selectedProgram);

      const filename = mod.buildPdfFilename(particle, material, program);
      return mod.generateCalculatorPdf({
        rows,
        stpUnit,
        particle,
        material,
        program,
        filename,
        url: window.location.href,
      });
    })
    .catch((error: unknown) => {
      console.error("Failed to export PDF.", error);
    });
}

/**
 * Export plot data as CSV (export.md §4.2).
 * Uses the last-known plot state from initPlotExportState.
 */
export function exportPlotCsv(): void {
  if (!_plotState) return;

  const series = _plotState.series;
  void import("$lib/export/plot-csv")
    .then((mod) => {
      mod.downloadPlotCsv(series, "keV/µm");
    })
    .catch((error: unknown) => {
      console.error("Failed to export plot CSV.", error);
    });
}

/**
 * Export plot as PDF report (export.md §5).
 * Uses the last-known SVG getter from initPlotExportState.
 */
export function exportPlotPdf(): void {
  if (!_plotState || !_getSvg) return;

  const svgString = _getSvg();
  if (!svgString) {
    console.warn("No SVG content available for PDF export.");
    return;
  }

  const series = _plotState.series;
  void import("$lib/export/pdf")
    .then((mod) => {
      const filename = "dedx_plot_report.pdf";
      return mod.generatePlotPdf({
        svgString,
        series,
        url: window.location.href,
        filename,
      });
    })
    .catch((error: unknown) => {
      console.error("Failed to export plot PDF.", error);
    });
}
