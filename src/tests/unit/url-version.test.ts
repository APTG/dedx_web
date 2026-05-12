import { describe, test, expect } from "vitest";
import { negotiateVersion } from "$lib/utils/url-version.js";

describe("negotiateVersion", () => {
  test("negotiateVersion(1) → ok", () => {
    expect(negotiateVersion(1)).toEqual({ status: "ok" });
  });

  test("negotiateVersion(undefined) → ok (absent = version 1)", () => {
    expect(negotiateVersion(undefined)).toEqual({ status: "ok" });
  });

  test("negotiateVersion(999) → mismatch with version 999", () => {
    expect(negotiateVersion(999)).toEqual({ status: "mismatch", version: 999 });
  });

  test("negotiateVersion(0) → mismatch with version 0", () => {
    expect(negotiateVersion(0)).toEqual({ status: "mismatch", version: 0 });
  });
});
