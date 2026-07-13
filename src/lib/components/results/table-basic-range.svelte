<script lang="ts">
  import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
  import type { StpUnit } from "$lib/wasm/types";
  import { formatEnergy, formatStpValue } from "./value-formatters";
  import { convertStpMass } from "$lib/utils/unit-conversions";
  import { RANGE_ANCHOR_OPTIONS } from "./table-advanced-helpers";
  import UnitAnchorStrip from "./unit-anchor-strip.svelte";
  import HelpHint from "$lib/components/help-hint.svelte";

  interface Props {
    inverseLookupState: InverseLookupState;
    /** Whether the current material is a gas by default — picks the fixed
     *  STP output unit (issue #840: Basic mode has no STP unit dropdown). */
    isGas: boolean;
    /** Effective material density (g/cm³) for the STP unit conversion. */
    density: number;
    class?: string;
  }

  let { inverseLookupState, isGas, density, class: className = "" }: Props = $props();

  // Basic mode has no Add Row (#840) — always the first (and only) row.
  const row = $derived(inverseLookupState.rangeRows[0]!);

  // Fixed STP output unit — keV/µm for solids/liquids, MeV·cm²/g for gases.
  // Computed directly from material phase, ignoring the Advanced-mode STP
  // unit override (`stpOutputUnit` / `sunit=`) so a leftover Advanced choice
  // can't violate the "fixed unit" requirement in Basic mode.
  const fixedStpUnit: StpUnit = $derived(isGas ? "MeV·cm²/g" : "keV/µm");

  function handleRangeInput(event: Event) {
    inverseLookupState.updateRangeRowText(0, (event.target as HTMLInputElement).value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  }

  function selectRangeUnit(unit: string) {
    inverseLookupState.setRangeMasterUnit(unit as "nm" | "um" | "mm" | "cm" | "m");
  }

  function energyDisplay(): string {
    if (row.status === "valid" && row.energyMevNucl !== null)
      return formatEnergy(row.energyMevNucl);
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
  <!-- Unit-anchor strip: shown per the Range → design (unlike Energy → hero,
       which has no unit control). No "(per-row mode active)" text — Basic
       mode is always a single row, so per-row mode is moot (#840). -->
  <div class="flex items-center gap-1">
    <UnitAnchorStrip
      options={RANGE_ANCHOR_OPTIONS}
      selected={inverseLookupState.rangeMasterUnit}
      onSelect={selectRangeUnit}
      disabled={row.unitFromSuffix}
      data-testid="basic-range-unit-strip"
    />
    <HelpHint term="inverseRange" side="bottom" testId="basic-range-unit-help" />
  </div>

  <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
    <!-- ① Range — the input (orange = what you type in) -->
    <div
      class={`flex flex-col rounded-lg border px-4 py-3 transition-colors sm:flex-[1.4] ${
        row.status === "invalid"
          ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30"
      }`}
    >
      <label
        for="basic-range-input"
        class={`mb-1 flex items-start gap-1 text-xs font-semibold ${
          row.status === "invalid" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        }`}>Range</label
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
          row.status === "invalid"
            ? "border-red-400 focus:ring-red-400/50"
            : "border-input focus:ring-orange-400/60"
        }`}
        onkeydown={handleKeyDown}
        oninput={handleRangeInput}
      />
      <div class="mt-1 min-h-[1rem] text-xs">
        {#if row.message && row.status === "invalid"}
          <span class="text-red-600 dark:text-red-400" role="alert">{row.message}</span>
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
