export const wasmReady = $state({ value: false });
export const wasmError = $state<{ value: Error | null }>({ value: null });
