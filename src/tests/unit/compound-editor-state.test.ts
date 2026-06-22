import { describe, it, expect, vi } from "vitest";
import {
  createCompoundEditorState,
  type SavedCompoundData,
} from "$lib/state/compound-editor.svelte";

/**
 * Unit coverage for the shared compound-editor state factory (issue #762).
 * These exercise the controller directly — duplicate-Z detection, mode
 * switching, sum-tracking/rescale, paste/preset, and Save gating — without
 * driving the DOM, which the component test in
 * `tests/components/compound-editor-modal.test.ts` still covers end-to-end.
 */

function makeEditor(onSave: (d: SavedCompoundData) => void = () => {}) {
  const editor = createCompoundEditorState({ onSave });
  // Default create-mode load (mirrors the modal opening empty).
  editor.load({ open: true, compound: null });
  return editor;
}

describe("createCompoundEditorState — defaults", () => {
  it("seeds the LiF placeholder composition in formula mode", () => {
    const editor = makeEditor();
    expect(editor.mode).toBe("formula");
    expect(editor.formData.elements).toEqual([
      { atomicNumber: 3, atomCount: 1 },
      { atomicNumber: 9, atomCount: 1 },
    ]);
    expect(editor.isEditing).toBe(false);
  });

  it("does not save an untouched empty-name form and reveals the reason", () => {
    const onSave = vi.fn();
    const editor = makeEditor(onSave);
    editor.handleSave();
    expect(onSave).not.toHaveBeenCalled();
    expect(editor.saveAttempted).toBe(true);
    expect(editor.saveBlockReason).toMatch(/name is required/i);
  });

  it("saves once name + density are valid", () => {
    const onSave = vi.fn();
    const editor = makeEditor(onSave);
    editor.formData.name = "LiF";
    editor.formData.density = "2.64";
    expect(editor.canSave).toBe(true);
    editor.handleSave();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]![0]).toMatchObject({ name: "LiF", density: 2.64 });
  });
});

describe("createCompoundEditorState — duplicate-Z detection", () => {
  it("flags a duplicate element and blocks Save", () => {
    const onSave = vi.fn();
    const editor = makeEditor(onSave);
    editor.formData.name = "Dup";
    editor.formData.density = "1";
    // Default has Li (3). Add another Li.
    expect(editor.addElementBySymbol("Li")).toBe(true);

    expect(editor.duplicateBanner).toMatchObject({ z: 3 });
    expect(editor.canSave).toBe(false);
    editor.handleSave();
    expect(onSave).not.toHaveBeenCalled();
    expect(editor.saveBlockReason).toMatch(/merge them first/i);
  });

  it("merges duplicate rows into one via the banner", () => {
    const editor = makeEditor();
    editor.addElementBySymbol("Li"); // now Li, Li, F
    editor.handleMergeBanner();
    expect(editor.duplicateBanner).toBeNull();
    const li = editor.formData.elements.find((e) => e.atomicNumber === 3);
    expect(li?.atomCount).toBe(2);
  });
});

describe("createCompoundEditorState — mass percent & weight mode", () => {
  it("derives per-row mass percentages in formula mode", () => {
    const editor = makeEditor();
    const pcts = editor.massPercents;
    expect(pcts).not.toBeNull();
    expect(pcts!.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  it("flags an out-of-tolerance weight sum and clears it after rescale", () => {
    const onSave = vi.fn();
    const editor = makeEditor(onSave);
    editor.formData.name = "Rescale";
    editor.formData.density = "1";
    editor.switchMode("weight");
    editor.setWeightText(0, "40");
    editor.setWeightText(1, "50"); // sums to 90 → out of tolerance

    expect(editor.canSave).toBe(false);
    expect(editor.errors.elements).toMatch(/sum to 100/i);

    editor.handleRescale();
    const sum = editor.weightTexts.reduce((a, t) => a + parseFloat(t), 0);
    expect(sum).toBeCloseTo(100, 1);
    expect(editor.errors.elements).toBeUndefined();
    expect(editor.canSave).toBe(true);
  });
});

describe("createCompoundEditorState — quick start", () => {
  it("replaces an empty composition with a pasted formula directly", () => {
    const editor = makeEditor();
    // Empty out via replace path: paste while empty composition is the default.
    editor.handlePasteFormula([
      { atomicNumber: 1, atomCount: 2 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
    // Default composition was untouched, so paste replaced it (no confirm).
    expect(editor.formulaToConfirm).toBeNull();
    expect(editor.formData.elements).toEqual([
      { atomicNumber: 1, atomCount: 2 },
      { atomicNumber: 8, atomCount: 1 },
    ]);
  });

  it("defers to a confirm dialog when pasting over a touched composition", () => {
    const editor = makeEditor();
    editor.handleAtomCountChange(0, "5"); // touch the composition
    editor.handlePasteFormula([{ atomicNumber: 6, atomCount: 1 }]);
    expect(editor.formulaToConfirm).not.toBeNull();
    editor.applyPasteFormulaData(editor.formulaToConfirm!, true);
    expect(editor.formData.elements).toEqual([{ atomicNumber: 6, atomCount: 1 }]);
  });
});

describe("createCompoundEditorState — edit & prefill load", () => {
  it("loads an existing compound for editing", () => {
    const editor = createCompoundEditorState({ onSave: () => {} });
    editor.load({
      open: true,
      compound: {
        id: "cc_abc",
        name: "Water",
        normalizedName: "water",
        density: 1,
        phase: "condensed",
        elements: [
          { atomicNumber: 1, atomCount: 2 },
          { atomicNumber: 8, atomCount: 1 },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(editor.isEditing).toBe(true);
    expect(editor.formData.name).toBe("Water");
    expect(editor.isEmptyComposition).toBe(false);
  });

  it("reveals errors immediately for a failed-URL prefill", () => {
    const editor = createCompoundEditorState({ onSave: () => {} });
    editor.load({
      open: true,
      compound: null,
      prefill: {
        name: "Bad",
        density: "99",
        iValue: "",
        phase: "condensed",
        elements: [{ atomicNumber: 1, atomCount: 2 }],
      },
      initialWarning: "mat_density invalid",
    });
    expect(editor.saveAttempted).toBe(true);
    expect(editor.visibleErrors.density).toMatch(/density/i);
    expect(editor.isUrlAmber("density")).toBe(true);
    expect(editor.canSave).toBe(false);
  });
});
