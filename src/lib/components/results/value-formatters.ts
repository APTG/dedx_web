import { autoScaleLengthCm, formatSigFigs } from "$lib/utils/unit-conversions";

/** Format a CSDA range (in cm) as an auto-scaled string with inline SI unit. */
export function formatRangeCm(cm: number): string {
  const scaled = autoScaleLengthCm(cm);
  return `${formatSigFigs(scaled.value, 4)} ${scaled.unit}`;
}
