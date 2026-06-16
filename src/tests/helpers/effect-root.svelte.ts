/**
 * Test helper: wraps $effect.root so plain .test.ts files can register
 * Svelte 5 reactive effects without needing to be compiled as .svelte.ts.
 */
export function runInEffectRoot(fn: () => void): () => void {
  return $effect.root(fn);
}

/**
 * Register a `$effect` from a plain `.test.ts` file (where the rune is not
 * available). Call inside a `runInEffectRoot` callback.
 */
export function registerEffect(fn: () => void): void {
  $effect(fn);
}
