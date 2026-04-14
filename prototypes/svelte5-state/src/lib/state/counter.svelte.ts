// Simulates: selection.svelte.ts + calculation.svelte.ts

// Module-level $state with { value: T } wrapper
export const selectedValue = $state<{ value: number }>({ value: 0 });
export const inputText = $state<{ value: string }>({ value: "" });

// Array state — test bulk replacement
export const items = $state<{ value: string[] }>({ value: [] });

// NOTE: $derived cannot be exported from a module in Svelte 5.
// See: https://svelte.dev/e/derived_invalid_export
// Alternative: export pure compute functions; callers wrap in $derived inside components.

export function computeParsedNumbers(): number[] {
  return inputText.value
    .split("\n")
    .map((line) => parseFloat(line.trim()))
    .filter((n) => !isNaN(n));
}

export function computeResult(parsedNums: number[]): number[] {
  return parsedNums.map((n) => n * (selectedValue.value + 1));
}
