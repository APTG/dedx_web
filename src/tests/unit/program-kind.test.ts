import { describe, test, expect } from "vitest";
import {
  programKind,
  programKindMeta,
  getProgramKindMeta,
} from "$lib/utils/program-kind";

describe("programKind", () => {
  test("numeric ids ≤ 90 map to TAB", () => {
    expect(programKind(1)).toBe("TAB");
    expect(programKind(2)).toBe("TAB");
    expect(programKind(7)).toBe("TAB");
    expect(programKind(90)).toBe("TAB");
  });

  test("numeric ids > 90 map to FN", () => {
    expect(programKind(91)).toBe("FN");
    expect(programKind(100)).toBe("FN");
    expect(programKind(101)).toBe("FN");
  });

  test("string ids map to EXT", () => {
    expect(programKind("ext:srim/srim")).toBe("EXT");
    expect(programKind("any-extref")).toBe("EXT");
  });
});

describe("programKindMeta", () => {
  test("returns glyph, badge and description for each kind", () => {
    expect(programKindMeta(2)).toMatchObject({
      kind: "TAB",
      glyph: "▦",
      badge: "DATA",
      description: expect.stringContaining("Tabulated"),
    });
    expect(programKindMeta(100)).toMatchObject({
      kind: "FN",
      glyph: "∫",
      badge: "FN",
      description: expect.stringContaining("Analytical"),
    });
    expect(programKindMeta("ext:foo")).toMatchObject({
      kind: "EXT",
      glyph: "🔗",
      badge: "EXT",
      description: expect.stringContaining("External"),
    });
  });
});

describe("getProgramKindMeta", () => {
  test("retrieves meta directly by kind", () => {
    expect(getProgramKindMeta("TAB").glyph).toBe("▦");
    expect(getProgramKindMeta("FN").glyph).toBe("∫");
    expect(getProgramKindMeta("EXT").glyph).toBe("🔗");
  });
});
