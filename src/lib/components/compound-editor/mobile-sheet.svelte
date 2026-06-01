<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { useVisualViewport } from "$lib/utils/visual-viewport";
  import FormulaFooter from "./formula-footer.svelte";
  import SumTracker from "./sum-tracker.svelte";
  import QuickStartPanel from "./quick-start-panel.svelte";
  import MobilePickerOverlay from "./mobile-picker-overlay.svelte";
  import RowActionSheet from "./row-action-sheet.svelte";
  import type { EditorController } from "./types";

  import { computeAtomCounts } from "$lib/utils/element-data";

  interface Props {
    editor: EditorController;
    prefersReducedMotion: boolean;
    onCancel: () => void;
  }

  let { editor, prefersReducedMotion, onCancel }: Props = $props();

  type Step = 1 | 2;
  let step = $state<Step>(1);
  let picker = $state<{ mode: "ADD" | "EDIT"; index: number | null } | null>(null);
  let actionSheetIndex = $state<number | null>(null);

  // Drives the test hook so Playwright can assert which screen is active.
  let activeScreen = $derived(picker ? "picker" : String(step));

  let displayElements = $derived.by(() => {
    if (editor.mode === "formula") return editor.formData.elements;

    // In weight mode, derive atom counts from weight percentages
    const wfs = editor.weightTexts.map((t, i) => ({
      atomicNumber: editor.formData.elements[i]?.atomicNumber ?? 1,
      weightFraction: (parseFloat(t) || 0) / 100,
    }));

    return computeAtomCounts(wfs) || editor.formData.elements;
  });

  let sheetEl: HTMLElement | null = $state(null);
  // Older engines (iOS Safari < 17) overlay the keyboard rather than shrinking
  // the layout viewport; mirror the visual-viewport gap into --vkb-offset so
  // the sheet height can subtract it.
  $effect(() => {
    const el = sheetEl;
    if (!el) return;
    return useVisualViewport((px) => el.style.setProperty("--vkb-offset", `${px}px`));
  });

  // Cancel any in-flight long-press timer when the sheet unmounts, so the
  // callback can't fire and mutate state after the component is destroyed.
  $effect(() => () => cancelLongPress());

  const slideMs = $derived(prefersReducedMotion ? 0 : 180);

  // ── Long-press → row action sheet ──────────────────────────────────────────
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  // Set when the long-press timer fires so the subsequent click on the element
  // tile (touch/mouse end synthesises one) doesn't also open the picker.
  let longPressFired = false;
  function startLongPress(index: number, e: PointerEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    cancelLongPress();
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      actionSheetIndex = index;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    }, 400);
  }
  function cancelLongPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function onTileClick(index: number) {
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    openPicker("EDIT", index);
  }

  function openPicker(mode: "ADD" | "EDIT", index: number | null) {
    actionSheetIndex = null;
    picker = { mode, index };
  }

  function commitPicker(z: number) {
    if (!picker) return;
    editor.applyElementSelection(z, picker.mode, picker.index);
    picker = null;
  }

  function scrollFocusIntoView(e: FocusEvent) {
    (e.currentTarget as HTMLElement).scrollIntoView({ block: "center" });
  }
</script>

<div
  bind:this={sheetEl}
  class="mobile-sheet-root fixed inset-0 z-[60] flex flex-col bg-background"
  data-testid="compound-editor-mobile-sheet"
  data-step={activeScreen}
>
  <!-- Test hook: tracks which screen (1 | 2 | picker) is active. -->
  <span class="sr-only" data-testid="compound-editor-mobile-step" data-step={activeScreen}
    >{activeScreen}</span
  >
  <!-- 2-bar progress indicator -->
  <div class="flex items-center gap-3 border-b px-4 py-3">
    <div class="flex flex-1 gap-1.5" aria-hidden="true">
      <div class={cn("h-1 flex-1 rounded-full", step >= 1 ? "bg-primary" : "bg-muted")}></div>
      <div class={cn("h-1 flex-1 rounded-full", step >= 2 ? "bg-primary" : "bg-muted")}></div>
    </div>
    <span class="shrink-0 text-sm font-medium text-muted-foreground">
      {#if step === 1}Basics{:else}Composition{/if}
    </span>
  </div>

  <div class="relative flex-1 overflow-hidden">
    <!-- Step 1 / Step 2 track -->
    <div
      class="flex h-full w-[200%]"
      style="transform: translateX({step === 1
        ? '0'
        : '-50%'}); transition: transform {slideMs}ms ease;"
    >
      <!-- ── Step 1 · Basics ── -->
      <section class="flex h-full w-1/2 flex-col">
        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid gap-5">
            <label class="grid gap-1.5">
              <span class="text-sm font-medium">Name</span>
              <input
                type="text"
                value={editor.formData.name}
                oninput={(e) => (editor.formData.name = e.currentTarget.value)}
                onfocus={scrollFocusIntoView}
                placeholder="e.g., LiF Pellet"
                class={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-base",
                  editor.errors.name && "border-destructive",
                )}
                data-testid="mobile-field-name"
              />
              {#if editor.errors.name}
                <span class="text-sm text-destructive">{editor.errors.name}</span>
              {/if}
            </label>

            <label class="grid gap-1.5">
              <span class="text-sm font-medium">Density (g/cm³)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="25"
                inputmode="decimal"
                value={editor.formData.density}
                oninput={(e) => (editor.formData.density = e.currentTarget.value)}
                onfocus={scrollFocusIntoView}
                class={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-base hide-spin-button",
                  editor.errors.density && "border-destructive",
                )}
                data-testid="mobile-field-density"
              />
              {#if editor.errors.density}
                <span class="text-sm text-destructive">{editor.errors.density}</span>
              {/if}
            </label>

            <label class="grid gap-1.5">
              <span class="text-sm font-medium">I-value (eV, optional)</span>
              <input
                type="number"
                step="1"
                min="0"
                max="10000"
                inputmode="decimal"
                value={editor.formData.iValue}
                oninput={(e) => (editor.formData.iValue = e.currentTarget.value)}
                onfocus={scrollFocusIntoView}
                class={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-base hide-spin-button",
                  editor.errors.iValue && "border-destructive",
                )}
                data-testid="mobile-field-ivalue"
              />
              {#if editor.errors.iValue}
                <span class="text-sm text-destructive">{editor.errors.iValue}</span>
              {/if}
            </label>

            <div class="grid gap-1.5">
              <span class="text-sm font-medium">Phase</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  class={cn(
                    "flex-1 rounded-md border px-4 py-3 text-base",
                    editor.formData.phase === "condensed"
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-accent",
                  )}
                  onclick={() => (editor.formData.phase = "condensed")}
                >
                  Condensed
                </button>
                <button
                  type="button"
                  class={cn(
                    "flex-1 rounded-md border px-4 py-3 text-base",
                    editor.formData.phase === "gas"
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-accent",
                  )}
                  onclick={() => (editor.formData.phase = "gas")}
                >
                  Gas
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          class="sticky bottom-0 flex gap-2 border-t bg-background p-3"
          style="padding-bottom: max(12px, env(safe-area-inset-bottom));"
        >
          <button
            type="button"
            class="flex-1 rounded-md border px-4 py-3 text-base font-medium hover:bg-accent"
            onclick={onCancel}
            data-testid="mobile-step1-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
            onclick={() => (step = 2)}
            data-testid="mobile-step1-next"
          >
            Next →
          </button>
        </div>
      </section>

      <!-- ── Step 2 · Composition ── -->
      <section class="flex h-full w-1/2 flex-col">
        <div class="flex-1 overflow-y-auto p-4">
          {#if editor.isEmptyComposition}
            <QuickStartPanel
              isEmpty={editor.isEmptyComposition}
              onPasteFormula={(els) => editor.handlePasteFormula(els)}
              onApplyPreset={(p) => editor.handleApplyPreset(p)}
            />
          {/if}

          <div class="mb-3 flex items-center justify-between">
            <span class="text-sm font-medium">Elements</span>
            <div role="tablist" class="flex gap-2 text-xs">
              <button
                type="button"
                role="tab"
                aria-selected={editor.mode === "formula"}
                class={cn(
                  "font-medium",
                  editor.mode === "formula" ? "text-foreground" : "text-muted-foreground",
                )}
                onclick={() => editor.switchMode("formula")}
              >
                Atoms
              </button>
              <span class="text-muted-foreground">|</span>
              <button
                type="button"
                role="tab"
                aria-selected={editor.mode === "weight"}
                class={cn(
                  "font-medium",
                  editor.mode === "weight" ? "text-foreground" : "text-muted-foreground",
                )}
                onclick={() => editor.switchMode("weight")}
              >
                % mass
              </button>
            </div>
          </div>

          {#if editor.errors.elements}
            <p class="mb-2 text-sm text-destructive">{editor.errors.elements}</p>
          {/if}

          <!-- Duplicate banner (compressed) -->
          {#if editor.duplicateBanner}
            {@const dup = editor.duplicateBanner}
            <div class="mb-3 rounded-md border border-destructive bg-destructive/10 p-3">
              <p class="text-sm font-medium text-destructive">
                {editor.getLocalName(dup.z)} (Z={dup.z}) appears twice.
              </p>
              <p class="mb-3 text-xs text-destructive">libdedx requires one row per element.</p>
              <div class="flex flex-col gap-2">
                <button
                  type="button"
                  class="w-full rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground"
                  onclick={() => editor.handleMergeBanner()}
                  data-testid="compound-editor-dup-merge"
                >
                  Merge ({editor.getLocalSymbol(dup.z)})
                </button>
                <button
                  type="button"
                  class="w-full rounded-md border border-destructive px-4 py-2.5 text-sm font-medium text-destructive"
                  onclick={() => editor.handleRemoveDuplicateBanner()}
                  data-testid="compound-editor-dup-remove"
                >
                  Remove
                </button>
              </div>
            </div>
          {/if}

          <!-- Edit-duplicate prompt -->
          {#if editor.editDuplicatePrompt}
            {@const prompt = editor.editDuplicatePrompt}
            <div class="mb-3 rounded-md border border-orange-400 bg-orange-50 p-3">
              <p class="text-sm font-medium text-orange-900">
                {editor.getLocalName(prompt.newZ)} (Z={prompt.newZ}) is already in this compound.
              </p>
              <div class="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  class="w-full rounded-md bg-orange-500 px-4 py-2.5 text-sm font-medium text-white"
                  onclick={() => editor.handleMergePrompt()}
                >
                  Merge into existing {editor.getLocalSymbol(prompt.newZ)}
                </button>
                <button
                  type="button"
                  class="w-full rounded-md border border-orange-200 px-4 py-2.5 text-sm font-medium text-orange-900"
                  onclick={() => editor.cancelEditDuplicate()}
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          <!-- Rows -->
          <div class="grid gap-2">
            {#each editor.formData.elements as element, index (index)}
              {@const isDup =
                editor.duplicateBanner &&
                (index === editor.duplicateBanner.firstIndex ||
                  index === editor.duplicateBanner.duplicateIndex)}
              <div
                role="group"
                aria-label={`${editor.getLocalName(element.atomicNumber)} row`}
                class={cn(
                  "flex touch-none items-center gap-2 rounded-md border p-2",
                  isDup && "border-destructive bg-destructive/10",
                )}
                onpointerdown={(e) => startLongPress(index, e)}
                onpointerup={cancelLongPress}
                onpointerleave={cancelLongPress}
                onpointercancel={cancelLongPress}
              >
                <button
                  type="button"
                  class="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-sm border bg-card"
                  onclick={() => onTileClick(index)}
                  data-testid={`picker-element-tile-${element.atomicNumber}`}
                  aria-label={`Change ${editor.getLocalName(element.atomicNumber)}`}
                >
                  <span class="text-[10px] leading-none text-muted-foreground">
                    Z={element.atomicNumber}
                  </span>
                  <span class="font-mono font-bold leading-none">
                    {editor.getLocalSymbol(element.atomicNumber)}
                  </span>
                </button>

                {#if editor.mode === "formula"}
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    inputmode="numeric"
                    placeholder="Count"
                    value={String(element.atomCount)}
                    oninput={(e) => editor.handleAtomCountChange(index, e.currentTarget.value)}
                    onfocus={scrollFocusIntoView}
                    class="w-20 rounded-md border bg-background px-2 py-2 text-base hide-spin-button"
                    aria-label={`Atom count for element ${index + 1}`}
                  />
                  <span
                    class="flex-1 text-right text-xs tabular-nums text-muted-foreground"
                    data-testid={`compound-mass-percent-${index}`}
                  >
                    {#if editor.massPercents && editor.massPercents[index] !== undefined}
                      {editor.massPercents[index]!.toFixed(1)}%
                    {/if}
                  </span>
                {:else}
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.01"
                    inputmode="decimal"
                    placeholder="Weight %"
                    value={editor.weightTexts[index]}
                    oninput={(e) => editor.setWeightText(index, e.currentTarget.value)}
                    onfocus={scrollFocusIntoView}
                    class="flex-1 rounded-md border bg-background px-2 py-2 text-right text-base hide-spin-button"
                    aria-label={`Weight fraction % for element ${index + 1}`}
                  />
                  <span class="w-4 text-xs text-muted-foreground">%</span>
                {/if}

                <button
                  type="button"
                  class="flex h-10 w-8 shrink-0 items-center justify-center rounded text-lg text-muted-foreground hover:bg-accent"
                  onclick={() => (actionSheetIndex = index)}
                  aria-label={`Row actions for ${editor.getLocalName(element.atomicNumber)}`}
                  data-testid="mobile-row-actions"
                >
                  …
                </button>
              </div>
            {/each}
          </div>

          <!-- FOOTER -->
          <div class="mt-4 shrink-0 px-4 pb-4">
            <FormulaFooter elements={displayElements} iValueOverride={editor.formData.iValue} />
            {#if editor.mode === "weight"}
              <SumTracker
                values={editor.weightTexts.map((t) => parseFloat(t) || 0)}
                symbols={editor.formData.elements.map((el) =>
                  editor.getLocalSymbol(el.atomicNumber),
                )}
                onRescale={() => editor.handleRescale()}
              />
            {/if}
          </div>

          <button
            type="button"
            class="mt-3 w-full rounded-md border border-dashed px-4 py-3 text-base font-medium text-muted-foreground hover:bg-accent"
            onclick={() => openPicker("ADD", null)}
            data-testid="mobile-add-element"
          >
            + Add element
          </button>
        </div>

        <div
          class="sticky bottom-0 flex gap-2 border-t bg-background p-3"
          style="padding-bottom: max(12px, env(safe-area-inset-bottom));"
        >
          <button
            type="button"
            class="flex-1 rounded-md border px-4 py-3 text-base font-medium hover:bg-accent"
            onclick={() => (step = 1)}
            data-testid="mobile-step2-back"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={!editor.canSave}
            title={editor.canSave ? undefined : (editor.saveBlockReason ?? undefined)}
            class="flex-1 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
            onclick={() => editor.handleSave()}
            data-testid="mobile-step2-save"
          >
            Save compound
          </button>
        </div>
      </section>
    </div>

    <!-- Picker overlay slides in from the right -->
    {#if picker}
      <div
        class="absolute inset-0 z-10 bg-background"
        style="animation: mobile-picker-in {slideMs}ms ease;"
      >
        <MobilePickerOverlay
          mode={picker.mode}
          usedZ={editor.usedZ}
          currentZ={picker.mode === "EDIT" && picker.index !== null
            ? (editor.formData.elements[picker.index]?.atomicNumber ?? null)
            : null}
          onSelect={commitPicker}
          onCancel={() => (picker = null)}
        />
      </div>
    {/if}
  </div>
</div>

{#if actionSheetIndex !== null}
  {@const idx = actionSheetIndex}
  <RowActionSheet
    symbol={editor.getLocalSymbol(editor.formData.elements[idx]?.atomicNumber ?? 0)}
    name={editor.getLocalName(editor.formData.elements[idx]?.atomicNumber ?? 0)}
    canRemove={editor.formData.elements.length > 1}
    onChangeElement={() => openPicker("EDIT", idx)}
    onRemove={() => {
      editor.handleRemoveElement(idx);
      actionSheetIndex = null;
    }}
    onCancel={() => (actionSheetIndex = null)}
  />
{/if}

<style>
  /* 100dvh shrinks with the keyboard on engines honouring
     interactive-widget=resizes-content; the calc() fallback subtracts the
     visual-viewport gap (--vkb-offset) on older engines (iOS Safari < 17). */
  .mobile-sheet-root {
    height: 100vh;
    height: 100dvh;
    height: calc(100dvh - var(--vkb-offset, 0px));
  }
  :global(.hide-spin-button::-webkit-inner-spin-button),
  :global(.hide-spin-button::-webkit-outer-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
  :global(.hide-spin-button) {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  @keyframes mobile-picker-in {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [style*="mobile-picker-in"] {
      animation: none !important;
    }
  }
</style>
