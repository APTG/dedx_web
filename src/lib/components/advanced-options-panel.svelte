<script lang="ts">
  import { browser } from "$app/environment";
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "$lib/components/ui/accordion";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { NativeSelect } from "$lib/components/ui/native-select";
  import HelpHint from "$lib/components/help-hint.svelte";
  import { cn } from "$lib/utils.js";
  import type { AggregateState, MstarMode, AdvancedOptions } from "$lib/wasm/types";

  import { advancedOptions } from "$lib/state/advanced-options.svelte";
  import {
    getDensityPlaceholder,
    getDensityTooltip,
    validateDensity,
    validateIValue,
    buildHeaderText,
    scaleToSelectValue,
    methodToSelectValue,
    nextInterpolationForScale,
    nextInterpolationForMethod,
    type ScaleSelectValue,
    type MethodSelectValue,
  } from "$lib/utils/advanced-options-fields";

  /**
   * Manual Y-range override wiring for the plot page (#798). When supplied, the
   * panel renders the `yMin`/`yMax` inputs at the top of its content and behaves
   * as the plot's `⚙ Advanced options` disclosure (gear header, content hint,
   * persisted open/closed state). The calculator page omits this prop and keeps
   * the plain physics-only panel.
   */
  interface PlotRangeControls {
    yMin: number | undefined;
    yMax: number | undefined;
    setYRange: (bound: "min" | "max", value: number | undefined) => void;
  }

  interface Props {
    materialIsGas: boolean;
    materialBuiltInDensity?: number | undefined;
    materialBuiltInAggregateState?: "gas" | "condensed" | undefined;
    selectedProgram?: string | undefined;
    isCustomCompoundActive?: boolean | undefined;
    /** Plot-page Y-range override (#798); enables the disclosure presentation. */
    plotRanges?: PlotRangeControls | undefined;
    /** Render the density/I-value/interpolation/MSTAR physics controls. */
    showCalculationControls?: boolean;
    /** localStorage key persisting open/closed for the plot disclosure (#798). */
    persistKey?: string | undefined;
  }

  let {
    materialIsGas,
    materialBuiltInDensity,
    materialBuiltInAggregateState,
    selectedProgram,
    isCustomCompoundActive = false,
    plotRanges,
    showCalculationControls = true,
    persistKey,
  }: Props = $props();

  // Plot disclosure mode (#798): gear header + content hint + persistence.
  const isPlotDisclosure = $derived(plotRanges !== undefined);

  // Accordion open/closed value ("" = collapsed, ITEM_VALUE = open). In plot
  // disclosure mode we control it so the choice can persist to localStorage;
  // the calculator leaves it uncontrolled (collapsed default).
  const ITEM_VALUE = "advanced-options";
  let openValue = $state("");

  // Hydrate the persisted open/closed state once on mount (browser only).
  $effect(() => {
    if (!browser || !persistKey) return;
    openValue = localStorage.getItem(persistKey) === "1" ? ITEM_VALUE : "";
  });

  function handleOpenChange(value: string | undefined) {
    openValue = value ?? "";
    if (browser && persistKey) {
      if (openValue === ITEM_VALUE) localStorage.setItem(persistKey, "1");
      else localStorage.removeItem(persistKey);
    }
  }

  // ── Manual Y-range (#798) ──
  let yMinInput = $state("");
  let yMaxInput = $state("");

  // Mirror the plot state into the local inputs (e.g. after a Reset all).
  $effect(() => {
    if (!plotRanges) return;
    yMinInput = plotRanges.yMin !== undefined ? String(plotRanges.yMin) : "";
    yMaxInput = plotRanges.yMax !== undefined ? String(plotRanges.yMax) : "";
  });

  // Empty input clears the override (auto-range); a finite positive number wins
  // verbatim over the auto/`niceCeil` range computed in `computeAxisRanges`.
  function parseRange(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  function handleYMinChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    yMinInput = value;
    plotRanges?.setYRange("min", parseRange(value));
  }

  function handleYMaxChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    yMaxInput = value;
    plotRanges?.setYRange("max", parseRange(value));
  }

  // Local state for input values and validation
  let densityInput = $state("");
  let densityError = $state<string | null>(null);
  let iValueInput = $state("");
  let iValueError = $state<string | null>(null);

  // Sync local state with reactive options on mount and when options change
  $effect(() => {
    const densityVal =
      advancedOptions.value.densityOverride !== undefined
        ? String(advancedOptions.value.densityOverride)
        : "";
    const ivalVal =
      advancedOptions.value.iValueOverride !== undefined
        ? String(advancedOptions.value.iValueOverride)
        : "";
    // Use untracked assignment pattern - these are intentional synchronizations
    densityInput = densityVal;
    iValueInput = ivalVal;
  });

  // Handle density input change
  function handleDensityChange(event: Event) {
    if (isCustomCompoundActive) return;
    const input = event.target as HTMLInputElement;
    const value = input.value;
    densityInput = value;

    const validation = validateDensity(value);
    if (!validation.valid) {
      densityError = validation.error ?? null;
      return;
    }

    densityError = null;
    if (validation.parsedValue !== undefined) {
      advancedOptions.value.densityOverride = validation.parsedValue;
    } else {
      delete advancedOptions.value.densityOverride;
    }
  }

  // Handle I-value input change
  function handleIValueChange(event: Event) {
    if (isCustomCompoundActive) return;
    const input = event.target as HTMLInputElement;
    const value = input.value;
    iValueInput = value;

    const validation = validateIValue(value);
    if (!validation.valid) {
      iValueError = validation.error ?? null;
      return;
    }

    iValueError = null;
    if (validation.parsedValue !== undefined) {
      advancedOptions.value.iValueOverride = validation.parsedValue;
    } else {
      delete advancedOptions.value.iValueOverride;
    }
  }

  // Clear density override
  function clearDensity() {
    if (isCustomCompoundActive) return;
    densityInput = "";
    densityError = null;
    delete advancedOptions.value.densityOverride;
  }

  // Clear I-value override
  function clearIValue() {
    if (isCustomCompoundActive) return;
    iValueInput = "";
    iValueError = null;
    delete advancedOptions.value.iValueOverride;
  }

  // Handle aggregate state toggle
  function handleAggStateChange(newState: AggregateState) {
    if (isCustomCompoundActive) return;
    const builtInPhase: AggregateState | undefined = materialBuiltInAggregateState;
    if (builtInPhase && newState === builtInPhase) {
      delete advancedOptions.value.aggregateState;
    } else {
      advancedOptions.value.aggregateState = newState;
    }
  }

  // Handle MSTAR mode change
  function handleMstarModeChange(value: string) {
    const mode = value as MstarMode;
    if (mode === "b") {
      delete advancedOptions.value.mstarMode;
    } else {
      advancedOptions.value.mstarMode = mode;
    }
  }

  // Check if MSTAR is selected
  const isMstarSelected = $derived(selectedProgram === "MSTAR" || selectedProgram === "mstar");

  // Check if aggregate state section should be shown
  const showAggState = $derived(materialBuiltInAggregateState !== undefined);

  // Get accordion header text. Plot disclosure mode uses the fixed
  // "⚙ Advanced options" label; the calculator keeps the density-aware text.
  const headerText = $derived(
    isPlotDisclosure
      ? "⚙ Advanced options"
      : buildHeaderText(advancedOptions.value.densityOverride),
  );

  // Muted hint of what's inside, shown beside the plot disclosure header. Only
  // advertises controls that actually render (calc controls hide in Basic mode).
  const contentHint = $derived(
    showCalculationControls ? "Y-range · density · interpolation" : "Y-range",
  );

  const currentMstarMode = $derived(advancedOptions.value.mstarMode ?? "b");

  // Scale select value, derived from the interpolation override (mirrors methodSelectValue).
  const scaleSelectValue = $derived(scaleToSelectValue(advancedOptions.value.interpolation?.scale));

  // Apply a computed next-interpolation state to the singleton (undefined = clear).
  function applyInterpolation(next: AdvancedOptions["interpolation"]) {
    if (next === undefined) {
      delete advancedOptions.value.interpolation;
    } else {
      advancedOptions.value.interpolation = next;
    }
  }

  // Handle scale select change - maps Select values to internal values
  function handleScaleSelectChange(value: string) {
    applyInterpolation(
      nextInterpolationForScale(advancedOptions.value.interpolation, value as ScaleSelectValue),
    );
  }

  // Local state for method select (maps internal "linear"/"cubic" to select values "linear"/"spline")
  let methodSelectValue = $derived(
    methodToSelectValue(advancedOptions.value.interpolation?.method),
  );

  // Handle method select change - maps "spline" -> "cubic", "linear" -> "linear" (delete)
  function handleMethodSelectChange(value: string) {
    applyInterpolation(
      nextInterpolationForMethod(advancedOptions.value.interpolation, value as MethodSelectValue),
    );
  }

  // Get current aggregate state for toggle highlighting
  const currentAggState = $derived(
    advancedOptions.value.aggregateState ?? (materialIsGas ? "gas" : "condensed"),
  );
</script>

<Accordion
  type="single"
  collapsible
  class="w-full border rounded-lg bg-card"
  value={openValue}
  onValueChange={(v) => handleOpenChange(v as string | undefined)}
>
  <AccordionItem
    value={ITEM_VALUE}
    class="border-b-0"
    data-testid={isPlotDisclosure ? "plot-advanced-panel" : undefined}
  >
    <AccordionTrigger
      class="px-4 py-3 hover:no-underline"
      data-testid={isPlotDisclosure ? "plot-advanced-toggle" : undefined}
    >
      <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="text-sm font-medium">{headerText}</span>
        {#if isPlotDisclosure}
          <span class="text-xs font-normal text-muted-foreground">{contentHint}</span>
        {/if}
      </span>
    </AccordionTrigger>
    <AccordionContent class="px-4 pb-4 pt-0">
      <div class="grid gap-4">
        <!-- Manual Y-range override (#798) -->
        {#if plotRanges}
          <div class="grid gap-2">
            <div class="flex items-center gap-2">
              <Label class="text-sm font-medium">Y-axis range</Label>
            </div>
            <p class="text-xs text-muted-foreground">
              Leave blank for automatic range. A value here overrides the auto-range.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div class="grid gap-1.5">
                <Label for="plot-ymin" class="text-xs text-muted-foreground">Min</Label>
                <Input
                  id="plot-ymin"
                  data-testid="plot-ymin"
                  type="number"
                  inputmode="decimal"
                  placeholder="auto"
                  value={yMinInput}
                  oninput={handleYMinChange}
                />
              </div>
              <div class="grid gap-1.5">
                <Label for="plot-ymax" class="text-xs text-muted-foreground">Max</Label>
                <Input
                  id="plot-ymax"
                  data-testid="plot-ymax"
                  type="number"
                  inputmode="decimal"
                  placeholder="auto"
                  value={yMaxInput}
                  oninput={handleYMaxChange}
                />
              </div>
            </div>
          </div>
        {/if}

        {#if showCalculationControls}
          <!-- Density Override -->
          <div class="grid gap-2">
            <div class="flex items-center gap-2">
              <Label for="density-override" class="text-sm font-medium">Density</Label>
              <HelpHint
                text={getDensityTooltip(isCustomCompoundActive, materialIsGas)}
                href="/docs/user-guide#advanced-options"
                side="right"
                testId="advanced-density-help"
              />
            </div>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Input
                  id="density-override"
                  type="text"
                  placeholder={getDensityPlaceholder(materialBuiltInDensity)}
                  value={densityInput}
                  disabled={isCustomCompoundActive}
                  title={isCustomCompoundActive
                    ? "Custom compounds carry their own density. Edit the compound to change density."
                    : undefined}
                  oninput={handleDensityChange}
                  class={cn(
                    "pr-16",
                    densityError && "border-destructive focus-visible:ring-destructive",
                  )}
                  aria-invalid={densityError ? "true" : "false"}
                  aria-describedby={densityError ? "density-error" : undefined}
                />
                {#if densityInput !== ""}
                  <button
                    type="button"
                    disabled={isCustomCompoundActive}
                    title={isCustomCompoundActive
                      ? "Custom compounds carry their own density. Edit the compound to change density."
                      : undefined}
                    onclick={clearDensity}
                    class="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Clear density override"
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
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                {/if}
              </div>
              <span class="text-sm text-muted-foreground">g/cm³</span>
            </div>
            {#if densityError}
              <p id="density-error" class="text-xs text-destructive">{densityError}</p>
            {/if}
          </div>

          <!-- I-Value Override -->
          <div class="grid gap-2">
            <div class="flex items-center gap-2">
              <Label for="ival-override" class="text-sm font-medium">I-value</Label>
              <HelpHint term="iValueOverride" side="right" testId="advanced-ivalue-help" />
            </div>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Input
                  id="ival-override"
                  type="text"
                  placeholder="e.g., 75.0"
                  value={iValueInput}
                  disabled={isCustomCompoundActive}
                  title={isCustomCompoundActive
                    ? "Custom compounds carry their own I-value. Edit the compound to change it."
                    : undefined}
                  oninput={handleIValueChange}
                  class={cn(
                    "pr-16",
                    iValueError && "border-destructive focus-visible:ring-destructive",
                  )}
                  aria-invalid={iValueError ? "true" : "false"}
                  aria-describedby={iValueError ? "ival-error" : undefined}
                />
                {#if iValueInput !== ""}
                  <button
                    type="button"
                    disabled={isCustomCompoundActive}
                    title={isCustomCompoundActive
                      ? "Custom compounds carry their own I-value. Edit the compound to change it."
                      : undefined}
                    onclick={clearIValue}
                    class="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Clear I-value override"
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
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                {/if}
              </div>
              <span class="text-sm text-muted-foreground">eV</span>
            </div>
            {#if iValueError}
              <p id="ival-error" class="text-xs text-destructive">{iValueError}</p>
            {/if}
          </div>

          <!-- Aggregate State -->
          {#if showAggState}
            <div class="grid gap-2">
              <div class="grid gap-1.5">
                <div class="flex items-center gap-2">
                  <Label class="text-sm font-medium">Aggregate state</Label>
                  <HelpHint term="aggregateState" side="right" testId="advanced-agg-state-help" />
                </div>
                <p class="text-xs text-muted-foreground">
                  Built-in: {materialIsGas ? "Gas" : "Condensed"}
                </p>
              </div>
              <div class="flex gap-1">
                <button
                  type="button"
                  disabled={isCustomCompoundActive}
                  title={isCustomCompoundActive
                    ? "Custom compounds carry their own aggregate state. Edit the compound to change it."
                    : undefined}
                  onclick={() => handleAggStateChange("gas")}
                  class={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    currentAggState === "gas"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                  aria-pressed={currentAggState === "gas"}
                >
                  Gas
                </button>
                <button
                  type="button"
                  disabled={isCustomCompoundActive}
                  title={isCustomCompoundActive
                    ? "Custom compounds carry their own aggregate state. Edit the compound to change it."
                    : undefined}
                  onclick={() => handleAggStateChange("condensed")}
                  class={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    currentAggState === "condensed"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-accent",
                  )}
                  aria-pressed={currentAggState === "condensed"}
                >
                  Condensed
                </button>
              </div>
            </div>
          {/if}

          <!-- Interpolation -->
          <div class="grid gap-3">
            <div class="flex items-center gap-2">
              <Label class="text-sm font-medium">Interpolation</Label>
              <HelpHint term="interpolation" side="right" testId="advanced-interpolation-help" />
            </div>

            <!-- Axis Scale -->
            <div class="grid gap-1.5">
              <Label for="interp-scale" class="text-xs text-muted-foreground">Axis scale</Label>
              <NativeSelect
                id="interp-scale"
                value={scaleSelectValue}
                onValueChange={handleScaleSelectChange}
                options={[
                  { value: "log-log", label: "Log-log" },
                  { value: "lin-lin", label: "Lin-lin" },
                ]}
              />
            </div>

            <!-- Method -->
            <div class="grid gap-1.5">
              <Label for="interp-method" class="text-xs text-muted-foreground">Method</Label>
              <NativeSelect
                id="interp-method"
                value={methodSelectValue}
                onValueChange={handleMethodSelectChange}
                options={[
                  { value: "linear", label: "Linear" },
                  { value: "spline", label: "Spline" },
                ]}
              />
            </div>

            <p class="text-xs text-muted-foreground">
              Applies to all data sources. Mixing interpolation settings across series is not
              supported.
            </p>
          </div>

          <!-- MSTAR Mode -->
          {#if isMstarSelected}
            <div class="grid gap-2">
              <div class="flex items-center gap-2">
                <Label for="mstar-mode" class="text-sm font-medium">MSTAR mode</Label>
                <HelpHint term="mstarMode" side="right" testId="advanced-mstar-help" />
              </div>
              <NativeSelect
                id="mstar-mode"
                value={currentMstarMode}
                onValueChange={handleMstarModeChange}
                options={[
                  { value: "a", label: "A — Auto (C for condensed, G for gas)" },
                  { value: "b", label: "B — Auto (D for condensed, H for gas) — Recommended" },
                  { value: "c", label: "C — Condensed (standard)" },
                  { value: "d", label: "D — Condensed (special)" },
                  { value: "g", label: "G — Gas (standard)" },
                  { value: "h", label: "H — Gas (special)" },
                ]}
              />
            </div>
          {/if}
        {/if}
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
