<script lang="ts">
  import type { CalculatorState } from "$lib/state/calculator.svelte";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { InverseLookupState } from "$lib/state/inverse-lookups.svelte";
  import type { EnergyUnit } from "$lib/wasm/types";
  import { formatStpValue, formatRangeCm, formatEnergy } from "./value-formatters";
  import { formatSigFigs } from "$lib/utils/unit-conversions";
  import { getAvailableEnergyUnits } from "$lib/utils/available-units";
  import UnitAnchorStrip from "./unit-anchor-strip.svelte";
  import { tick } from "svelte";

  const RANGE_ANCHOR_OPTIONS = [
    { value: "nm", label: "nm", tooltip: "nanometres" },
    { value: "um", label: "µm", tooltip: "micrometres" },
    { value: "mm", label: "mm", tooltip: "millimetres" },
    { value: "cm", label: "cm", tooltip: "centimetres" },
    { value: "m", label: "m", tooltip: "metres" },
  ];

  const ENERGY_UNIT_TOOLTIPS: Record<EnergyUnit, string> = {
    MeV: "Megaelectronvolts — total kinetic energy",
    "MeV/nucl": "MeV per nucleon — kinetic energy per nucleon (equals MeV for proton)",
    "MeV/u": "MeV per unified atomic mass unit — differs from MeV by ~0.001 for proton",
  };

  type EnergyModeProps = {
    mode: "energy";
    calcState: CalculatorState;
    entitySelection: EntitySelectionState;
    class?: string;
  };

  type RangeModeProps = {
    mode: "range";
    inverseLookupState: InverseLookupState;
    class?: string;
  };

  type Props = EnergyModeProps | RangeModeProps;

  let props: Props = $props();

  // Derived per-mode state
  const isEnergy = $derived(props.mode === "energy");
  const calcState = $derived(isEnergy ? (props as EnergyModeProps).calcState : null);
  const entitySelection = $derived(isEnergy ? (props as EnergyModeProps).entitySelection : null);
  const inverseLookupState = $derived(
    !isEnergy ? (props as RangeModeProps).inverseLookupState : null,
  );

  // Energy → mode: rows and derived state
  const energyRows = $derived(calcState?.rows ?? []);
  const showMevNuclColumn = $derived(calcState?.isPerRowMode ?? false);

  // Energy anchor options (energy mode only)
  const energyAnchorOptions = $derived.by(() => {
    if (!isEnergy || !entitySelection) return [];
    const particle = entitySelection.selectedParticle;
    return getAvailableEnergyUnits(
      particle as Parameters<typeof getAvailableEnergyUnits>[0],
      true,
    ).map((u) => ({
      value: u,
      label: u,
      tooltip: ENERGY_UNIT_TOOLTIPS[u as EnergyUnit] ?? u,
    }));
  });

  // Range → mode: rows
  const rangeRows = $derived(inverseLookupState?.rangeRows ?? []);

  function inputClass(status: string): string {
    const isError = status === "invalid" || status === "out-of-range" || status === "error";
    return `w-28 px-2 py-1 border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
      isError ? "border-destructive bg-destructive/5" : "border-input"
    }`;
  }

  function cellClass(status: string): string {
    return status === "out-of-range" ? "text-destructive" : "";
  }

  // Energy → mode handlers
  function handleEnergyInput(e: Event, i: number) {
    if (!calcState) return;
    calcState.updateRowText(i, (e.target as HTMLInputElement).value);
    calcState.triggerCalculation();
  }

  function advancedInputs() {
    return document.querySelectorAll<HTMLInputElement>(
      "[data-testid='advanced-combined-table'] input[data-row-index]",
    );
  }

  function focusAdvancedRow(index: number): void {
    tick().then(() => advancedInputs()[index]?.focus());
  }

  function handleEnergyKeyDown(e: KeyboardEvent, i: number) {
    if (!calcState) return;

    if (e.key === "Escape") {
      e.preventDefault();
      const target = e.target as HTMLInputElement;
      tick().then(() => target.blur());
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      calcState.handleBlur(i);
      if (e.shiftKey) return;
      const next = advancedInputs()[i + 1];
      if (next) {
        next.focus();
      } else {
        calcState.addRow();
        focusAdvancedRow(i + 1);
      }
      return;
    }

    if (e.key === "Tab") {
      const target = advancedInputs()[e.shiftKey ? i - 1 : i + 1];
      if (target) {
        e.preventDefault();
        calcState.handleBlur(i);
        target.focus();
      }
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const direction = e.key === "ArrowUp" ? "up" : "down";
        calcState.moveRow(i, direction);
        focusAdvancedRow(direction === "up" ? i - 1 : i + 1);
      } else {
        e.preventDefault();
        advancedInputs()[e.key === "ArrowUp" ? i - 1 : i + 1]?.focus();
      }
      return;
    }

    if (e.key === "Backspace") {
      const input = e.target as HTMLInputElement;
      if (input.value === "" && calcState && calcState.rows.length > 1) {
        e.preventDefault();
        calcState.removeRow(i);
        tick().then(() => focusAdvancedRow(Math.max(0, i - 1)));
      }
    }
  }

  function handleEnergyFocus(e: Event) {
    (e.target as HTMLInputElement).select();
  }

  function handleEnergyPaste(e: ClipboardEvent, i: number) {
    if (!calcState) return;
    e.preventDefault();
    const text = e.clipboardData?.getData("text") ?? "";
    const lines = text
      .split(/\r?\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (lines.length === 0) return;
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (!line) continue;
      const target = i + j;
      if (target >= calcState.rows.length) {
        calcState.updateRowText(calcState.rows.length - 1, line);
      } else {
        calcState.updateRowText(target, line);
      }
    }
    calcState.triggerCalculation();
  }

  // Range → mode handlers
  function handleRangeInput(e: Event, i: number) {
    if (!inverseLookupState) return;
    inverseLookupState.updateRangeRowText(i, (e.target as HTMLInputElement).value);
  }

  function rangeUnitLabel(row: (typeof rangeRows)[0]): string {
    const u = row.unitFromSuffix ? row.unit : (inverseLookupState?.rangeMasterUnit ?? "cm");
    return u === "um" ? "µm" : u;
  }
</script>

<div class={`space-y-2 ${props.class ?? ""}`}>
  {#if isEnergy && calcState && entitySelection}
    <!-- Energy → mode: compact unit selector above table -->
    {#if energyAnchorOptions.length > 0}
      <UnitAnchorStrip
        options={energyAnchorOptions}
        selected={calcState.masterUnit}
        onSelect={(v) => calcState?.setMasterUnit(v as EnergyUnit)}
        disabled={calcState.isPerRowMode}
        data-testid="advanced-energy-unit-strip"
      />
    {/if}

    <div class="overflow-x-auto">
      <table
        class="w-full min-w-[480px] text-sm border-collapse"
        data-testid="advanced-combined-table"
      >
        <thead class="sticky top-0 bg-background">
          <tr>
            <th
              scope="col"
              class="sticky left-0 z-20 bg-background w-6 px-1 py-2 border-b"
              aria-label="Drag handle"
            ></th>
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b w-8"
              >#</th
            >
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b"
              >Energy ({calcState.masterUnit})</th
            >
            {#if showMevNuclColumn}
              <th
                scope="col"
                class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
                data-testid="mev-nucl-column-header">→ MeV/nucl</th
              >
            {/if}
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
              >STP ({calcState.stpDisplayUnit})</th
            >
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
              >CSDA Range</th
            >
            <th scope="col" class="px-1 py-2 font-medium border-b w-6" aria-label="Delete row"></th>
          </tr>
        </thead>
        <tbody>
          {#each energyRows as row, i (row.id)}
            <tr
              class={i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : "even:bg-muted/20"}
              data-testid="advanced-energy-row-{i}"
            >
              <!-- Drag handle (static, drag behaviour in #562) -->
              <td
                class={`sticky left-0 z-10 px-1 py-2 text-muted-foreground/40 select-none ${i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : i % 2 === 1 ? "bg-muted/20" : "bg-background"}`}
                aria-hidden="true">≡</td
              >

              <!-- Row index -->
              <td class="px-2 py-2 text-muted-foreground text-xs tabular-nums">{i + 1}</td>

              <!-- Energy input -->
              <td class="px-2 py-2">
                <input
                  type="text"
                  inputmode="text"
                  aria-label={`Energy value row ${i + 1}`}
                  data-row-index={i}
                  data-testid="advanced-energy-input-{i}"
                  value={row.rawInput}
                  placeholder="e.g. 100 keV"
                  class={inputClass(row.status)}
                  onfocus={handleEnergyFocus}
                  oninput={(e) => handleEnergyInput(e, i)}
                  onkeydown={(e) => handleEnergyKeyDown(e, i)}
                  onpaste={(e) => handleEnergyPaste(e, i)}
                  onblur={() => tick().then(() => calcState?.handleBlur(i))}
                />
                {#if row.message && (row.status === "invalid" || row.status === "out-of-range")}
                  <div class="mt-0.5 text-xs text-destructive" role="alert">{row.message}</div>
                {/if}
              </td>

              <!-- → MeV/nucl (conditional) -->
              {#if showMevNuclColumn}
                <td
                  class="px-2 py-2 text-right whitespace-nowrap font-mono text-muted-foreground"
                  data-testid="advanced-mev-nucl-cell-{i}"
                >
                  {row.normalizedMevNucl !== null ? formatSigFigs(row.normalizedMevNucl, 4) : "—"}
                </td>
              {/if}

              <!-- STP result -->
              <td
                class={`px-2 py-2 text-right whitespace-nowrap font-mono ${cellClass(row.status)}`}
                data-testid="advanced-stp-cell-{i}"
              >
                {#if row.status === "out-of-range"}
                  <span class="text-destructive text-xs">out of range</span>
                {:else if row.stoppingPower !== null && !calcState.isCalculating}
                  {formatStpValue(row.stoppingPower, calcState.stpDisplayUnit)}
                {:else}
                  —
                {/if}
              </td>

              <!-- CSDA Range result -->
              <td
                class={`px-2 py-2 text-right whitespace-nowrap font-mono ${cellClass(row.status)}`}
                data-testid="advanced-range-cell-{i}"
              >
                {#if row.status === "out-of-range"}
                  <span class="text-destructive text-xs">out of range</span>
                {:else if row.csdaRangeCm !== null && !calcState.isCalculating}
                  {formatRangeCm(row.csdaRangeCm)}
                {:else}
                  —
                {/if}
              </td>

              <!-- Delete row -->
              <td class="px-1 py-2 text-center">
                {#if energyRows.length > 1}
                  <button
                    type="button"
                    aria-label="Delete row {i + 1}"
                    data-testid="advanced-delete-row-{i}"
                    class="text-muted-foreground/50 hover:text-destructive text-base leading-none"
                    onclick={() => calcState?.removeRow(i)}>×</button
                  >
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if calcState.validationSummary.invalid > 0 || calcState.validationSummary.outOfRange > 0}
      <div class="text-xs text-muted-foreground">
        {calcState.validationSummary.invalid + calcState.validationSummary.outOfRange} of {calcState
          .validationSummary.total} values excluded ({#if calcState.validationSummary.invalid > 0}{calcState
            .validationSummary.invalid} invalid{/if}{#if calcState.validationSummary.invalid > 0 && calcState.validationSummary.outOfRange > 0},
        {/if}{#if calcState.validationSummary.outOfRange > 0}{calcState.validationSummary
            .outOfRange} out of range{/if})
      </div>
    {/if}

    <button
      type="button"
      class="text-sm text-primary hover:underline"
      onclick={() => calcState?.addRow()}>+ Add row</button
    >
  {:else if !isEnergy && inverseLookupState}
    <!-- Range → mode: compact unit selector above table -->
    <div class="flex items-center gap-3">
      <UnitAnchorStrip
        options={RANGE_ANCHOR_OPTIONS}
        selected={inverseLookupState.rangeMasterUnit}
        onSelect={(v) =>
          inverseLookupState?.setRangeMasterUnit(v as "nm" | "um" | "mm" | "cm" | "m")}
        disabled={inverseLookupState.rangeRows.some((r) => r.unitFromSuffix)}
        data-testid="inverse-range-unit"
      />
      {#if inverseLookupState.rangeRows.some((r) => r.unitFromSuffix)}
        <span class="text-xs text-muted-foreground">(per-row mode active)</span>
      {/if}
    </div>

    <div class="overflow-x-auto">
      <table
        class="w-full min-w-[400px] text-sm border-collapse"
        data-testid="advanced-range-table"
      >
        <thead class="sticky top-0 bg-background">
          <tr>
            <th
              scope="col"
              class="sticky left-0 z-20 bg-background w-6 px-1 py-2 border-b"
              aria-label="Drag handle"
            ></th>
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b w-8"
              >#</th
            >
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b"
              >Range</th
            >
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-left border-b"
              >Unit</th
            >
            <th scope="col" class="px-2 py-2 font-medium whitespace-nowrap text-right border-b"
              >→ Energy</th
            >
            <th scope="col" class="px-1 py-2 font-medium border-b w-6" aria-label="Delete row"></th>
          </tr>
        </thead>
        <tbody>
          {#each rangeRows as row, i (row.id)}
            <tr
              class={i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : "even:bg-muted/20"}
              data-testid="inverse-range-row-{i}"
            >
              <!-- Drag handle -->
              <td
                class={`sticky left-0 z-10 px-1 py-2 text-muted-foreground/40 select-none ${i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : i % 2 === 1 ? "bg-muted/20" : "bg-background"}`}
                aria-hidden="true">≡</td
              >

              <!-- Row index -->
              <td class="px-2 py-2 text-muted-foreground text-xs tabular-nums">{i + 1}</td>

              <!-- Range input -->
              <td class="px-2 py-2">
                <input
                  type="text"
                  aria-label={`Range value row ${i + 1}`}
                  value={row.text}
                  placeholder="e.g. 7.718 cm"
                  class={inputClass(row.status)}
                  oninput={(e) => handleRangeInput(e, i)}
                  data-testid="inverse-range-input-{i}"
                />
              </td>

              <!-- Unit badge -->
              <td class="px-2 py-2">
                <span class="rounded border border-input bg-muted px-2 py-0.5 text-xs"
                  >{rangeUnitLabel(row)}</span
                >
              </td>

              <!-- → Energy result -->
              <td
                class="px-2 py-2 text-right whitespace-nowrap font-mono"
                data-testid="inverse-range-result-{i}"
              >
                {#if row.status === "valid" && row.energyMevNucl !== null}
                  {formatEnergy(row.energyMevNucl)}
                {:else if row.status === "out-of-range"}
                  <span class="text-destructive text-xs">out of range</span>
                {:else if row.status === "invalid" || row.status === "error"}
                  <span class="text-destructive text-xs">{row.message ?? "invalid"}</span>
                {:else}
                  —
                {/if}
              </td>

              <!-- Delete row -->
              <td class="px-1 py-2 text-center">
                {#if rangeRows.length > 1}
                  <button
                    type="button"
                    aria-label="Delete range row {i + 1}"
                    data-testid="inverse-range-delete-{i}"
                    class="text-muted-foreground/50 hover:text-destructive text-base leading-none"
                    onclick={() => inverseLookupState?.removeRangeRow(i)}>×</button
                  >
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <button
      type="button"
      class="text-sm text-primary hover:underline"
      onclick={() => inverseLookupState?.addRangeRow()}>+ Add row</button
    >
  {/if}
</div>
