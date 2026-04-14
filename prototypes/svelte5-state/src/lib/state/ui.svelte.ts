// Simulates: ui.svelte.ts

export const isAdvancedMode = $state<{ value: boolean }>({ value: false });
export const computationCount = $state<{ value: number }>({ value: 0 });
