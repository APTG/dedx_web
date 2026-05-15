import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("$app/environment", () => ({
  browser: true,
}));

describe("picker-mode state", () => {
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

  test("initial value is 'basic' when localStorage is empty", async () => {
    const { pickerMode } = await import("$lib/state/picker-mode.svelte");
    expect(pickerMode.value).toBe("basic");
  });

  test("setPickerMode('advanced') persists to localStorage", async () => {
    const { pickerMode, setPickerMode } = await import("$lib/state/picker-mode.svelte");
    setPickerMode("advanced");
    expect(pickerMode.value).toBe("advanced");
    expect(localStorage.setItem).toHaveBeenCalledWith("webdedx.pickerMode", "advanced");
  });

  test("setPickerMode('basic') removes localStorage entry", async () => {
    const { setPickerMode } = await import("$lib/state/picker-mode.svelte");
    setPickerMode("advanced");
    setPickerMode("basic");
    expect(localStorage.removeItem).toHaveBeenCalledWith("webdedx.pickerMode");
  });

  test("togglePickerMode flips the value", async () => {
    const { pickerMode, togglePickerMode } = await import("$lib/state/picker-mode.svelte");
    expect(pickerMode.value).toBe("basic");
    togglePickerMode();
    expect(pickerMode.value).toBe("advanced");
    togglePickerMode();
    expect(pickerMode.value).toBe("basic");
  });

  test("initPickerModeFromUrl('mode=advanced') flips to advanced", async () => {
    const { pickerMode, initPickerModeFromUrl } = await import(
      "$lib/state/picker-mode.svelte"
    );
    initPickerModeFromUrl(new URLSearchParams("mode=advanced"));
    expect(pickerMode.value).toBe("advanced");
  });

  test("initPickerModeFromUrl('mode=basic') resets to basic", async () => {
    const { pickerMode, setPickerMode, initPickerModeFromUrl } = await import(
      "$lib/state/picker-mode.svelte"
    );
    setPickerMode("advanced");
    initPickerModeFromUrl(new URLSearchParams("mode=basic"));
    expect(pickerMode.value).toBe("basic");
  });

  test("initPickerModeFromUrl('') leaves value unchanged", async () => {
    const { pickerMode, setPickerMode, initPickerModeFromUrl } = await import(
      "$lib/state/picker-mode.svelte"
    );
    setPickerMode("advanced");
    initPickerModeFromUrl(new URLSearchParams(""));
    expect(pickerMode.value).toBe("advanced");
  });
});
