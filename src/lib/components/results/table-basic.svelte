<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { formatSigFigs } from "$lib/utils/unit-conversions";
  import { formatRangeCm } from "./value-formatters";
  import { ELECTRON_UNSUPPORTED_MESSAGE } from "$lib/config/libdedx-version";
  import HelpHint from "$lib/components/help-hint.svelte";

  interface Props {
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
    class?: string;
  }

  let { calcState, entitySelection, class: className = "" }: Props = $props();

  // Ghost note: appears once per session when energy label changes (proton ↔ heavy ion).
  let noteVisible = $state(false);
  let prevIsHeavyIon: boolean | null = null;

  const currentIsHeavyIon = $derived.by(() => {
    const particle = entitySelection.selectedParticle;
    if (!particle) return false;
    if ("massNumber" in particle) return particle.massNumber > 1;
    if ("A" in particle) return (particle as { A: number }).A > 1;
    return false;
  });

  $effect(() => {
    const cur = currentIsHeavyIon;
    if (prevIsHeavyIon !== null && prevIsHeavyIon !== cur) {
      const dismissed =
        typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("dedx_unit_note_dismissed") === "1";
      if (!dismissed) noteVisible = true;
    }
    prevIsHeavyIon = cur;
  });

  function dismissNote() {
    noteVisible = false;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("dedx_unit_note_dismissed", "1");
    }
  }

  // Trigger initial calculation when entity selection becomes complete.
  $effect(() => {
    if (entitySelection.isComplete) {
      calcState.triggerCalculation();
    }
  });

  // Inline-unit hint — shown while the single-row hero input is focused, as a
  // gentle reminder that a unit suffix can be typed (e.g. "10 keV"). Focus-
  // driven so it reappears whenever the field is active (#823 feedback).
  let hintVisible = $state(false);

  function handleInputFocus(event: Event) {
    (event.target as HTMLInputElement).select();
  }

  function focusRowInput(targetIndex: number): boolean {
    const inputs = document.querySelectorAll<HTMLInputElement>("input[data-row-index]");
    const target = inputs[targetIndex];
    if (target) {
      target.focus();
      return true;
    }
    return false;
  }

  function handleInputKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      calcState.handleBlur(index);
      if (event.shiftKey) return;
      const moved = focusRowInput(index + 1);
      if (!moved) {
        calcState.addRow();
        queueMicrotask(() => focusRowInput(index + 1));
      }
      return;
    }

    if (event.key === "Tab") {
      const targetIndex = event.shiftKey ? index - 1 : index + 1;
      const inputs = document.querySelectorAll<HTMLInputElement>("input[data-row-index]");
      const targetInput = inputs[targetIndex];
      if (targetInput) {
        event.preventDefault();
        calcState.handleBlur(index);
        targetInput.focus();
      }
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? "up" : "down";
        calcState.moveRow(index, direction);
        const newIndex = direction === "up" ? index - 1 : index + 1;
        queueMicrotask(() => focusRowInput(newIndex));
      } else {
        event.preventDefault();
        focusRowInput(event.key === "ArrowUp" ? index - 1 : index + 1);
      }
      return;
    }

    if (event.key === "Backspace") {
      const input = event.target as HTMLInputElement;
      if (input.value === "" && calcState.rows.length > 1) {
        event.preventDefault();
        calcState.removeRow(index);
        queueMicrotask(() => focusRowInput(Math.max(0, index - 1)));
      }
    }
  }

  function handleInputChange(event: Event, index: number) {
    const target = event.target as HTMLInputElement;
    // autoAdd=false: layout stays as card until user explicitly adds a row
    // (Enter key or "+ Add row" button). Advanced mode uses the default autoAdd=true.
    calcState.updateRowText(index, target.value, false);
    calcState.triggerCalculation();
  }

  function handlePaste(event: ClipboardEvent, index: number) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData("text") || "";
    const lines = pastedText
      .split(/\r?\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (lines.length === 0) return;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const targetIndex = index + i;
      if (targetIndex >= calcState.rows.length) {
        calcState.updateRowText(calcState.rows.length - 1, line);
      } else {
        calcState.updateRowText(targetIndex, line);
      }
    }
    calcState.triggerCalculation();
  }

  function stpDisplay(row: (typeof calcState.rows)[0]): string {
    if (calcState.isCalculating) return "—";
    if (row.stoppingPower !== null) return formatSigFigs(row.stoppingPower, 4);
    return "-";
  }

  function rangeDisplay(row: (typeof calcState.rows)[0]): string {
    if (calcState.isCalculating) return "—";
    if (row.csdaRangeCm !== null) return formatRangeCm(row.csdaRangeCm);
    return "-";
  }

  function inputClass(row: (typeof calcState.rows)[0]): string {
    const isError = row.status === "invalid" || row.status === "out-of-range";
    return `w-24 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
      isError ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-input"
    }`;
  }

  const isSingleRow = $derived(calcState.rows.length === 1);
  const energyLabel = $derived(`Energy (${calcState.masterUnit})`);
  const noteText = $derived(
    currentIsHeavyIon
      ? "unit is now MeV/nucl — value unchanged"
      : "unit is now MeV — value unchanged",
  );
</script>

<div class={`space-y-3 ${className}`} data-testid="result-table">
  {#if !entitySelection.isComplete}
    <div class="p-4 text-center text-muted-foreground">
      {#if entitySelection.selectedParticle?.id === 1001}
        {ELECTRON_UNSUPPORTED_MESSAGE}
      {:else if entitySelection.selectedParticle && entitySelection.selectedMaterial}
        No program supports <strong>{entitySelection.selectedParticle.name}</strong> in
        <strong>{entitySelection.selectedMaterial.name}</strong>. Change the particle or material
        selection to continue.
      {:else}
        Select a particle and material to calculate.
      {/if}
    </div>
  {:else}
    {#if noteVisible}
      <div
        class="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        role="status"
        aria-live="polite"
        data-testid="unit-changed-note"
      >
        <span>{noteText}</span>
        <button
          type="button"
          class="ml-3 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 text-lg leading-none"
          aria-label="Dismiss"
          onclick={dismissNote}>×</button
        >
      </div>
    {/if}

    {#if isSingleRow}
      <!-- Single-energy "hero row" (#823): the kinetic-energy input sits on the
           same row as its two outputs — energy → range → dE/dx — so cause→effect
           reads left-to-right as input → results. A light two-tone tint marks in
           vs out: orange for the input cell, a cool sky tint for the result
           cells. On mobile it stacks: the full-width energy input on top, the
           two result cells side-by-side below. Adding a second row switches to
           the multi-row table layout below. -->
      {@const row = calcState.rows[0]!}
      {@const isError = row.status === "invalid" || row.status === "out-of-range"}
      <!-- The unit lives in the label ("Kinetic energy (MeV)"), matching the
           master anchor; once the user types their own unit suffix it is
           dropped so the label never contradicts the typed value (#823). -->
      {@const energyHeroLabel = row.unitFromSuffix
        ? "Kinetic energy"
        : `Kinetic energy (${calcState.masterUnit})`}
      <div data-testid="basic-single-row-card">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <!-- ① Kinetic energy — the input (orange = what you type in) -->
          <div
            class={`rounded-lg border p-4 transition-colors sm:flex-[1.4] ${
              isError
                ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                : "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30"
            }`}
          >
            <label
              for="basic-energy-input"
              class={`mb-1.5 flex items-start gap-1 text-xs font-semibold ${
                isError ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              }`}>{energyHeroLabel}</label
            >
            <input
              id="basic-energy-input"
              type="text"
              inputmode="text"
              aria-label="Energy value row 1"
              data-row-index={0}
              data-testid="energy-input-0"
              value={row.rawInput}
              placeholder="e.g. 100"
              class={`w-full rounded-md border bg-background px-3 py-2 font-mono text-2xl font-semibold focus:outline-none focus:ring-2 disabled:opacity-60 ${
                isError
                  ? "border-red-400 focus:ring-red-400/50"
                  : "border-input focus:ring-orange-400/60"
              }`}
              onfocus={(e) => {
                handleInputFocus(e);
                hintVisible = true;
              }}
              onblur={() => (hintVisible = false)}
              onkeydown={(e) => handleInputKeyDown(e, 0)}
              oninput={(e) => handleInputChange(e, 0)}
              onpaste={(e) => handlePaste(e, 0)}
              disabled={calcState.isCalculating}
            />
            {#if row.message && isError}
              <div class="mt-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
                {row.message}
              </div>
            {/if}
            {#if hintVisible}
              <p
                class="mt-1.5 text-xs text-orange-700 dark:text-orange-300"
                role="status"
                data-testid="inline-unit-hint"
              >
                type a unit too — e.g. <code class="font-mono font-medium">10 keV</code>
              </p>
            {/if}
          </div>

          <!-- connector: input → results (desktop only) -->
          <div
            class="hidden text-xl text-muted-foreground/50 sm:flex sm:items-center sm:self-stretch"
            aria-hidden="true"
          >
            →
          </div>

          <!-- ② CSDA range and ③ stopping power — the results (cool = what
               comes out). The two cells are equal height (grid on mobile,
               flex on desktop) and each value is pinned to the bottom
               (mt-auto), so the two numbers stay aligned even when one label
               wraps to more lines than the other (#823 feedback). -->
          <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-[2.4] sm:items-stretch">
            <div
              class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
            >
              <div class="mb-1.5 flex items-start gap-1 text-xs font-medium text-muted-foreground">
                <span>CSDA Range</span>
                <HelpHint term="csdaRange" side="bottom" testId="basic-range-help" />
              </div>
              <div
                class="mt-auto font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
                data-testid="range-cell-0"
              >
                {rangeDisplay(row)}
              </div>
            </div>
            <div
              class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
            >
              <div class="mb-1.5 flex items-start gap-1 text-xs font-medium text-muted-foreground">
                <span>Stopping Power ({calcState.stpDisplayUnit})</span>
                <HelpHint term="stoppingPower" side="bottom" testId="basic-stp-help" />
              </div>
              <div
                class="mt-auto font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
                data-testid="stp-cell-0"
              >
                {stpDisplay(row)}
              </div>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <!-- Multi-row compact table layout -->
      <div class="overflow-x-auto" data-testid="basic-multi-row-table">
        <table class="w-full min-w-[400px] text-sm" data-testid="basic-result-table">
          <thead class="sticky top-0 bg-background">
            <tr>
              <th
                scope="col"
                class="sticky left-0 z-20 bg-background shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)] px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-left border-b"
              >
                {energyLabel}
              </th>
              <th
                scope="col"
                class="px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-right border-b"
              >
                <span class="inline-flex items-center gap-1">
                  Stopping Power ({calcState.stpDisplayUnit})
                  <HelpHint term="stoppingPower" side="bottom" class="font-normal" />
                </span>
              </th>
              <th
                scope="col"
                class="px-2 sm:px-4 py-2 font-medium whitespace-nowrap text-right border-b"
              >
                <span class="inline-flex items-center gap-1">
                  CSDA Range
                  <HelpHint term="csdaRange" side="bottom" class="font-normal" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each calcState.rows as row, i (row.id)}
              <tr class="even:bg-muted/30">
                <td
                  class={`sticky left-0 z-10 px-2 sm:px-4 py-2 shadow-[2px_0_3px_-1px_rgba(0,0,0,0.08)] ${i % 2 === 1 ? "bg-muted/30" : "bg-background"}`}
                >
                  <input
                    type="text"
                    inputmode="text"
                    aria-label={`Energy value row ${i + 1}`}
                    data-row-index={i}
                    data-testid={`energy-input-${i}`}
                    value={row.rawInput}
                    placeholder="e.g. 100 keV"
                    class={inputClass(row)}
                    onfocus={(e) => handleInputFocus(e)}
                    onkeydown={(e) => handleInputKeyDown(e, i)}
                    oninput={(e) => handleInputChange(e, i)}
                    onpaste={(e) => handlePaste(e, i)}
                    disabled={calcState.isCalculating}
                  />
                  {#if row.message && (row.status === "invalid" || row.status === "out-of-range")}
                    <div class="mt-0.5 text-xs text-red-600 dark:text-red-400" role="alert">
                      {row.message}
                    </div>
                  {/if}
                </td>
                <td
                  class="px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono"
                  data-testid={`stp-cell-${i}`}
                >
                  {stpDisplay(row)}
                </td>
                <td
                  class="px-2 sm:px-4 py-2 text-right whitespace-nowrap font-mono"
                  data-testid={`range-cell-${i}`}
                >
                  {rangeDisplay(row)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if calcState.validationSummary.invalid > 0 || calcState.validationSummary.outOfRange > 0}
      <div class="text-sm text-muted-foreground border-t pt-2">
        {calcState.validationSummary.invalid + calcState.validationSummary.outOfRange} of {calcState
          .validationSummary.total} values excluded (
        {#if calcState.validationSummary.invalid > 0}
          {calcState.validationSummary.invalid} invalid
          {#if calcState.validationSummary.outOfRange > 0},{/if}
        {/if}
        {#if calcState.validationSummary.outOfRange > 0}
          {calcState.validationSummary.outOfRange} out of range
        {/if}
        )
      </div>
    {/if}

    {#if calcState.error}
      <div
        class="text-sm border-t border-destructive/20 bg-destructive/5 p-3 space-y-1"
        role="alert"
      >
        <p class="text-destructive font-medium">Calculation error: {calcState.error.message}</p>
        <details class="text-xs text-muted-foreground">
          <summary class="cursor-pointer select-none">Show details</summary>
          <code class="mt-1 block">LibdedxError code: {calcState.error.code}</code>
        </details>
      </div>
    {/if}

    <div class="flex justify-start">
      <button
        type="button"
        class="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        onclick={() => calcState.addRow()}
      >
        + Add row
      </button>
    </div>
  {/if}
</div>
