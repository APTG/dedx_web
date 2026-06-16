/**
 * Shared debounced-snapshot contract for the async calculation `$effect`s
 * (`multi-program-calc`, `multi-entity-calc`, `inverse-stp-calc`,
 * `inverse-range-calc`).
 *
 * Each of those effects captures its reactive inputs into a plain object, then
 * runs a debounced async calculation that must not let a stale resolution
 * overwrite fresher results. This helper centralizes the debounce + cancellation
 * wiring so every call site only has to declare its typed input object.
 *
 * Wire the return value as the cleanup of an `$effect`: when inputs change the
 * effect re-runs, the previous cleanup flips the cancellation flag and clears
 * the pending timer, so the latest input wins and any in-flight stale run is
 * dropped at its next `isCancelled()` check.
 *
 * @param input    Snapshot of the inputs, handed back to `run`.
 * @param run      Debounced callback. Poll `isCancelled()` after every `await`
 *                 and before publishing results.
 * @param delayMs  Debounce delay (default 300 ms).
 * @returns Cleanup function that cancels the pending/in-flight run.
 */
export function runDebouncedSnapshot<T>(
  input: T,
  run: (input: T, isCancelled: () => boolean) => void | Promise<void>,
  delayMs = 300,
): () => void {
  let cancelled = false;
  const timer = setTimeout(() => {
    if (cancelled) return;
    void run(input, () => cancelled);
  }, delayMs);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
