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

async function removeRow(index: number) {
  const removeBtns = screen.getAllByTestId("picker-element-row-remove");
  await fireEvent.click(removeBtns[index]!);
  const confirmBtn = screen.getByRole("button", { name: "Yes, remove" });
  await fireEvent.click(confirmBtn);
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

    // Li is present by default; add a second Li.
    await addElement("Li");

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

  it("pre-fills the form from a shared-URL prefill (Edit & save copy)", async () => {
    renderModal({
      prefill: {
        name: "LiF (copy)",
        density: "2.64",
        iValue: "",
        phase: "condensed",
        elements: [
          { atomicNumber: 3, atomCount: 1 },
          { atomicNumber: 9, atomCount: 1 },
        ],
      },
    });
    expect(nameInput()).toHaveValue("LiF (copy)");
    expect(densityInput()).toHaveValue(2.64);
    // No Delete button — this is create (copy) mode, not editing a library entry.
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("shows the amber notice and disables Save for a failed-URL density (Gap B)", async () => {
    renderModal({
      initialWarning: "mat_density invalid",
      prefill: {
        name: "Bad Density",
        density: "99",
        iValue: "",
        phase: "condensed",
        elements: [
          { atomicNumber: 1, atomCount: 2 },
          { atomicNumber: 8, atomCount: 1 },
        ],
      },
    });
    expect(screen.getByTestId("compound-editor-url-warning")).toBeInTheDocument();
    // Density field is amber-flagged and Save stays disabled until it's fixed.
    expect(densityInput()).toHaveAttribute("data-url-failed", "density");
    expect(saveButton()).toBeDisabled();

    // Correcting the value clears the amber flag and re-enables Save.
    await fireEvent.input(densityInput(), { target: { value: "2.64" } });
    expect(densityInput()).not.toHaveAttribute("data-url-failed");
    expect(saveButton()).toBeEnabled();
  });

  it("renders the formula footer with atom count and computed I-value (no crash on duplicates)", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Water" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });

    // Initially Li (3) and F (9). Add H (1) and O (8).
    await addElement("H");
    await addElement("O");
    // Sorted order is now: H (1), Li (3), O (8), F (9)
    await removeRow(3); // Removes F
    await removeRow(1); // Removes Li

    // Now H and O are present.
    const counts = screen.getAllByPlaceholderText(/count/i);
    await fireEvent.input(counts[0]!, { target: { value: "2" } }); // H
    await fireEvent.input(counts[1]!, { target: { value: "1" } }); // O

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
