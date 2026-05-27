/**
 * Test helper: wraps $effect.root so plain .test.ts files can register
 * Svelte 5 reactive effects without needing to be compiled as .svelte.ts.
 */
export function runInEffectRoot(fn: () => void): () => void {
  return $effect.root(fn);
}
