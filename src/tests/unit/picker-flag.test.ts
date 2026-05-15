import { describe, test, expect, beforeEach, vi } from "vitest";

vi.mock("$app/environment", () => ({
  browser: true,
}));

describe("picker-flag (v8 feature flag)", () => {
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
    });
  });

  test("default value is false (v7 stays the production render path)", async () => {
    const { isPickerV8 } = await import("$lib/state/picker-flag.svelte");
    expect(isPickerV8.value).toBe(false);
  });

  test("initial value reads from localStorage when '1' is stored", async () => {
    mockLocalStorage["dedx_picker_v8"] = "1";
    const { isPickerV8 } = await import("$lib/state/picker-flag.svelte");
    expect(isPickerV8.value).toBe(true);
  });

  test("initPickerV8FromUrl('v8=1') flips on and persists", async () => {
    const { isPickerV8, initPickerV8FromUrl } = await import(
      "$lib/state/picker-flag.svelte"
    );
    initPickerV8FromUrl(new URLSearchParams("v8=1"));
    expect(isPickerV8.value).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith("dedx_picker_v8", "1");
  });

  test("initPickerV8FromUrl('v8=0') flips off and clears storage", async () => {
    mockLocalStorage["dedx_picker_v8"] = "1";
    const { isPickerV8, initPickerV8FromUrl } = await import(
      "$lib/state/picker-flag.svelte"
    );
    initPickerV8FromUrl(new URLSearchParams("v8=0"));
    expect(isPickerV8.value).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_picker_v8");
  });

  test("initPickerV8FromUrl('') leaves value unchanged", async () => {
    mockLocalStorage["dedx_picker_v8"] = "1";
    const { isPickerV8, initPickerV8FromUrl } = await import(
      "$lib/state/picker-flag.svelte"
    );
    initPickerV8FromUrl(new URLSearchParams(""));
    expect(isPickerV8.value).toBe(true);
  });
});
