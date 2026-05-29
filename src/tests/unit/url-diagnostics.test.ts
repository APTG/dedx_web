import { describe, it, expect } from "vitest";
import { renderCaret, friendlyExpected } from "$lib/utils/url-diagnostics";

describe("renderCaret", () => {
  it("underlines the offending span", () => {
    const src = "particle=6&energies=100";
    const [line = "", carets = ""] = renderCaret(src, { start: 11, end: 19 }).split("\n");
    expect(line).toBe(src);
    expect(carets).toBe(" ".repeat(11) + "^".repeat(8));
  });

  it("windows long inputs with ellipses and keeps the caret aligned", () => {
    const src = "a".repeat(60) + "BAD" + "b".repeat(60);
    const [line = "", carets = ""] = renderCaret(src, { start: 60, end: 63 }, 10).split("\n");
    expect(line.startsWith("…")).toBe(true);
    expect(line.endsWith("…")).toBe(true);
    // caret sits under the first 'B' of BAD
    const caretStart = carets.indexOf("^");
    expect(line[caretStart]).toBe("B");
    expect(carets.replace(/[^^]/g, "")).toBe("^^^");
  });

  it("always draws at least one caret for a zero-width span", () => {
    const [, carets = ""] = renderCaret("abc", { start: 1, end: 1 }).split("\n");
    expect(carets).toBe(" ^");
  });
});

describe("friendlyExpected", () => {
  it("uses named-rule descriptions and lists alternatives", () => {
    const msg = friendlyExpected({
      expected: [
        { type: "other", description: "a number" },
        { type: "literal", text: "&" },
      ],
      found: ",",
      location: { start: { offset: 5 }, end: { offset: 6 } },
    });
    expect(msg).toBe('Expected a number or "&" but found ",".');
  });

  it("reports end of input when nothing was found", () => {
    const msg = friendlyExpected({
      expected: [{ type: "other", description: "an integer" }],
      found: null,
      location: { start: { offset: 3 }, end: { offset: 3 } },
    });
    expect(msg).toBe("Expected an integer but found end of input.");
  });

  it("de-duplicates repeated expectations", () => {
    const msg = friendlyExpected({
      expected: [
        { type: "other", description: "a number" },
        { type: "other", description: "a number" },
      ],
      found: "x",
      location: { start: { offset: 0 }, end: { offset: 1 } },
    });
    expect(msg).toBe('Expected a number but found "x".');
  });
});
