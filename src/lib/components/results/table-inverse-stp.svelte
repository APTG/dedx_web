<script lang="ts">
  import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
  import { formatEnergy, formatRangeCm } from "./value-formatters";
  import UnitAnchorStrip from "./unit-anchor-strip.svelte";
  import HelpHint from "$lib/components/help-hint.svelte";

  const STP_ANCHOR_OPTIONS = [
    { value: "kev-um", label: "keV/µm", tooltip: "keV per micrometre (linear stopping power)" },
    { value: "mev-cm", label: "MeV/cm", tooltip: "MeV per centimetre (linear stopping power)" },
    {
      value: "mev-cm2-g",
      label: "MeV·cm²/g",
      tooltip: "MeV per g/cm² (mass stopping power)",
    },
  ];

  type Props = {
    inverseLookupState: InverseLookupState;
    /** Called when user clicks "Plot" on a 2-solution row. Parent handles navigation. */
    onPlotRow?: (rowIndex: number) => void;
    class?: string;
  };

  let props: Props = $props();

  const stpRows = $derived(props.inverseLookupState.stpRows);

  const hasTwoSolutionRow = $derived(
    stpRows.some((r) => r.energyLowMevNucl !== null && r.energyHighMevNucl !== null),
  );

  const showLowEColumn = $derived(
    props.inverseLookupState.stpBranchState === "both" || hasTwoSolutionRow,
  );

  // When the low-E column first appears, animate it once.
  let loEPrevVisible = $state(false);
  let loEColumnJustRevealed = $state(false);
  let autoRevealedByTwoSolution = $state(false);

  $effect(() => {
    const now = showLowEColumn;
    let revealTimeoutId: ReturnType<typeof setTimeout> | undefined;
    if (now && !loEPrevVisible) {
      loEColumnJustRevealed = true;
      // Remove the tint class after the animation completes (600ms).
      revealTimeoutId = setTimeout(() => {
        loEColumnJustRevealed = false;
      }, 600);
    }
    loEPrevVisible = now;
    return () => {
      if (revealTimeoutId !== undefined) {
        clearTimeout(revealTimeoutId);
      }
    };
  });

  // Sync stpBranchState for auto-reveal behaviour triggered by 2-solution rows.
  $effect(() => {
    if (hasTwoSolutionRow) {
      autoRevealedByTwoSolution = true;
      if (props.inverseLookupState.stpBranchState !== "both") {
        props.inverseLookupState.setStpBranchState("both");
      }
      return;
    }
    if (autoRevealedByTwoSolution) {
      autoRevealedByTwoSolution = false;
      if (props.inverseLookupState.stpBranchState === "both") {
        props.inverseLookupState.setStpBranchState("hi");
      }
    }
  });

  const canDeleteRows = $derived(stpRows.length > 1);

  function onDeleteRow(index: number): void {
    if (!canDeleteRows) return;
    props.inverseLookupState.removeStpRow(index);
  }

  function inputClass(status: string): string {
    const isError = status === "invalid" || status === "out-of-range" || status === "error";
    return `w-28 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
      isError ? "border-destructive bg-destructive/5" : "border-input"
    }`;
  }
</script>

<div class={`space-y-2 ${props.class ?? ""}`}>
  <!-- Unit anchor strip + branch / Bragg-peak help -->
  <div class="flex items-center gap-3">
    <UnitAnchorStrip
      options={STP_ANCHOR_OPTIONS}
      selected={props.inverseLookupState.stpMasterUnit}
      onSelect={(v) =>
        props.inverseLookupState.setStpMasterUnit(v as "kev-um" | "mev-cm" | "mev-cm2-g")}
      data-testid="inverse-stp-unit"
    />
    <HelpHint term="inverseStp" side="bottom" testId="inverse-stp-help" />
    <HelpHint term="braggPeak" side="bottom" testId="inverse-stp-bragg-help" />
  </div>

  <div class="overflow-x-auto">
    <table class="w-full min-w-[400px] text-sm border-collapse" data-testid="inverse-stp-table">
      <thead class="sticky top-0 bg-background">
        <tr>
          <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b w-8"
            >#</th
          >
          <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b"
            >Stopping Power</th
          >
          <th
            scope="col"
            class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
            data-testid="col-hi-e"
          >
            → Energy{showLowEColumn ? " (high-E)" : ""}
          </th>
          <th
            scope="col"
            class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
            data-testid="col-hi-range"
          >
            → Range{showLowEColumn ? " (high-E)" : ""}
          </th>
          {#if showLowEColumn}
            <th
              scope="col"
              class={`px-2 py-2 font-medium whitespace-nowrap text-right border-b transition-colors duration-500 ${loEColumnJustRevealed ? "bg-amber-100/70 dark:bg-amber-900/30" : ""}`}
              data-testid="col-lo-e"
            >
              → Energy (low-E)
            </th>
            <th
              scope="col"
              class={`px-2 py-2 font-medium whitespace-nowrap text-right border-b transition-colors duration-500 ${loEColumnJustRevealed ? "bg-amber-100/70 dark:bg-amber-900/30" : ""}`}
              data-testid="col-lo-range"
            >
              → Range (low-E)
            </th>
          {/if}
          <th scope="col" class="px-1 py-2 font-medium border-b w-6" aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        {#each stpRows as row, i (row.id)}
          <tr
            class={i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : "even:bg-muted/20"}
            data-testid="inverse-stp-row-{i}"
          >
            <!-- Row index -->
            <td class="px-2 py-2 text-muted-foreground text-xs tabular-nums">{i + 1}</td>

            <!-- STP input -->
            <td class="px-2 py-2">
              <input
                type="text"
                aria-label={`Stopping power row ${i + 1}`}
                value={row.text}
                placeholder="e.g. 30"
                class={inputClass(row.status)}
                oninput={(e) => props.inverseLookupState.updateStpRowText(i, e.currentTarget.value)}
                data-testid="inverse-stp-input-{i}"
              />
              {#if (row.status === "invalid" || row.status === "no-solution" || row.status === "error") && row.message}
                <div
                  class="mt-0.5 text-xs text-destructive"
                  role="alert"
                  data-testid="inverse-stp-row-error-{i}"
                >
                  {row.message}
                </div>
              {/if}
            </td>

            <!-- High-E result -->
            <td
              class="px-2 py-2 text-right whitespace-nowrap font-mono"
              data-testid="inverse-stp-result-high-{i}"
            >
              {#if row.status === "valid" && row.energyHighMevNucl !== null}
                <span class="text-sm font-mono">{formatEnergy(row.energyHighMevNucl)}</span>
              {:else if row.status === "no-solution"}
                <span class="text-muted-foreground text-xs">—</span>
              {:else if row.status === "error"}
                <span class="text-destructive text-xs">{row.message ?? "error"}</span>
              {:else}
                <span class="text-muted-foreground">—</span>
              {/if}
            </td>

            <!-- High-E range -->
            <td
              class="px-2 py-2 text-right whitespace-nowrap font-mono"
              data-testid="inverse-stp-result-range-high-{i}"
            >
              {#if row.status === "valid" && row.rangeHighCm !== null}
                <span class="text-sm font-mono">{formatRangeCm(row.rangeHighCm)}</span>
              {:else}
                <span class="text-muted-foreground">—</span>
              {/if}
            </td>

            <!-- Low-E result + range (only when column visible) -->
            {#if showLowEColumn}
              <td
                class={`px-2 py-2 text-right whitespace-nowrap font-mono transition-colors duration-500 ${loEColumnJustRevealed ? "bg-amber-100/70 dark:bg-amber-900/30" : ""}`}
                data-testid="inverse-stp-result-low-{i}"
              >
                {#if row.status === "valid" && row.energyLowMevNucl !== null}
                  <span class="text-sm font-mono">{formatEnergy(row.energyLowMevNucl)}</span>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/if}
              </td>
              <td
                class={`px-2 py-2 text-right whitespace-nowrap font-mono transition-colors duration-500 ${loEColumnJustRevealed ? "bg-amber-100/70 dark:bg-amber-900/30" : ""}`}
                data-testid="inverse-stp-result-range-low-{i}"
              >
                {#if row.status === "valid" && row.rangeLowCm !== null}
                  <span class="text-sm font-mono">{formatRangeCm(row.rangeLowCm)}</span>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/if}
              </td>
            {/if}

            <!-- Actions: delete + plot -->
            <td class="px-1 py-2 text-center">
              <div class="flex items-center gap-1 justify-end">
                {#if props.onPlotRow && row.status === "valid" && row.energyHighMevNucl !== null && row.energyLowMevNucl !== null}
                  <button
                    type="button"
                    aria-label="Plot row {i + 1} (two series)"
                    data-testid="inverse-stp-plot-{i}"
                    class="text-xs text-primary hover:underline whitespace-nowrap"
                    onclick={() => props.onPlotRow?.(i)}
                  >
                    Plot
                  </button>
                {/if}
                <button
                  type="button"
                  aria-label="Delete row {i + 1}"
                  aria-disabled={!canDeleteRows}
                  data-testid="inverse-stp-delete-{i}"
                  disabled={!canDeleteRows}
                  class={`text-base leading-none ${canDeleteRows ? "text-muted-foreground/50 hover:text-destructive" : "text-muted-foreground/25 cursor-not-allowed"}`}
                  onclick={() => onDeleteRow(i)}>×</button
                >
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <button
    type="button"
    class="text-sm text-primary hover:underline"
    onclick={() => props.inverseLookupState.addStpRow()}>+ Add row</button
  >
</div>
