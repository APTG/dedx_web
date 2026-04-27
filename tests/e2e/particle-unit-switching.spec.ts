/**
 * Particle / unit switching E2E corner-case sequences.
 *
 * Locks down the **kinetic-energy-conservation** behaviour mandated by
 * `docs/04-feature-specs/unit-handling.md` v4 §"Unit Preservation on
 * Particle Change":
 *
 *   - Switching the particle preserves each row's per-nucleon kinetic
 *     energy (E_nucl). E.g. He @ 20 MeV/nucl → switch to proton →
 *     row reads `20 MeV` (since proton A=1 ⇒ MeV = MeV/nucl).
 *   - Toggling a row's unit between MeV and MeV/nucl re-expresses the
 *     same physical KE in the new unit, not the same numeric value.
 *
 * Companion design notes:
 * `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`.
 */
import { test, expect } from "@playwright/test";

const WASM_TIMEOUT = 20000;

async function waitForWasm(page: import("@playwright/test").Page) {
  await page.goto("/calculator");
  await page.waitForSelector('[aria-label="Particle"]', { timeout: WASM_TIMEOUT });
}

async function waitForTable(page: import("@playwright/test").Page) {
  await expect(page.locator("thead th").first()).toContainText(/Energy/i, {
    timeout: WASM_TIMEOUT,
  });
}

async function selectParticle(page: import("@playwright/test").Page, name: string) {
  const particleBtn = page.getByRole("button", { name: /^Particle$/ });
  await particleBtn.click();
  await page.locator('input[placeholder="Name, symbol, Z..."]').first().fill(name);
  const opt = page.getByRole("option", { name: new RegExp(name, "i") }).first();
  await opt.click();
  await waitForTable(page);
}

async function typeInRow(page: import("@playwright/test").Page, index: number, value: string) {
  const inputs = page.locator("input[data-row-index]");
  await inputs.nth(index).fill(value);
}

async function rowText(page: import("@playwright/test").Page, index: number): Promise<string> {
  return await page.locator("input[data-row-index]").nth(index).inputValue();
}

async function mevNuclCell(page: import("@playwright/test").Page, index: number): Promise<string> {
  return (await page.locator("tbody tr").nth(index).locator("td").nth(1).textContent()) ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle switching — kinetic energy conservation (E_nucl preserved)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle switching — E_nucl conservation", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("He 20 MeV/nucl → switch to proton: E_nucl conserved, row shows 20 MeV", async ({
    page,
  }) => {
    await selectParticle(page, "alpha");
    await typeInRow(page, 0, "20 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("20");

    await selectParticle(page, "proton");
    // E_nucl=20 conserved: proton (A=1) displays as 20 MeV.
    expect(await rowText(page, 0)).toBe("20 MeV");
    expect(await mevNuclCell(page, 0)).toContain("20");
  });

  test("He 80 MeV → switch to proton: E_nucl conserved (80/4=20), row shows 20 MeV", async ({ page }) => {
    await selectParticle(page, "alpha");
    await typeInRow(page, 0, "80 MeV");
    // Helium 80 MeV total → E_nucl = 80/4 = 20 MeV/nucl.
    expect(await mevNuclCell(page, 0)).toContain("20");

    await selectParticle(page, "proton");
    // E_nucl=20 conserved: proton displays as 20 MeV.
    expect(await rowText(page, 0)).toBe("20 MeV");
    expect(await mevNuclCell(page, 0)).toContain("20");
  });

  test("Proton 100 MeV → switch to carbon → switch back to hydrogen: E_nucl conserved", async ({
    page,
  }) => {
    // Default: proton 100 MeV (E_nucl=100).
    expect(await rowText(page, 0)).toBe("100");
    expect(await mevNuclCell(page, 0)).toContain("100");

    // Carbon (A=12): E_nucl=100 → 100 × 12 = 1200 MeV total.
    await selectParticle(page, "carbon");
    expect(await rowText(page, 0)).toBe("1200 MeV");
    expect(await mevNuclCell(page, 0)).toContain("100");

    // Back to proton: E_nucl=100 → 100 MeV.
    await selectParticle(page, "proton");
    expect(await rowText(page, 0)).toBe("100 MeV");
    expect(await mevNuclCell(page, 0)).toContain("100");
  });

  test("Plain '100' + suffixed '1 GeV' on proton → switch to alpha: both rows follow the same E_nucl-conservation rule (PR #379 regression)", async ({
    page,
  }) => {
    // Reproduces the inconsistency reported on PR #379: the plain-number
    // row used to keep its numeric value across particle switches while
    // the suffixed row got KE-converted, so the user could not tell what
    // was being conserved. After the fix, both rows are interpreted under
    // the active master unit (MeV here) and both conserve E_nucl.

    // Row 0 already pre-populated with "100" by default. Add row 1 with "1 GeV".
    const addBtn = page.getByRole("button", { name: /\+\s*Add row/i });
    await addBtn.click();
    await typeInRow(page, 1, "1 GeV");

    // Sanity: on proton (A=1), E_nucl mirrors the total in MeV.
    expect(await mevNuclCell(page, 0)).toContain("100");
    expect(await mevNuclCell(page, 1)).toContain("1000");

    // Switch to alpha (A=4). Both rows should be re-expressed as total MeV
    // with E_nucl conserved (100 → 400, 1000 → 4000) — NOT one row
    // unchanged and the other scaled.
    await selectParticle(page, "alpha");
    expect(await rowText(page, 0)).toBe("400 MeV");
    expect(await rowText(page, 1)).toBe("4000 MeV");
    expect(await mevNuclCell(page, 0)).toContain("100");
    expect(await mevNuclCell(page, 1)).toContain("1000");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-row unit dropdown — current behaviour
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Per-row unit dropdown — current behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("Carbon 12 MeV → toggle unit to MeV/nucl: text is rewritten with converted value (KE conserved)", async ({
    page,
  }) => {
    await selectParticle(page, "carbon");
    await typeInRow(page, 0, "12 MeV");

    // Carbon 12 MeV total = 1 MeV/nucl in the conversion column.
    expect(await mevNuclCell(page, 0)).toContain("1");

    // Use the per-row Unit dropdown to switch the row to MeV/nucl.
    const unitSelect = page.locator("tbody tr").first().locator("select").first();
    await unitSelect.selectOption("MeV/nucl");

    // Per `setRowUnit()` in calculator.svelte.ts: the numeric value IS
    // converted to conserve kinetic energy. So "12 MeV" → "1 MeV/nucl",
    // and the MeV/nucl column now reads 1 (kinetic energy conserved).
    expect(await rowText(page, 0)).toBe("1 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pending KE-conservation behaviours that need follow-up implementation.
//
// Active KE-conservation behaviours (particle switch, per-row toggle) are
// covered by the two `describe` blocks above. The cases here track work
// the spec mandates but the implementation does not yet meet:
//
//   - master-unit toggle MeV ↔ MeV/nucl needs to convert row values
//     (Task 6 follow-up; see calculator.svelte.ts setMasterUnit).
//   - multi-row, particle round-trip preservation across all rows.
//
// Both are wrapped in `test.fixme()` so the suite stays green while the
// gap is tracked. Note: an electron-selection scenario was intentionally
// omitted — `entity-selection-comboboxes.svelte` blocks selecting
// particle id 1001 (ESTAR is not implemented in libdedx v1.4.0); see
// `src/lib/components/entity-selection-comboboxes.svelte:209-218`.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle/unit switching — KE conservation (pending)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test.fixme(
    "Carbon 100 MeV/nucl → switch master unit MeV/nucl → MeV: row should show 1200 MeV (KE conserved)",
    async ({ page }) => {
      await selectParticle(page, "carbon");
      // Use the master unit selector (MeV/nucl button).
      await page.getByRole("radio", { name: /MeV\/nucl/i }).click();
      await typeInRow(page, 0, "100");
      expect(await mevNuclCell(page, 0)).toContain("100");

      await page.getByRole("radio", { name: /^MeV$/i }).click();
      // DESIRED: 100 MeV/nucl × 12 = 1200 MeV.
      // NOTE: This test depends on master-unit-selector KE conversion
      // (calculator.svelte.ts setMasterUnit) being wired up.
      expect(await rowText(page, 0)).toBe("1200");
    },
  );

  test.fixme(
    "He 20 MeV/nucl + multiple rows: KE conservation applies independently to each row",
    async ({ page }) => {
      await selectParticle(page, "alpha");
      await typeInRow(page, 0, "20 MeV/nucl");
      await typeInRow(page, 1, "50 MeV");

      await selectParticle(page, "proton");
      // Row 0: E_nucl=20 → proton 20 MeV. Row 1: E_nucl=50/4=12.5 → proton 12.5 MeV.
      expect(await rowText(page, 0)).toBe("20 MeV");
      expect(await rowText(page, 1)).toBe("12.5 MeV");

      await selectParticle(page, "alpha");
      // Row 0: proton "20 MeV" → He "20 MeV" (lossy, not "20 MeV/nucl").
      // Row 1: proton "12.5 MeV" → He "12.5 MeV" (lossy, E_nucl=12.5 × 4 = 50 MeV total).
      expect(await rowText(page, 0)).toBe("20 MeV");
      expect(await rowText(page, 1)).toBe("50 MeV");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Add-row UX — explicit "+ Add row" button rendered below the table.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Add row UX", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("typing in the last row auto-appends a fresh row below it", async ({ page }) => {
    // Default state has a single pre-filled "100" row. Typing in the LAST
    // row auto-appends a new empty row (see `updateRowText` in
    // `src/lib/state/energy-input.svelte.ts`).
    const initialCount = await page.locator("tbody tr").count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Type into the current last row to trigger an auto-append.
    await typeInRow(page, initialCount - 1, "200");
    await expect(page.locator("tbody tr")).toHaveCount(initialCount + 1);

    // Typing in the new last row appends one more.
    await typeInRow(page, initialCount, "300");
    await expect(page.locator("tbody tr")).toHaveCount(initialCount + 2);
  });

  test("explicit '+ Add row' button is rendered and appends an empty row when clicked", async ({ page }) => {
    // `result-table.svelte` renders an explicit add-row affordance
    // (button text: "+ Add row"). It coexists with the auto-append
    // behaviour above; clicking it inserts an extra empty row immediately.
    const addBtn = page.getByRole("button", { name: /\+\s*Add row/i });
    await expect(addBtn).toHaveCount(1);

    const before = await page.locator("tbody tr").count();
    await addBtn.click();
    await expect(page.locator("tbody tr")).toHaveCount(before + 1);
  });
});
