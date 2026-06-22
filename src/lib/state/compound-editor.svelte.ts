/**
 * Shared, rune-based state factory for the custom-compound editor.
 *
 * Owns the entire editor behaviour — composition rows, atom-count vs %-by-mass
 * mode, duplicate-Z detection, sum tracking, rescale-to-100, formula/preset
 * application, deferred validation, and save/cancel — so the desktop modal
 * (`compound-editor-modal.svelte`) and the mobile sheet
 * (`compound-editor/mobile-sheet.svelte`) are thin views over one controller
 * instead of each re-implementing the flow (issue #762).
 *
 * Pure derivations stay in `utils/compound-derive.ts` (`deriveMassPercents`,
 * `rescaleTo100`); this module orchestrates them around the reactive form state.
 * `ParsedElement` from `utils/formula-parser.ts` is used only as a type.
 *
 * @packageDocumentation
 */

import {
  type StoredCompoundInternal,
  type CompoundElementEntry,
  mergeRows,
} from "$lib/state/custom-compounds.svelte";
import {
  ELEMENTS,
  resolveElement,
  computeWeightFractions,
  computeAtomCounts,
  normalizeAtomCounts,
} from "$lib/utils/element-data";
import { deriveMassPercents, rescaleTo100 } from "$lib/utils/compound-derive";
import { presetToAtomCounts, type CompoundPreset } from "$lib/data/compound-presets";
import type { ParsedElement } from "$lib/utils/formula-parser";
import type {
  CompoundFormData,
  CompoundEditorPrefill,
  EditorController,
} from "$lib/components/compound-editor/types";

/** Compound payload handed back to the caller on a successful Save. */
export interface SavedCompoundData {
  name: string;
  density: number;
  iValue?: number;
  phase: "gas" | "condensed";
  elements: CompoundElementEntry[];
}

/** Reactive inputs the modal feeds the controller whenever it (re)opens. */
export interface CompoundEditorLoadArgs {
  open: boolean;
  compound: StoredCompoundInternal | null;
  prefill?: CompoundEditorPrefill | null;
  initialWarning?: string | null;
}

/**
 * Desktop superset of {@link EditorController}. The mobile sheet only needs the
 * shared contract; the desktop modal additionally drives the secondary
 * "replace composition?" dialogs, the URL-recovery amber highlighting, and the
 * `load()` lifecycle.
 */
export interface CompoundEditorState extends EditorController {
  readonly presetToConfirm: CompoundPreset | null;
  readonly formulaToConfirm: ParsedElement[] | null;
  readonly urlFailedFields: Set<string>;

  isUrlAmber(field: string): boolean;
  fieldBorderClass(field: string): string;
  applyPresetData(preset: CompoundPreset): void;
  applyPasteFormulaData(elements: ParsedElement[], replace: boolean): void;
  cancelPreset(): void;
  cancelFormula(): void;

  /** (Re)initialise the form for the current open/compound/prefill props. */
  load(args: CompoundEditorLoadArgs): void;
}

const INITIAL_DATA: CompoundFormData = {
  name: "",
  density: "",
  iValue: "",
  phase: "condensed",
  elements: [
    { atomicNumber: 3, atomCount: 1 },
    { atomicNumber: 9, atomCount: 1 },
  ],
};

export function createCompoundEditorState(options: {
  onSave: (data: SavedCompoundData) => void;
}): CompoundEditorState {
  let formData = $state<CompoundFormData>({
    ...INITIAL_DATA,
    elements: INITIAL_DATA.elements.map((e) => ({ ...e })),
  });
  let elementTexts = $state<string[]>(["Li", "F"]);
  let weightTexts = $state<string[]>(["26.76", "73.24"]);
  let mode = $state<"formula" | "weight">("formula");
  let compositionTouched = $state(false);

  // The compound being edited (null in create mode) and the URL-recovery
  // warning text, both seeded by `load()`.
  let editingCompound = $state<StoredCompoundInternal | null>(null);
  let warning = $state<string | null>(null);

  // Deferred validation: a field's error only surfaces once the user has
  // touched it (blur) or after a Save attempt (#767).
  let touched = $state<Set<string>>(new Set());
  let saveAttempted = $state(false);

  let editDuplicatePrompt = $state<{
    index: number;
    newZ: number;
    existingIndex: number;
  } | null>(null);
  let presetToConfirm = $state<CompoundPreset | null>(null);
  let formulaToConfirm = $state<ParsedElement[] | null>(null);

  // Which form fields a failed shared URL flagged, derived from the warning
  // text. A field stays highlighted only while it is still invalid (#648).
  const urlFailedFields = $derived.by(() => {
    const s = new Set<string>();
    const w = warning ?? "";
    if (w.includes("mat_name")) s.add("name");
    if (w.includes("mat_density")) s.add("density");
    if (w.includes("mat_ival")) s.add("iValue");
    if (w.includes("mat_elements")) s.add("elements");
    return s;
  });

  const isEmptyComposition = $derived(
    formData.elements.length === 0 || (!compositionTouched && !editingCompound),
  );

  const duplicateBanner = $derived.by(() => {
    const seen = new Map<number, number>();
    for (let i = 0; i < formData.elements.length; i++) {
      const z = formData.elements[i]!.atomicNumber;
      if (seen.has(z)) {
        return { z, firstIndex: seen.get(z)!, duplicateIndex: i };
      }
      seen.set(z, i);
    }
    return null;
  });

  const usedZ = $derived.by(() => new Set(formData.elements.map((e) => e.atomicNumber)));

  // Live per-row mass percentages (formula mode only), aligned by row index.
  const massPercents = $derived(mode === "formula" ? deriveMassPercents(formData.elements) : null);

  const displayElements = $derived.by(() => {
    if (mode === "formula") return formData.elements;

    const wfs = weightTexts.map((t, i) => ({
      atomicNumber: formData.elements[i]?.atomicNumber ?? 1,
      weightFraction: (parseFloat(t) || 0) / 100,
    }));
    return computeAtomCounts(wfs) || formData.elements;
  });

  // Pure validation: a function of the form state only, so the Save gating and
  // inline messages stay in sync without any imperative writes.
  const errors = $derived.by(() => {
    const e: Record<string, string> = {};

    const name = formData.name.trim();
    if (!name) {
      e.name = "Name is required.";
    } else if (name.length > 80) {
      e.name = "Name must be 80 characters or fewer.";
    }

    const density = parseFloat(formData.density);
    if (!formData.density || isNaN(density)) {
      e.density = "Density is required.";
    } else if (density <= 0) {
      e.density = "Density must be greater than zero.";
    } else if (density > 25) {
      e.density = "Density must be ≤ 25 g/cm³.";
    }

    if (formData.iValue) {
      const iVal = parseFloat(formData.iValue);
      if (isNaN(iVal) || iVal <= 0) {
        e.iValue = "I-value must be a positive number.";
      } else if (iVal > 10000) {
        e.iValue = "I-value must be ≤ 10 000 eV.";
      }
    }

    if (formData.elements.length === 0) {
      e.elements = "At least one element is required.";
    } else if (mode === "weight") {
      const parsed = weightTexts.map((t) => parseFloat(t));
      if (parsed.some((v) => isNaN(v) || v <= 0)) {
        e.elements = "All weight fractions must be positive numbers.";
      } else {
        const sum = parsed.reduce((s, v) => s + v, 0);
        if (Math.abs(sum - 100) > 0.5) {
          e.elements = `Weight fractions must sum to 100% (current: ${sum.toFixed(1)}%).`;
        }
      }
    } else {
      for (const elem of formData.elements) {
        if (elem.atomicNumber < 1 || elem.atomicNumber > 118) {
          e.elements = `Unknown element: Z=${elem.atomicNumber}.`;
          break;
        }
        if (elem.atomCount <= 0) {
          e.elements = "Atom count must be greater than zero.";
          break;
        }
        if (elem.atomCount > 1000) {
          e.elements = "Atom count must be ≤ 1000.";
          break;
        }
      }
    }

    return e;
  });

  // The subset of `errors` that should actually be shown: a field error appears
  // once touched or after a Save attempt (composition errors also surface as
  // soon as the composition is edited). Save gating still uses the full
  // `errors`/`canSave` so an untouched invalid form can't be saved (#767).
  const visibleErrors = $derived.by(() => {
    const out: Record<string, string> = {};
    for (const [field, msg] of Object.entries(errors)) {
      const show =
        saveAttempted ||
        touched.has(field) ||
        (field === "elements" && compositionTouched) ||
        urlFailedFields.has(field);
      if (show) out[field] = msg;
    }
    return out;
  });

  // A duplicate element is surfaced by `duplicateBanner` / the edit prompt and
  // hard-blocks Save in addition to the field errors above.
  const canSave = $derived(
    Object.keys(errors).length === 0 && !duplicateBanner && !editDuplicatePrompt,
  );

  const saveBlockReason = $derived.by(() => {
    if (duplicateBanner) return "Two rows share the same element — merge them first.";
    if (editDuplicatePrompt) return "Resolve the duplicate-element prompt first.";
    return errors.name ?? errors.density ?? errors.iValue ?? errors.elements ?? null;
  });

  function markTouched(field: string) {
    if (!touched.has(field)) touched = new Set(touched).add(field);
  }

  function isUrlAmber(field: string): boolean {
    return urlFailedFields.has(field) && !!errors[field];
  }

  function fieldBorderClass(field: string): string {
    if (isUrlAmber(field)) return "border-amber-500 ring-1 ring-amber-400";
    return visibleErrors[field] ? "border-destructive" : "";
  }

  function resetTransientState() {
    editDuplicatePrompt = null;
    presetToConfirm = null;
    formulaToConfirm = null;
    touched = new Set();
    saveAttempted = false;
  }

  function sortElements() {
    const combined = formData.elements.map((el, i) => ({
      el,
      et: elementTexts[i],
      wt: weightTexts[i],
    }));
    combined.sort((a, b) => a.el.atomicNumber - b.el.atomicNumber);
    formData.elements = combined.map((x) => x.el);
    elementTexts = combined.map((x) => x.et!);
    weightTexts = combined.map((x) => x.wt!);
  }

  function getLocalSymbol(z: number): string {
    return ELEMENTS.find((e) => e.atomicNumber === z)?.symbol ?? String(z);
  }

  function getLocalName(z: number): string {
    return ELEMENTS.find((e) => e.atomicNumber === z)?.name ?? "";
  }

  function computeInitialWeightTexts(elements: CompoundElementEntry[]): string[] {
    const fractions = computeWeightFractions(elements);
    if (!fractions) return elements.map(() => "");
    return fractions.map((f) => (f.weightFraction * 100).toFixed(2));
  }

  function switchMode(newMode: "formula" | "weight") {
    if (newMode === mode) return;
    if (newMode === "weight") {
      weightTexts = computeInitialWeightTexts(formData.elements);
    } else {
      const converted = convertWeightFractionsToAtomCounts();
      if (converted) {
        formData.elements = converted;
        elementTexts = converted.map((e) => getLocalSymbol(e.atomicNumber));
      }
    }
    mode = newMode;
    compositionTouched = true;
  }

  function convertWeightFractionsToAtomCounts(): CompoundElementEntry[] | null {
    const wfs = weightTexts.map((t, i) => ({
      atomicNumber: formData.elements[i]?.atomicNumber ?? 1,
      weightFraction: (parseFloat(t) || 0) / 100,
    }));
    const result = computeAtomCounts(wfs);
    if (!result) return null;
    return normalizeAtomCounts(result);
  }

  function handleSave() {
    if (!canSave) {
      // Surface every outstanding error and the block reason instead of a
      // silent no-op on a disabled button (#767).
      saveAttempted = true;
      return;
    }

    let elements = formData.elements;
    if (mode === "weight") {
      const converted = convertWeightFractionsToAtomCounts();
      if (converted) elements = converted;
    }

    options.onSave({
      name: formData.name,
      density: parseFloat(formData.density),
      ...(formData.iValue ? { iValue: parseFloat(formData.iValue) } : {}),
      phase: formData.phase,
      elements,
    });
  }

  function handleRescale() {
    const values = weightTexts.map((t) => parseFloat(t) || 0);
    weightTexts = rescaleTo100(values).map((v) => v.toFixed(2));
    compositionTouched = true;
  }

  function handleRemoveElement(index: number) {
    if (formData.elements.length > 1) {
      formData.elements.splice(index, 1);
      elementTexts.splice(index, 1);
      weightTexts.splice(index, 1);
      editDuplicatePrompt = null;
      compositionTouched = true;
    }
  }

  function handleAtomCountChange(index: number, count: string) {
    compositionTouched = true;
    const num = parseFloat(count);
    const element = formData.elements[index];
    if (!isNaN(num) && num > 0 && element) {
      element.atomCount = num;
    }
  }

  // Core selection logic, parameterised so both the desktop picker dialog and
  // the mobile picker overlay can drive it without sharing picker UI state.
  function applyElementSelection(z: number, selMode: "ADD" | "EDIT", selIndex: number | null) {
    if (selMode === "ADD") {
      formData.elements.push({ atomicNumber: z, atomCount: 1 });
      elementTexts.push(getLocalSymbol(z));
      if (mode === "weight") weightTexts.push("0");
      compositionTouched = true;
      sortElements();
    } else if (selMode === "EDIT" && selIndex !== null) {
      const existingIndex = formData.elements.findIndex(
        (e, i) => i !== selIndex && e.atomicNumber === z,
      );
      if (existingIndex !== -1) {
        editDuplicatePrompt = { index: selIndex, newZ: z, existingIndex };
      } else {
        const element = formData.elements[selIndex];
        if (element) {
          element.atomicNumber = z;
          elementTexts[selIndex] = getLocalSymbol(z);
          sortElements();
          compositionTouched = true;
        }
      }
    }
  }

  function addElementBySymbol(text: string): boolean {
    const resolved = resolveElement(text);
    if (!resolved) return false;
    formData.elements.push({ atomicNumber: resolved.atomicNumber, atomCount: 1 });
    elementTexts.push(getLocalSymbol(resolved.atomicNumber));
    if (mode === "weight") weightTexts.push("0");
    compositionTouched = true;
    sortElements();
    return true;
  }

  function handleMergeBanner() {
    if (!duplicateBanner) return;
    const { firstIndex, duplicateIndex } = duplicateBanner;
    const merged = mergeRows(formData.elements[firstIndex]!, formData.elements[duplicateIndex]!);
    formData.elements[firstIndex] = merged;
    if (mode === "weight") {
      const sum =
        (parseFloat(weightTexts[firstIndex]!) || 0) +
        (parseFloat(weightTexts[duplicateIndex]!) || 0);
      weightTexts[firstIndex] = String(sum);
    }
    formData.elements.splice(duplicateIndex, 1);
    elementTexts.splice(duplicateIndex, 1);
    weightTexts.splice(duplicateIndex, 1);
    sortElements();
    compositionTouched = true;
  }

  function handleRemoveDuplicateBanner() {
    if (!duplicateBanner) return;
    handleRemoveElement(duplicateBanner.duplicateIndex);
  }

  function handleMergePrompt() {
    if (!editDuplicatePrompt) return;
    const { index, existingIndex, newZ } = editDuplicatePrompt;

    const rowA = { ...formData.elements[existingIndex]! };
    const rowB = { ...formData.elements[index]!, atomicNumber: newZ };
    const merged = mergeRows(rowA, rowB);

    formData.elements[existingIndex] = merged;
    if (mode === "weight") {
      const sum =
        (parseFloat(weightTexts[existingIndex]!) || 0) + (parseFloat(weightTexts[index]!) || 0);
      weightTexts[existingIndex] = String(sum);
    }

    formData.elements.splice(index, 1);
    elementTexts.splice(index, 1);
    weightTexts.splice(index, 1);

    editDuplicatePrompt = null;
    sortElements();
    compositionTouched = true;
  }

  function applyPasteFormulaData(elements: ParsedElement[], replace: boolean) {
    if (replace) {
      formData.elements = [];
      elementTexts = [];
      if (mode === "weight") weightTexts = [];
    }
    for (const elem of elements) {
      const existing = formData.elements.find((e) => e.atomicNumber === elem.atomicNumber);
      if (existing) {
        existing.atomCount += elem.atomCount;
      } else {
        formData.elements.push({ atomicNumber: elem.atomicNumber, atomCount: elem.atomCount });
        elementTexts.push(getLocalSymbol(elem.atomicNumber));
        if (mode === "weight") weightTexts.push("0");
      }
    }
    sortElements();
    if (mode === "weight") {
      weightTexts = computeInitialWeightTexts(formData.elements);
    }
    compositionTouched = true;
    formulaToConfirm = null;
  }

  function handlePasteFormula(elements: ParsedElement[]) {
    if (isEmptyComposition) {
      applyPasteFormulaData(elements, true);
    } else {
      formulaToConfirm = elements;
    }
  }

  function applyPresetData(preset: CompoundPreset) {
    formData.name = preset.name;
    formData.density = String(preset.density);
    formData.iValue = preset.iValue ? String(preset.iValue) : "";
    formData.phase = preset.phase;

    const atomCounts = presetToAtomCounts(preset);
    formData.elements = atomCounts.map((e) => ({ ...e }));
    elementTexts = atomCounts.map((e) => getLocalSymbol(e.atomicNumber));

    if (preset.mode === "weight") {
      weightTexts = atomCounts.map((e) => {
        const orig = preset.elements.find((x) => x.atomicNumber === e.atomicNumber);
        return orig ? String(orig.value) : "0";
      });
      mode = "weight";
    } else {
      weightTexts = computeInitialWeightTexts(formData.elements);
      mode = "formula";
    }

    sortElements();
    compositionTouched = true;
    presetToConfirm = null;
  }

  function handleApplyPreset(preset: CompoundPreset) {
    if (isEmptyComposition) {
      applyPresetData(preset);
    } else {
      presetToConfirm = preset;
    }
  }

  function load({ open, compound, prefill = null, initialWarning = null }: CompoundEditorLoadArgs) {
    if (!open) return;
    warning = initialWarning;
    editingCompound = compound;

    if (compound) {
      formData.name = compound.name;
      formData.density = String(compound.density);
      formData.iValue = compound.iValue ? String(compound.iValue) : "";
      formData.phase = compound.phase;
      formData.elements = compound.elements.map((e) => ({ ...e }));
      elementTexts = compound.elements.map((e) => getLocalSymbol(e.atomicNumber));
      weightTexts = computeInitialWeightTexts(compound.elements);
      mode = "formula";
      resetTransientState();
      sortElements();
      compositionTouched = false;
    } else if (prefill) {
      // Create mode, pre-filled from a shared URL (Gap B / "Edit & save copy").
      // Numeric fields keep their raw text so an out-of-range value is shown for
      // the user to fix. compositionTouched stays true so the empty placeholder
      // composition isn't substituted.
      formData.name = prefill.name;
      formData.density = prefill.density;
      formData.iValue = prefill.iValue;
      formData.phase = prefill.phase;
      formData.elements = prefill.elements.map((e) => ({ ...e }));
      elementTexts = prefill.elements.map((e) => getLocalSymbol(e.atomicNumber));
      weightTexts = computeInitialWeightTexts(formData.elements);
      mode = "formula";
      resetTransientState();
      if (formData.elements.length > 0) sortElements();
      compositionTouched = true;
      // Recovery flow: the warning banner asks the user to fix flagged fields,
      // so reveal their validation errors right away (#767).
      saveAttempted = true;
    } else {
      formData = { ...INITIAL_DATA, elements: INITIAL_DATA.elements.map((e) => ({ ...e })) };
      elementTexts = ["Li", "F"];
      weightTexts = computeInitialWeightTexts(formData.elements);
      mode = "formula";
      resetTransientState();
      compositionTouched = false;
    }
  }

  return {
    get formData() {
      return formData;
    },
    get displayElements() {
      return displayElements;
    },
    get elementTexts() {
      return elementTexts;
    },
    get weightTexts() {
      return weightTexts;
    },
    get mode() {
      return mode;
    },
    get duplicateBanner() {
      return duplicateBanner;
    },
    get editDuplicatePrompt() {
      return editDuplicatePrompt;
    },
    get massPercents() {
      return massPercents;
    },
    get errors() {
      return errors;
    },
    get visibleErrors() {
      return visibleErrors;
    },
    get saveAttempted() {
      return saveAttempted;
    },
    get canSave() {
      return canSave;
    },
    get saveBlockReason() {
      return saveBlockReason;
    },
    get isEmptyComposition() {
      return isEmptyComposition;
    },
    get usedZ() {
      return usedZ;
    },
    get isEditing() {
      return !!editingCompound;
    },
    get presetToConfirm() {
      return presetToConfirm;
    },
    get formulaToConfirm() {
      return formulaToConfirm;
    },
    get urlFailedFields() {
      return urlFailedFields;
    },
    markTouched,
    getLocalSymbol,
    getLocalName,
    switchMode,
    handleSave,
    handleRescale,
    handleRemoveElement,
    handleAtomCountChange,
    applyElementSelection,
    handleMergeBanner,
    handleRemoveDuplicateBanner,
    handleMergePrompt,
    handlePasteFormula,
    handleApplyPreset,
    addElementBySymbol,
    setWeightText(index: number, value: string) {
      weightTexts[index] = value;
      compositionTouched = true;
    },
    cancelEditDuplicate() {
      editDuplicatePrompt = null;
    },
    isUrlAmber,
    fieldBorderClass,
    applyPresetData,
    applyPasteFormulaData,
    cancelPreset() {
      presetToConfirm = null;
    },
    cancelFormula() {
      formulaToConfirm = null;
    },
    load,
  };
}
