import { describe, test, expect, beforeEach } from "vitest";
import {
  sanitizeLabel,
  labelFromUrl,
  validateLabelValue,
  validateExternalUrl,
  nextAvailableLabel,
  firstDroppedUrl,
  appendRecent,
  loadRecents,
  recordRecent,
  type ExternalRecent,
} from "$lib/external-data/load-form";

describe("sanitizeLabel", () => {
  test("replaces invalid chars with single dashes and trims", () => {
    expect(sanitizeLabel("My Data!! v2")).toBe("My-Data-v2");
    expect(sanitizeLabel("--leading--trailing--")).toBe("leading-trailing");
  });

  test("caps at 32 chars and falls back to 'ext'", () => {
    expect(sanitizeLabel("a".repeat(40))).toHaveLength(32);
    expect(sanitizeLabel("")).toBe("ext");
    expect(sanitizeLabel("@@@")).toBe("ext");
  });
});

describe("labelFromUrl", () => {
  test("uses the last path segment minus .webdedx", () => {
    expect(labelFromUrl("https://example.com/data/srim.webdedx")).toBe("srim");
    expect(labelFromUrl("https://example.com/My%20Set.webdedx/")).toBe("My-20Set");
  });

  test("falls back to 'ext' on an unparseable URL", () => {
    expect(labelFromUrl("not a url")).toBe("ext");
  });
});

describe("validateLabelValue", () => {
  const existing = new Set(["srim"]);

  test("rejects empty, bad charset and duplicates", () => {
    expect(validateLabelValue("", existing)).toBe("Label is required");
    expect(validateLabelValue("a b", existing)).toBe("Use only letters, digits, - and _");
    expect(validateLabelValue("srim", existing)).toBe('"srim" is already loaded');
  });

  test("accepts a fresh valid label", () => {
    expect(validateLabelValue("astar", existing)).toBeNull();
  });
});

describe("validateExternalUrl", () => {
  test("accepts https .webdedx and http localhost", () => {
    expect(validateExternalUrl("https://example.com/x.webdedx")).toBeNull();
    expect(validateExternalUrl("http://localhost:5173/x.webdedx")).toBeNull();
    expect(validateExternalUrl("http://127.0.0.1/data/x.webdedx/")).toBeNull();
  });

  test("rejects plain http and non-.webdedx", () => {
    expect(validateExternalUrl("http://example.com/x.webdedx")).not.toBeNull();
    expect(validateExternalUrl("https://example.com/x.zip")).not.toBeNull();
  });
});

describe("nextAvailableLabel", () => {
  test("returns base when free", () => {
    expect(nextAvailableLabel("srim", new Set())).toBe("srim");
  });

  test("appends the first free numeric suffix", () => {
    expect(nextAvailableLabel("srim", new Set(["srim", "srim-2"]))).toBe("srim-3");
  });
});

describe("firstDroppedUrl", () => {
  test("prefers uri-list, taking the first line", () => {
    expect(firstDroppedUrl("https://a.com/x.webdedx\nhttps://b.com", "")).toBe(
      "https://a.com/x.webdedx",
    );
  });

  test("falls back to plain text", () => {
    expect(firstDroppedUrl("", "http://localhost/x.webdedx")).toBe("http://localhost/x.webdedx");
  });

  test("returns null when no http(s) URL", () => {
    expect(firstDroppedUrl("", "just text")).toBeNull();
    expect(firstDroppedUrl("", "")).toBeNull();
  });
});

describe("appendRecent", () => {
  const mk = (url: string): ExternalRecent => ({ url, label: "l", name: "n", loadedAt: 0 });

  test("prepends and de-duplicates by url", () => {
    const list = [mk("a"), mk("b")];
    expect(appendRecent(list, mk("a")).map((r) => r.url)).toEqual(["a", "b"]);
    expect(appendRecent(list, mk("c")).map((r) => r.url)).toEqual(["c", "a", "b"]);
  });

  test("caps the list length", () => {
    const list = [mk("a"), mk("b"), mk("c")];
    expect(appendRecent(list, mk("d"), 2).map((r) => r.url)).toEqual(["d", "a"]);
  });
});

describe("loadRecents / recordRecent (localStorage)", () => {
  beforeEach(() => localStorage.clear());

  test("loadRecents returns empty when nothing stored", () => {
    expect(loadRecents()).toEqual([]);
  });

  test("recordRecent persists and returns the updated list", () => {
    const after = recordRecent("https://a.com/x.webdedx", "srim", "SRIM");
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ url: "https://a.com/x.webdedx", label: "srim", name: "SRIM" });
    expect(loadRecents()).toHaveLength(1);
  });

  test("loadRecents recovers from corrupt JSON", () => {
    localStorage.setItem("webdedx.externalRecents.v1", "{not json");
    expect(loadRecents()).toEqual([]);
  });
});
