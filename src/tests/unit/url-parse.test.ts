import { describe, it, expect } from "vitest";
import { parseQuery, UrlParseError } from "$lib/utils/url-parse";
import type { PairNode } from "$lib/utils/url-ast";

/** Find the first pair with the given key (ignores duplicates). */
function pair(query: string, key: string): PairNode | undefined {
  return parseQuery(query).pairs.find((p) => "key" in p && p.key === key);
}

/** All pairs with the given key, in document order. */
function pairs(query: string, key: string): PairNode[] {
  return parseQuery(query).pairs.filter((p) => "key" in p && p.key === key);
}

describe("parseQuery — tokenization (no semantics)", () => {
  it("splits scalar pairs and records spans", () => {
    const ast = parseQuery("urlv=2&particle=6");
    expect(ast.pairs).toEqual([
      { type: "scalar", key: "urlv", value: "2", span: { start: 0, end: 6 } },
      { type: "scalar", key: "particle", value: "6", span: { start: 7, end: 17 } },
    ]);
  });

  it("keeps ALL duplicate pairs (last-wins is a resolver concern)", () => {
    const found = pairs("particle=1&particle=2", "particle");
    expect(found.map((p) => (p.type === "scalar" ? p.value : null))).toEqual(["1", "2"]);
  });

  it("classifies unrecognized keys as unknown without dropping them", () => {
    const p = pair("foo=bar", "foo");
    expect(p).toMatchObject({ type: "unknown", key: "foo", value: "bar" });
  });

  it("accepts a bare unknown key with no value", () => {
    expect(pair("tip_seen=inline_unit&flag", "flag")).toMatchObject({
      type: "unknown",
      key: "flag",
      value: "",
    });
  });

  it("accepts a URLSearchParams input and a leading '?'", () => {
    const ast = parseQuery(new URLSearchParams("particle=1"));
    expect(ast.pairs[0]).toMatchObject({ key: "particle", value: "1" });
    expect(parseQuery("?particle=1").pairs[0]).toMatchObject({ key: "particle", value: "1" });
  });
});

describe("parseQuery — structured list params", () => {
  it("parses energies into items with per-row unit suffix", () => {
    const p = pair("energies=100,200:keV", "energies");
    expect(p).toMatchObject({
      type: "energies",
      raw: "100,200:keV",
      items: [
        { value: "100", unit: null },
        { value: "200", unit: "keV" },
      ],
    });
  });

  it("falls back to raw when an energy unit is not recognized", () => {
    const p = pair("energies=100:foo", "energies");
    expect(p).toMatchObject({ type: "energies", items: null, raw: "100:foo" });
  });

  it("parses series triplets including ext-refs", () => {
    const p = pair("series=9.1.276,ext:cake:7.1.276", "series");
    expect(p).toMatchObject({
      type: "series",
      items: [
        { program: "9", particle: "1", material: "276" },
        { program: "ext:cake:7", particle: "1", material: "276" },
      ],
    });
  });

  it("parses mat_elements as Z:count pairs", () => {
    const p = pair("mat_elements=8:2,1:8,6:5", "mat_elements");
    expect(p).toMatchObject({
      type: "mat-elements",
      elements: [
        { z: "8", count: "2" },
        { z: "1", count: "8" },
        { z: "6", count: "5" },
      ],
    });
  });

  it("parses entity lists (programs/particles/materials)", () => {
    expect(pair("programs=9,2,101", "programs")).toMatchObject({
      type: "entity-list",
      key: "programs",
      ids: ["9", "2", "101"],
    });
  });

  it("does not confuse singular anchors with plural lists", () => {
    const ast = parseQuery("material=custom&materials=276,3");
    expect(pair("material=custom&materials=276,3", "material")).toMatchObject({
      type: "scalar",
      value: "custom",
    });
    expect(ast.pairs.find((p) => "key" in p && p.key === "materials")).toMatchObject({
      type: "entity-list",
      ids: ["276", "3"],
    });
  });

  it("parses lookups items", () => {
    expect(pair("lookups=7.718:cm,45:um,1.5:mm", "lookups")).toMatchObject({
      type: "lookups",
      items: [
        { value: "7.718", unit: "cm" },
        { value: "45", unit: "um" },
        { value: "1.5", unit: "mm" },
      ],
    });
  });

  it("treats ivalues as a lookups node (legacy alias)", () => {
    expect(pair("ivalues=45.76,10.00", "ivalues")).toMatchObject({
      type: "lookups",
      key: "ivalues",
      items: [
        { value: "45.76", unit: null },
        { value: "10.00", unit: null },
      ],
    });
  });

  it("splits extdata on the first colon", () => {
    expect(pair("extdata=cake:https%3A%2F%2Fx.org", "extdata")).toMatchObject({
      type: "extdata",
      label: "cake",
      url: "https%3A%2F%2Fx.org",
    });
  });
});

describe("parseQuery — §5 conformance vectors (structure)", () => {
  it("vector 5.1.1 — basic forward defaults", () => {
    const ast = parseQuery(
      "urlv=2&particle=1&material=276&program=auto&energies=100,200&uanchor=MeV",
    );
    expect(ast.pairs.map((p) => ("key" in p ? p.key : null))).toEqual([
      "urlv",
      "particle",
      "material",
      "program",
      "energies",
      "uanchor",
    ]);
  });

  it("vector 5.1.5 — compare-across programs", () => {
    const ast = parseQuery(
      "urlv=2&mode=advanced&particle=1&material=276&program=9&programs=9,2,101&energies=100,200&uanchor=MeV&across=programs&qshow=range",
    );
    const energies = ast.pairs.find((p) => "key" in p && p.key === "energies");
    expect(energies).toMatchObject({
      items: [
        { value: "100", unit: null },
        { value: "200", unit: null },
      ],
    });
    expect(ast.pairs.find((p) => "key" in p && p.key === "programs")).toMatchObject({
      ids: ["9", "2", "101"],
    });
  });

  it("vector 5.3.6 — custom compound element order preserved in tokens", () => {
    const p = pair(
      "urlv=2&mode=advanced&material=custom&mat_elements=8:2,1:8,6:5&mat_ival=74.0",
      "mat_elements",
    );
    // Canonical ascending-Z ordering is a resolver/canonicalize concern, not the parser's.
    expect(p).toMatchObject({
      elements: [
        { z: "8", count: "2" },
        { z: "1", count: "8" },
        { z: "6", count: "5" },
      ],
    });
  });
});

describe("parseQuery — totality (never discards valid params)", () => {
  it("tokenizes a leading '=' (empty key) instead of throwing", () => {
    // The grammar is total so a malformed segment is captured, not fatal.
    const ast = parseQuery("=oops");
    expect(ast.pairs).toEqual([
      { type: "unknown", key: "", value: "oops", span: { start: 0, end: 5 } },
    ]);
  });

  it("preserves valid params that sit next to a malformed segment", () => {
    // Regression guard: a bad `=oops` segment must not drop `particle=1`.
    const ast = parseQuery("particle=1&=oops");
    expect(pair("particle=1&=oops", "particle")).toMatchObject({ type: "scalar", value: "1" });
    expect(ast.pairs.some((p) => p.type === "unknown" && p.key === "")).toBe(true);
  });

  it("UrlParseError remains the defensive contract for any residual failure", () => {
    expect(UrlParseError).toBeTypeOf("function");
  });
});
