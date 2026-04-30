import { describe, test, expect, beforeEach, vi } from "vitest";
import type { CalculatedRow } from "$lib/state/calculator.svelte";

// --- Test helpers ---

function makeMockRow(overrides: Partial<CalculatedRow> = {}): CalculatedRow {
  return {
    id: 1,
    rawInput: '100',
    normalizedMevNucl: 100,
    unit: 'MeV' as const,
    unitFromSuffix: false,
    status: 'valid',
    stoppingPower: 5.278,
    csdaRangeCm: 0.02345,
    ...overrides,
  };
}

// --- Tests ---

describe('canExport — initial state', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('canExport is false before initialization', async () => {
    const exportModule = await import('$lib/state/export.svelte');
    expect(exportModule.canExport.value).toBe(false);
  });
});

describe('canExport — after initExportState', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('becomes true when rows are non-empty', async () => {
    const mockRows: CalculatedRow[] = [makeMockRow()];

    const exportModule = await import('$lib/state/export.svelte');
    exportModule.initExportState(
      { rows: mockRows, stpDisplayUnit: 'keV/µm' as const },
      {
        selectedParticle: { name: 'Proton' },
        selectedMaterial: null,
        selectedProgram: { id: 2, name: 'PSTAR', resolvedProgram: null },
      },
    );

    expect(exportModule.canExport.value).toBe(true);
  });

  test('stays false when rows array is empty', async () => {
    const exportModule = await import('$lib/state/export.svelte');

    exportModule.initExportState(
      { rows: [], stpDisplayUnit: 'keV/µm' as const },
      {
        selectedParticle: null,
        selectedMaterial: null,
        selectedProgram: { id: -1, name: 'Auto', resolvedProgram: null },
      },
    );

    expect(exportModule.canExport.value).toBe(false);
  });
});

describe('initExportState — stores data for export functions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('marks canExport as true for a single valid row', async () => {
    const mockRows: CalculatedRow[] = [makeMockRow()];

    const exportModule = await import('$lib/state/export.svelte');
    exportModule.initExportState(
      { rows: mockRows, stpDisplayUnit: 'keV/µm' as const },
      {
        selectedParticle: { name: 'Proton' },
        selectedMaterial: null,
        selectedProgram: { id: -1, name: 'Auto', resolvedProgram: null },
      },
    );

    expect(exportModule.canExport.value).toBe(true);
  });

  test('canExport is false when all rows are invalid', async () => {
    const mockRows: CalculatedRow[] = [
      makeMockRow({ status: 'invalid', normalizedMevNucl: null, rawInput: 'abc' }),
      makeMockRow({ status: 'empty', normalizedMevNucl: null, rawInput: '' }),
    ];

    const exportModule = await import('$lib/state/export.svelte');
    exportModule.initExportState(
      { rows: mockRows, stpDisplayUnit: 'keV/µm' as const },
      {
        selectedParticle: { name: 'Proton' },
        selectedMaterial: null,
        selectedProgram: { id: -1, name: 'Auto', resolvedProgram: null },
      },
    );

    expect(exportModule.canExport.value).toBe(false);
  });

  test('canExport is true even if only one row is valid among invalid ones', async () => {
    const mockRows: CalculatedRow[] = [
      makeMockRow({ status: 'invalid', normalizedMevNucl: null }),
      makeMockRow({ status: 'valid', normalizedMevNucl: 100 }),
      makeMockRow({ status: 'empty', normalizedMevNucl: null }),
    ];

    const exportModule = await import('$lib/state/export.svelte');
    exportModule.initExportState(
      { rows: mockRows, stpDisplayUnit: 'keV/µm' as const },
      {
        selectedParticle: { name: 'Proton' },
        selectedMaterial: null,
        selectedProgram: { id: -1, name: 'Auto', resolvedProgram: null },
      },
    );

    expect(exportModule.canExport.value).toBe(true);
  });
});
