import { describe, test, expect } from "vitest";
import {
  formatProgramName,
  getProgramFriendlyName,
  PROGRAM_NAME_OVERRIDES,
} from "$lib/config/program-names";

describe("formatProgramName", () => {
  test("keeps pure alphabetic acronyms as-is", () => {
    expect(formatProgramName("ASTAR")).toBe("ASTAR");
    expect(formatProgramName("PSTAR")).toBe("PSTAR");
    expect(formatProgramName("MSTAR")).toBe("MSTAR");
    expect(formatProgramName("ESTAR")).toBe("ESTAR");
  });

  test("converts underscore-separated names to title-case", () => {
    expect(formatProgramName("SOME_PROGRAM_NAME")).toBe("Some Program Name");
  });

  test("returns empty string unchanged", () => {
    expect(formatProgramName("")).toBe("");
  });
});

describe("PROGRAM_NAME_OVERRIDES", () => {
  test("maps ICRU 73 (old) to ID 5", () => {
    expect(PROGRAM_NAME_OVERRIDES.get(5)).toBe("ICRU 73 (old)");
  });

  test("maps ICRU 73 to ID 6", () => {
    expect(PROGRAM_NAME_OVERRIDES.get(6)).toBe("ICRU 73");
  });

  test("maps ICRU 49 to ID 7", () => {
    expect(PROGRAM_NAME_OVERRIDES.get(7)).toBe("ICRU 49");
  });

  test("maps Default (Bethe) to ID 100", () => {
    expect(PROGRAM_NAME_OVERRIDES.get(100)).toBe("Default (Bethe)");
  });

  test("maps Bethe Extended to ID 101", () => {
    expect(PROGRAM_NAME_OVERRIDES.get(101)).toBe("Bethe Extended");
  });

  test("no override is an empty string", () => {
    for (const name of PROGRAM_NAME_OVERRIDES.values()) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test("no override contains raw ALL-CAPS identifiers like ICRU73_OLD", () => {
    for (const name of PROGRAM_NAME_OVERRIDES.values()) {
      expect(name).not.toMatch(/_/);
    }
  });
});

describe("getProgramFriendlyName", () => {
  test("returns ASTAR unchanged for ID 1", () => {
    expect(getProgramFriendlyName(1, "ASTAR")).toBe("ASTAR");
  });

  test("returns PSTAR unchanged for ID 2", () => {
    expect(getProgramFriendlyName(2, "PSTAR")).toBe("PSTAR");
  });

  test("returns MSTAR unchanged for ID 4", () => {
    expect(getProgramFriendlyName(4, "MSTAR")).toBe("MSTAR");
  });

  test("returns ICRU 73 (old) for ID 5, raw ICRU73_OLD", () => {
    expect(getProgramFriendlyName(5, "ICRU73_OLD")).toBe("ICRU 73 (old)");
  });

  test("returns ICRU 73 for ID 6, raw ICRU73", () => {
    expect(getProgramFriendlyName(6, "ICRU73")).toBe("ICRU 73");
  });

  test("returns ICRU 49 for ID 7, raw ICRU49", () => {
    expect(getProgramFriendlyName(7, "ICRU49")).toBe("ICRU 49");
  });

  test("returns Default (Bethe) for ID 100, raw DEFAULT", () => {
    expect(getProgramFriendlyName(100, "DEFAULT")).toBe("Default (Bethe)");
  });

  test("returns Bethe Extended for ID 101, raw BETHE_EXT00", () => {
    expect(getProgramFriendlyName(101, "BETHE_EXT00")).toBe("Bethe Extended");
  });

  test("override takes precedence over raw name", () => {
    expect(getProgramFriendlyName(100, "ANYTHING")).toBe("Default (Bethe)");
  });

  test("falls back to formatProgramName for unknown IDs", () => {
    expect(getProgramFriendlyName(999, "NEWPROG")).toBe("NEWPROG");
    expect(getProgramFriendlyName(999, "NEW_PROG")).toBe("New Prog");
  });
});
