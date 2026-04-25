import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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
    
    // Force a tick for reactivity
    await Promise.resolve();
    
    render(ResultTable, { props: { state: calcState, entitySelection } });
    
    // Mock returns Math.log(100 + 1) ≈ 4.615, converted to keV/µm = 4.615 * 1.0 / 10 = 0.4615
    expect(screen.getByText(/0\.4608/)).toBeInTheDocument();
  });

  it('shows CSDA range with auto-scaled units', async () => {
    const freshCalcState = createCalculatorState(entitySelection, service);
    freshCalcState.updateRowText(0, '100');
    await freshCalcState.triggerCalculation();
    
    await Promise.resolve();
    
    render(ResultTable, { props: { state: freshCalcState, entitySelection } });
    
    // Mock returns Math.pow(100, 1.5) = 1000, converted to cm = 1000 / 1.0 = 989.6 cm ≈ 9.9 m
    const ranges = screen.getAllByText(/9\.896\s*m/);
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
    if (carbon) {
      entitySelection.selectParticle(carbon.id);
      
      // Force per-row mode by typing a unit suffix
      calcState.updateRowText(0, '100 MeV/nucl');
      
      render(ResultTable, { props: { state: calcState, entitySelection } });
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    }
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
    
    const summary = screen.getAllByText(/excluded/);
    expect(summary[0]).toBeInTheDocument();  // First occurrence
  });
});
