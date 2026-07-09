import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/svelte";
import { LibdedxServiceImpl } from "$lib/wasm/__mocks__/libdedx";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { createCalculatorState } from "$lib/state/calculator.svelte";
import TableBasic from "$lib/components/results/table-basic.svelte";
import type { CalculatorState } from "$lib/state/calculator.svelte";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";

describe("TableBasic — mouse row removal", () => {
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

  it("shows the single-row hero card (no delete control) with one row", () => {
    render(TableBasic, { props: { calcState, entitySelection } });

    expect(screen.getByTestId("basic-single-row-card")).toBeInTheDocument();
    expect(screen.queryByTestId("basic-delete-row-0")).not.toBeInTheDocument();
  });

  it("renders a visible delete button per row in the multi-row table", async () => {
    calcState.addRow();
    render(TableBasic, { props: { calcState, entitySelection } });

    await waitFor(() => {
      expect(screen.getByTestId("basic-multi-row-table")).toBeInTheDocument();
    });
    expect(screen.getByTestId("basic-delete-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("basic-delete-row-1")).toBeInTheDocument();
  });

  it("collapses back to the hero card when the table is reduced to one row", async () => {
    calcState.addRow();
    render(TableBasic, { props: { calcState, entitySelection } });

    await waitFor(() => {
      expect(screen.getByTestId("basic-multi-row-table")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTestId("basic-delete-row-1"));

    await waitFor(() => {
      expect(screen.getByTestId("basic-single-row-card")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("basic-multi-row-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("basic-delete-row-0")).not.toBeInTheDocument();
  });
});
