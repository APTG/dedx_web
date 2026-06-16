import type { CompoundElementEntry } from "$lib/state/custom-compounds.svelte";
import type { ParsedElement } from "$lib/utils/formula-parser";
import type { CompoundPreset } from "$lib/data/compound-presets";

export interface CompoundFormData {
  name: string;
  density: string;
  iValue: string;
  phase: "gas" | "condensed";
  elements: CompoundElementEntry[];
}

/**
 * Seed values for opening the editor pre-filled in *create* mode (no `compound`
 * id). Used by the "Edit & save copy" flow and the failed-URL recovery flow
 * (issue #648). Numeric fields are raw strings so an out-of-range value from a
 * shared URL (e.g. density `"99"`) is shown verbatim for the user to correct.
 */
export interface CompoundEditorPrefill {
  name: string;
  density: string;
  iValue: string;
  phase: "gas" | "condensed";
  elements: CompoundElementEntry[];
}

export interface DuplicateBanner {
  z: number;
  firstIndex: number;
  duplicateIndex: number;
}

export interface EditDuplicatePrompt {
  index: number;
  newZ: number;
  existingIndex: number;
}

/**
 * Imperative + reactive surface the compound editor exposes to its mobile
 * sub-components. All form state lives in `compound-editor-modal.svelte`; the
 * mobile sheet, picker overlay, and action sheet read it through the getters
 * (which track the parent's runes) and mutate it through the methods. This
 * keeps step transitions non-destructive — switching screens never touches the
 * underlying state.
 */
export interface EditorController {
  readonly formData: CompoundFormData;
  /**
   * Element rows to render in the formula footer. In weight mode these are the
   * atom counts derived from the weight percentages; in formula mode they are
   * `formData.elements` directly. Derived once by the parent so desktop and
   * mobile views never disagree.
   */
  readonly displayElements: CompoundElementEntry[];
  readonly elementTexts: string[];
  readonly weightTexts: string[];
  readonly mode: "formula" | "weight";
  readonly duplicateBanner: DuplicateBanner | null;
  readonly editDuplicatePrompt: EditDuplicatePrompt | null;
  readonly massPercents: number[] | null;
  readonly errors: Record<string, string>;
  readonly canSave: boolean;
  readonly saveBlockReason: string | null;
  readonly isEmptyComposition: boolean;
  readonly usedZ: Set<number>;
  readonly isEditing: boolean;

  getLocalSymbol(z: number): string;
  getLocalName(z: number): string;
  switchMode(mode: "formula" | "weight"): void;
  handleSave(): void;
  handleRescale(): void;
  handleRemoveElement(index: number): void;
  handleAtomCountChange(index: number, count: string): void;
  applyElementSelection(z: number, mode: "ADD" | "EDIT", index: number | null): void;
  handleMergeBanner(): void;
  handleRemoveDuplicateBanner(): void;
  handleMergePrompt(): void;
  handlePasteFormula(elements: ParsedElement[]): void;
  handleApplyPreset(preset: CompoundPreset): void;
  addElementBySymbol(text: string): boolean;
  setWeightText(index: number, value: string): void;
  cancelEditDuplicate(): void;
}
