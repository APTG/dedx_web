import { describe, it, expect } from "vitest";
import { computeBucket, type SizeBucket } from "$lib/components/entity-selection/size-bucket";

describe("computeBucket", () => {
  it("returns 'tiny' for count = 0", () => {
    expect(computeBucket(0)).toBe<SizeBucket>("tiny");
  });

  it("returns 'tiny' for count = 1", () => {
    expect(computeBucket(1)).toBe<SizeBucket>("tiny");
  });

  it("returns 'tiny' for count = 10 (boundary)", () => {
    expect(computeBucket(10)).toBe<SizeBucket>("tiny");
  });

  it("returns 'medium' for count = 11 (just above tiny boundary)", () => {
    expect(computeBucket(11)).toBe<SizeBucket>("medium");
  });

  it("returns 'medium' for count = 100", () => {
    expect(computeBucket(100)).toBe<SizeBucket>("medium");
  });

  it("returns 'medium' for count = 150 (boundary)", () => {
    expect(computeBucket(150)).toBe<SizeBucket>("medium");
  });

  it("returns 'large' for count = 151 (just above medium boundary)", () => {
    expect(computeBucket(151)).toBe<SizeBucket>("large");
  });

  it("returns 'large' for count = 500", () => {
    expect(computeBucket(500)).toBe<SizeBucket>("large");
  });

  it("typical particle count (~30) is medium", () => {
    expect(computeBucket(30)).toBe<SizeBucket>("medium");
  });

  it("typical material count (~195) is large", () => {
    expect(computeBucket(195)).toBe<SizeBucket>("large");
  });

  it("typical built-in program count (7) is tiny", () => {
    expect(computeBucket(7)).toBe<SizeBucket>("tiny");
  });

  it("program count with externals pushing past 10 (12) is medium", () => {
    expect(computeBucket(12)).toBe<SizeBucket>("medium");
  });
});
