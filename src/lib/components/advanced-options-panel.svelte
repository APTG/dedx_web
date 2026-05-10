<script lang="ts">
  import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "$lib/components/ui/accordion";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
  } from "$lib/components/ui/tooltip";
  import { NativeSelect } from "$lib/components/ui/native-select";
  import { cn } from "$lib/utils.js";
  import Info from "@lucide/svelte/icons/info";
  import type {
    AggregateState,
    InterpolationScale,
    InterpolationMethod,
    MstarMode,
  } from "$lib/wasm/types";

  import { advancedOptions } from "$lib/state/advanced-options.svelte";

  interface Props {
    materialIsGas: boolean;
    materialBuiltInDensity?: number;
    materialBuiltInAggregateState?: "gas" | "condensed";
    selectedProgram?: string;
    isCustomCompoundActive?: boolean;
  }

  let {
    materialIsGas,
    materialBuiltInDensity,
    materialBuiltInAggregateState,
    selectedProgram,
    isCustomCompoundActive = false,
  }: Props = $props();

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

  // Format density for placeholder and header display
  function formatDensityForDisplay(value: number): string {
    if (value < 0.01) {
      return value.toExponential(2).replace(/\.?0+e/, "e");
    }
    return value.toFixed(3);
  }

  // Get placeholder text for density input
  function getDensityPlaceholder(): string {
    if (materialBuiltInDensity === undefined) {
      return "—";
    }
    return formatDensityForDisplay(materialBuiltInDensity);
  }

  // Get tooltip text for density based on material type
  function getDensityTooltip(): string {
    if (isCustomCompoundActive) {
      return "Custom compounds carry their own density. Edit the compound to change density.";
    }
    if (materialIsGas) {
      return "Gas density depends on pressure and temperature. The built-in value is at standard conditions (STP). Override for non-standard conditions.";
    }
    return "The built-in density is for bulk material at standard conditions. Override for non-standard forms (e.g., powder, pressed pellets, or machined samples).";
  }

  // Validate density input
  function validateDensity(value: string): {
    valid: boolean;
    parsedValue?: number;
    error?: string;
  } {
    if (value === "") {
      return { valid: true };
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return { valid: false, error: "Enter a numeric value" };
    }
    if (parsed <= 0) {
      return { valid: false, error: "Density must be greater than 0" };
    }
    return { valid: true, parsedValue: parsed };
  }

  // Validate I-value input
  function validateIValue(value: string): { valid: boolean; parsedValue?: number; error?: string } {
    if (value === "") {
      return { valid: true };
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return { valid: false, error: "Enter a numeric value" };
    }
    if (parsed <= 0) {
      return { valid: false, error: "I-value must be greater than 0" };
    }
    if (parsed > 10000) {
      return { valid: false, error: "I-value exceeds 10 000 eV (physical maximum)" };
    }
    return { valid: true, parsedValue: parsed };
  }

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

  // Handle interpolation scale change - UNUSED kept for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleInterpolationScaleChange(value: string) {
    const scale = value as InterpolationScale;
    const currentInterpolation = advancedOptions.value.interpolation;

    let newInterpolation: typeof currentInterpolation;
    if (scale === "log") {
      if (!currentInterpolation) {
        newInterpolation = undefined;
      } else if (currentInterpolation.method === undefined) {
        newInterpolation = undefined;
      } else {
        // Keep method, remove scale
        newInterpolation = { method: currentInterpolation.method };
      }
    } else {
      // "lin-lin" -> internal "linear"
      newInterpolation = {
        ...currentInterpolation,
        scale,
      };
    }

    // Create new state object to force reactivity
    advancedOptions.value = {
      ...advancedOptions.value,
      interpolation: newInterpolation,
    };
  }

  // Handle interpolation method change - UNUSED kept for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleInterpolationMethodChange(value: string) {
    const method = value as InterpolationMethod;
    if (method === "linear") {
      if (advancedOptions.value.interpolation) {
        delete advancedOptions.value.interpolation.method;
        if (advancedOptions.value.interpolation.scale === undefined) {
          delete advancedOptions.value.interpolation;
        }
      }
    } else {
      advancedOptions.value.interpolation = {
        ...advancedOptions.value.interpolation,
        method,
      };
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

  // Get accordion header text
  const headerText = $derived.by(() => {
    let text = "Advanced Options";
    const density = advancedOptions.value.densityOverride;
    if (density !== undefined) {
      text += ` (ρ = ${formatDensityForDisplay(density)} g/cm³)`;
    }
    return text;
  });

  // Get current interpolation values for selects - UNUSED kept for reference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentScale = $derived(advancedOptions.value.interpolation?.scale ?? "log");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentMethod = $derived(advancedOptions.value.interpolation?.method ?? "linear");
  const currentMstarMode = $derived(advancedOptions.value.mstarMode ?? "b");

  // Local state for scale select
  let scaleSelectValue = $state<"log-log" | "lin-lin">("log-log");

  // Sync scaleSelectValue with advancedOptions on mount and when options change
  $effect(() => {
    const internalScale = advancedOptions.value.interpolation?.scale;
    scaleSelectValue = internalScale === "linear" ? "lin-lin" : "log-log";
  });

  // Handle scale select change - maps Select values to internal values
  function handleScaleSelectChange(value: string) {
    // value is "log-log" or "lin-lin" from Select options
    const currentInterpolation = advancedOptions.value.interpolation;

    if (value === "log-log") {
      // "log-log" selected -> remove scale (use default)
      if (!currentInterpolation) {
        // already default
      } else if (currentInterpolation.method === undefined) {
        delete advancedOptions.value.interpolation;
      } else {
        // keep method, remove scale
        advancedOptions.value.interpolation = { method: currentInterpolation.method };
      }
    } else {
      // "lin-lin" selected -> internal scale is "linear"
      advancedOptions.value.interpolation = {
        ...currentInterpolation,
        scale: "linear",
      };
    }
  }

  // Local state for method select (maps internal "linear"/"cubic" to select values "linear"/"spline")
  let methodSelectValue = $derived.by(() =>
    advancedOptions.value.interpolation?.method === "cubic" ? "spline" : "linear",
  );

  // Handle method select change - maps "spline" -> "cubic", "linear" -> "linear" (delete)
  function handleMethodSelectChange(value: string) {
    if (value === "spline") {
      advancedOptions.value.interpolation = {
        ...advancedOptions.value.interpolation,
        method: "cubic",
      };
    } else {
      // "linear" value means delete the method (use default)
      if (advancedOptions.value.interpolation) {
        delete advancedOptions.value.interpolation.method;
        if (advancedOptions.value.interpolation.scale === undefined) {
          delete advancedOptions.value.interpolation;
        }
      }
    }
  }

  // Get current aggregate state for toggle highlighting
  const currentAggState = $derived(
    advancedOptions.value.aggregateState ?? (materialIsGas ? "gas" : "condensed"),
  );
</script>

<TooltipProvider>
  <Accordion type="single" collapsible class="w-full border rounded-lg bg-card">
    <AccordionItem value="advanced-options" class="border-b-0">
      <AccordionTrigger class="px-4 py-3 hover:no-underline">
        <span class="text-sm font-medium">{headerText}</span>
      </AccordionTrigger>
      <AccordionContent class="px-4 pb-4 pt-0">
        <div class="grid gap-4">
          <!-- Density Override -->
          <div class="grid gap-2">
            <div class="flex items-center gap-2">
              <Label for="density-override" class="text-sm font-medium">Density</Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info class="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" class="max-w-[250px]">
                  <p class="text-xs">{getDensityTooltip()}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Input
                  id="density-override"
                  type="text"
                  placeholder={getDensityPlaceholder()}
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
                    onclick={clearDensity}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear density override"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
            <Label for="ival-override" class="text-sm font-medium">I-value</Label>
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
                    onclick={clearIValue}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear I-value override"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
                <Label class="text-sm font-medium">Aggregate state</Label>
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
            <Label class="text-sm font-medium">Interpolation</Label>

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
              <Label for="mstar-mode" class="text-sm font-medium">MSTAR mode</Label>
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
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</TooltipProvider>
