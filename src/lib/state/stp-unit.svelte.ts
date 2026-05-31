import type { StpUnit } from "$lib/wasm/types";

/**
 * Shared, in-memory stopping-power **output** unit — the explicit user choice
 * made via the calculator's STP header dropdown or the plot's unit control.
 *
 * `null` means "no explicit choice yet": the calculator then falls back to its
 * aggregate-state-derived default (gas → MeV·cm²/g, condensed → keV/µm) and the
 * plot falls back to keV/µm, so pre-existing URLs render exactly as before.
 *
 * The value carries across in-app navigation between the calculator and plot
 * pages without touching browser storage; durable persistence is the URL
 * `sunit=` param only.
 */
const store = $state<{ value: StpUnit | null }>({ value: null });

export const stpOutputUnit = {
  get value(): StpUnit | null {
    return store.value;
  },
  set(unit: StpUnit | null) {
    store.value = unit;
  },
};
