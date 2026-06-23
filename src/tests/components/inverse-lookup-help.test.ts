import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import TableInverseStp from "$lib/components/results/table-inverse-stp.svelte";
import TableAdvanced from "$lib/components/results/table-advanced.svelte";
import { createInverseLookupState } from "$lib/state/inverse-lookups.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { HELP_TEXT } from "$lib/config/help-text";

// Contextual help (#771): the inverse Range→ and STP→ branches each get an
// explanatory ⓘ hint, with the STP branch also carrying the Bragg-peak
// validity hint. This asserts parity across both branches.
function makeState() {
  const service = new LibdedxServiceImpl();
  const matrix = buildCompatibilityMatrix(service);
  const entity = createEntitySelectionState(matrix);
  entity.selectProgram(2); // PSTAR — proton + water
  return createInverseLookupState(entity);
}

describe("Inverse lookup contextual help", () => {
  afterEach(() => cleanup());

  describe("STP→ branch", () => {
    beforeEach(() => {
      render(TableInverseStp, { props: { inverseLookupState: makeState() } });
    });

    it("explains the STP→ lookup with two-branch wording", () => {
      expect(screen.getByTestId("inverse-stp-help")).toHaveAccessibleName(
        new RegExp(HELP_TEXT.inverseStp.text.slice(0, 20)),
      );
    });

    it("carries the Bragg-peak validity hint", () => {
      expect(screen.getByTestId("inverse-stp-bragg-help")).toHaveAccessibleName(
        new RegExp(HELP_TEXT.braggPeak.text.slice(0, 20)),
      );
    });
  });

  describe("Range→ branch", () => {
    it("explains the Range→ lookup (parity with STP→)", () => {
      render(TableAdvanced, {
        props: {
          mode: "range",
          inverseLookupState: makeState(),
          stpDisplayUnit: "keV/µm",
          onSelectStpUnit: vi.fn(),
          density: 1,
        },
      });

      expect(screen.getByTestId("inverse-range-help")).toHaveAccessibleName(
        new RegExp(HELP_TEXT.inverseRange.text.slice(0, 20)),
      );
    });
  });
});
