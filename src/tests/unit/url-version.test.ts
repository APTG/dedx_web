import { describe, test, expect } from "vitest";
import {
  negotiateVersion,
  migrateUrl,
  CURRENT_URL_MAJOR,
  MIN_SUPPORTED_URL_MAJOR,
} from "$lib/utils/url-version.js";

describe("negotiateVersion", () => {
  test("negotiateVersion(2) → ok", () => {
    expect(negotiateVersion("2")).toEqual({ status: "ok" });
  });

  test("negotiateVersion(null/undefined) → ok (absent = current schema)", () => {
    expect(negotiateVersion(null)).toEqual({ status: "ok" });
    expect(negotiateVersion(undefined)).toEqual({ status: "ok" });
  });

  test("negotiateVersion(1) → mismatch (v1 no longer supported)", () => {
    expect(negotiateVersion("1")).toEqual({ status: "mismatch", version: 1 });
  });

  test("negotiateVersion(999) → mismatch with version 999", () => {
    expect(negotiateVersion("999")).toEqual({ status: "mismatch", version: 999 });
  });

  test("negotiateVersion(0) → mismatch with version 0", () => {
    expect(negotiateVersion("0")).toEqual({ status: "mismatch", version: 0 });
  });

  test("malformed urlv → mismatch with raw token", () => {
    expect(negotiateVersion("1abc")).toEqual({ status: "mismatch", version: "1abc" });
  });
});

describe("migrateUrl seam", () => {
  test("v1 is below the minimum supported major (rejected, not migrated)", () => {
    expect(MIN_SUPPORTED_URL_MAJOR).toBe(2);
    expect(CURRENT_URL_MAJOR).toBe(2);
  });

  test("is the identity for the current major (no chain defined yet)", () => {
    const tokens = { a: 1 };
    expect(migrateUrl(CURRENT_URL_MAJOR, CURRENT_URL_MAJOR, tokens)).toBe(tokens);
  });
});
