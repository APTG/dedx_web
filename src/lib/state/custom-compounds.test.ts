import { describe, it, expect } from "vitest";
import { mergeRows } from "./custom-compounds.svelte";

describe("mergeRows", () => {
  it("merges two rows with the same atomic number", () => {
    const rowA = { atomicNumber: 6, atomCount: 2 };
    const rowB = { atomicNumber: 6, atomCount: 3 };
    const merged = mergeRows(rowA, rowB);
    expect(merged).toEqual({ atomicNumber: 6, atomCount: 5 });
  });

  it("throws when merging rows with different atomic numbers", () => {
    const rowA = { atomicNumber: 6, atomCount: 2 };
    const rowB = { atomicNumber: 8, atomCount: 1 };
    expect(() => mergeRows(rowA, rowB)).toThrow("Cannot merge different elements: Z=6 and Z=8");
  });
});
