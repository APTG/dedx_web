import { describe, test, expect, vi } from "vitest";
import { debounce } from "$lib/utils/debounce";

describe("debounce", () => {
  test("calls function after specified delay", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    expect(fn).not.toHaveBeenCalled();
    
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("cancels previous call if invoked within delay", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced();
    debounced();
    
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("passes arguments to function", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced("arg1", 42);
    
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).toHaveBeenCalledWith("arg1", 42);
  });

  test("can be cancelled manually", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced.cancel();
    
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fn).not.toHaveBeenCalled();
  });

  test("flush executes immediately", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    expect(fn).not.toHaveBeenCalled();
    
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("flush executes pending call immediately", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced("arg1");
    debounced("arg2");
    
    const result = debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("arg2");
    expect(result).toBeUndefined();
  });

  test("cancel prevents flush from executing", async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced.cancel();
    debounced.flush();
    
    expect(fn).not.toHaveBeenCalled();
  });

  test("returns last result when flushed", () => {
    let counter = 0;
    const fn = vi.fn(() => ++counter);
    const debounced = debounce(fn, 100);
    
    debounced();
    debounced();
    const result = debounced.flush();
    
    expect(result).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
