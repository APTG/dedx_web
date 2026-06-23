import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import QuantityToggle from "$lib/components/results/quantity-toggle.svelte";
import { HELP_TEXT } from "$lib/config/help-text";

describe("QuantityToggle", () => {
  afterEach(() => cleanup());

  it("renders both quantity radios", () => {
    render(QuantityToggle, { props: { value: "stp", onChange: vi.fn() } });
    expect(screen.getByTestId("quantity-toggle-stp")).toBeInTheDocument();
    expect(screen.getByTestId("quantity-toggle-range")).toBeInTheDocument();
  });

  // Parity: stopping power AND CSDA range each get an explanatory ⓘ hint.
  it("renders a contextual-help hint for each quantity with glossary-sourced copy", () => {
    render(QuantityToggle, { props: { value: "stp", onChange: vi.fn() } });

    const stpHint = screen.getByTestId("quantity-help-stp");
    expect(stpHint).toHaveAccessibleName(new RegExp(HELP_TEXT.stoppingPower.text.slice(0, 20)));

    const rangeHint = screen.getByTestId("quantity-help-range");
    expect(rangeHint).toHaveAccessibleName(new RegExp(HELP_TEXT.csdaRange.text.slice(0, 20)));
  });

  it("keeps the help hints out of the roving radio tab order", () => {
    render(QuantityToggle, { props: { value: "stp", onChange: vi.fn() } });
    // Hints are real <button>s but not radios, so the radiogroup still owns
    // exactly two radio controls.
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});
