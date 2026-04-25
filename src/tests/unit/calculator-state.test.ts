import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibdedxServiceImpl } from '$lib/wasm/__mocks__/libdedx';
import { buildCompatibilityMatrix } from '$lib/state/compatibility-matrix';
import { createEntitySelectionState } from '$lib/state/entity-selection.svelte';
import { createCalculatorState, formatStpValue, formatRangeValue } from '$lib/state/calculator.svelte';

describe('CalculatorState', () => {
  let service: LibdedxServiceImpl;
  let entitySelection: ReturnType<typeof createEntitySelectionState>;
  let calcState: ReturnType<typeof createCalculatorState>;

  beforeEach(() => {
    service = new LibdedxServiceImpl();
    const matrix = buildCompatibilityMatrix(service);
    entitySelection = createEntitySelectionState(matrix);
    calcState = createCalculatorState(entitySelection, service);
  });

  it('initializes with one pre-filled row and correct stpDisplayUnit for water', () => {
    expect(calcState.rows).toHaveLength(1);
    expect(calcState.rows[0].rawInput).toBe('100');
    expect(calcState.stpDisplayUnit).toBe('keV/µm');
  });

  it('has null results before calculation is triggered', () => {
    expect(calcState.rows[0].stoppingPower).toBeNull();
    expect(calcState.rows[0].csdaRangeCm).toBeNull();
  });

  it('calculates results after triggering', async () => {
    expect(entitySelection.isComplete).toBe(true);
    await calcState.triggerCalculation();

    expect(calcState.rows[0].stoppingPower).not.toBeNull();
    expect(calcState.rows[0].csdaRangeCm).not.toBeNull();
  });

  it('handles invalid input with appropriate status', () => {
    calcState.updateRowText(0, 'abc');
    expect(calcState.rows[0].status).toBe('invalid');
    expect(calcState.rows[0].normalizedMevNucl).toBeNull();
  });

  it('excludes invalid rows from calculation', async () => {
    calcState.updateRowText(0, 'abc');
    calcState.handleBlur(0);  // Creates new row
    calcState.updateRowText(1, '200');

    await calcState.triggerCalculation();

    expect(calcState.rows[0].stoppingPower).toBeNull();
    expect(calcState.rows[1].stoppingPower).not.toBeNull();
  });

  it('switches stpDisplayUnit to MeV·cm²/g for gas material (air)', () => {
    const airMaterial = entitySelection.availableMaterials.find(m => m.name === 'Air');
    expect(airMaterial).toBeDefined();
    entitySelection.selectMaterial(airMaterial!.id);
    expect(calcState.stpDisplayUnit).toBe('MeV·cm²/g');
  });

  it('handles empty rows correctly', () => {
    calcState.updateRowText(0, '');
    expect(calcState.rows[0].status).toBe('empty');
    expect(calcState.rows[0].normalizedMevNucl).toBeNull();
    expect(calcState.rows[0].stoppingPower).toBeNull();
  });

  it('clears results when entity selection is incomplete', async () => {
    calcState.updateRowText(0, '100');
    await calcState.triggerCalculation();

    expect(calcState.rows[0].stoppingPower).not.toBeNull();

    calcState.clearResults();
    entitySelection.clearParticle();

    expect(calcState.rows[0].stoppingPower).toBeNull();
  });

  it('handles multiple rows with different values', async () => {
    // Initial state has 1 row with "100"
    calcState.updateRowText(0, '100');  // Update first row
    calcState.handleBlur(0);  // Triggers adding new row

    calcState.updateRowText(1, '200');  // Update second row
    calcState.handleBlur(1);  // Triggers adding new row

    calcState.updateRowText(2, '300');  // Update third row
    // Last row is the always-empty-row

    await calcState.triggerCalculation();

    // Should now have 4 rows (3 with values + 1 empty always-empty-row)
    expect(calcState.rows).toHaveLength(4);
    expect(calcState.rows[0].stoppingPower).not.toBeNull();
    expect(calcState.rows[1].stoppingPower).not.toBeNull();
    expect(calcState.rows[2].stoppingPower).not.toBeNull();
    expect(calcState.rows[3].rawInput).toBe('');
  });

  it('maintains always-empty-row pattern', () => {
    // Initial state has one row with "100", no empty row yet
    expect(calcState.rows).toHaveLength(1);
    expect(calcState.rows[0].rawInput).toBe('100');
    
    // Typing in the last row creates a new empty row
    calcState.updateRowText(0, '50');
    
    expect(calcState.rows[calcState.rows.length - 1].rawInput).toBe('');
    expect(calcState.rows).toHaveLength(2);
  });

  it('updates validation summary correctly', () => {
    // Initial: 1 valid row with "100" 
    expect(calcState.validationSummary.total).toBe(1);
    expect(calcState.validationSummary.valid).toBe(1);
    
    // Make the first row invalid - this also triggers adding a new row
    calcState.updateRowText(0, 'abc');
    
    // Now we have 2 rows: 1 invalid ("abc") + 1 empty
    expect(calcState.validationSummary.total).toBe(2);
    expect(calcState.validationSummary.invalid).toBe(1);
    expect(calcState.validationSummary.valid).toBe(0);
  });

  it('isCalculating is set during calculation', async () => {
    expect(calcState.isCalculating).toBe(false);

    vi.spyOn(service, 'calculate').mockImplementation((...args) => {
      void args;
      expect(calcState.isCalculating).toBe(true);
      return { energies: [100], stoppingPowers: [1.0], csdaRanges: [0.1] };
    });

    await calcState.triggerCalculation();

    vi.restoreAllMocks();
  });

  it('handles MeV/nucl unit for heavy ions', async () => {
    const carbon = entitySelection.availableParticles.find(p => p.name === 'Carbon');
    expect(carbon).toBeDefined();
    entitySelection.selectParticle(carbon!.id);
    expect(calcState.masterUnit).toBe('MeV');

    calcState.updateRowText(0, '120');
    await calcState.triggerCalculation();

    expect(calcState.rows[0].normalizedMevNucl).not.toBeNull();
  });

  it('clears results when explicitly requested', async () => {
    calcState.updateRowText(0, '100');
    await calcState.triggerCalculation();

    expect(calcState.rows[0].stoppingPower).not.toBeNull();

    calcState.clearResults();

    expect(calcState.rows[0].stoppingPower).toBeNull();
  });

  it('handles out-of-range energy values', () => {
    calcState.updateRowText(0, '0');
    expect(calcState.rows[0].status).toBe('invalid');
  });

  it('logs warning for subnormal WASM stopping power values', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    vi.spyOn(service, 'calculate').mockImplementation(() => ({
      energies: [100],
      stoppingPowers: [1e-320],
      csdaRanges: [0.1],
    }));

    await calcState.triggerCalculation();

    expect(warnSpy).toHaveBeenCalledWith(
      '[dedx] subnormal/invalid WASM output (stopping power)',
      expect.objectContaining({
        programId: expect.any(Number),
        particleId: expect.any(Number),
        materialId: expect.any(Number),
        energyMevNucl: 100,
        rawValue: 1e-320,
      }),
    );

    warnSpy.mockRestore();
  });

  it('logs warning for subnormal WASM CSDA range values', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    vi.spyOn(service, 'calculate').mockImplementation(() => ({
      energies: [100],
      stoppingPowers: [1.0],
      csdaRanges: [1e-320],
    }));

    await calcState.triggerCalculation();

    expect(warnSpy).toHaveBeenCalledWith(
      '[dedx] subnormal/invalid WASM output (CSDA range)',
      expect.objectContaining({
        programId: expect.any(Number),
        particleId: expect.any(Number),
        materialId: expect.any(Number),
        energyMevNucl: 100,
        rawValue: 1e-320,
      }),
    );

    warnSpy.mockRestore();
  });

  it('logs warning for NaN WASM values', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    vi.spyOn(service, 'calculate').mockImplementation(() => ({
      energies: [100],
      stoppingPowers: [NaN],
      csdaRanges: [0.1],
    }));

    await calcState.triggerCalculation();

    expect(warnSpy).toHaveBeenCalledWith(
      '[dedx] subnormal/invalid WASM output (stopping power)',
      expect.objectContaining({
        rawValue: NaN,
      }),
    );

    warnSpy.mockRestore();
  });

  it('stores results by row ID to avoid float key collisions', async () => {
    const rowId1 = calcState.rows[0].id;
    
    await calcState.triggerCalculation();
    
    expect(calcState.rows[0].stoppingPower).not.toBeNull();
    
    calcState.updateRowText(0, '200');
    await calcState.triggerCalculation();
    
    const newRowId = calcState.rows[0].id;
    expect(newRowId).toBe(rowId1);
    expect(calcState.rows[0].stoppingPower).not.toBeNull();
  });
});

describe('formatStpValue', () => {
  it('formats stopping power to 4 significant figures', () => {
    expect(formatStpValue(45.7623, 'keV/µm')).toBe('45.76');
    expect(formatStpValue(0.003, 'MeV·cm²/g')).toBe('0.003');
  });
});

describe('formatRangeValue', () => {
  it('formats CSDA range with auto-scaled units', () => {
    expect(formatRangeValue(0.2)).toContain('mm');
    expect(formatRangeValue(250)).toContain('m');
    expect(formatRangeValue(0.00012)).toContain('µm');
  });

  it('returns empty string for null input', () => {
    expect(formatRangeValue(null)).toBe('');
  });
});
