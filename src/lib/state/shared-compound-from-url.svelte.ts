import {
  customCompounds,
  suggestCopyName,
  type StoredCompoundInternal,
} from "$lib/state/custom-compounds.svelte";
import type { CustomCompoundPartial } from "$lib/utils/url-shared";
import type { CompoundEditorPrefill } from "$lib/components/compound-editor/types";
import type { decodeCalculatorUrl } from "$lib/utils/calculator-url";
import { appInit } from "$lib/state/app-init.svelte";

/**
 * Shared-compound-from-URL flow (issue #648).
 *
 * Owns the banner + recovery-editor state for a custom compound that arrived via
 * a shared link, and the actions to either save it to the library as-is, edit a
 * copy first, or dismiss it. Extracted from the calculator page orchestrator
 * (issue #763) so the orchestrator is left doing wiring + effect ordering only.
 *
 * The orchestrator holds an instance and delegates; the calculator page consumes
 * the same surface via that orchestrator.
 */
export class SharedCompoundFromUrl {
  sharedUrlCompound = $state<StoredCompoundInternal | null>(null);
  sharedUrlWarning = $state<string | null>(null);
  /** Best-effort `mat_*` fields from the URL, used to pre-fill the editor (Gap B). */
  sharedUrlPartial = $state<CustomCompoundPartial | null>(null);
  /** True when the shared URL carried `matsrc=transient` (sender never saved it). */
  sharedUrlFromTransient = $state(false);

  // "Edit & save copy" / failed-URL recovery editor (issue #648). A dedicated
  // CompoundEditorModal instance lives on the calculator page so the flow works
  // even when the entity-selection picker (which owns the library editor) is
  // collapsed and unmounted.
  compoundEditorOpen = $state(false);
  compoundEditorPrefill = $state<CompoundEditorPrefill | null>(null);
  compoundEditorWarning = $state<string | null>(null);

  restoreCustomCompoundFromUrl(urlState: ReturnType<typeof decodeCalculatorUrl>) {
    this.sharedUrlWarning = urlState.fromUrlWarning ?? null;
    this.sharedUrlPartial = urlState.matPartial ?? null;
    this.sharedUrlFromTransient = urlState.matSrc === "transient";
    if (
      !urlState.materialIsCustom ||
      !urlState.matName ||
      urlState.matDensity === undefined ||
      !urlState.matElements?.length
    ) {
      return null;
    }

    const compound = customCompounds.addTransient({
      name: urlState.matName,
      density: urlState.matDensity,
      iValue: urlState.matIval,
      elements: urlState.matElements,
      phase: urlState.matPhase ?? "condensed",
    });
    this.sharedUrlCompound = compound;
    return compound;
  }

  /**
   * Open the dedicated compound editor pre-filled from the shared URL — either
   * the valid transient (deduplicated name) or, when the URL failed validation,
   * the best-effort partial fields with an amber warning (issue #648).
   */
  openSharedCompoundEditor() {
    if (this.sharedUrlCompound) {
      const copy = customCompounds.editAndSaveCopy(this.sharedUrlCompound);
      this.compoundEditorPrefill = {
        name: copy.name,
        density: String(copy.density),
        iValue: copy.iValue !== undefined ? String(copy.iValue) : "",
        phase: copy.phase,
        elements: copy.elements,
      };
    } else if (this.sharedUrlPartial) {
      const p = this.sharedUrlPartial;
      this.compoundEditorPrefill = {
        name: p.name ? suggestCopyName(p.name, (n) => customCompounds.nameExists(n)) : "",
        density: p.densityRaw,
        iValue: p.iValueRaw,
        phase: p.matPhase,
        elements: p.elements.map((e) => ({ ...e })),
      };
    } else {
      return;
    }
    this.compoundEditorWarning = this.sharedUrlWarning;
    this.compoundEditorOpen = true;
  }

  /**
   * Persist the edited copy: create a new library entry, dismiss the transient
   * and clear the shared-URL banner, then select the new entry.
   */
  saveSharedCompoundCopy(data: {
    name: string;
    density: number;
    iValue?: number;
    elements: Array<{ atomicNumber: number; atomCount: number }>;
    phase: "gas" | "condensed";
  }) {
    const result = customCompounds.create(data);
    if (!result.success) return;
    if (this.sharedUrlCompound) {
      customCompounds.removeTransient(this.sharedUrlCompound.id);
    }
    appInit.entityState?.selectMaterial(result.compound.id);
    this.dismissSharedCompound();
    this.closeSharedCompoundEditor();
  }

  closeSharedCompoundEditor() {
    this.compoundEditorOpen = false;
    this.compoundEditorPrefill = null;
    this.compoundEditorWarning = null;
  }

  /** Save the transient compound to the library as-is ("Save to library"). */
  saveSharedToLibrary() {
    const c = this.sharedUrlCompound;
    if (!c || !appInit.entityState) return;
    const result = customCompounds.create({
      name: c.name,
      density: c.density,
      iValue: c.iValue,
      elements: c.elements,
      phase: c.phase,
    });
    if (!result.success) return;
    customCompounds.removeTransient(c.id);
    appInit.entityState.selectMaterial(result.compound.id);
    this.dismissSharedCompound();
  }

  dismissSharedCompound() {
    this.sharedUrlCompound = null;
    this.sharedUrlWarning = null;
    this.sharedUrlPartial = null;
    this.sharedUrlFromTransient = false;
  }
}

export function createSharedCompoundFromUrl() {
  return new SharedCompoundFromUrl();
}
