import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { flushSync } from "svelte";
import TableBasicRange from "$lib/components/results/table-basic-range.svelte";
import TableBasicStp from "$lib/components/results/table-basic-stp.svelte";
import { createInverseLookupState } from "$lib/state/inverse-lookups.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";

// Basic-mode Range→/STP→ cards (issue #840): single-row hero layout with a
// fixed STP unit (no Advanced-mode unit dropdown/override) and, for STP→, a
// conditionally-revealed low-energy-branch card.
function makeState() {
  const service = new LibdedxServiceImpl();
  const matrix = buildCompatibilityMatrix(service);
  const entity = createEntitySelectionState(matrix);
  entity.selectProgram(2); // PSTAR — proton + water
  return createInverseLookupState(entity);
}

describe("TableBasicRange", () => {
  afterEach(() => cleanup());

  it("has no per-row Unit column or per-row-mode indicator", () => {
    render(TableBasicRange, {
      props: { inverseLookupState: makeState(), isGas: false, density: 1 },
    });
    expect(screen.queryByText(/per-row mode active/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId(/range-cell-\d+/)).not.toBeInTheDocument();
  });

  it("fixes the STP output unit to keV/µm for a non-gas material", () => {
    render(TableBasicRange, {
      props: { inverseLookupState: makeState(), isGas: false, density: 1 },
    });
    expect(screen.getByText("Stopping Power (keV/µm)")).toBeInTheDocument();
  });

  it("fixes the STP output unit to MeV·cm²/g for a gas material", () => {
    render(TableBasicRange, {
      props: { inverseLookupState: makeState(), isGas: true, density: 0.0012 },
    });
    expect(screen.getByText("Stopping Power (MeV·cm²/g)")).toBeInTheDocument();
  });

  it("converts a resolved stopping power to the fixed unit, ignoring density for keV/µm math", () => {
    const state = makeState();
    render(TableBasicRange, { props: { inverseLookupState: state, isGas: false, density: 1 } });

    // Simulate a resolved calculation (normally set by setupInverseRangeCalculation).
    state.rangeRows[0]!.status = "valid";
    state.rangeRows[0]!.energyMevNucl = 100;
    state.rangeRows[0]!.stoppingPower = 25; // MeV·cm²/g, native
    flushSync();

    // keV/µm = massStp * density / 10 = 25 * 1 / 10 = 2.5
    expect(screen.getByTestId("basic-range-stp-cell")).toHaveTextContent("2.5");
  });
});

describe("TableBasicStp", () => {
  afterEach(() => cleanup());

  it("fixes the input unit label to keV/µm for a non-gas material", () => {
    render(TableBasicStp, { props: { inverseLookupState: makeState(), isGas: false } });
    expect(screen.getByText(/Stopping Power \(keV\/µm\)/)).toBeInTheDocument();
  });

  it("fixes the input unit label to MeV·cm²/g for a gas material and pins the row unit", () => {
    const state = makeState();
    render(TableBasicStp, { props: { inverseLookupState: state, isGas: true } });
    flushSync();
    expect(screen.getByText(/Stopping Power \(MeV·cm²\/g\)/)).toBeInTheDocument();
    expect(state.stpMasterUnit).toBe("mev-cm2-g");
  });

  it("hides the low-energy-branch card when only a high-E solution exists", () => {
    const state = makeState();
    render(TableBasicStp, { props: { inverseLookupState: state, isGas: false } });

    state.stpRows[0]!.status = "valid";
    state.stpRows[0]!.energyHighMevNucl = 800;
    state.stpRows[0]!.energyLowMevNucl = null;
    flushSync();

    expect(screen.queryByTestId("basic-stp-low-e-card")).not.toBeInTheDocument();
  });

  it("reveals the low-energy-branch card when a second (low-E) solution exists", () => {
    const state = makeState();
    render(TableBasicStp, { props: { inverseLookupState: state, isGas: false } });

    state.stpRows[0]!.status = "valid";
    state.stpRows[0]!.energyHighMevNucl = 800;
    state.stpRows[0]!.energyLowMevNucl = 5;
    state.stpRows[0]!.rangeHighCm = 0.001738;
    state.stpRows[0]!.rangeLowCm = 0.0000185;
    flushSync();

    expect(screen.getByTestId("basic-stp-low-e-card")).toBeInTheDocument();
    expect(screen.getByTestId("basic-stp-energy-low-cell")).toHaveTextContent("5");
  });
});
