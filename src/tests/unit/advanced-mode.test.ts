import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock browser environment
vi.mock("$app/environment", () => ({
  browser: true,
}));

describe("advanced-mode state", () => {
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    vi.resetModules();
    mockLocalStorage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
    });
  });

  test("initial value → isAdvancedMode.value === false", async () => {
    const { isAdvancedMode } = await import("$lib/state/advanced-mode.svelte");
    expect(isAdvancedMode.value).toBe(false);
  });

  test("toggleAdvancedMode() → value flips to true; localStorage key set", async () => {
    const { isAdvancedMode, toggleAdvancedMode } = await import(
      "$lib/state/advanced-mode.svelte"
    );
    expect(isAdvancedMode.value).toBe(false);
    toggleAdvancedMode();
    expect(isAdvancedMode.value).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("dedx_advanced_mode", "1");
  });

  test("toggleAdvancedMode() again → value false; localStorage key cleared", async () => {
    const { isAdvancedMode, toggleAdvancedMode } = await import(
      "$lib/state/advanced-mode.svelte"
    );
    // Start with true
    isAdvancedMode.value = true;
    mockLocalStorage["dedx_advanced_mode"] = "1";
    toggleAdvancedMode();
    expect(isAdvancedMode.value).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_advanced_mode");
  });

  test("initAdvancedModeFromUrl(new URLSearchParams('mode=advanced')) → value true", async () => {
    const { isAdvancedMode, initAdvancedModeFromUrl } = await import(
      "$lib/state/advanced-mode.svelte"
    );
    initAdvancedModeFromUrl(new URLSearchParams("mode=advanced"));
    expect(isAdvancedMode.value).toBe(true);
  });

  test("initAdvancedModeFromUrl(new URLSearchParams('')) → value false", async () => {
    const { isAdvancedMode, initAdvancedModeFromUrl } = await import(
      "$lib/state/advanced-mode.svelte"
    );
    initAdvancedModeFromUrl(new URLSearchParams(""));
    expect(isAdvancedMode.value).toBe(false);
  });
});
