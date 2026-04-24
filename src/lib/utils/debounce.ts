export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): DebouncedFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let pending = false;

  const invoke = () => {
    if (lastArgs && pending) {
      fn(...lastArgs);
      pending = false;
      lastArgs = null;
    }
  };

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    pending = true;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(invoke, delayMs);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pending = false;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (pending && lastArgs) {
      const result = fn(...lastArgs);
      pending = false;
      lastArgs = null;
      return result;
    }

    return undefined;
  };

  return debounced;
}
