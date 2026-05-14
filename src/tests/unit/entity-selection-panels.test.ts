/**
 * Regression tests for the each_key_duplicate bug in entity-selection-panels.svelte.
 *
 * Root cause: programItems always pushed state.selectedProgram as the first
 * entry. When a concrete program (e.g. PSTAR, id=2) was selected,
 * state.selectedProgram returned that ProgramEntity (id=2), and the same entity
 * also appeared in state.availablePrograms — giving Svelte two items with the
 * same key and throwing each_key_duplicate.
 *
 * Fix: always push a synthetic { id: -1, name: "Auto-select" } entity so the
 * first list entry can never clash with any real program ID.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntitySelectionPanels from "$lib/components/entity-selection-panels.svelte";
import { createEntitySelectionState } from "$lib/state/entity-selection.svelte";
import { buildCompatibilityMatrix } from "$lib/state/compatibility-matrix";
import { buildExternalCompatibilityContext } from "$lib/state/external-compatibility";
import { makeExternalEntityStore } from "./external-entity-fixtures";
import type { ProgramEntity, ParticleEntity, MaterialEntity } from "$lib/wasm/types";

// Minimal mock: PSTAR (2) and ICRU49 (7) both support Proton (1) + Water (276).
// This replicates the exact scenario that triggered each_key_duplicate.
class MockService {
  getPrograms(): ProgramEntity[] {
    return [
      { id: 2, name: "PSTAR", version: "1.0" },
      { id: 7, name: "ICRU 49", version: "1.0" },
    ];
  }

  getParticles(_programId: number): ParticleEntity[] {
    return [
      {
        id: 1,
        name: "Hydrogen",
        massNumber: 1,
        atomicMass: 1.007,
        symbol: "H",
        aliases: ["proton", "p"],
      },
    ];
  }

  getMaterials(_programId: number): MaterialEntity[] {
    return [{ id: 276, name: "Water (liquid)", density: 1.0, isGasByDefault: false }];
  }
}

describe("EntitySelectionPanels — program panel duplicate-key regression", () => {
  let state: ReturnType<typeof createEntitySelectionState>;

  beforeEach(() => {
    cleanup();
    const matrix = buildCompatibilityMatrix(new MockService() as any);
    state = createEntitySelectionState(matrix);
  });

  test("selecting PSTAR does not produce duplicate program buttons", async () => {
    const user = userEvent.setup();
    render(EntitySelectionPanels, { props: { state } });

    const programPanel = screen.getByRole("group", { name: /③ Program/i });

    // Click PSTAR — previously caused each_key_duplicate (keys 2 at indexes 0 and 1)
    const pstarButton = within(programPanel).getByRole("button", { name: /PSTAR/i });
    await user.click(pstarButton);

    // Each program name must appear exactly once in the panel
    const allButtons = within(programPanel).getAllByRole("button");
    const buttonTexts = allButtons.map((b) => b.textContent?.trim() ?? "");
    const unique = new Set(buttonTexts);
    expect(unique.size).toBe(allButtons.length);
  });

  test("Auto-select button is always present with its own entry after selecting PSTAR", async () => {
    const user = userEvent.setup();
    render(EntitySelectionPanels, { props: { state } });

    const programPanel = screen.getByRole("group", { name: /③ Program/i });
    await user.click(within(programPanel).getByRole("button", { name: /PSTAR/i }));

    // Auto-select must still be in the list exactly once
    const autoButtons = within(programPanel)
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("Auto-select"));
    expect(autoButtons).toHaveLength(1);

    // Auto-select must NOT be marked as selected (PSTAR is)
    expect(autoButtons[0]).toHaveAttribute("aria-pressed", "false");
  });

  test("PSTAR button is marked as selected after clicking it", async () => {
    const user = userEvent.setup();
    render(EntitySelectionPanels, { props: { state } });

    const programPanel = screen.getByRole("group", { name: /③ Program/i });
    const pstarButton = within(programPanel).getByRole("button", { name: /PSTAR/i });
    await user.click(pstarButton);

    expect(pstarButton).toHaveAttribute("aria-pressed", "true");
  });

  test("program panel shows Auto-select, PSTAR, and ICRU 49 after selecting PSTAR", async () => {
    const user = userEvent.setup();
    render(EntitySelectionPanels, { props: { state } });

    const programPanel = screen.getByRole("group", { name: /③ Program/i });
    await user.click(within(programPanel).getByRole("button", { name: /PSTAR/i }));

    const buttons = within(programPanel).getAllByRole("button");
    const texts = buttons.map((b) => b.textContent ?? "");
    expect(texts.some((t) => t.includes("Auto-select"))).toBe(true);
    expect(texts.some((t) => t.includes("PSTAR"))).toBe(true);
    expect(texts.some((t) => t.includes("ICRU 49"))).toBe(true);
    // Exactly 3 entries: Auto-select + PSTAR + ICRU 49
    expect(buttons).toHaveLength(3);
  });

  test("plot panels include compatible external programs and external-only materials", () => {
    state.setExternalContext(
      buildExternalCompatibilityContext(
        [makeExternalEntityStore()],
        state.allParticles,
        state.allMaterials,
      ),
    );
    render(EntitySelectionPanels, { props: { state } });

    const programPanel = screen.getByRole("group", { name: /③ Program/i });
    const materialPanel = screen.getByRole("group", { name: /② Material/i });

    expect(within(programPanel).getByRole("button", { name: /SRIM GUI/i })).toBeInTheDocument();
    expect(
      within(materialPanel).getByRole("button", { name: /External Polymer/i }),
    ).toBeInTheDocument();
  });
});
