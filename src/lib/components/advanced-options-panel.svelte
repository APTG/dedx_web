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
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import { cn } from "$lib/utils";
  import Info from "@lucide/svelte/icons/info";
  import type {
    AdvancedOptions,
    AggregateState,
    InterpolationScale,
    InterpolationMethod,
    MstarMode,
  } from "$lib/wasm/types";

  interface Props {
    options: { value: AdvancedOptions };
    materialIsGas: boolean;
    materialBuiltInDensity?: number;
    materialBuiltInAggregateState?: "gas" | "condensed";
    selectedProgram?: string;
  }

  let {
    options,
    materialIsGas,
    materialBuiltInDensity,
    materialBuiltInAggregateState,
    selectedProgram,
  }: Props = $props();

  // Local state for input values and validation
  let densityInput = $state("");
  let densityError = $state<string | null>(null);
  let iValueInput = $state("");
  let iValueError = $state<string | null>(null);

  // Sync local state with reactive options on mount and when options change
  $effect(() => {
    const opt = options.value;
    const densityVal = opt.densityOverride !== undefined ? String(opt.densityOverride) : "";
    const ivalVal = opt.iValueOverride !== undefined ? String(opt.iValueOverride) : "";
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
      options.value.densityOverride = validation.parsedValue;
    } else {
      delete options.value.densityOverride;
    }
  }

  // Handle I-value input change
  function handleIValueChange(event: Event) {
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
      options.value.iValueOverride = validation.parsedValue;
    } else {
      delete options.value.iValueOverride;
    }
  }

  // Clear density override
  function clearDensity() {
    densityInput = "";
    densityError = null;
    delete options.value.densityOverride;
  }

  // Clear I-value override
  function clearIValue() {
    iValueInput = "";
    iValueError = null;
    delete options.value.iValueOverride;
  }

  // Handle aggregate state toggle
  function handleAggStateChange(newState: AggregateState) {
    const builtInPhase: AggregateState | undefined = materialBuiltInAggregateState;
    if (builtInPhase && newState === builtInPhase) {
      delete options.value.aggregateState;
    } else {
      options.value.aggregateState = newState;
    }
  }

  // Handle interpolation scale change
  function handleInterpolationScaleChange(value: string) {
    const scale = value as InterpolationScale;
    if (scale === "log") {
      if (options.value.interpolation) {
        delete options.value.interpolation.scale;
        if (options.value.interpolation.method === undefined) {
          delete options.value.interpolation;
        }
      }
    } else {
      options.value.interpolation = {
        ...options.value.interpolation,
        scale,
      };
    }
  }

  // Handle interpolation method change
  function handleInterpolationMethodChange(value: string) {
    const method = value as InterpolationMethod;
    if (method === "linear") {
      if (options.value.interpolation) {
        delete options.value.interpolation.method;
        if (options.value.interpolation.scale === undefined) {
          delete options.value.interpolation;
        }
      }
    } else {
      options.value.interpolation = {
        ...options.value.interpolation,
        method,
      };
    }
  }

  // Handle MSTAR mode change
  function handleMstarModeChange(value: string) {
    const mode = value as MstarMode;
    if (mode === "b") {
      delete options.value.mstarMode;
    } else {
      options.value.mstarMode = mode;
    }
  }

  // Check if MSTAR is selected
  const isMstarSelected = $derived(selectedProgram === "MSTAR" || selectedProgram === "mstar");

  // Check if aggregate state section should be shown
  const showAggState = $derived(materialBuiltInAggregateState !== undefined);

  // Get accordion header text
  const headerText = $derived.by(() => {
    let text = "Advanced Options";
    const density = options.value.densityOverride;
    if (density !== undefined) {
      text += ` (ρ = ${formatDensityForDisplay(density)} g/cm³)`;
    }
    return text;
  });

  // Get current interpolation values for selects
  const currentScale = $derived(options.value.interpolation?.scale ?? "log");
  const currentMethod = $derived(options.value.interpolation?.method ?? "linear");
  const currentMstarMode = $derived(options.value.mstarMode ?? "b");

  // Get current aggregate state for toggle highlighting
  const currentAggState = $derived(
    options.value.aggregateState ?? (materialIsGas ? "gas" : "condensed"),
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
              <Select
                value={currentScale === "log" ? "log-log" : "lin-lin"}
                onValueChange={handleInterpolationScaleChange}
              >
                <SelectTrigger id="interp-scale" class="w-full">
                  <span>{currentScale === "log" ? "Log-log" : "Lin-lin"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="log-log" label="Log-log" />
                  <SelectItem value="lin-lin" label="Lin-lin" />
                </SelectContent>
              </Select>
            </div>

            <!-- Method -->
            <div class="grid gap-1.5">
              <Label for="interp-method" class="text-xs text-muted-foreground">Method</Label>
              <Select
                value={currentMethod === "cubic" ? "spline" : "linear"}
                onValueChange={handleInterpolationMethodChange}
              >
                <SelectTrigger id="interp-method" class="w-full">
                  <span>{currentMethod === "cubic" ? "Spline" : "Linear"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear" label="Linear" />
                  <SelectItem value="spline" label="Spline" />
                </SelectContent>
              </Select>
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
              <Select value={currentMstarMode} onValueChange={handleMstarModeChange}>
                <SelectTrigger id="mstar-mode" class="w-full">
                  <span>
                    {#if currentMstarMode === "a"}A — Auto (C for condensed, G for gas)
                    {:else if currentMstarMode === "b"}B — Auto (D for condensed, H for gas) —
                      Recommended
                    {:else if currentMstarMode === "c"}C — Condensed (standard)
                    {:else if currentMstarMode === "d"}D — Condensed (special)
                    {:else if currentMstarMode === "g"}G — Gas (standard)
                    {:else if currentMstarMode === "h"}H — Gas (special){/if}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a" label="A — Auto (C for condensed, G for gas)" />
                  <SelectItem
                    value="b"
                    label="B — Auto (D for condensed, H for gas) — Recommended"
                  />
                  <SelectItem value="c" label="C — Condensed (standard)" />
                  <SelectItem value="d" label="D — Condensed (special)" />
                  <SelectItem value="g" label="G — Gas (standard)" />
                  <SelectItem value="h" label="H — Gas (special)" />
                </SelectContent>
              </Select>
            </div>
          {/if}
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</TooltipProvider>
