import type { CalculatedRow } from "$lib/state/calculator.svelte";
import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
import { generateCalculatorCsv, downloadCsv } from "$lib/export/csv";

export const canExport = $state({ value: false });

let _calcState: {
  get rows(): CalculatedRow[];
  get stpDisplayUnit(): string;
} | null = null;
let _entitySelection: {
  selectedParticle: ParticleEntity | null;
  selectedMaterial: MaterialEntity | null;
  selectedProgram: { id: number; name: string; resolvedProgram?: ProgramEntity | null };
} | null = null;

export function initExportState(
  calcState: {
    get rows(): CalculatedRow[];
    get stpDisplayUnit(): string;
  },
  entitySelection: {
    selectedParticle: ParticleEntity | null;
    selectedMaterial: MaterialEntity | null;
    selectedProgram: { id: number; name: string; resolvedProgram?: ProgramEntity | null };
  },
): void {
  _calcState = calcState;
  _entitySelection = entitySelection;
  canExport.value = calcState.rows.some((r) => r.status === "valid");
}

export function exportCsv(): void {
  if (!_calcState || !_entitySelection) return;

  const rows = _calcState.rows;
  const stpUnit = _calcState.stpDisplayUnit;
  const particle = _entitySelection.selectedParticle;
  const material = _entitySelection.selectedMaterial;
  const sp = _entitySelection.selectedProgram;

  let program: ProgramEntity | null;
  if (sp.id === -1) {
    program = (sp.resolvedProgram as ProgramEntity | null) || null;
  } else {
    program = { id: sp.id, name: sp.name } as ProgramEntity;
  }

  const { content, filename } = generateCalculatorCsv(rows, stpUnit, {
    particle,
    material,
    program,
  });
  downloadCsv(content, filename);
}

export function exportPdf(): void {
  if (!_calcState || !_entitySelection) return;

  import("$lib/export/pdf").then((mod) => {
    const rows = _calcState!.rows;
    const stpUnit = _calcState!.stpDisplayUnit;
    const particle = _entitySelection!.selectedParticle;
    const material = _entitySelection!.selectedMaterial;
    const sp = _entitySelection!.selectedProgram;

    let program: ProgramEntity | null;
    if (sp.id === -1) {
      program = (sp.resolvedProgram as ProgramEntity | null) || null;
    } else {
      program = { id: sp.id, name: sp.name } as ProgramEntity;
    }

    const filename = mod.buildPdfFilename(particle, material, program);
    mod.generateCalculatorPdf({
      rows,
      stpUnit,
      particle,
      material,
      program,
      filename,
      url: window.location.href,
    });
  });
}
