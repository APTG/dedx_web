import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/svelte";
import CompoundEditorModal from "$lib/components/compound-editor-modal.svelte";

/**
 * Component-level coverage for the compound editor's Save gating and live
 * derived UI (Issue #645). These assertions mirror the Playwright specs but
 * run without WASM, so the duplicate-element regression (PR #653 left Save
 * enabled while the "appears twice" banner showed) is caught here directly.
 */

const noop = () => {};

function renderModal(overrides: Record<string, unknown> = {}) {
  return render(CompoundEditorModal, {
    props: {
      open: true,
      compound: null,
      onOpenChange: noop,
      onSave: vi.fn(),
      onDelete: noop,
      ...overrides,
    },
  });
}

function nameInput() {
  return screen.getByRole("textbox", { name: /name/i });
}
function densityInput() {
  return screen.getByRole("spinbutton", { name: /density/i });
}
function saveButton() {
  return screen.getByRole("button", { name: "Save" });
}
async function addElement(symbol: string) {
  const addInput = screen.getByPlaceholderText(/type symbol or element/i);
  await fireEvent.input(addInput, { target: { value: symbol } });
  await fireEvent.keyDown(addInput, { key: "Enter" });
}

describe("CompoundEditorModal — Save gating & derived UI", () => {
  async function flushDialog() {
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  beforeEach(async () => {
    await flushDialog();
    localStorage.clear();
  });
  afterEach(async () => {
    await flushDialog();
  });

  it("enables Save for a valid single-element compound", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Hydrogen Gas" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    expect(saveButton()).toBeEnabled();
  });

  it("disables Save and shows the banner when an element appears twice", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Duplicate" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });

    // H is present by default; add a second H.
    await addElement("H");

    // The duplicate banner is shown AND Save is disabled — the exact behaviour
    // PR #653 regressed (banner showed but Save stayed enabled).
    expect(screen.getByText(/appears twice/i)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("disables Save while the name is empty", async () => {
    renderModal();
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it("disables Save when density exceeds the limit", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Dense" } });
    await fireEvent.input(densityInput(), { target: { value: "30" } });
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(/density must be/i)).toBeInTheDocument();
  });

  it("renders the formula footer with atom count and computed I-value (no crash on duplicates)", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Water" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });

    // H present; set count 2, add O count 1 → H2O.
    const counts = screen.getAllByPlaceholderText(/count/i);
    await fireEvent.input(counts[0]!, { target: { value: "2" } });
    await addElement("O");
    const countsAfter = screen.getAllByPlaceholderText(/count/i);
    await fireEvent.input(countsAfter[1]!, { target: { value: "1" } });

    expect(screen.getByTestId("compound-formula-string")).toHaveTextContent("H₂O");
    expect(screen.getByTestId("compound-total-atoms")).toHaveTextContent("3 atoms");
    // Bragg additivity preview for water ≈ 69 eV.
    expect(screen.getByTestId("compound-ivalue")).toHaveTextContent(/69(\.\d)?\s*eV/);
    expect(screen.getByTestId("compound-ivalue")).toHaveTextContent(/computed/i);

    // Adding a duplicate H must not crash the footer (single-string render).
    await addElement("H");
    expect(screen.getByText(/appears twice/i)).toBeInTheDocument();
    expect(screen.getByTestId("compound-formula-footer")).toBeInTheDocument();
  });

  it("shows the sum tracker in weight mode and auto-rescales to 100%", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Rescale" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    await addElement("O");

    await fireEvent.click(screen.getByRole("tab", { name: /weight fraction/i }));

    const wf1 = screen.getByRole("spinbutton", { name: /weight fraction.*element 1/i });
    const wf2 = screen.getByRole("spinbutton", { name: /weight fraction.*element 2/i });
    await fireEvent.input(wf1, { target: { value: "40" } });
    await fireEvent.input(wf2, { target: { value: "50" } });

    expect(screen.getByTestId("compound-sum-status")).toHaveTextContent(/must equal 100/i);
    expect(saveButton()).toBeDisabled();

    await fireEvent.click(screen.getByTestId("compound-sum-rescale"));

    expect(screen.getByTestId("compound-sum-status")).toHaveTextContent(/within tolerance/i);
    expect(saveButton()).toBeEnabled();
  });
});
