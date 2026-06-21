<script lang="ts">
  import { untrack } from "svelte";
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
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
  import { cn } from "$lib/utils.js";
  import { deriveMassPercents, rescaleTo100 } from "$lib/utils/compound-derive";
  import ElementPicker from "./element-picker.svelte";
  import FormulaFooter from "./compound-editor/formula-footer.svelte";
  import SumTracker from "./compound-editor/sum-tracker.svelte";
  import QuickStartPanel from "./compound-editor/quick-start-panel.svelte";
  import MobileSheet from "./compound-editor/mobile-sheet.svelte";
  import type { EditorController, CompoundEditorPrefill } from "./compound-editor/types";
  import { presetToAtomCounts, type CompoundPreset } from "$lib/data/compound-presets";
  import type { ParsedElement } from "$lib/utils/formula-parser";

  interface CompoundEditorFormData {
    name: string;
    density: string;
    iValue: string;
    phase: "gas" | "condensed";
    elements: CompoundElementEntry[];
  }

  interface SavedCompoundData {
    name: string;
    density: number;
    iValue?: number;
    phase: "gas" | "condensed";
    elements: CompoundElementEntry[];
  }

  interface Props {
    open: boolean;
    compound: StoredCompoundInternal | null;
    onOpenChange: (open: boolean) => void;
    onSave: (data: SavedCompoundData) => void;
    onDelete: () => void;
    /**
     * Seed values for *create* mode (used when `compound` is null) — the
     * "Edit & save copy" / failed-URL recovery flows pre-fill the form (#648).
     */
    prefill?: CompoundEditorPrefill | null;
    /**
     * Amber notice text shown at the top of the modal when a shared URL could
     * not be fully restored. Fields named in the text are highlighted (#648).
     */
    initialWarning?: string | null;
  }

  let {
    open,
    compound,
    onOpenChange,
    onSave,
    onDelete,
    prefill = null,
    initialWarning = null,
  }: Props = $props();

  // Which form fields a failed shared URL flagged, derived from the warning text
  // (see `parseCustomCompound` in url-shared.ts). A field stays highlighted only
  // while it is still invalid, so fixing it clears the amber outline (#648).
  let urlFailedFields = $derived.by(() => {
    const s = new Set<string>();
    const w = initialWarning ?? "";
    if (w.includes("mat_name")) s.add("name");
    if (w.includes("mat_density")) s.add("density");
    if (w.includes("mat_ival")) s.add("iValue");
    if (w.includes("mat_elements")) s.add("elements");
    return s;
  });
  function isUrlAmber(field: string): boolean {
    return urlFailedFields.has(field) && !!errors[field];
  }
  function fieldBorderClass(field: string): string {
    if (isUrlAmber(field)) return "border-amber-500 ring-1 ring-amber-400";
    return errors[field] ? "border-destructive" : "";
  }

  const initialData: CompoundEditorFormData = {
    name: "",
    density: "",
    iValue: "",
    phase: "condensed",
    elements: [
      { atomicNumber: 3, atomCount: 1 },
      { atomicNumber: 9, atomCount: 1 },
    ],
  };

  let formData = $state<CompoundEditorFormData>({ ...initialData });
  let elementTexts = $state<string[]>(["Li", "F"]);
  let weightTexts = $state<string[]>(["26.76", "73.24"]);
  let mode = $state<"formula" | "weight">("formula");
  let showDeleteConfirm = $state(false);
  let compositionTouched = $state(false);
  let presetToConfirm = $state<CompoundPreset | null>(null);
  let formulaToConfirm = $state<ParsedElement[] | null>(null);

  // Phone-only mobile layout: ≤ 640px AND a coarse pointer, matching the rest
  // of the entity-selection redesign. Guarded for jsdom (no matchMedia), where
  // it stays false so unit tests exercise the desktop layout.
  let isMobile = $state(false);
  let prefersReducedMotion = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px) and (pointer: coarse)");
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (prefersReducedMotion = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  let isEmptyComposition = $derived(
    formData.elements.length === 0 || (!compositionTouched && !compound),
  );

  // Picker and UI states
  let pickerMode = $state<"ADD" | "EDIT" | null>(null);
  let pickerEditIndex = $state<number | null>(null);
  let confirmRemoveIndex = $state<number | null>(null);
  let editDuplicatePrompt = $state<{ index: number; newZ: number; existingIndex: number } | null>(
    null,
  );

  let duplicateBanner = $derived.by(() => {
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

  let usedZ = $derived.by(() => new Set(formData.elements.map((e) => e.atomicNumber)));

  // Live per-row mass percentages (formula mode only), aligned by row index.
  let massPercents = $derived(mode === "formula" ? deriveMassPercents(formData.elements) : null);

  let displayElements = $derived.by(() => {
    if (mode === "formula") return formData.elements;

    const wfs = weightTexts.map((t, i) => ({
      atomicNumber: formData.elements[i]?.atomicNumber ?? 1,
      weightFraction: (parseFloat(t) || 0) / 100,
    }));
    return computeAtomCounts(wfs) || formData.elements;
  });

  // Pure validation: a function of the form state only, so the Save gating and
  // inline messages stay in sync without any imperative writes.
  let errors = $derived.by(() => {
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

  // A duplicate element is surfaced by `duplicateBanner` / the edit prompt and
  // hard-blocks Save in addition to the field errors above.
  let canSave = $derived(
    Object.keys(errors).length === 0 && !duplicateBanner && !editDuplicatePrompt,
  );

  let saveBlockReason = $derived.by(() => {
    if (duplicateBanner) return "Two rows share the same element — merge them first.";
    if (editDuplicatePrompt) return "Resolve the duplicate-element prompt first.";
    return errors.name ?? errors.density ?? errors.iValue ?? errors.elements ?? null;
  });

  $effect(() => {
    const isOpen = open;
    const c = compound;
    const pf = prefill;
    untrack(() => {
      if (isOpen && c) {
        formData.name = c.name;
        formData.density = String(c.density);
        formData.iValue = c.iValue ? String(c.iValue) : "";
        formData.phase = c.phase;
        formData.elements = c.elements.map((e) => ({ ...e }));
        elementTexts = c.elements.map((e) => getLocalSymbol(e.atomicNumber));
        weightTexts = computeInitialWeightTexts(c.elements);
        mode = "formula";
        resetTransientState();
        sortElements();
        compositionTouched = false;
      } else if (isOpen && pf) {
        // Create mode, but pre-filled from a shared URL (Gap B / "Edit & save
        // copy"). Numeric fields keep their raw text so an out-of-range value is
        // shown for the user to fix. compositionTouched stays true so the empty
        // placeholder composition isn't substituted.
        formData.name = pf.name;
        formData.density = pf.density;
        formData.iValue = pf.iValue;
        formData.phase = pf.phase;
        formData.elements = pf.elements.map((e) => ({ ...e }));
        elementTexts = pf.elements.map((e) => getLocalSymbol(e.atomicNumber));
        weightTexts = computeInitialWeightTexts(formData.elements);
        mode = "formula";
        resetTransientState();
        if (formData.elements.length > 0) sortElements();
        compositionTouched = true;
      } else if (isOpen && !c) {
        formData = { ...initialData, elements: initialData.elements.map((e) => ({ ...e })) };
        elementTexts = ["Li", "F"];
        weightTexts = computeInitialWeightTexts(formData.elements);
        mode = "formula";
        resetTransientState();
        compositionTouched = false;
      }
    });
  });

  function resetTransientState() {
    pickerMode = null;
    pickerEditIndex = null;
    confirmRemoveIndex = null;
    editDuplicatePrompt = null;
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
    if (!canSave) return;

    let elements = formData.elements;
    if (mode === "weight") {
      const converted = convertWeightFractionsToAtomCounts();
      if (converted) elements = converted;
    }

    onSave({
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
      confirmRemoveIndex = null;
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

  function handlePickerSelect(z: number) {
    applyElementSelection(z, pickerMode ?? "ADD", pickerEditIndex);
    pickerMode = null;
    pickerEditIndex = null;
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
    const { duplicateIndex } = duplicateBanner;
    handleRemoveElement(duplicateIndex);
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
    if (formData.elements.length === 0 || (!compositionTouched && !compound)) {
      applyPresetData(preset);
    } else {
      presetToConfirm = preset;
    }
  }

  // Single reactive surface handed to the mobile sub-components. Getters track
  // the runes above so children stay in sync; methods mutate the same state, so
  // step transitions never clear inputs.
  const editor: EditorController = {
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
      return !!compound;
    },
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
  };

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (confirmRemoveIndex !== null) {
        confirmRemoveIndex = null;
        e.stopPropagation();
      }
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

{#if isMobile && open}
  <!-- Wrap the full-screen mobile sheet in the same bits-ui Dialog primitive the
       desktop path uses, so it gets a focus trap, aria-modal semantics,
       background scroll-lock + inert, and Escape-to-close. -->
  <Dialog.Root {open} onOpenChange={(newOpen) => onOpenChange(newOpen)}>
    <Dialog.Portal>
      <Dialog.Content class="fixed inset-0 z-[60] outline-none">
        <Dialog.Title class="sr-only">
          {compound ? "Edit Compound" : "Compound Editor"}
        </Dialog.Title>
        <Dialog.Description class="sr-only">
          {compound ? "Update compound properties" : "Define a new compound material"}
        </Dialog.Description>
        <MobileSheet {editor} {prefersReducedMotion} onCancel={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{:else}
  <Dialog.Root
    {open}
    onOpenChange={(newOpen) => {
      if (!newOpen && showDeleteConfirm) {
        showDeleteConfirm = false;
      }
      onOpenChange(newOpen);
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay
        class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <Dialog.Content
        class="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-[500px] md:max-w-[650px] max-h-[95dvh] overflow-y-auto"
      >
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <Dialog.Title class="text-lg font-semibold">
            {#if showDeleteConfirm}Delete Compound{:else}{compound
                ? "Edit Compound"
                : "Compound Editor"}{/if}
          </Dialog.Title>
          {#if showDeleteConfirm}
            <p class="mt-1 text-sm text-muted-foreground">
              Are you sure you want to delete "{compound?.name}"? This action cannot be undone.
            </p>
          {:else}
            <Dialog.Description class="sr-only">
              {compound ? "Update compound properties" : "Define a new compound material"}
            </Dialog.Description>
          {/if}

          {#if !showDeleteConfirm}
            {#if initialWarning}
              <div
                class="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900"
                data-testid="compound-editor-url-warning"
                role="status"
                aria-live="polite"
              >
                <p class="text-sm">
                  Some URL parameters couldn't be restored:
                  <code class="font-mono">{initialWarning}</code>.
                </p>
                <p class="text-xs mt-1">
                  Fix the highlighted fields and Save to keep this compound.
                </p>
              </div>
            {/if}
            <div class="mt-4 grid gap-4">
              <!-- Properties row 1 -->
              <div class="flex items-center gap-4">
                <Label for="compound-name" class="font-medium w-12">Name</Label>
                <div class="flex-1 max-w-[20rem]">
                  <Input
                    id="compound-name"
                    bind:value={formData.name}
                    placeholder="e.g., LiF Pellet"
                    class={cn(fieldBorderClass("name"))}
                    data-url-failed={isUrlAmber("name") ? "name" : undefined}
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                  />
                  {#if errors.name}
                    <p class="text-sm text-destructive mt-1">{errors.name}</p>
                  {/if}
                </div>
              </div>

              <div class="grid grid-cols-1 md:flex items-start gap-4">
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <Label for="compound-density" class="whitespace-nowrap">Density (g/cm³)</Label>
                    <Input
                      id="compound-density"
                      type="number"
                      step="0.01"
                      min="0"
                      max="25"
                      bind:value={formData.density}
                      class={cn("w-24 hide-spin-button", fieldBorderClass("density"))}
                      data-url-failed={isUrlAmber("density") ? "density" : undefined}
                    />
                  </div>
                  {#if errors.density}
                    <p class="text-sm text-destructive">{errors.density}</p>
                  {/if}
                </div>

                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <Label for="compound-ivalue" class="whitespace-nowrap"
                      >I-value (eV, optional)</Label
                    >
                    <Input
                      id="compound-ivalue"
                      type="number"
                      step="1"
                      min="0"
                      max="10000"
                      bind:value={formData.iValue}
                      class={cn("w-24 hide-spin-button", fieldBorderClass("iValue"))}
                      data-url-failed={isUrlAmber("iValue") ? "iValue" : undefined}
                    />
                  </div>
                  {#if errors.iValue}
                    <p class="text-sm text-destructive">{errors.iValue}</p>
                  {/if}
                </div>

                <div class="flex flex-col gap-2 md:ml-auto">
                  <div class="flex items-center gap-4 h-[40px]">
                    <Label class="whitespace-nowrap">Phase</Label>
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        name="phase"
                        value="condensed"
                        checked={formData.phase === "condensed"}
                        onchange={() => (formData.phase = "condensed")}
                      />
                      <span class="text-sm">Condensed</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <input
                        type="radio"
                        name="phase"
                        value="gas"
                        checked={formData.phase === "gas"}
                        onchange={() => (formData.phase = "gas")}
                      />
                      <span class="text-sm">Gas</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="grid gap-2">
                <QuickStartPanel
                  isEmpty={isEmptyComposition}
                  onPasteFormula={handlePasteFormula}
                  onApplyPreset={handleApplyPreset}
                />
                <div class="flex items-center justify-between">
                  <Label>Elements</Label>
                  <div role="tablist" class="flex gap-2">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "formula"}
                      aria-controls="elements-panel"
                      id="formula-tab"
                      aria-label="Formula mode"
                      class={cn(
                        "text-xs font-medium transition-colors hover:text-foreground",
                        mode === "formula" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onclick={() => switchMode("formula")}
                    >
                      Formula
                    </button>
                    <span class="text-muted-foreground">|</span>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "weight"}
                      aria-controls="elements-panel"
                      id="weight-tab"
                      aria-label="Weight fraction mode"
                      class={cn(
                        "text-xs font-medium transition-colors hover:text-foreground",
                        mode === "weight" ? "text-foreground" : "text-muted-foreground",
                      )}
                      onclick={() => switchMode("weight")}
                    >
                      Weight fraction
                    </button>
                  </div>
                </div>

                {#if errors.elements}
                  <p
                    class={cn(
                      "text-sm",
                      isUrlAmber("elements") ? "text-amber-700" : "text-destructive",
                    )}
                    data-url-failed={isUrlAmber("elements") ? "elements" : undefined}
                  >
                    {errors.elements}
                  </p>
                {/if}

                <div
                  class="grid gap-2"
                  id="elements-panel"
                  role="tabpanel"
                  aria-labelledby={mode === "formula" ? "formula-tab" : "weight-tab"}
                >
                  <!-- Duplicate Banner -->
                  {#if duplicateBanner}
                    {@const dupElName = getLocalName(duplicateBanner.z)}
                    <div class="mb-2 rounded-md border border-destructive bg-destructive/10 p-3">
                      <p class="text-sm font-medium text-destructive">
                        {dupElName} (Z={duplicateBanner.z}) appears twice.
                      </p>
                      <p class="text-xs text-destructive mb-3">
                        libdedx requires one row per element. URL-shared and pasted-formula inputs
                        are de-duplicated automatically.
                      </p>
                      <div class="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onclick={handleMergeBanner}
                          data-testid="compound-editor-dup-merge"
                        >
                          Merge into one
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onclick={handleRemoveDuplicateBanner}
                          data-testid="compound-editor-dup-remove"
                        >
                          Remove duplicate
                        </Button>
                      </div>
                    </div>
                  {/if}

                  {#each formData.elements as element, index (index)}
                    {@const isDuplicate =
                      duplicateBanner &&
                      (index === duplicateBanner.firstIndex ||
                        index === duplicateBanner.duplicateIndex)}

                    <div class="relative">
                      {#if editDuplicatePrompt && editDuplicatePrompt.index === index}
                        <div class="mb-2 rounded-md border border-orange-400 bg-orange-50 p-3">
                          <p class="text-sm font-medium text-orange-900">
                            {getLocalName(editDuplicatePrompt.newZ)} (Z={editDuplicatePrompt.newZ})
                            is already in this compound.
                          </p>
                          <p class="text-xs text-orange-800 mb-3">
                            Changing {elementTexts[index]} → {getLocalSymbol(
                              editDuplicatePrompt.newZ,
                            )} would create a duplicate row. Pick what to do:
                          </p>
                          <div class="flex gap-2">
                            <Button
                              size="sm"
                              class="bg-orange-500 hover:bg-orange-600 text-white"
                              onclick={handleMergePrompt}
                              autofocus
                            >
                              Merge into existing {getLocalSymbol(editDuplicatePrompt.newZ)}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              class="border-orange-200 text-orange-900 hover:bg-orange-100"
                              onclick={() => (editDuplicatePrompt = null)}
                            >
                              Cancel — keep this row as {elementTexts[index]}
                            </Button>
                          </div>
                        </div>
                      {/if}

                      <div
                        class={cn(
                          "flex items-center gap-2 rounded-md p-1",
                          isDuplicate && "border border-destructive bg-destructive/10",
                        )}
                      >
                        <button
                          type="button"
                          class="flex h-10 w-12 flex-col items-center justify-center rounded-sm border bg-card p-0 transition-colors hover:bg-accent"
                          onclick={() => {
                            pickerMode = "EDIT";
                            pickerEditIndex = index;
                          }}
                          title="Click to change element"
                          data-testid={`picker-element-tile-${element.atomicNumber}`}
                        >
                          <span class="text-[10px] text-muted-foreground leading-none"
                            >Z={element.atomicNumber}</span
                          >
                          <div class="flex items-center gap-1">
                            <span class="font-mono font-bold leading-none"
                              >{getLocalSymbol(element.atomicNumber)}</span
                            >
                            <span class="text-[10px] text-muted-foreground">✎</span>
                          </div>
                        </button>

                        {#if mode === "formula"}
                          <Input
                            type="number"
                            min="1"
                            max="1000"
                            step="1"
                            placeholder="Count"
                            value={String(element.atomCount)}
                            oninput={(e) =>
                              handleAtomCountChange(
                                index,
                                (e.currentTarget as HTMLInputElement).value,
                              )}
                            class="w-24 sm:w-32"
                            aria-label={`Atom count for element ${index + 1}`}
                          />
                          <span
                            class="w-24 shrink-0 text-xs text-muted-foreground tabular-nums"
                            data-testid={`compound-mass-percent-${index}`}
                          >
                            {#if massPercents && massPercents[index] !== undefined}
                              {massPercents[index]!.toFixed(1)}% by mass
                            {/if}
                          </span>
                        {:else}
                          <div class="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0.01"
                              max="100"
                              step="0.01"
                              placeholder="Weight %"
                              bind:value={weightTexts[index]}
                              oninput={() => (compositionTouched = true)}
                              class="w-32 sm:w-48 text-right hide-spin-button"
                              aria-label={`Weight fraction % for element ${index + 1}`}
                            />
                            <span class="text-xs text-muted-foreground w-4">%</span>
                          </div>
                        {/if}

                        <button
                          type="button"
                          class="flex items-center gap-1 h-[30px] px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded transition-colors whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          onclick={() => {
                            confirmRemoveIndex = index;
                          }}
                          aria-label={`Remove ${getLocalName(element.atomicNumber)}`}
                          disabled={formData.elements.length === 1}
                          data-testid="picker-element-row-remove"
                        >
                          <span class="text-base leading-none">🗑</span>
                          <span>Remove</span>
                        </button>
                      </div>

                      <!-- Inline remove confirm -->
                      {#if confirmRemoveIndex === index}
                        <div
                          class="absolute inset-0 z-10 flex items-center justify-between rounded-md border border-destructive bg-background p-1 pl-3 shadow-sm"
                        >
                          <span class="text-sm">Remove {getLocalName(element.atomicNumber)}?</span>
                          <div class="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onclick={() => (confirmRemoveIndex = null)}>Cancel</Button
                            >
                            <Button
                              size="sm"
                              variant="destructive"
                              autofocus
                              onclick={() => handleRemoveElement(index)}>Yes, remove</Button
                            >
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>

                <FormulaFooter elements={displayElements} iValueOverride={formData.iValue} />
                {#if mode === "weight"}
                  <SumTracker
                    values={weightTexts.map((t) => parseFloat(t) || 0)}
                    symbols={formData.elements.map((el) => getLocalSymbol(el.atomicNumber))}
                    onRescale={handleRescale}
                  />
                  <p class="text-xs text-muted-foreground">
                    Fractions must total 100%. Values are stored as atomic ratios (w/M).
                  </p>
                {/if}

                <!-- Add and Picker Buttons -->
                <div class="flex flex-wrap items-center gap-4 mt-2">
                  <Input
                    type="text"
                    placeholder="Type symbol or element..."
                    class="w-32 sm:w-48 h-8 text-sm"
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = e.currentTarget;
                        const text = target.value.trim();
                        if (text) {
                          const resolved = resolveElement(text);
                          if (resolved) {
                            formData.elements.push({
                              atomicNumber: resolved.atomicNumber,
                              atomCount: 1,
                            });
                            elementTexts.push(getLocalSymbol(resolved.atomicNumber));
                            if (mode === "weight") weightTexts.push("0");
                            sortElements();
                            target.value = "";
                          }
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    class="text-sm font-medium text-muted-foreground hover:text-primary hover:underline whitespace-nowrap"
                    onclick={() => (pickerMode = "ADD")}
                  >
                    ⊞ Pick from periodic table
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-between">
              {#if compound}
                <Button
                  type="button"
                  variant="destructive"
                  onclick={() => (showDeleteConfirm = true)}
                >
                  Delete
                </Button>
              {:else}
                <div></div>
              {/if}
              <div class="flex gap-2">
                <Button type="button" variant="outline" onclick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onclick={handleSave}
                  disabled={!canSave}
                  aria-disabled={!canSave}
                  title={canSave ? undefined : (saveBlockReason ?? undefined)}
                >
                  Save
                </Button>
              </div>
            </div>
          {:else}
            <div class="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onclick={() => (showDeleteConfirm = false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onclick={() => {
                  onDelete();
                  showDeleteConfirm = false;
                }}
              >
                Delete
              </Button>
            </div>
          {/if}
        </form>

        <Dialog.Close
          class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

<Dialog.Root
  open={!!pickerMode}
  onOpenChange={(v) => {
    if (!v) {
      pickerMode = null;
      pickerEditIndex = null;
    }
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-[60] bg-black/80" />
    <Dialog.Content
      class="fixed left-[50%] top-[50%] z-[60] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-0 shadow-lg sm:max-w-[800px] overflow-hidden"
    >
      <div class="px-6 py-4 border-b flex justify-between items-center bg-muted/30">
        <Dialog.Title class="text-lg font-semibold">
          {pickerMode === "ADD" ? "Add an element" : "Change element"}
        </Dialog.Title>
        <Dialog.Close
          class="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <span class="sr-only">Close</span>
          <span aria-hidden="true" class="text-xl">×</span>
        </Dialog.Close>
      </div>
      <div class="p-6 bg-muted/10 overflow-y-auto max-h-[80vh]">
        <ElementPicker
          mode={pickerMode || "ADD"}
          {usedZ}
          currentZ={pickerMode === "EDIT" && pickerEditIndex !== null
            ? (formData.elements[pickerEditIndex]?.atomicNumber ?? null)
            : null}
          onSelect={handlePickerSelect}
        />
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

{#if presetToConfirm}
  <Dialog.Root
    open={!!presetToConfirm}
    onOpenChange={(o) => {
      if (!o) presetToConfirm = null;
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay class="fixed inset-0 z-[60] bg-black/80" />
      <Dialog.Content
        class="fixed left-[50%] top-[50%] z-[60] w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg"
      >
        <Dialog.Title class="text-lg font-semibold">Replace Composition</Dialog.Title>
        <p class="mt-2 text-sm text-muted-foreground">
          Replace your current composition with {presetToConfirm.name}?
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" onclick={() => (presetToConfirm = null)} autofocus>
            Cancel
          </Button>
          <Button variant="default" onclick={() => applyPresetData(presetToConfirm!)}>
            Replace
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if formulaToConfirm}
  <Dialog.Root
    open={!!formulaToConfirm}
    onOpenChange={(o) => {
      if (!o) formulaToConfirm = null;
    }}
  >
    <Dialog.Portal>
      <Dialog.Overlay class="fixed inset-0 z-[60] bg-black/80" />
      <Dialog.Content
        class="fixed left-[50%] top-[50%] z-[60] w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg"
      >
        <Dialog.Title class="text-lg font-semibold">Paste Formula</Dialog.Title>
        <p class="mt-2 text-sm text-muted-foreground">
          Do you want to replace your current composition with the pasted formula, or append to it?
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" onclick={() => (formulaToConfirm = null)}>Cancel</Button>
          <Button
            variant="secondary"
            onclick={() => applyPasteFormulaData(formulaToConfirm!, false)}
          >
            Append
          </Button>
          <Button
            variant="default"
            onclick={() => applyPasteFormulaData(formulaToConfirm!, true)}
            autofocus
          >
            Replace
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

<style>
  :global(.hide-spin-button::-webkit-inner-spin-button),
  :global(.hide-spin-button::-webkit-outer-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
  :global(.hide-spin-button) {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
