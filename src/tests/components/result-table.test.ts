import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { LibdedxServiceImpl } from '$lib/wasm/__mocks__/libdedx';
import { buildCompatibilityMatrix } from '$lib/state/compatibility-matrix';
import { createEntitySelectionState } from '$lib/state/entity-selection.svelte';
import { createCalculatorState } from '$lib/state/calculator.svelte';
import ResultTable from '$lib/components/result-table.svelte';
import type { CalculatorState } from '$lib/state/calculator.svelte';
import type { EntitySelectionState } from '$lib/state/entity-selection.svelte';

describe('ResultTable', () => {
  let service: LibdedxServiceImpl;
  let entitySelection: EntitySelectionState;
  let calcState: CalculatorState;

  beforeEach(() => {
    cleanup();
    service = new LibdedxServiceImpl();
    const matrix = buildCompatibilityMatrix(service);
    entitySelection = createEntitySelectionState(matrix);
    calcState = createCalculatorState(entitySelection, service);
  });

  it('renders 5 column headers including the master unit in col-1 header', () => {
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    expect(screen.getByText(/Energy \(MeV\)/)).toBeInTheDocument();
    expect(screen.getByText(/→ MeV\/nucl/)).toBeInTheDocument();
    expect(screen.getByText(/Unit/)).toBeInTheDocument();
    expect(screen.getByText(/Stopping Power/)).toBeInTheDocument();
    expect(screen.getByText(/CSDA Range/)).toBeInTheDocument();
  });

  it('shows "Select a particle and material to calculate" when entity selection is incomplete', () => {
    entitySelection.clearParticle();
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    expect(screen.getByText(/Select a particle and material to calculate/)).toBeInTheDocument();
  });

  it('displays calculated results with proper formatting', async () => {
    calcState.updateRowText(0, '100');
    await calcState.triggerCalculation();
    calcState.flushCalculation();
    
    // Force a tick for reactivity
    await Promise.resolve();
    
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    // Mock returns Math.log(100 + 1) ≈ 4.615, converted to keV/µm with density 1.0 = 0.4615
    expect(screen.getAllByText(/0\.4615/)[0]).toBeInTheDocument();
  });

  it('shows CSDA range with auto-scaled units', async () => {
    const freshCalcState = createCalculatorState(entitySelection, service);
    freshCalcState.updateRowText(0, '100');
    await freshCalcState.triggerCalculation();
    freshCalcState.flushCalculation();
    
    await Promise.resolve();
    
    render(ResultTable, { props: { state: freshCalcState, entitySelection } });
    
    // Mock returns Math.pow(100, 1.5) = 1000, converted to cm = 1000 / 1.0 = 1000 cm = 10 m
    const ranges = screen.getAllByText(/10\s*m/);
    expect(ranges[0]).toBeInTheDocument();
  });

  it('shows red styling on input when row is invalid', () => {
    calcState.updateRowText(0, 'abc');
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    const input = screen.getByDisplayValue('abc');
    expect(input).toHaveClass('border-red-500');
  });

  it('shows select dropdown in Unit column in per-row mode', async () => {
    // Select a heavy ion to enable per-row mode with MeV/nucl option
    const carbon = entitySelection.availableParticles.find(p => p.name === 'Carbon');
    expect(carbon).toBeDefined();
    entitySelection.selectParticle(carbon!.id);

    // Force per-row mode by typing a unit suffix
    calcState.updateRowText(0, '100 MeV/nucl');

    render(ResultTable, { props: { state: calcState, entitySelection } });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows plain text in Unit column in master mode', () => {
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    // Should NOT have a select dropdown in master mode for proton
    // Use the first table found since we're testing the first rendered component
    const firstTable = screen.getAllByRole('table')[0];
    const comboboxesInFirstTable = firstTable.querySelectorAll('select');
    expect(comboboxesInFirstTable).toHaveLength(0);
  });

  it('displays validation summary when there are invalid rows', () => {
    const freshCalcState = createCalculatorState(entitySelection, service);
    freshCalcState.updateRowText(0, 'abc');
    freshCalcState.handleBlur(0);

    render(ResultTable, { props: { state: freshCalcState, entitySelection } });

    const summary = screen.getAllByText(/excluded/)[0];
    expect(summary).toBeInTheDocument();
  });

  it('changes the row unit when the per-row select dropdown changes', async () => {
    // Heavy ion to enable the per-row select
    const carbon = entitySelection.availableParticles.find((p) => p.name === 'Carbon');
    expect(carbon).toBeDefined();
    entitySelection.selectParticle(carbon!.id);

    calcState.updateRowText(0, '120 MeV');

    render(ResultTable, { props: { state: calcState, entitySelection } });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'MeV/nucl' } });

    // The row text should now be rewritten with converted value (KE conserved).
    // 120 MeV total / 12 nucleons = 10 MeV/nucl.
    expect(calcState.rows[0].rawInput).toBe('10 MeV/nucl');
    expect(calcState.rows[0].unitFromSuffix).toBe(true);
  });

  it('shows the count of invalid + out-of-range rows in the validation summary', () => {
    const fresh = createCalculatorState(entitySelection, service);
    fresh.updateRowText(0, 'abc');           // invalid
    fresh.handleBlur(0);                     // adds empty row
    fresh.updateRowText(1, '0');             // out of range
    fresh.handleBlur(1);

    render(ResultTable, { props: { state: fresh, entitySelection } });

    const summary = screen.getAllByText(/excluded/)[0];
    expect(summary).toBeInTheDocument();
    expect(summary.textContent).toMatch(/invalid/);
  });

  it('renders custom columns when columns prop is provided', async () => {
    const customColumns = [
      {
        id: "energy",
        header: (s: typeof calcState) => `Energy (${s.masterUnit})`,
        getValue: (row: any) => row.rawInput,
        align: "left" as const,
      },
      {
        id: "stopping-power",
        header: (s: typeof calcState) => `Stopping Power (${s.stpDisplayUnit})`,
        getValue: (row: any, s: typeof calcState) => {
          if (s.isCalculating) return "—";
          if (row.stoppingPower !== null) return row.stoppingPower.toFixed(2);
          return "-";
        },
        align: "right" as const,
      },
    ];

    calcState.updateRowText(0, '100');
    await calcState.triggerCalculation();
    calcState.flushCalculation();
    await Promise.resolve();

    render(ResultTable, { props: { state: calcState, entitySelection, columns: customColumns } });

    expect(screen.getByText(/Energy \(MeV\)/)).toBeInTheDocument();
    expect(screen.getByText(/Stopping Power \(keV\/µm\)/)).toBeInTheDocument();
    expect(screen.queryByText(/→ MeV\/nucl/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CSDA Range/)).not.toBeInTheDocument();
  });
});
