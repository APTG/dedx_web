import { describe, test, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { stripHeadsPrefix } = require("../../../scripts/deploy.cjs");

describe("stripHeadsPrefix", () => {
  test('removes "heads/" prefix from branch refs', () => {
    expect(stripHeadsPrefix("heads/master")).toBe("master");
    expect(stripHeadsPrefix("heads/feat/foo")).toBe("feat/foo");
  });

  test('keeps "tags/" prefix unchanged', () => {
    expect(stripHeadsPrefix("tags/v1.0")).toBe("tags/v1.0");
  });

  test('returns string unchanged if no "heads/" prefix', () => {
    expect(stripHeadsPrefix("master")).toBe("master");
    expect(stripHeadsPrefix("feat/bar")).toBe("feat/bar");
  });

  test("returns empty string unchanged", () => {
    expect(stripHeadsPrefix("")).toBe("");
  });
});
