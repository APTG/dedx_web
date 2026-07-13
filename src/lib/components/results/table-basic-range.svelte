<script lang="ts">
  import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
  import type { StpUnit } from "$lib/wasm/types";
  import { formatEnergy, formatStpValue } from "./value-formatters";
  import { convertStpMass } from "$lib/utils/unit-conversions";
  import HelpHint from "$lib/components/help-hint.svelte";

  interface Props {
    inverseLookupState: InverseLookupState;
    /** Whether the current material is a gas by default — picks the fixed
     *  STP output unit (issue #840: Basic mode has no STP unit dropdown). */
    isGas: boolean;
    /** Effective material density (g/cm³) for the STP unit conversion. */
    density: number;
    /** True for heavy ions — the resolved "Energy" output is shown in
     *  MeV/nucl instead of MeV, matching the Energy tab's auto unit switch. */
    isHeavyIon: boolean;
    class?: string;
  }

  let { inverseLookupState, isGas, density, isHeavyIon, class: className = "" }: Props = $props();

  // Basic mode has no Add Row (#840) — always the first (and only) row.
  const row = $derived(inverseLookupState.rangeRows[0]!);

  // Fixed STP output unit — keV/µm for solids/liquids, MeV·cm²/g for gases.
  // Computed directly from material phase, ignoring the Advanced-mode STP
  // unit override (`stpOutputUnit` / `sunit=`) so a leftover Advanced choice
  // can't violate the "fixed unit" requirement in Basic mode.
  const fixedStpUnit: StpUnit = $derived(isGas ? "MeV·cm²/g" : "keV/µm");

  // The unit lives in the label ("Range (cm)"), matching the master anchor
  // (like Kinetic energy's "MeV" label); once the user types their own unit
  // suffix it is dropped so the label never contradicts the typed value.
  const rangeUnitDisplay = $derived(
    inverseLookupState.rangeMasterUnit === "um" ? "µm" : inverseLookupState.rangeMasterUnit,
  );
  const rangeHeroLabel = $derived(row.unitFromSuffix ? "Range" : `Range (${rangeUnitDisplay})`);

  function handleRangeInput(event: Event) {
    inverseLookupState.updateRangeRowText(0, (event.target as HTMLInputElement).value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  }

  // Error state mirrors the forward Basic hero (table-basic.svelte): treat
  // "invalid", "out-of-range", and "error" all as error for styling/messaging.
  const isError = $derived(
    row.status === "invalid" || row.status === "out-of-range" || row.status === "error",
  );

  // Inline-unit hint — shown while the range input is focused, mirroring the
  // Kinetic energy hero's hint (table-basic.svelte).
  let hintVisible = $state(false);

  function handleInputFocus(event: Event) {
    (event.target as HTMLInputElement).select();
  }

  function energyDisplay(): string {
    if (row.status === "valid" && row.energyMevNucl !== null)
      return formatEnergy(row.energyMevNucl, isHeavyIon);
    if (row.status === "out-of-range") return "out of range";
    return "—";
  }

  function stpDisplay(): string {
    if (row.status === "valid" && row.stoppingPower !== null) {
      return formatStpValue(convertStpMass(row.stoppingPower, density, fixedStpUnit), fixedStpUnit);
    }
    if (row.status === "out-of-range") return "out of range";
    return "—";
  }
</script>

<div class={`space-y-3 ${className}`} data-testid="basic-range-card">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
    <!-- ① Range — the input (orange = what you type in) -->
    <div
      class={`flex flex-col rounded-lg border px-4 py-3 transition-colors sm:flex-[1.4] ${
        isError
          ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30"
      }`}
    >
      <label
        for="basic-range-input"
        class={`mb-1 flex items-start gap-1 text-xs font-semibold ${
          isError ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        }`}>{rangeHeroLabel}</label
      >
      <input
        id="basic-range-input"
        type="text"
        inputmode="text"
        aria-label="Range value"
        data-testid="basic-range-input"
        value={row.text}
        placeholder="e.g. 7.718"
        class={`mt-auto w-full rounded-md border bg-background px-3 py-1.5 font-mono text-2xl font-semibold focus:outline-none focus:ring-2 disabled:opacity-60 ${
          isError ? "border-red-400 focus:ring-red-400/50" : "border-input focus:ring-orange-400/60"
        }`}
        onfocus={(e) => {
          handleInputFocus(e);
          hintVisible = true;
        }}
        onblur={() => (hintVisible = false)}
        onkeydown={handleKeyDown}
        oninput={handleRangeInput}
      />
      <div class="mt-1 min-h-[1rem] text-xs">
        {#if row.message && isError}
          <span class="text-red-600 dark:text-red-400" role="alert">{row.message}</span>
        {:else if hintVisible}
          <span
            class="text-orange-700 dark:text-orange-300"
            role="status"
            data-testid="inline-range-unit-hint"
          >
            type a unit too — e.g. <code class="font-mono font-medium">10 um</code>
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

    <!-- ② Energy and ③ stopping power — the results (cool = what comes out) -->
    <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-[2.4] sm:items-stretch">
      <div
        class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
      >
        <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
          <span>Energy</span>
        </div>
        <div
          class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
          data-testid="basic-range-energy-cell"
        >
          {energyDisplay()}
        </div>
        <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
      </div>
      <div
        class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
      >
        <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
          <span>Stopping Power ({fixedStpUnit})</span>
          <HelpHint term="stoppingPower" side="bottom" testId="basic-range-stp-help" />
        </div>
        <div
          class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
          data-testid="basic-range-stp-cell"
        >
          {stpDisplay()}
        </div>
        <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</div>
