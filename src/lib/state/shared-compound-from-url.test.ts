import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSharedCompoundFromUrl } from "./shared-compound-from-url.svelte";
import { customCompounds } from "./custom-compounds.svelte";
import type { decodeCalculatorUrl } from "$lib/utils/calculator-url";
import type { CustomCompoundPartial } from "$lib/utils/url-shared";

type UrlState = ReturnType<typeof decodeCalculatorUrl>;

/** Build a decoded-URL stub carrying a valid custom compound. */
function validCustomUrlState(overrides: Partial<UrlState> = {}): UrlState {
  return {
    materialIsCustom: true,
    matName: "LiF",
    matDensity: 2.64,
    matIval: undefined,
    matElements: [
      { atomicNumber: 3, atomCount: 1 },
      { atomicNumber: 9, atomCount: 1 },
    ],
    matPhase: "condensed",
    matSrc: "saved",
    matPartial: null,
    fromUrlWarning: null,
    ...overrides,
  } as unknown as UrlState;
}

describe("SharedCompoundFromUrl", () => {
  let flow: ReturnType<typeof createSharedCompoundFromUrl>;

  beforeEach(() => {
    flow = createSharedCompoundFromUrl();
  });

  afterEach(() => {
    // Remove any transient compounds left by this test to avoid polluting the
    // shared customCompounds singleton for subsequent tests in the same worker.
    for (const c of customCompounds.compounds) {
      if (customCompounds.isTransient(c.id)) {
        customCompounds.removeTransient(c.id);
      }
    }
  });

  describe("restoreCustomCompoundFromUrl", () => {
    it("adds a transient compound and exposes it as the banner subject", () => {
      const compound = flow.restoreCustomCompoundFromUrl(validCustomUrlState());

      expect(compound).not.toBeNull();
      expect(compound!.name).toBe("LiF");
      expect(flow.sharedUrlCompound?.id).toBe(compound!.id);
      expect(customCompounds.getById(compound!.id)).toBeDefined();
    });

    it("records the transient origin flag from matSrc", () => {
      flow.restoreCustomCompoundFromUrl(validCustomUrlState({ matSrc: "transient" }));
      expect(flow.sharedUrlFromTransient).toBe(true);
    });

    it("returns null and keeps warning/partial when the URL is not a valid custom compound", () => {
      const partial: CustomCompoundPartial = {
        name: "Broken",
        densityRaw: "abc",
        density: undefined,
        iValueRaw: "",
        iValue: undefined,
        elements: [],
        matPhase: "condensed",
      };
      const result = flow.restoreCustomCompoundFromUrl(
        validCustomUrlState({
          materialIsCustom: true,
          matDensity: undefined,
          matElements: [],
          fromUrlWarning: "density out of range",
          matPartial: partial,
        }),
      );

      expect(result).toBeNull();
      expect(flow.sharedUrlCompound).toBeNull();
      expect(flow.sharedUrlWarning).toBe("density out of range");
      expect(flow.sharedUrlPartial).toEqual(partial);
    });
  });

  describe("openSharedCompoundEditor", () => {
    it("prefills the editor from a restored transient compound", () => {
      flow.restoreCustomCompoundFromUrl(validCustomUrlState({ matName: "PMMA", matDensity: 1.19 }));
      flow.openSharedCompoundEditor();

      expect(flow.compoundEditorOpen).toBe(true);
      expect(flow.compoundEditorPrefill).not.toBeNull();
      expect(flow.compoundEditorPrefill!.density).toBe("1.19");
      expect(flow.compoundEditorPrefill!.elements.length).toBeGreaterThan(0);
    });

    it("prefills from the best-effort partial when no valid compound was restored", () => {
      const partial: CustomCompoundPartial = {
        name: "Water-ish",
        densityRaw: "1.0",
        density: 1.0,
        iValueRaw: "78",
        iValue: 78,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        matPhase: "condensed",
      };
      flow.restoreCustomCompoundFromUrl(
        validCustomUrlState({
          matDensity: undefined,
          matElements: [],
          fromUrlWarning: "could not parse all fields",
          matPartial: partial,
        }),
      );
      flow.openSharedCompoundEditor();

      expect(flow.compoundEditorOpen).toBe(true);
      expect(flow.compoundEditorPrefill!.density).toBe("1.0");
      expect(flow.compoundEditorPrefill!.iValue).toBe("78");
      expect(flow.compoundEditorWarning).toBe("could not parse all fields");
    });

    it("does nothing when there is neither a compound nor a partial", () => {
      flow.openSharedCompoundEditor();
      expect(flow.compoundEditorOpen).toBe(false);
      expect(flow.compoundEditorPrefill).toBeNull();
    });
  });

  describe("closeSharedCompoundEditor", () => {
    it("clears the editor state", () => {
      flow.restoreCustomCompoundFromUrl(validCustomUrlState());
      flow.openSharedCompoundEditor();
      flow.closeSharedCompoundEditor();

      expect(flow.compoundEditorOpen).toBe(false);
      expect(flow.compoundEditorPrefill).toBeNull();
      expect(flow.compoundEditorWarning).toBeNull();
    });
  });

  describe("dismissSharedCompound", () => {
    it("clears all shared-URL banner state", () => {
      flow.restoreCustomCompoundFromUrl(validCustomUrlState({ matSrc: "transient" }));
      flow.dismissSharedCompound();

      expect(flow.sharedUrlCompound).toBeNull();
      expect(flow.sharedUrlWarning).toBeNull();
      expect(flow.sharedUrlPartial).toBeNull();
      expect(flow.sharedUrlFromTransient).toBe(false);
    });
  });
});
