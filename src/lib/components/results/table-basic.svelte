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

  // Basic mode is always exactly one row — Add Row is Advanced-only (#840).
  // So there is no other row to navigate to; Enter just commits the value.
  function handleInputKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      calcState.handleBlur(0);
      (event.target as HTMLInputElement).blur();
    }
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    calcState.updateRowText(0, target.value, false);
    calcState.triggerCalculation();
  }

  // Only the first pasted line is used — Basic mode has no Add Row to grow
  // into a multi-row table (#840).
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData("text") || "";
    const firstLine = pastedText
      .split(/\r?\n|\r/)
      .map((l) => l.trim())
      .find((l) => l !== "");
    if (firstLine === undefined) return;
    calcState.updateRowText(0, firstLine, false);
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

    <!-- Single-energy "hero row" (#823): the kinetic-energy input sits on the
         same row as its two outputs — energy → range → dE/dx — so cause→effect
         reads left-to-right as input → results. The input cell is orange-
         accented (the only accent hue); result cells use neutral surface
         tokens. On mobile it stacks: the full-width energy input on top, the
         two result cells side-by-side below. Basic mode is always exactly one
         row — Add Row is Advanced-only (#840). -->
    {@const row = calcState.rows[0]!}
    {@const isError = row.status === "invalid" || row.status === "out-of-range"}
    <!-- The unit lives in the label ("Kinetic energy (MeV)"), matching the
         master anchor; once the user types their own unit suffix it is
         dropped so the label never contradicts the typed value (#823). -->
    {@const energyHeroLabel = row.unitFromSuffix
      ? "Kinetic energy"
      : `Kinetic energy (${calcState.masterUnit})`}
    <div data-testid="basic-single-row-card">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <!-- ① Kinetic energy — the input (orange = what you type in) -->
        <div
          class={`flex flex-col rounded-lg border px-4 py-3 transition-colors sm:flex-[1.4] ${
            isError
              ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
              : "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30"
          }`}
        >
          <label
            for="basic-energy-input"
            class={`mb-1 flex items-start gap-1 text-xs font-semibold ${
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
            class={`mt-auto w-full rounded-md border bg-background px-3 py-1.5 font-mono text-2xl font-semibold focus:outline-none focus:ring-2 disabled:opacity-60 ${
              isError
                ? "border-red-400 focus:ring-red-400/50"
                : "border-input focus:ring-orange-400/60"
            }`}
            onfocus={(e) => {
              handleInputFocus(e);
              hintVisible = true;
            }}
            onblur={() => (hintVisible = false)}
            onkeydown={handleInputKeyDown}
            oninput={handleInputChange}
            onpaste={handlePaste}
            disabled={calcState.isCalculating}
          />
          <!-- Reserved fixed-height slot for the message/hint so the input
               cell doesn't grow (and shove the whole row) when the hint
               appears on focus — the three cells stay the same size (#823). -->
          <div class="mt-1 min-h-[1rem] text-xs">
            {#if row.message && isError}
              <span class="text-red-600 dark:text-red-400" role="alert">{row.message}</span>
            {:else if hintVisible}
              <span
                class="text-orange-700 dark:text-orange-300"
                role="status"
                data-testid="inline-unit-hint"
              >
                type a unit too — e.g. <code class="font-mono font-medium">10 keV</code>
              </span>
            {/if}
          </div>
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
             (mt-auto) plus a bottom slot mirroring the input's hint slot, so
             all three value lines share one baseline — the input and both
             results — and the two numbers stay aligned even when one label
             wraps to more lines than the other. The transparent border +
             py-1.5 give the plain result text the same line box as the boxed
             input, so glyphs land on the same level (#823 feedback). -->
        <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-[2.4] sm:items-stretch">
          <div
            class="flex flex-col rounded-lg border border-border bg-muted/20 px-4 py-3 sm:flex-1"
          >
            <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
              <span>CSDA Range</span>
              <HelpHint term="csdaRange" side="bottom" testId="basic-range-help" />
            </div>
            <div
              class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
              data-testid="range-cell-0"
            >
              {rangeDisplay(row)}
            </div>
            <!-- Mirrors the input cell's hint slot so all three value lines
                 share the same bottom offset and land on one baseline. -->
            <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
          </div>
          <div
            class="flex flex-col rounded-lg border border-border bg-muted/20 px-4 py-3 sm:flex-1"
          >
            <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
              <span>Stopping Power ({calcState.stpDisplayUnit})</span>
              <HelpHint term="stoppingPower" side="bottom" testId="basic-stp-help" />
            </div>
            <div
              class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
              data-testid="stp-cell-0"
            >
              {stpDisplay(row)}
            </div>
            <!-- Mirrors the input cell's hint slot so all three value lines
                 share the same bottom offset and land on one baseline. -->
            <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>

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
  {/if}
</div>
