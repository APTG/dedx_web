<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { cn } from "$lib/utils.js";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Pencil from "@lucide/svelte/icons/pencil";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import HelpHint from "$lib/components/help-hint.svelte";
  import ElementPicker from "../element-picker.svelte";
  import FormulaFooter from "./formula-footer.svelte";
  import SumTracker from "./sum-tracker.svelte";
  import QuickStartPanel from "./quick-start-panel.svelte";
  import type { CompoundEditorState } from "$lib/state/compound-editor.svelte";
  import type { StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";

  interface Props {
    editor: CompoundEditorState;
    compound: StoredCompoundInternal | null;
    initialWarning?: string | null;
    onCancel: () => void;
    onDelete: () => void;
  }

  let { editor, compound, initialWarning = null, onCancel, onDelete }: Props = $props();

  let showDeleteConfirm = $state(false);
  let pickerMode = $state<"ADD" | "EDIT" | null>(null);
  let pickerEditIndex = $state<number | null>(null);
  let confirmRemoveIndex = $state<number | null>(null);

  function handlePickerSelect(z: number) {
    editor.applyElementSelection(z, pickerMode ?? "ADD", pickerEditIndex);
    pickerMode = null;
    pickerEditIndex = null;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && confirmRemoveIndex !== null) {
      confirmRemoveIndex = null;
      e.stopPropagation();
    }
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<form
  onsubmit={(e) => {
    e.preventDefault();
    editor.handleSave();
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
        <p class="text-xs mt-1">Fix the highlighted fields and Save to keep this compound.</p>
      </div>
    {/if}
    <div class="mt-4 grid gap-4">
      <!-- Properties row 1 -->
      <div class="flex items-center gap-4">
        <Label for="compound-name" class="font-medium w-12">Name</Label>
        <div class="flex-1 max-w-[20rem]">
          <Input
            id="compound-name"
            bind:value={editor.formData.name}
            placeholder="e.g., LiF Pellet"
            class={cn(editor.fieldBorderClass("name"))}
            data-url-failed={editor.isUrlAmber("name") ? "name" : undefined}
            aria-invalid={editor.visibleErrors.name ? "true" : undefined}
            aria-describedby={editor.visibleErrors.name ? "compound-name-error" : undefined}
            onblur={() => editor.markTouched("name")}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
          />
          {#if editor.visibleErrors.name}
            <p id="compound-name-error" class="text-sm text-destructive mt-1">
              {editor.visibleErrors.name}
            </p>
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
              bind:value={editor.formData.density}
              class={cn("w-24 hide-spin-button", editor.fieldBorderClass("density"))}
              data-url-failed={editor.isUrlAmber("density") ? "density" : undefined}
              aria-invalid={editor.visibleErrors.density ? "true" : undefined}
              aria-describedby={editor.visibleErrors.density ? "compound-density-error" : undefined}
              onblur={() => editor.markTouched("density")}
            />
          </div>
          {#if editor.visibleErrors.density}
            <p id="compound-density-error" class="text-sm text-destructive">
              {editor.visibleErrors.density}
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Label for="compound-ivalue" class="whitespace-nowrap">I-value (eV, optional)</Label>
            <HelpHint term="compoundIValue" side="top" testId="compound-ivalue-help" />
            <Input
              id="compound-ivalue"
              type="number"
              step="1"
              min="0"
              max="10000"
              bind:value={editor.formData.iValue}
              class={cn("w-24 hide-spin-button", editor.fieldBorderClass("iValue"))}
              data-url-failed={editor.isUrlAmber("iValue") ? "iValue" : undefined}
              aria-invalid={editor.visibleErrors.iValue ? "true" : undefined}
              aria-describedby={editor.visibleErrors.iValue ? "compound-ivalue-error" : undefined}
              onblur={() => editor.markTouched("iValue")}
            />
          </div>
          {#if editor.visibleErrors.iValue}
            <p id="compound-ivalue-error" class="text-sm text-destructive">
              {editor.visibleErrors.iValue}
            </p>
          {/if}
        </div>

        <div class="flex flex-col gap-2 md:ml-auto">
          <div class="flex items-center gap-4 h-[40px]">
            <span class="flex items-center gap-2">
              <Label class="whitespace-nowrap">Phase</Label>
              <HelpHint term="aggregateState" side="top" testId="compound-phase-help" />
            </span>
            <label class="flex items-center gap-2">
              <input
                type="radio"
                name="phase"
                value="condensed"
                checked={editor.formData.phase === "condensed"}
                onchange={() => (editor.formData.phase = "condensed")}
              />
              <span class="text-sm">Condensed</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                type="radio"
                name="phase"
                value="gas"
                checked={editor.formData.phase === "gas"}
                onchange={() => (editor.formData.phase = "gas")}
              />
              <span class="text-sm">Gas</span>
            </label>
          </div>
        </div>
      </div>

      <div class="grid gap-2">
        <QuickStartPanel
          isEmpty={editor.isEmptyComposition}
          onPasteFormula={(els) => editor.handlePasteFormula(els)}
          onApplyPreset={(p) => editor.handleApplyPreset(p)}
        />
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2">
            <Label>Elements</Label>
            <HelpHint term="compoundComposition" side="right" testId="compound-composition-help" />
          </span>
          <div role="tablist" class="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={editor.mode === "formula"}
              aria-controls="elements-panel"
              id="formula-tab"
              aria-label="Formula mode"
              class={cn(
                "text-xs font-medium transition-colors hover:text-foreground",
                editor.mode === "formula" ? "text-foreground" : "text-muted-foreground",
              )}
              onclick={() => editor.switchMode("formula")}
            >
              Formula
            </button>
            <span class="text-muted-foreground">|</span>
            <button
              type="button"
              role="tab"
              aria-selected={editor.mode === "weight"}
              aria-controls="elements-panel"
              id="weight-tab"
              aria-label="Weight fraction mode"
              class={cn(
                "text-xs font-medium transition-colors hover:text-foreground",
                editor.mode === "weight" ? "text-foreground" : "text-muted-foreground",
              )}
              onclick={() => editor.switchMode("weight")}
            >
              Weight fraction
            </button>
          </div>
        </div>

        {#if editor.visibleErrors.elements}
          <p
            class={cn(
              "text-sm",
              editor.isUrlAmber("elements") ? "text-amber-700" : "text-destructive",
            )}
            data-url-failed={editor.isUrlAmber("elements") ? "elements" : undefined}
          >
            {editor.visibleErrors.elements}
          </p>
        {/if}

        <div
          class="grid gap-2"
          id="elements-panel"
          role="tabpanel"
          aria-labelledby={editor.mode === "formula" ? "formula-tab" : "weight-tab"}
        >
          <!-- Duplicate Banner -->
          {#if editor.duplicateBanner}
            {@const dupBanner = editor.duplicateBanner}
            {@const dupElName = editor.getLocalName(dupBanner.z)}
            <div class="mb-2 rounded-md border border-destructive bg-destructive/10 p-3">
              <p class="text-sm font-medium text-destructive">
                {dupElName} (Z={dupBanner.z}) appears twice.
              </p>
              <p class="text-xs text-destructive mb-3">
                libdedx requires one row per element. URL-shared and pasted-formula inputs are
                de-duplicated automatically.
              </p>
              <div class="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onclick={() => editor.handleMergeBanner()}
                  data-testid="compound-editor-dup-merge"
                >
                  Merge into one
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  class="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onclick={() => editor.handleRemoveDuplicateBanner()}
                  data-testid="compound-editor-dup-remove"
                >
                  Remove duplicate
                </Button>
              </div>
            </div>
          {/if}

          {#each editor.formData.elements as element, index (index)}
            {@const isDuplicate =
              editor.duplicateBanner &&
              (index === editor.duplicateBanner.firstIndex ||
                index === editor.duplicateBanner.duplicateIndex)}

            <div class="relative">
              {#if editor.editDuplicatePrompt && editor.editDuplicatePrompt.index === index}
                {@const prompt = editor.editDuplicatePrompt}
                <div class="mb-2 rounded-md border border-orange-400 bg-orange-50 p-3">
                  <p class="text-sm font-medium text-orange-900">
                    {editor.getLocalName(prompt.newZ)} (Z={prompt.newZ}) is already in this
                    compound.
                  </p>
                  <p class="text-xs text-orange-800 mb-3">
                    Changing {editor.elementTexts[index]} → {editor.getLocalSymbol(prompt.newZ)} would
                    create a duplicate row. Pick what to do:
                  </p>
                  <div class="flex gap-2">
                    <Button
                      size="sm"
                      class="bg-orange-500 hover:bg-orange-600 text-white"
                      onclick={() => editor.handleMergePrompt()}
                      autofocus
                    >
                      Merge into existing {editor.getLocalSymbol(prompt.newZ)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      class="border-orange-200 text-orange-900 hover:bg-orange-100"
                      onclick={() => editor.cancelEditDuplicate()}
                    >
                      Cancel — keep this row as {editor.elementTexts[index]}
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
                      >{editor.getLocalSymbol(element.atomicNumber)}</span
                    >
                    <Pencil class="size-2.5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>

                {#if editor.mode === "formula"}
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    placeholder="Count"
                    value={String(element.atomCount)}
                    oninput={(e) =>
                      editor.handleAtomCountChange(
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
                    {#if editor.massPercents && editor.massPercents[index] !== undefined}
                      {editor.massPercents[index]!.toFixed(1)}% by mass
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
                      value={editor.weightTexts[index]}
                      oninput={(e) =>
                        editor.setWeightText(index, (e.currentTarget as HTMLInputElement).value)}
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
                  aria-label={`Remove ${editor.getLocalName(element.atomicNumber)}`}
                  disabled={editor.formData.elements.length === 1}
                  data-testid="picker-element-row-remove"
                >
                  <Trash2 class="size-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>

              <!-- Inline remove confirm -->
              {#if confirmRemoveIndex === index}
                <div
                  class="absolute inset-0 z-10 flex items-center justify-between rounded-md border border-destructive bg-background p-1 pl-3 shadow-sm"
                >
                  <span class="text-sm">Remove {editor.getLocalName(element.atomicNumber)}?</span>
                  <div class="flex gap-2">
                    <Button size="sm" variant="ghost" onclick={() => (confirmRemoveIndex = null)}
                      >Cancel</Button
                    >
                    <Button
                      size="sm"
                      variant="destructive"
                      autofocus
                      onclick={() => {
                        editor.handleRemoveElement(index);
                        confirmRemoveIndex = null;
                      }}>Yes, remove</Button
                    >
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <FormulaFooter elements={editor.displayElements} iValueOverride={editor.formData.iValue} />
        {#if editor.mode === "weight"}
          <SumTracker
            values={editor.weightTexts.map((t) => parseFloat(t) || 0)}
            symbols={editor.formData.elements.map((el) => editor.getLocalSymbol(el.atomicNumber))}
            onRescale={() => editor.handleRescale()}
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
                if (text && editor.addElementBySymbol(text)) {
                  target.value = "";
                }
              }
            }}
          />
          <button
            type="button"
            class="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary hover:underline whitespace-nowrap"
            onclick={() => (pickerMode = "ADD")}
          >
            <LayoutGrid class="size-3.5" aria-hidden="true" />
            Pick from periodic table
          </button>
        </div>
      </div>
    </div>

    <div class="mt-6 flex flex-col gap-2">
      <div class="flex justify-between">
        {#if compound}
          <Button type="button" variant="destructive" onclick={() => (showDeleteConfirm = true)}>
            Delete
          </Button>
        {:else}
          <div></div>
        {/if}
        <div class="flex gap-2">
          <Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
          <Button
            type="button"
            onclick={() => editor.handleSave()}
            aria-describedby={editor.saveAttempted && !editor.canSave
              ? "compound-save-error"
              : undefined}
          >
            Save
          </Button>
        </div>
      </div>
      <!-- Visible reason instead of a tooltip-only hint on a disabled button:
           Save stays clickable and reveals what's blocking it (#767). -->
      {#if editor.saveAttempted && !editor.canSave && editor.saveBlockReason}
        <p
          id="compound-save-error"
          class="text-sm text-destructive text-right"
          role="alert"
          data-testid="compound-save-block-reason"
        >
          {editor.saveBlockReason}
        </p>
      {/if}
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
  aria-label="Close modal"
  class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
  <span class="sr-only">Close</span>
</Dialog.Close>

<!-- Periodic-table picker (ADD / EDIT) -->
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
          usedZ={editor.usedZ}
          currentZ={pickerMode === "EDIT" && pickerEditIndex !== null
            ? (editor.formData.elements[pickerEditIndex]?.atomicNumber ?? null)
            : null}
          onSelect={handlePickerSelect}
        />
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

{#if editor.presetToConfirm}
  {@const preset = editor.presetToConfirm}
  <Dialog.Root open onOpenChange={(o) => !o && editor.cancelPreset()}>
    <Dialog.Portal>
      <Dialog.Overlay class="fixed inset-0 z-[60] bg-black/80" />
      <Dialog.Content
        class="fixed left-[50%] top-[50%] z-[60] w-full max-w-sm translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg"
      >
        <Dialog.Title class="text-lg font-semibold">Replace Composition</Dialog.Title>
        <p class="mt-2 text-sm text-muted-foreground">
          Replace your current composition with {preset.name}?
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" onclick={() => editor.cancelPreset()} autofocus>Cancel</Button>
          <Button variant="default" onclick={() => editor.applyPresetData(preset)}>Replace</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}

{#if editor.formulaToConfirm}
  {@const formula = editor.formulaToConfirm}
  <Dialog.Root open onOpenChange={(o) => !o && editor.cancelFormula()}>
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
          <Button variant="outline" onclick={() => editor.cancelFormula()}>Cancel</Button>
          <Button variant="secondary" onclick={() => editor.applyPasteFormulaData(formula, false)}>
            Append
          </Button>
          <Button
            variant="default"
            onclick={() => editor.applyPasteFormulaData(formula, true)}
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
