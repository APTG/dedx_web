import { formatRangeValue } from "$lib/state/calculator.svelte";

/** Format a CSDA range (in cm) as an auto-scaled string with inline SI unit. */
export function formatRangeCm(cm: number): string {
  return formatRangeValue(cm);
}
