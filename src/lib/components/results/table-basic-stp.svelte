<script lang="ts">
  import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
  import { formatEnergy, formatRangeCm } from "./value-formatters";
  import HelpHint from "$lib/components/help-hint.svelte";

  interface Props {
    inverseLookupState: InverseLookupState;
    /** Whether the current material is a gas by default — picks the fixed
     *  STP input unit (issue #840: Basic mode has no unit dropdown). */
    isGas: boolean;
    class?: string;
  }

  let { inverseLookupState, isGas, class: className = "" }: Props = $props();

  // Basic mode has no Add Row (#840) — always the first (and only) row.
  const row = $derived(inverseLookupState.stpRows[0]!);

  const fixedUnitToken = $derived(isGas ? "mev-cm2-g" : "kev-um");
  const fixedUnitLabel = $derived(isGas ? "MeV·cm²/g" : "keV/µm");

  // Keep the row's unit pinned to the material-phase default — Basic mode has
  // no dropdown to override it, unlike Advanced's Inverse STP tab.
  $effect(() => {
    if (inverseLookupState.stpMasterUnit !== fixedUnitToken) {
      inverseLookupState.setStpMasterUnit(fixedUnitToken);
    }
  });

  // A row resolves to two distinct energies when the queried stopping power
  // occurs on both sides of the Bragg peak; the low-E card only appears then.
  const showLowE = $derived(row.energyLowMevNucl !== null);

  function handleStpInput(event: Event) {
    inverseLookupState.updateStpRowText(0, (event.target as HTMLInputElement).value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  }

  function energyDisplay(mevNucl: number | null): string {
    return mevNucl !== null ? formatEnergy(mevNucl) : "—";
  }

  function rangeDisplay(cm: number | null): string {
    return cm !== null ? formatRangeCm(cm) : "—";
  }
</script>

<div class={`space-y-3 ${className}`} data-testid="basic-stp-card">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-stretch">
    <!-- ① Stopping power — the input (orange = what you type in) -->
    <div
      class={`flex flex-col rounded-lg border px-4 py-3 transition-colors sm:flex-[1.4] ${
        row.status === "invalid"
          ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
          : "border-orange-200 bg-orange-50 dark:border-orange-800/50 dark:bg-orange-950/30"
      }`}
    >
      <label
        for="basic-stp-input"
        class={`mb-1 flex items-start gap-1 text-xs font-semibold ${
          row.status === "invalid" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        }`}
        >Stopping Power ({fixedUnitLabel})
        <HelpHint term="braggPeak" side="bottom" testId="basic-stp-bragg-help" />
      </label>
      <input
        id="basic-stp-input"
        type="text"
        inputmode="text"
        aria-label="Stopping power value"
        data-testid="basic-stp-input"
        value={row.text}
        placeholder="e.g. 30"
        class={`mt-auto w-full rounded-md border bg-background px-3 py-1.5 font-mono text-2xl font-semibold focus:outline-none focus:ring-2 disabled:opacity-60 ${
          row.status === "invalid"
            ? "border-red-400 focus:ring-red-400/50"
            : "border-input focus:ring-orange-400/60"
        }`}
        onkeydown={handleKeyDown}
        oninput={handleStpInput}
      />
      <div class="mt-1 min-h-[1rem] text-xs">
        {#if row.message && (row.status === "invalid" || row.status === "error")}
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

    <!-- ② high-energy branch: Energy and Range (cool = what comes out) -->
    <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-[2.4] sm:items-stretch">
      <div
        class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
      >
        <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
          <span>Energy{showLowE ? " (high-E)" : ""}</span>
        </div>
        <div
          class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
          data-testid="basic-stp-energy-high-cell"
        >
          {energyDisplay(row.energyHighMevNucl)}
        </div>
        <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
      </div>
      <div
        class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30 sm:flex-1"
      >
        <div class="mb-1 flex items-start gap-1 text-xs font-medium text-muted-foreground">
          <span>Range{showLowE ? " (high-E)" : ""}</span>
          <HelpHint term="csdaRange" side="bottom" testId="basic-stp-range-high-help" />
        </div>
        <div
          class="mt-auto border border-transparent py-1.5 font-mono text-xl font-semibold whitespace-nowrap sm:text-2xl"
          data-testid="basic-stp-range-high-cell"
        >
          {rangeDisplay(row.rangeHighCm)}
        </div>
        <div class="mt-1 min-h-[1rem]" aria-hidden="true"></div>
      </div>
    </div>
  </div>

  {#if showLowE}
    <!-- Low-energy branch: same stopping power occurs at a second, lower
         energy (below the Bragg peak). Revealed only when it exists. -->
    <div
      class="rounded-lg border border-dashed border-input p-3"
      data-testid="basic-stp-low-e-card"
    >
      <p class="mb-2 text-xs text-muted-foreground">
        Second solution (low-energy branch) — the same stopping power also occurs at a lower energy,
        below the Bragg peak.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <div
          class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30"
        >
          <div class="mb-1 text-xs font-medium text-muted-foreground">Energy (low-E)</div>
          <div
            class="font-mono text-lg font-semibold whitespace-nowrap"
            data-testid="basic-stp-energy-low-cell"
          >
            {energyDisplay(row.energyLowMevNucl)}
          </div>
        </div>
        <div
          class="flex flex-col rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30"
        >
          <div class="mb-1 text-xs font-medium text-muted-foreground">Range (low-E)</div>
          <div
            class="font-mono text-lg font-semibold whitespace-nowrap"
            data-testid="basic-stp-range-low-cell"
          >
            {rangeDisplay(row.rangeLowCm)}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
