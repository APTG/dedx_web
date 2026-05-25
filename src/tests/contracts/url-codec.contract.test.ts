/**
 * URL Codec Round-Trip Contract Tests
 *
 * For every TypeScript union type used in URL encoding, every union member must
 * survive a round-trip: decode(encode({ field: v })) === v.
 *
 * The test maps use `satisfies Record<UnionType, string>` so that adding a new
 * member to the union fails the TypeScript build here, forcing the test and
 * decoder to be updated at the same time.
 *
 * Background: PR #427 contained a bug where `mstar_mode` decoder accepted only
 * a|c|d|g|h but the MstarMode union also includes "b". See
 * .opencode/lessons-learned.md Entry 5.
 */

import { describe, it, expect } from "vitest";
import { encodeCalculatorUrl, decodeCalculatorUrl } from "$lib/utils/calculator-url";
import type { CalculatorUrlState } from "$lib/utils/calculator-url";
import type {
  MstarMode,
  AggregateState,
  InterpolationScale,
  InterpolationMethod,
  InverseMode,
} from "$lib/wasm/types";

/** Minimal valid state to act as a base for codec tests. */
const baseState: CalculatorUrlState = {
  particleId: 1,
  materialId: 276,
  programId: null,
  rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
  masterUnit: "MeV",
  isAdvancedMode: true, // required for advancedOptions to be encoded
};

// ─────────────────────────────────────────────────────────────────────────────
// MstarMode round-trip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keyed by `MstarMode` via `satisfies` — adding a new member to MstarMode
 * causes a TS compile error here, forcing this test to be updated.
 *
 * The value in each entry is the expected URL parameter string (may differ
 * from the type value if the encoder applies a transformation).
 */
const MSTAR_MODE_URL_ROUNDTRIP = {
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  g: "g",
  h: "h",
} satisfies Record<MstarMode, string>;

describe("URL codec round-trip — MstarMode", () => {
  it.each(Object.entries(MSTAR_MODE_URL_ROUNDTRIP))(
    'mstar_mode="%s" round-trips through encode→decode',
    (mode) => {
      const mstarMode = mode as MstarMode;
      const encoded = encodeCalculatorUrl({
        ...baseState,
        advancedOptions: { mstarMode },
      });
      const decoded = decodeCalculatorUrl(encoded);
      // "b" is the default and is omitted from the URL; decode returns undefined for it.
      // All other modes must round-trip exactly.
      if (mstarMode === "b") {
        expect(decoded.advancedOptions?.mstarMode).toBeUndefined();
      } else {
        expect(decoded.advancedOptions?.mstarMode).toBe(mstarMode);
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AggregateState round-trip
// ─────────────────────────────────────────────────────────────────────────────

const AGGREGATE_STATE_ROUNDTRIP = {
  gas: "gas",
  condensed: "condensed",
} satisfies Record<AggregateState, string>;

describe("URL codec round-trip — AggregateState", () => {
  it.each(Object.entries(AGGREGATE_STATE_ROUNDTRIP))(
    'agg_state="%s" round-trips through encode→decode',
    (state) => {
      const aggregateState = state as AggregateState;
      const encoded = encodeCalculatorUrl({
        ...baseState,
        advancedOptions: { aggregateState },
      });
      const decoded = decodeCalculatorUrl(encoded);
      expect(decoded.advancedOptions?.aggregateState).toBe(aggregateState);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// InterpolationScale round-trip
// ─────────────────────────────────────────────────────────────────────────────

const INTERPOLATION_SCALE_ROUNDTRIP = {
  log: "log",
  linear: "linear",
} satisfies Record<InterpolationScale, string>;

describe("URL codec round-trip — InterpolationScale", () => {
  it.each(Object.entries(INTERPOLATION_SCALE_ROUNDTRIP))(
    'interp_scale="%s" round-trips through encode→decode',
    (scale) => {
      const interpolationScale = scale as InterpolationScale;
      const encoded = encodeCalculatorUrl({
        ...baseState,
        advancedOptions: {
          interpolation: { scale: interpolationScale, method: "linear" },
        },
      });
      const decoded = decodeCalculatorUrl(encoded);
      // "log" (log-log) is the default and omitted from the URL
      if (interpolationScale === "log") {
        expect(decoded.advancedOptions?.interpolation?.scale ?? "log").toBe("log");
      } else {
        expect(decoded.advancedOptions?.interpolation?.scale).toBe(interpolationScale);
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// InterpolationMethod round-trip
// ─────────────────────────────────────────────────────────────────────────────

const INTERPOLATION_METHOD_ROUNDTRIP = {
  linear: "linear",
  cubic: "cubic",
} satisfies Record<InterpolationMethod, string>;

describe("URL codec round-trip — InterpolationMethod", () => {
  it.each(Object.entries(INTERPOLATION_METHOD_ROUNDTRIP))(
    'interp_method="%s" round-trips through encode→decode',
    (method) => {
      const interpolationMethod = method as InterpolationMethod;
      const encoded = encodeCalculatorUrl({
        ...baseState,
        advancedOptions: {
          interpolation: { scale: "log", method: interpolationMethod },
        },
      });
      const decoded = decodeCalculatorUrl(encoded);
      // "linear" is the default and omitted from the URL
      if (interpolationMethod === "linear") {
        expect(decoded.advancedOptions?.interpolation?.method ?? "linear").toBe("linear");
      } else {
        expect(decoded.advancedOptions?.interpolation?.method).toBe(interpolationMethod);
      }
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// InverseMode round-trip (imode parameter)
// ─────────────────────────────────────────────────────────────────────────────

const INVERSE_MODE_ROUNDTRIP = {
  csda: "csda",
  stp: "stp",
} satisfies Record<InverseMode, string>;

describe("URL codec round-trip — InverseMode", () => {
  it.each(Object.entries(INVERSE_MODE_ROUNDTRIP))(
    'imode="%s" round-trips through encode→decode',
    (mode) => {
      const imode = mode as InverseMode;
      const encoded = encodeCalculatorUrl({
        ...baseState,
        imode,
        ivalues: [{ rawInput: "7.718", unit: "cm", unitFromSuffix: false }],
        iunit: "cm",
      } as any);
      const decoded = decodeCalculatorUrl(encoded);
      expect((decoded as any).imode).toBe(imode);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CSDA iunit round-trip (length units)
// ─────────────────────────────────────────────────────────────────────────────

const CSDA_IUNIT_ROUNDTRIP = {
  nm: "nm",
  um: "um",
  mm: "mm",
  cm: "cm",
  m: "m",
} satisfies Record<"nm" | "um" | "mm" | "cm" | "m", string>;

describe("URL codec round-trip — CSDA iunit (length units)", () => {
  it.each(Object.entries(CSDA_IUNIT_ROUNDTRIP))(
    'iunit="%s" (csda) round-trips through encode→decode',
    (unit) => {
      const iunit = unit as "nm" | "um" | "mm" | "cm" | "m";
      const encoded = encodeCalculatorUrl({
        ...baseState,
        imode: "csda",
        ivalues: [{ rawInput: "7.718", unit: iunit, unitFromSuffix: false }],
        iunit,
      } as any);
      const decoded = decodeCalculatorUrl(encoded);
      expect((decoded as any).iunit).toBe(iunit);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STP iunit round-trip (STP unit tokens)
// ─────────────────────────────────────────────────────────────────────────────

const STP_IUNIT_ROUNDTRIP = {
  "kev-um": "kev-um",
  "mev-cm": "mev-cm",
  "mev-cm2-g": "mev-cm2-g",
} satisfies Record<"kev-um" | "mev-cm" | "mev-cm2-g", string>;

describe("URL codec round-trip — STP iunit (STP unit tokens)", () => {
  it.each(Object.entries(STP_IUNIT_ROUNDTRIP))(
    'iunit="%s" (stp) round-trips through encode→decode',
    (unit) => {
      const iunit = unit as "kev-um" | "mev-cm" | "mev-cm2-g";
      const encoded = encodeCalculatorUrl({
        ...baseState,
        imode: "stp",
        ivalues: [{ rawInput: "45.76", unit: iunit, unitFromSuffix: false }],
        iunit,
      } as any);
      const decoded = decodeCalculatorUrl(encoded);
      expect((decoded as any).iunit).toBe(iunit);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// URLv presence contract
// ─────────────────────────────────────────────────────────────────────────────

describe("URL codec contract — urlv always present", () => {
  it("encoded URL always contains urlv param", () => {
    const encoded = encodeCalculatorUrl({
      particleId: 1,
      materialId: 276,
      programId: null,
      rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
      masterUnit: "MeV",
    });
    expect(encoded.get("urlv")).toBe("2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Material discriminated-union round-trip (builtin vs "custom")
// ─────────────────────────────────────────────────────────────────────────────

const MATERIAL_URL_ROUNDTRIP = {
  builtin: "276",
  custom: "custom",
} satisfies Record<"builtin" | "custom", string>;

describe("URL codec contract — material discriminated-union round-trip", () => {
  it.each(Object.entries(MATERIAL_URL_ROUNDTRIP))("material round-trip: %s", (kind, material) => {
    const params = new URLSearchParams(
      `urlv=1&particle=1&material=${material}&program=auto&energies=100&eunit=MeV&mode=advanced&qfocus=both` +
        (kind === "custom"
          ? "&mat_name=Custom%20Material&mat_density=1.5&mat_elements=6:2,8:1"
          : ""),
    );
    const state = decodeCalculatorUrl(params);
    if (kind === "custom") {
      expect(state.materialId).toBeNull();
      expect(state.materialIsCustom).toBe(true);
    } else {
      expect(state.materialId).toBe(276);
      expect(state.materialIsCustom).toBeFalsy();
    }
  });
});
