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
  import ElementPicker from "./element-picker.svelte";
  import FormulaFooter from "./formula-footer.svelte";
  import SumTracker from "./sum-tracker.svelte";

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
  }

  let { open, compound, onOpenChange, onSave, onDelete }: Props = $props();

  const initialData: CompoundEditorFormData = {
    name: "",
    density: "",
    iValue: "",
    phase: "condensed",
    elements: [{ atomicNumber: 1, atomCount: 1 }],
  };

  let formData = $state<CompoundEditorFormData>({ ...initialData });
  let elementTexts = $state<string[]>(["H"]);
  let weightTexts = $state<string[]>(["100"]);
  let mode = $state<"formula" | "weight">("formula");
  let showDeleteConfirm = $state(false);

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

  let massFractions = $derived(computeWeightFractions(formData.elements));

  let errors = $derived.by(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required.";
    } else if (formData.name.trim().length > 80) {
      newErrors.name = "Name must be 80 characters or fewer.";
    }

    const density = parseFloat(formData.density);
    if (!formData.density || isNaN(density)) {
      newErrors.density = "Density is required.";
    } else if (density <= 0) {
      newErrors.density = "Density must be greater than zero.";
    } else if (density > 25) {
      newErrors.density = "Density must be ≤ 25 g/cm³.";
    }

    if (formData.iValue) {
      const iVal = parseFloat(formData.iValue);
      if (isNaN(iVal) || iVal <= 0) {
        newErrors.iValue = "I-value must be a positive number.";
      } else if (iVal > 10000) {
        newErrors.iValue = "I-value must be ≤ 10 000 eV.";
      }
    }

    if (mode === "weight") {
      const sum = weightTexts.reduce((s, t) => s + (parseFloat(t) || 0), 0);
      if (weightTexts.some((t) => isNaN(parseFloat(t)) || parseFloat(t) <= 0)) {
        newErrors.elements = "All weight fractions must be positive numbers.";
      } else if (Math.abs(sum - 100) > 0.1) {
        newErrors.elements = `Weight fractions must sum to 100% (current: ${sum.toFixed(2)}%).`;
      } else if (!formData.elements || formData.elements.length === 0) {
        newErrors.elements = "At least one element is required.";
      }
    } else {
      if (!formData.elements || formData.elements.length === 0) {
        newErrors.elements = "At least one element is required.";
      } else {
        const seenZ = new Set<number>();
        for (const elem of formData.elements) {
          if (elem.atomicNumber < 1 || elem.atomicNumber > 118) {
            newErrors.elements = `Unknown element: Z=${elem.atomicNumber}.`;
            break;
          }
          if (seenZ.has(elem.atomicNumber)) {
            newErrors.elements = `Element Z=${elem.atomicNumber} is listed more than once. Combine into a single row.`;
            break;
          }
          seenZ.add(elem.atomicNumber);
          if (elem.atomCount <= 0) {
            newErrors.elements = "Atom count must be greater than zero.";
            break;
          } else if (elem.atomCount > 1000) {
            newErrors.elements = "Atom count must be ≤ 1000.";
            break;
          }
        }
      }
    }

    return newErrors;
  });

  let isFormValid = $derived(Object.keys(errors).length === 0);

  $effect(() => {
    const isOpen = open;
    const c = compound;
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
      } else if (isOpen && !c) {
        formData = { ...initialData };
        elementTexts = ["H"];
        weightTexts = ["100"];
        mode = "formula";
        resetTransientState();
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

  function handleRescale() {
    const sum = weightTexts.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    if (sum > 0) {
      let currentSum = 0;
      const newTexts = weightTexts.map((val, i) => {
        if (i === weightTexts.length - 1) return "0.00"; // placeholder for the last element
        const v = parseFloat(val) || 0;
        const fraction = parseFloat(((v / sum) * 100).toFixed(2));
        currentSum += fraction;
        return fraction.toFixed(2);
      });
      if (weightTexts.length > 0) {
        const remaining = Math.max(0, 100 - currentSum);
        newTexts[newTexts.length - 1] = remaining.toFixed(2);
      }
      weightTexts = newTexts;
    }
  }

  function handleSave() {
    let elementsToSave = formData.elements;

    if (mode === "weight") {
      const converted = convertWeightFractionsToAtomCounts();
      if (converted) {
        elementsToSave = converted;
      }
    }

    const savedElements = formData.elements;
    formData.elements = elementsToSave;

    if (isFormValid && !duplicateBanner && !editDuplicatePrompt) {
      const data: SavedCompoundData = {
        name: formData.name,
        density: parseFloat(formData.density),
        ...(formData.iValue ? { iValue: parseFloat(formData.iValue) } : {}),
        phase: formData.phase,
        elements: formData.elements,
      };
      onSave(data);
    } else {
      formData.elements = savedElements;
    }
  }

  function handleRemoveElement(index: number) {
    if (formData.elements.length > 1) {
      formData.elements.splice(index, 1);
      elementTexts.splice(index, 1);
      weightTexts.splice(index, 1);
      confirmRemoveIndex = null;
      editDuplicatePrompt = null;
    }
  }

  function handleAtomCountChange(index: number, count: string) {
    const num = parseFloat(count);
    const element = formData.elements[index];
    if (!isNaN(num) && num > 0 && element) {
      element.atomCount = num;
    }
  }

  function handlePickerSelect(z: number) {
    if (pickerMode === "ADD") {
      formData.elements.push({ atomicNumber: z, atomCount: 1 });
      elementTexts.push(getLocalSymbol(z));
      if (mode === "weight") weightTexts.push("0");
      pickerMode = null;
      sortElements();
    } else if (pickerMode === "EDIT" && pickerEditIndex !== null) {
      const existingIndex = formData.elements.findIndex(
        (e, i) => i !== pickerEditIndex && e.atomicNumber === z,
      );
      if (existingIndex !== -1) {
        editDuplicatePrompt = { index: pickerEditIndex, newZ: z, existingIndex };
      } else {
        const element = formData.elements[pickerEditIndex];
        if (element) {
          element.atomicNumber = z;
          elementTexts[pickerEditIndex] = getLocalSymbol(z);
          sortElements();
        }
      }
      pickerMode = null;
      pickerEditIndex = null;
    }
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
  }

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
          <div class="mt-4 grid gap-4">
            <!-- Properties row 1 -->
            <div class="flex items-center gap-4">
              <Label for="compound-name" class="font-medium w-12">Name</Label>
              <div class="flex-1 max-w-[20rem]">
                <Input
                  id="compound-name"
                  bind:value={formData.name}
                  placeholder="e.g., LiF Pellet"
                  class={cn(errors.name && "border-destructive")}
                  onkeydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                />
                {#if errors.name}
                  <p class="text-sm text-destructive mt-1 absolute">{errors.name}</p>
                {/if}
              </div>
            </div>

            <div class="grid grid-cols-1 md:flex md:items-center gap-4 items-start">
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
                    class={cn("w-24 hide-spin-button", errors.density && "border-destructive")}
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
                    class={cn("w-24 hide-spin-button", errors.iValue && "border-destructive")}
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
                <p class="text-sm text-destructive">{errors.elements}</p>
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
                      libdedx requires one row per element. URL-shared and pasted-formula inputs are
                      de-duplicated automatically.
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
                          {getLocalName(editDuplicatePrompt.newZ)} (Z={editDuplicatePrompt.newZ}) is
                          already in this compound.
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
                        <div class="flex items-center gap-2">
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
                          <div class="w-16 text-right text-xs text-muted-foreground">
                            {((massFractions?.[index]?.weightFraction || 0) * 100).toFixed(2)}%
                          </div>
                        </div>
                      {:else}
                        <div class="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            placeholder="Weight %"
                            bind:value={weightTexts[index]}
                            class="w-32 sm:w-48 text-right hide-spin-button"
                            aria-label={`Weight fraction % for element ${index + 1}`}
                          />
                          <span class="text-xs text-muted-foreground w-4">%</span>
                        </div>
                      {/if}

                      <button
                        type="button"
                        class="flex items-center gap-1 h-[30px] px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded transition-colors whitespace-nowrap"
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

              {#if mode === "weight"}
                <p class="text-xs text-muted-foreground">
                  Fractions must total 100%. Values are stored as atomic ratios (w/M).
                </p>
                <SumTracker {weightTexts} elementSymbols={elementTexts} onRescale={handleRescale} />
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

              <!-- Footers / Summaries -->
              {#if mode === "formula"}
                <FormulaFooter elements={formData.elements} iValueOverride={formData.iValue} />
              {:else}
                <SumTracker {weightTexts} elementSymbols={elementTexts} onRescale={handleRescale} />
              {/if}
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
                disabled={!isFormValid || !!duplicateBanner || !!editDuplicatePrompt}
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
