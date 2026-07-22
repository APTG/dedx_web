/**
 * Page-Init Contract Tests
 *
 * These tests assert that critical initialization calls are present in both
 * page components. They are string-presence checks on the source file content
 * — cheap to run, catch the exact class of bug from PR #427 comment
 * 4388502961 (missing initAdvancedModeFromUrl on /plot).
 *
 * See .opencode/lessons-learned.md Entry 9.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/** Resolve a path relative to the project root. */
function repoFile(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

/** Read a source file and return its text content. */
function readSource(relativePath: string): string {
  return readFileSync(repoFile(relativePath), "utf-8");
}

const CALCULATOR_PAGE = "src/routes/calculator/+page.svelte";
const CALCULATOR_ORCHESTRATOR = "src/lib/state/calculator-page-orchestrator.svelte.ts";
const PLOT_PAGE = "src/routes/plot/+page.svelte";
const PLOT_ORCHESTRATOR = "src/lib/state/plot-page-orchestrator.svelte.ts";

describe("Page-init contract — initAdvancedModeFromUrl", () => {
  it("calculator orchestrator calls initAdvancedModeFromUrl", () => {
    const source = readSource(CALCULATOR_ORCHESTRATOR);
    expect(source).toContain("initAdvancedModeFromUrl");
  });

  it("plot orchestrator calls initAdvancedModeFromUrl", () => {
    const source = readSource(PLOT_ORCHESTRATOR);
    expect(source).toContain("initAdvancedModeFromUrl");
  });
});

describe("Page-init contract — isAdvancedMode guard on advanced-option reads", () => {
  it("calculator/+page.svelte references isAdvancedMode (guards advanced reads)", () => {
    const source = readSource(CALCULATOR_PAGE);
    expect(source).toContain("isAdvancedMode");
  });

  it("plot/+page.svelte references isAdvancedMode (guards advanced reads)", () => {
    const source = readSource(PLOT_PAGE);
    expect(source).toContain("isAdvancedMode");
  });
});

describe("Page-init contract — reactive dep snapshot pattern", () => {
  it("calculator/+page.svelte uses advOptsKey or equivalent snapshot pattern", () => {
    const source = readSource(CALCULATOR_PAGE);
    // Either a dedicated advOptsKey $derived, or explicit sync snapshot reads.
    // We check for the advOptsKey pattern that was added in Stage 6.8.
    const hasAdvOptsKey = source.includes("advOptsKey");
    const hasAdvOptsSnapshot =
      source.includes("advancedOptions.value") && source.includes("$derived");
    expect(hasAdvOptsKey || hasAdvOptsSnapshot).toBe(true);
  });

  it("plot orchestrator uses advOptsKey or equivalent snapshot pattern", () => {
    const source = readSource(PLOT_ORCHESTRATOR);
    const hasAdvOptsKey = source.includes("advOptsKey");
    const hasAdvOptsSnapshot =
      source.includes("advancedOptions.value") && source.includes("$derived");
    expect(hasAdvOptsKey || hasAdvOptsSnapshot).toBe(true);
  });
});

describe("Page-init contract — replaceState wrapped in untrack", () => {
  it("plot/+page.svelte wraps replaceState calls with untrack (prevents reactive loop)", () => {
    const source = readSource(PLOT_PAGE);
    // If replaceState is present, it must be within an untrack() call.
    // This guards against the effect_update_depth_exceeded bug.
    if (source.includes("import { replaceState }")) {
      expect(source).toContain("untrack");
    }
  });

  it("calculator orchestrator wraps replaceState calls with untrack (prevents reactive loop)", () => {
    const source = readSource(CALCULATOR_ORCHESTRATOR);
    if (source.includes("import { replaceState }")) {
      expect(source).toContain("untrack");
    }
  });
});

describe("Page-init contract — urlv negotiation", () => {
  it("calculator orchestrator source contains negotiateVersion call", () => {
    const source = readSource(CALCULATOR_ORCHESTRATOR);
    expect(source).toContain("negotiateVersion");
  });

  it("plot orchestrator source contains negotiateVersion call", () => {
    const source = readSource(PLOT_ORCHESTRATOR);
    expect(source).toContain("negotiateVersion");
  });
});

describe("Page-init contract — Basic-mode program-discard toast (#869)", () => {
  it("calculator orchestrator announces feedback when hydrating an explicit program in Basic mode", () => {
    const source = readSource(CALCULATOR_ORCHESTRATOR);
    // Guards against silently regressing to the pre-#869 behavior where a
    // Basic-mode link's `program=` was discarded by setupModeFallbacks with
    // no user-visible explanation.
    expect(source).toContain("announceProgramFeedback");
    expect(source).toContain("urlState.programId !== null");
  });

  it("calculator/+page.svelte mounts a NoticeToast bound to orchestrator.programFeedback", () => {
    const source = readSource(CALCULATOR_PAGE);
    expect(source).toContain("NoticeToast");
    expect(source).toContain("orchestrator.programFeedback");
  });
});
