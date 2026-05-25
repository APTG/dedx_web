/**
 * Branch constants for inverse-STP WASM calls.
 *
 * The stopping-power curve is non-monotonic: it rises at low energy (ascending
 * branch), peaks at the Bragg peak, then falls at high energy (descending
 * branch).  For a given STP value below the peak there are two solutions —
 * one on each side.
 *
 * The WASM API selects a branch via the `side` parameter:
 *   side=0 → low-E branch  (ascending, below Bragg peak)
 *   side=1 → high-E branch (descending, above Bragg peak)
 *
 * The UI shows the high-E branch in the primary (always-visible) column and
 * reveals the low-E column only when at least one row has a two-solution result.
 */

/** `side` value for the low-energy branch (ascending slope). */
export const LOW_E_SIDE = 0 as const;

/** `side` value for the high-energy branch (descending slope). */
export const HIGH_E_SIDE = 1 as const;

/**
 * Column-visibility state encoded in the `istpbranch=` URL param.
 *
 * - `"hi"`   — only high-E column visible (default)
 * - `"both"` — both columns visible (set once any row returns two solutions)
 * - `"lo"`   — schema stub only; reserved for a future "swap default" option
 */
export type StpBranchState = "hi" | "lo" | "both";
