import type { CalculatedRow } from "$lib/state/calculator.svelte";
import { generateCalculatorCsv, downloadCsv } from "$lib/export/csv";

interface CalcStateView {
  readonly rows: CalculatedRow[];
  readonly stpDisplayUnit: string;
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
