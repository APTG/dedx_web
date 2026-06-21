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
  const onSave = (overrides.onSave ?? vi.fn()) as unknown as ((data: unknown) => void) &
    ReturnType<typeof vi.fn>;
  const result = render(CompoundEditorModal, {
    props: {
      open: true,
      compound: null,
      onOpenChange: noop,
      onSave,
      onDelete: noop,
      ...overrides,
    },
  });
  return { ...result, onSave };
}

function blockReason() {
  return screen.getByTestId("compound-save-block-reason");
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

  it("saves a valid single-element compound", async () => {
    const { onSave } = renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Hydrogen Gas" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    await fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("blocks Save and shows the banner when an element appears twice", async () => {
    const { onSave } = renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Duplicate" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });

    // Li is present by default; add a second Li.
    await addElement("Li");

    // The duplicate banner is shown AND Save is blocked — the exact behaviour
    // PR #653 regressed (banner showed but Save still saved).
    expect(screen.getByText(/appears twice/i)).toBeInTheDocument();
    await fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
    expect(blockReason()).toHaveTextContent(/merge them first/i);
  });

  it("blocks Save and reveals the reason while the name is empty", async () => {
    const { onSave } = renderModal();
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    // Deferred validation: nothing is flagged until the user attempts to save.
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
    await fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
    expect(blockReason()).toHaveTextContent(/name is required/i);
  });

  it("blocks Save when density exceeds the limit", async () => {
    const { onSave } = renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Dense" } });
    await fireEvent.input(densityInput(), { target: { value: "30" } });
    await fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
    expect(blockReason()).toHaveTextContent(/density must be/i);
  });

  it("defers the density error until the field is blurred", async () => {
    renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Dense" } });
    await fireEvent.input(densityInput(), { target: { value: "30" } });
    // No blur, no save attempt yet → inline error stays hidden.
    expect(screen.queryByText(/density must be/i)).not.toBeInTheDocument();
    await fireEvent.blur(densityInput());
    expect(screen.getByText(/density must be/i)).toBeInTheDocument();
  });

  it("pre-fills the form from a shared-URL prefill (Edit & save copy)", async () => {
    const { onSave } = renderModal({
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
    await fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows the amber notice and blocks Save for a failed-URL density (Gap B)", async () => {
    const { onSave } = renderModal({
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
    // Density field is amber-flagged and Save stays blocked until it's fixed.
    expect(densityInput()).toHaveAttribute("data-url-failed", "density");
    await fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();

    // Correcting the value clears the amber flag and lets Save through.
    await fireEvent.input(densityInput(), { target: { value: "2.64" } });
    expect(densityInput()).not.toHaveAttribute("data-url-failed");
    await fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledOnce();
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
    const { onSave } = renderModal();
    await fireEvent.input(nameInput(), { target: { value: "Rescale" } });
    await fireEvent.input(densityInput(), { target: { value: "1.0" } });
    await addElement("O");

    await fireEvent.click(screen.getByRole("tab", { name: /weight fraction/i }));

    const wf1 = screen.getByRole("spinbutton", { name: /weight fraction.*element 1/i });
    const wf2 = screen.getByRole("spinbutton", { name: /weight fraction.*element 2/i });
    await fireEvent.input(wf1, { target: { value: "40" } });
    await fireEvent.input(wf2, { target: { value: "50" } });

    expect(screen.getByTestId("compound-sum-status")).toHaveTextContent(/must equal 100/i);
    await fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByTestId("compound-sum-rescale"));

    expect(screen.getByTestId("compound-sum-status")).toHaveTextContent(/within tolerance/i);
    await fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledOnce();
  });
});
