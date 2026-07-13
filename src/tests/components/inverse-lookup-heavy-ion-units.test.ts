import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import { flushSync } from "svelte";
import TableAdvanced from "$lib/components/results/table-advanced.svelte";
import TableInverseStp from "$lib/components/results/table-inverse-stp.svelte";
import { createInverseLookupState } from "$lib/state/inverse-lookups.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";

// The Energy tab auto-switches its unit to MeV/nucl for heavy ions (e.g.
// alpha particles). The Advanced Range→ and STP→ tables resolve an "Energy"
// output too, and must label it the same way instead of always saying "MeV".
function makeState() {
  const service = new LibdedxServiceImpl();
  const matrix = buildCompatibilityMatrix(service);
  const entity = createEntitySelectionState(matrix);
  entity.selectProgram(2); // PSTAR — proton + water
  return createInverseLookupState(entity);
}

describe("Advanced Range→ table: Energy output unit follows particle type", () => {
  afterEach(() => cleanup());

  it("shows plain MeV for a non-heavy ion", () => {
    const state = makeState();
    render(TableAdvanced, {
      props: {
        mode: "range",
        inverseLookupState: state,
        stpDisplayUnit: "keV/µm",
        onSelectStpUnit: vi.fn(),
        density: 1,
        isHeavyIon: false,
      },
    });

    state.rangeRows[0]!.status = "valid";
    state.rangeRows[0]!.energyMevNucl = 100;
    flushSync();

    expect(screen.getByTestId("inverse-range-result-0")).toHaveTextContent("100.0 MeV");
  });

  it("shows MeV/nucl for a heavy ion (issue: alpha unit)", () => {
    const state = makeState();
    render(TableAdvanced, {
      props: {
        mode: "range",
        inverseLookupState: state,
        stpDisplayUnit: "keV/µm",
        onSelectStpUnit: vi.fn(),
        density: 1,
        isHeavyIon: true,
      },
    });

    state.rangeRows[0]!.status = "valid";
    state.rangeRows[0]!.energyMevNucl = 100;
    flushSync();

    expect(screen.getByTestId("inverse-range-result-0")).toHaveTextContent("100.0 MeV/nucl");
  });
});

describe("Advanced STP→ table: Energy output unit follows particle type", () => {
  afterEach(() => cleanup());

  it("shows plain MeV for a non-heavy ion", () => {
    const state = makeState();
    render(TableInverseStp, { props: { inverseLookupState: state, isHeavyIon: false } });

    state.stpRows[0]!.status = "valid";
    state.stpRows[0]!.energyHighMevNucl = 100;
    flushSync();

    expect(screen.getByTestId("inverse-stp-result-high-0")).toHaveTextContent("100.0 MeV");
  });

  it("shows MeV/nucl for a heavy ion (issue: alpha unit)", () => {
    const state = makeState();
    render(TableInverseStp, { props: { inverseLookupState: state, isHeavyIon: true } });

    state.stpRows[0]!.status = "valid";
    state.stpRows[0]!.energyHighMevNucl = 100;
    flushSync();

    expect(screen.getByTestId("inverse-stp-result-high-0")).toHaveTextContent("100.0 MeV/nucl");
  });
});
