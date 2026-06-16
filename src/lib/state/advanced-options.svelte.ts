import { browser } from "$app/environment";
import type { AdvancedOptions, AggregateState, MstarMode } from "$lib/wasm/types";

const STORAGE_PREFIX = "dedx_adv_";

// URL parameter names
const URL_PARAMS = {
  AGG_STATE: "agg_state",
  INTERP_SCALE: "interp_scale",
  INTERP_METHOD: "interp_method",
  MSTAR_MODE: "mstar_mode",
  DENSITY: "density",
  IVAL: "ival",
} as const;

// Storage keys
const STORAGE_KEYS = {
  AGG_STATE: `${STORAGE_PREFIX}agg_state`,
  INTERP_SCALE: `${STORAGE_PREFIX}interp_scale`,
  INTERP_METHOD: `${STORAGE_PREFIX}interp_method`,
  MSTAR_MODE: `${STORAGE_PREFIX}mstar_mode`,
  DENSITY: `${STORAGE_PREFIX}density`,
  IVAL: `${STORAGE_PREFIX}ival`,
} as const;

// Valid value sets
const VALID_AGG_STATES: Set<string> = new Set(["gas", "condensed"]);
const VALID_MSTAR_MODES: Set<string> = new Set(["a", "b", "c", "d", "g", "h"]);

/**
 * Module-level state following the { value: T } wrapper pattern.
 * All fields undefined by default (no override = use libdedx built-in).
 */
export const advancedOptions: { value: AdvancedOptions } = $state({
  value: {},
});

/**
 * Deep, reactive read of every advanced-options field.
 *
 * Calling this inside a `$derived` or `$effect` registers a dependency on ALL
 * fields of `advancedOptions.value` — including nested ones (e.g.
 * `interpolation.scale`) and any options added in the future — because
 * `$state.snapshot` traverses the entire reactive proxy. Use it instead of a
 * hand-maintained `JSON.stringify([...])` change key so persistence and
 * recalculation react to any option change without enumerating fields.
 */
export function advancedOptionsSnapshot(): AdvancedOptions {
  return $state.snapshot(advancedOptions.value) as AdvancedOptions;
}

/**
 * Reset all advanced options to their default (undefined) state.
 */
export function resetAdvancedOptions(): void {
  advancedOptions.value = {};
  if (browser) {
    // Clear all localStorage keys
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  }
}

/**
 * Persist current advanced options to localStorage.
 * Only stores non-undefined values.
 */
export function persistAdvancedOptions(): void {
  if (!browser) return;

  const opts = advancedOptions.value;

  if (opts.aggregateState !== undefined) {
    localStorage.setItem(STORAGE_KEYS.AGG_STATE, opts.aggregateState);
  } else {
    localStorage.removeItem(STORAGE_KEYS.AGG_STATE);
  }

  if (opts.interpolation?.scale !== undefined) {
    // Convert internal "linear" to localStorage format "lin-lin"
    localStorage.setItem(
      STORAGE_KEYS.INTERP_SCALE,
      opts.interpolation.scale === "linear" ? "lin-lin" : "log-log",
    );
  } else {
    localStorage.removeItem(STORAGE_KEYS.INTERP_SCALE);
  }

  if (opts.interpolation?.method !== undefined) {
    // Convert internal "cubic" to localStorage format "spline"
    localStorage.setItem(
      STORAGE_KEYS.INTERP_METHOD,
      opts.interpolation.method === "cubic" ? "spline" : "linear",
    );
  } else {
    localStorage.removeItem(STORAGE_KEYS.INTERP_METHOD);
  }

  if (opts.mstarMode !== undefined) {
    localStorage.setItem(STORAGE_KEYS.MSTAR_MODE, opts.mstarMode);
  } else {
    localStorage.removeItem(STORAGE_KEYS.MSTAR_MODE);
  }

  if (opts.densityOverride !== undefined) {
    localStorage.setItem(STORAGE_KEYS.DENSITY, String(opts.densityOverride));
  } else {
    localStorage.removeItem(STORAGE_KEYS.DENSITY);
  }

  if (opts.iValueOverride !== undefined) {
    localStorage.setItem(STORAGE_KEYS.IVAL, String(opts.iValueOverride));
  } else {
    localStorage.removeItem(STORAGE_KEYS.IVAL);
  }
}

/**
 * Load advanced options from localStorage.
 * Called on app initialization; URL params take precedence over these values.
 */
export function loadAdvancedOptionsFromStorage(): void {
  if (!browser) return;

  const opts: AdvancedOptions = {};

  // Aggregate state
  const aggState = localStorage.getItem(STORAGE_KEYS.AGG_STATE);
  if (aggState && VALID_AGG_STATES.has(aggState)) {
    opts.aggregateState = aggState as AggregateState;
  }

  // Interpolation scale
  const interpScale = localStorage.getItem(STORAGE_KEYS.INTERP_SCALE);
  if (interpScale && interpScale === "lin-lin") {
    opts.interpolation = { ...opts.interpolation, scale: "linear" };
  }
  // Note: "log-log" is the default, not stored

  // Interpolation method
  const interpMethod = localStorage.getItem(STORAGE_KEYS.INTERP_METHOD);
  if (interpMethod && interpMethod === "spline") {
    opts.interpolation = { ...opts.interpolation, method: "cubic" };
  }
  // Note: "linear" is the default, not stored

  // MSTAR mode
  const mstarMode = localStorage.getItem(STORAGE_KEYS.MSTAR_MODE);
  if (mstarMode && VALID_MSTAR_MODES.has(mstarMode)) {
    opts.mstarMode = mstarMode as MstarMode;
  }

  // Density override
  const density = localStorage.getItem(STORAGE_KEYS.DENSITY);
  if (density !== null) {
    const parsed = Number(density);
    if (Number.isFinite(parsed) && parsed > 0) {
      opts.densityOverride = parsed;
    }
  }

  // I-value override
  const ival = localStorage.getItem(STORAGE_KEYS.IVAL);
  if (ival !== null) {
    const parsed = Number(ival);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10000) {
      opts.iValueOverride = parsed;
    }
  }

  advancedOptions.value = opts;
}

/**
 * Encode advanced options as URLSearchParams.
 * Only includes non-default values per shareable-urls-formal.md §3.7.
 *
 * URL param mapping:
 * - aggregateState → agg_state (omit if undefined)
 * - interpolation.scale: "linear" → "lin-lin" (omit if "log" which is default)
 * - interpolation.method: "cubic" → "spline" (omit if "linear" which is default)
 * - mstarMode → mstar_mode (omit if "b" which is default)
 * - densityOverride → density (omit if undefined)
 * - iValueOverride → ival (omit if undefined)
 *
 * @param opts - AdvancedOptions to encode. If omitted, uses module-level advancedOptions.value
 */
export function encodeAdvancedOptionsUrl(opts?: AdvancedOptions): URLSearchParams {
  const params = new URLSearchParams();
  const options = opts ?? advancedOptions.value;

  // Aggregate state - only if set
  if (options.aggregateState !== undefined) {
    params.set(URL_PARAMS.AGG_STATE, options.aggregateState);
  }

  // Interpolation scale - only if not default ("log" is default, "linear" maps to "lin-lin")
  if (options.interpolation?.scale !== undefined && options.interpolation.scale === "linear") {
    params.set(URL_PARAMS.INTERP_SCALE, "lin-lin");
  }

  // Interpolation method - only if not default ("linear" is default, "cubic" maps to "spline")
  if (options.interpolation?.method !== undefined && options.interpolation.method === "cubic") {
    params.set(URL_PARAMS.INTERP_METHOD, "spline");
  }

  // MSTAR mode - only if not default ("b" is default)
  if (options.mstarMode !== undefined && options.mstarMode !== "b") {
    params.set(URL_PARAMS.MSTAR_MODE, options.mstarMode);
  }

  // Density override - only if set
  if (options.densityOverride !== undefined) {
    params.set(URL_PARAMS.DENSITY, String(options.densityOverride));
  }

  // I-value override - only if set
  if (options.iValueOverride !== undefined) {
    params.set(URL_PARAMS.IVAL, String(options.iValueOverride));
  }

  return params;
}

/**
 * Decode advanced options from URLSearchParams.
 * Invalid values are silently ignored (per spec §3.7 validation rules).
 *
 * @param params - URLSearchParams to decode
 * @param materialIsGas - whether the current material is a gas by default
 *                        (used to determine if agg_state is an override)
 * @returns AdvancedOptions with only valid, non-default values
 */
export function decodeAdvancedOptionsUrl(
  params: URLSearchParams,
  materialIsGas?: boolean,
): AdvancedOptions {
  const opts: AdvancedOptions = {};

  // Aggregate state - must differ from material's built-in phase to be an override
  const aggStateParam = params.get(URL_PARAMS.AGG_STATE);
  if (aggStateParam && VALID_AGG_STATES.has(aggStateParam)) {
    const aggState = aggStateParam as AggregateState;
    // Only apply if it differs from the material's built-in phase
    if (materialIsGas !== undefined) {
      const builtInPhase: AggregateState = materialIsGas ? "gas" : "condensed";
      if (aggState !== builtInPhase) {
        opts.aggregateState = aggState;
      }
    } else {
      // If materialIsGas not provided, just store the value
      opts.aggregateState = aggState;
    }
  }

  // Interpolation scale - "lin-lin" maps to "linear", default "log-log" is "log"
  const interpScaleParam = params.get(URL_PARAMS.INTERP_SCALE);
  if (interpScaleParam && interpScaleParam === "lin-lin") {
    opts.interpolation = { ...opts.interpolation, scale: "linear" };
  }
  // Note: "log-log" (default) is not encoded in URL, so we don't set anything

  // Interpolation method - "spline" maps to "cubic", default is "linear"
  const interpMethodParam = params.get(URL_PARAMS.INTERP_METHOD);
  if (interpMethodParam && interpMethodParam === "spline") {
    opts.interpolation = { ...opts.interpolation, method: "cubic" };
  }
  // Note: "linear" (default) is not encoded in URL

  // MSTAR mode - must be valid and not default "b"
  const mstarModeParam = params.get(URL_PARAMS.MSTAR_MODE);
  if (mstarModeParam && VALID_MSTAR_MODES.has(mstarModeParam) && mstarModeParam !== "b") {
    opts.mstarMode = mstarModeParam as MstarMode;
  }

  // Density override - must be positive number
  const densityParam = params.get(URL_PARAMS.DENSITY);
  if (densityParam !== null) {
    const parsed = Number(densityParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      opts.densityOverride = parsed;
    }
    // Invalid values (negative, zero, NaN) are silently ignored
  }

  // I-value override - must be positive and <= 10000
  const ivalParam = params.get(URL_PARAMS.IVAL);
  if (ivalParam !== null) {
    const parsed = Number(ivalParam);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10000) {
      opts.iValueOverride = parsed;
    }
    // Invalid values are silently ignored
  }

  return opts;
}
