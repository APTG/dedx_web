import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock browser environment
vi.mock("$app/environment", () => ({
  browser: true,
}));

describe("advanced-options state", () => {
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

  describe("resetAdvancedOptions", () => {
    test("clears all fields to undefined", async () => {
      const { advancedOptions, resetAdvancedOptions } = await import(
        "$lib/state/advanced-options.svelte"
      );

      // Set some values
      advancedOptions.value = {
        aggregateState: "gas",
        interpolation: { scale: "linear", method: "cubic" },
        mstarMode: "c",
        densityOverride: 1.5,
        iValueOverride: 80,
      };

      resetAdvancedOptions();
      expect(advancedOptions.value).toEqual({});
      expect(Object.keys(advancedOptions.value).length).toBe(0);
    });

    test("clears localStorage keys", async () => {
      // Pre-populate localStorage
      mockLocalStorage["dedx_adv_density"] = "1.5";
      mockLocalStorage["dedx_adv_ival"] = "80";
      mockLocalStorage["dedx_adv_agg_state"] = "gas";

      const { resetAdvancedOptions } = await import("$lib/state/advanced-options.svelte");
      resetAdvancedOptions();

      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_agg_state");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_interp_scale");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_interp_method");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_mstar_mode");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_density");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_ival");
    });
  });

  describe("persistAdvancedOptions", () => {
    test("saves non-undefined fields to localStorage", async () => {
      const { advancedOptions, persistAdvancedOptions } = await import(
        "$lib/state/advanced-options.svelte"
      );

      advancedOptions.value = {
        aggregateState: "condensed",
        interpolation: { scale: "linear", method: "cubic" },
        mstarMode: "d",
        densityOverride: 2.5,
        iValueOverride: 95.5,
      };

      persistAdvancedOptions();

      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_agg_state", "condensed");
      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_interp_scale", "lin-lin"); // internal "linear" → storage "lin-lin"
      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_interp_method", "spline"); // internal "cubic" → storage "spline"
      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_mstar_mode", "d");
      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_density", "2.5");
      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_ival", "95.5");
    });

    test("removes localStorage keys for undefined fields", async () => {
      const { advancedOptions, persistAdvancedOptions } = await import(
        "$lib/state/advanced-options.svelte"
      );

      // Only set density, leave others undefined
      advancedOptions.value = {
        densityOverride: 1.2,
      };

      persistAdvancedOptions();

      expect(localStorage.setItem).toHaveBeenCalledWith("dedx_adv_density", "1.2");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_agg_state");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_interp_scale");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_interp_method");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_mstar_mode");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dedx_adv_ival");
    });
  });

  describe("loadAdvancedOptionsFromStorage", () => {
    test("restores all fields from localStorage", async () => {
      const { advancedOptions, loadAdvancedOptionsFromStorage } = await import(
        "$lib/state/advanced-options.svelte"
      );

      localStorage.setItem("dedx_adv_agg_state", "condensed");
      localStorage.setItem("dedx_adv_interp_scale", "lin-lin");
      localStorage.setItem("dedx_adv_interp_method", "spline");
      localStorage.setItem("dedx_adv_mstar_mode", "g");
      localStorage.setItem("dedx_adv_density", "2.5");
      localStorage.setItem("dedx_adv_ival", "92.3");

      loadAdvancedOptionsFromStorage();

      expect(advancedOptions.value.aggregateState).toBe("condensed");
      expect(advancedOptions.value.interpolation?.scale).toBe("linear"); // lin-lin → linear
      expect(advancedOptions.value.interpolation?.method).toBe("cubic"); // spline → cubic
      expect(advancedOptions.value.mstarMode).toBe("g");
      expect(advancedOptions.value.densityOverride).toBe(2.5);
      expect(advancedOptions.value.iValueOverride).toBe(92.3);
    });

    test("ignores invalid localStorage values", async () => {
      // Invalid density (negative)
      mockLocalStorage["dedx_adv_density"] = "-1.5";
      // Invalid mstar mode
      mockLocalStorage["dedx_adv_mstar_mode"] = "invalid";
      // Invalid i-value (too large)
      mockLocalStorage["dedx_adv_ival"] = "15000";

      const { advancedOptions, loadAdvancedOptionsFromStorage } = await import(
        "$lib/state/advanced-options.svelte"
      );
      loadAdvancedOptionsFromStorage();

      expect(advancedOptions.value.densityOverride).toBeUndefined();
      expect(advancedOptions.value.mstarMode).toBeUndefined();
      expect(advancedOptions.value.iValueOverride).toBeUndefined();
    });

    test("ignores invalid I-value at boundary (zero)", async () => {
      mockLocalStorage["dedx_adv_ival"] = "0";

      const { advancedOptions, loadAdvancedOptionsFromStorage } = await import(
        "$lib/state/advanced-options.svelte"
      );
      loadAdvancedOptionsFromStorage();

      expect(advancedOptions.value.iValueOverride).toBeUndefined();
    });

    test("accepts valid I-value at upper boundary (10000)", async () => {
      mockLocalStorage["dedx_adv_ival"] = "10000";

      const { advancedOptions, loadAdvancedOptionsFromStorage } = await import(
        "$lib/state/advanced-options.svelte"
      );
      loadAdvancedOptionsFromStorage();

      expect(advancedOptions.value.iValueOverride).toBe(10000);
    });
  });

  describe("encodeAdvancedOptionsUrl", () => {
    test("encodes all 6 params when non-default", async () => {
      const { encodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const opts = {
        aggregateState: "condensed" as const,
        interpolation: { scale: "linear" as const, method: "cubic" as const },
        mstarMode: "c" as const,
        densityOverride: 0.0000899,
        iValueOverride: 75.0,
      };

      const params = encodeAdvancedOptionsUrl(opts);

      expect(params.get("agg_state")).toBe("condensed");
      expect(params.get("interp_scale")).toBe("lin-lin");
      expect(params.get("interp_method")).toBe("spline");
      expect(params.get("mstar_mode")).toBe("c");
      expect(params.get("density")).toBe("0.0000899");
      expect(params.get("ival")).toBe("75");
    });

    test("omits default interpolation scale (log-log)", async () => {
      const { encodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const opts = {
        interpolation: { scale: "log" as const, method: "linear" as const },
      };

      const params = encodeAdvancedOptionsUrl(opts);
      expect(params.has("interp_scale")).toBe(false);
      expect(params.has("interp_method")).toBe(false);
    });

    test("omits default mstar_mode (b)", async () => {
      const { encodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const opts = {
        mstarMode: "b" as const,
      };

      const params = encodeAdvancedOptionsUrl(opts);
      expect(params.has("mstar_mode")).toBe(false);
    });

    test("encodes scientific notation for small density", async () => {
      const { encodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const opts = {
        densityOverride: 8.99e-5,
      };

      const params = encodeAdvancedOptionsUrl(opts);
      // JavaScript's Number.prototype.toString() may use scientific notation
      const density = params.get("density");
      expect(density).toMatch(/^\d*\.?\d+(e[+-]?\d+)?$/i);
      expect(Number(density)).toBeCloseTo(8.99e-5, 10);
    });

    test("omits undefined fields", async () => {
      const { encodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const opts = {
        aggregateState: "gas" as const,
        // Leave everything else undefined
      };

      const params = encodeAdvancedOptionsUrl(opts);
      expect(params.get("agg_state")).toBe("gas");
      expect(params.size).toBe(1);
    });
  });

  describe("decodeAdvancedOptionsUrl", () => {
    test("decodes all 6 params correctly", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams(
        "agg_state=condensed&interp_scale=lin-lin&interp_method=spline&mstar_mode=d&density=1.2&ival=85.5",
      );

      // Pass undefined for materialIsGas to just get the values without override logic
      const opts = decodeAdvancedOptionsUrl(params, undefined);

      expect(opts.aggregateState).toBe("condensed");
      expect(opts.interpolation?.scale).toBe("linear");
      expect(opts.interpolation?.method).toBe("cubic");
      expect(opts.mstarMode).toBe("d");
      expect(opts.densityOverride).toBe(1.2);
      expect(opts.iValueOverride).toBe(85.5);
    });

    test("treats agg_state=gas as no override for gas material", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("agg_state=gas");
      const opts = decodeAdvancedOptionsUrl(params, true); // gas material

      expect(opts.aggregateState).toBeUndefined();
    });

    test("treats agg_state=condensed as override for gas material", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("agg_state=condensed");
      const opts = decodeAdvancedOptionsUrl(params, true); // gas material

      expect(opts.aggregateState).toBe("condensed");
    });

    test("treats agg_state=condensed as no override for condensed material", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("agg_state=condensed");
      const opts = decodeAdvancedOptionsUrl(params, false); // condensed material

      expect(opts.aggregateState).toBeUndefined();
    });

    test("ignores invalid agg_state value", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("agg_state=invalid");
      const opts = decodeAdvancedOptionsUrl(params, false);

      expect(opts.aggregateState).toBeUndefined();
    });

    test("ignores negative density", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("density=-1.5");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.densityOverride).toBeUndefined();
    });

    test("ignores zero density", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("density=0");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.densityOverride).toBeUndefined();
    });

    test("accepts scientific notation density", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("density=8.99e-5");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.densityOverride).toBeCloseTo(8.99e-5, 10);
    });

    test("ignores unknown mstar_mode string", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("mstar_mode=unknown");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.mstarMode).toBeUndefined();
    });

    test("ignores i-value > 10000", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("ival=15000");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.iValueOverride).toBeUndefined();
    });

    test("ignores negative i-value", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("ival=-50");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.iValueOverride).toBeUndefined();
    });

    test("accepts i-value at exact boundary (10000)", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("ival=10000");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.iValueOverride).toBe(10000);
    });

    test("handles empty params", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts).toEqual({});
    });

    test("does not set interpolation.scale for default (log-log)", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.interpolation).toBeUndefined();
    });

    test("does not set interpolation.method for default (linear)", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.interpolation).toBeUndefined();
    });

    test("does not set mstar_mode for default (b)", async () => {
      const { decodeAdvancedOptionsUrl } = await import("$lib/state/advanced-options.svelte");

      const params = new URLSearchParams("mstar_mode=b");
      const opts = decodeAdvancedOptionsUrl(params);

      expect(opts.mstarMode).toBeUndefined();
    });
  });

  describe("URL encode/decode round-trip", () => {
    test("round-trip for agg_state=condensed (on condensed material - no override)", async () => {
      const { advancedOptions, encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      // Set up state with condensed aggregate state
      advancedOptions.value.aggregateState = "condensed";

      const params = encodeAdvancedOptionsUrl();
      expect(params.get("agg_state")).toBe("condensed");

      // When decoded for a condensed material, this should be treated as "no override"
      const decoded = decodeAdvancedOptionsUrl(params, false);
      expect(decoded.aggregateState).toBeUndefined();
    });

    test("round-trip for interp_scale=lin-lin", async () => {
      const { encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      const original = { interpolation: { scale: "linear" as const, method: "linear" as const } };
      const params = encodeAdvancedOptionsUrl(original);
      const decoded = decodeAdvancedOptionsUrl(params);

      expect(decoded.interpolation?.scale).toBe("linear");
      expect(decoded.interpolation?.method).toBeUndefined(); // Not encoded since it's default
    });

    test("round-trip for interp_method=spline", async () => {
      const { encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      const original = { interpolation: { scale: "log" as const, method: "cubic" as const } };
      const params = encodeAdvancedOptionsUrl(original);
      const decoded = decodeAdvancedOptionsUrl(params);

      expect(decoded.interpolation?.method).toBe("cubic");
      expect(decoded.interpolation?.scale).toBeUndefined(); // Not encoded since it's default
    });

    test("round-trip for mstar_mode=c", async () => {
      const { encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      const original = { mstarMode: "c" as const };
      const params = encodeAdvancedOptionsUrl(original);
      const decoded = decodeAdvancedOptionsUrl(params);

      expect(decoded.mstarMode).toBe("c");
    });

    test("round-trip for density", async () => {
      const { encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      const original = { densityOverride: 1.205 };
      const params = encodeAdvancedOptionsUrl(original);
      const decoded = decodeAdvancedOptionsUrl(params);

      expect(decoded.densityOverride).toBe(1.205);
    });

    test("round-trip for ival", async () => {
      const { encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      const original = { iValueOverride: 75.0 };
      const params = encodeAdvancedOptionsUrl(original);
      const decoded = decodeAdvancedOptionsUrl(params);

      expect(decoded.iValueOverride).toBe(75);
    });

    test("round-trip for all params", async () => {
      const { advancedOptions, encodeAdvancedOptionsUrl, decodeAdvancedOptionsUrl } = await import(
        "$lib/state/advanced-options.svelte"
      );

      advancedOptions.value.aggregateState = "condensed";
      advancedOptions.value.interpolation = { scale: "linear", method: "cubic" };
      advancedOptions.value.mstarMode = "d";
      advancedOptions.value.densityOverride = 1.5;
      advancedOptions.value.iValueOverride = 60;

      const params = encodeAdvancedOptionsUrl();

      // Decode for condensed material - agg_state=condensed is not an override
      const decoded = decodeAdvancedOptionsUrl(params, false);

      expect(decoded.aggregateState).toBeUndefined(); // "condensed" on condensed mat = no override
      expect(decoded.interpolation?.scale).toBe("linear");
      expect(decoded.interpolation?.method).toBe("cubic");
      expect(decoded.mstarMode).toBe("d");
      expect(decoded.densityOverride).toBe(1.5);
      expect(decoded.iValueOverride).toBe(60);
    });
  });

  describe("local storage key prefix", () => {
    test("uses dedx_adv_ prefix for all keys", async () => {
      const { advancedOptions, persistAdvancedOptions } = await import(
        "$lib/state/advanced-options.svelte"
      );

      advancedOptions.value = {
        aggregateState: "gas",
        interpolation: { scale: "linear", method: "cubic" },
        mstarMode: "a",
        densityOverride: 1.0,
        iValueOverride: 100,
      };

      persistAdvancedOptions();

      // Verify all keys have the prefix
      const calls = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls;
      calls.forEach(([key]) => {
        expect(key).toMatch(/^dedx_adv_/);
      });
    });
  });
});
