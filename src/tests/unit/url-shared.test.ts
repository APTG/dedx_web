import { describe, it, expect } from "vitest";
import {
  decodeComponent,
  buildTokenView,
  parseCustomCompound,
  parseStrictFiniteNumber,
  parseStrictAtomicNumber,
  encodeMatElements,
} from "$lib/utils/url-shared";
import { parseQuery } from "$lib/utils/url-parse";

describe("decodeComponent", () => {
  it("decodes percent escapes and treats '+' as space (URLSearchParams parity)", () => {
    expect(decodeComponent("100%3AkeV")).toBe("100:keV");
    expect(decodeComponent("PMMA+foo")).toBe("PMMA foo");
  });
  it("returns the raw text for malformed escapes instead of throwing", () => {
    expect(decodeComponent("50%")).toBe("50%");
  });
});

describe("buildTokenView", () => {
  const view = (q: string) => buildTokenView(parseQuery(q));

  it("returns decoded last-wins scalar values (§3.2 duplicate resolution)", () => {
    const t = view("particle=1&particle=2&eunit=MeV");
    // Last occurrence wins — matches the legacy resolveLastWins(), NOT raw
    // URLSearchParams.get() (which returns the first value).
    expect(t.get("particle")).toBe("2");
    expect(t.get("eunit")).toBe("MeV");
    expect(t.get("absent")).toBeNull();
  });

  it("exposes list nodes and their raw value via get()", () => {
    const t = view("energies=100,200:keV");
    expect(t.get("energies")).toBe("100,200:keV");
    expect(t.list("energies")?.type).toBe("energies");
  });

  it("collects unknown pairs without surfacing them via get()", () => {
    const t = view("particle=1&foo=bar");
    expect(t.get("foo")).toBeNull();
    expect(t.unknownPairs.map((p) => p.key)).toEqual(["foo"]);
  });
});

describe("strict numeric parsers", () => {
  it("parseStrictFiniteNumber accepts finite numbers, rejects junk", () => {
    expect(parseStrictFiniteNumber("1.5e3")).toBe(1500);
    expect(parseStrictFiniteNumber("abc")).toBeUndefined();
    expect(parseStrictFiniteNumber(null)).toBeUndefined();
  });
  it("parseStrictAtomicNumber accepts 1..118 integers only", () => {
    expect(parseStrictAtomicNumber("6")).toBe(6);
    expect(parseStrictAtomicNumber("0")).toBeUndefined();
    expect(parseStrictAtomicNumber("119")).toBeUndefined();
    expect(parseStrictAtomicNumber("6.0")).toBeUndefined();
  });
});

describe("parseCustomCompound", () => {
  const get = (map: Record<string, string>) => (key: string) => map[key] ?? null;

  it("parses a valid compound and orders elements by ascending Z", () => {
    const fields = parseCustomCompound(
      get({ mat_name: "PMMA", mat_density: "1.2", mat_elements: "8:2,1:8,6:5" }),
    );
    expect(fields.fromUrlWarning).toBeUndefined();
    expect(fields.matElements).toEqual([
      { atomicNumber: 1, atomCount: 8 },
      { atomicNumber: 6, atomCount: 5 },
      { atomicNumber: 8, atomCount: 2 },
    ]);
  });

  it("warns and clears fields when mat_name is missing", () => {
    const fields = parseCustomCompound(get({ mat_density: "1.2", mat_elements: "1:2" }));
    expect(fields.fromUrlWarning).toMatch(/mat_name/);
    expect(fields.matElements).toBeUndefined();
  });

  it("warns when density is out of range", () => {
    const fields = parseCustomCompound(
      get({ mat_name: "X", mat_density: "99", mat_elements: "1:2" }),
    );
    expect(fields.fromUrlWarning).toMatch(/mat_density/);
  });

  it("sums duplicate Z and drops non-positive counts", () => {
    const fields = parseCustomCompound(
      get({ mat_name: "X", mat_density: "1", mat_elements: "1:2,1:3,8:-1" }),
    );
    expect(fields.matElements).toEqual([{ atomicNumber: 1, atomCount: 5 }]);
  });

  it("emits span-accurate diagnostics when given a span source", () => {
    const t = buildTokenView(parseQuery("material=custom&mat_density=1.2&mat_elements=1:2"));
    const diagnostics: import("$lib/utils/url-diagnostics").Diagnostic[] = [];
    parseCustomCompound(t.get, { get: t.span }, diagnostics);
    const nameDiag = diagnostics.find((d) => d.param === "mat_name");
    expect(nameDiag?.severity).toBe("warning");
  });
});

describe("encodeMatElements", () => {
  it("emits ascending-Z Z:count pairs joined by the ~ list separator", () => {
    expect(
      encodeMatElements([
        { atomicNumber: 8, atomCount: 2 },
        { atomicNumber: 1, atomCount: 8 },
      ]),
    ).toBe("1:8~8:2");
  });
});
