/**
 * Particle / unit switching E2E corner-case sequences.
 *
 * Two purposes:
 *
 * 1. **Lock down today's behaviour** — when the user changes the selected
 *    particle, the typed numeric value is **not modified** (per
 *    `docs/04-feature-specs/unit-handling.md` §"Unit Preservation on Particle
 *    Change", points 1–4). The "→ MeV/nucl" column reinterprets the same
 *    number under the new particle's mass number.
 *
 * 2. **Document the open question** — the project owner has requested that
 *    *kinetic energy be conserved* on particle/unit switches (e.g. He @
 *    20 MeV/nucl ≡ 80 MeV; switching to a proton should show 80 MeV; back
 *    to He should show 20 MeV/nucl). The spec does NOT mandate this today.
 *    The desired-behaviour assertions are wrapped in `test.fixme()` so the
 *    suite stays green while the gap is tracked. See
 *    `docs/ux-reviews/2026-04-26-stage5-completion-and-ke-conservation.md`.
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
// Current behaviour: typed numbers are NOT modified on particle change
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle switching — current spec'd behaviour (numeric value preserved as text)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test("He 20 MeV/nucl → switch to proton: typed number stays '20', unit suffix is preserved", async ({
    page,
  }) => {
    await selectParticle(page, "helium");
    await typeInRow(page, 0, "20 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("20");

    // Switch to hydrogen (proton). Per spec: numeric value stays "20".
    await selectParticle(page, "hydrogen");

    // The literal text in the input is preserved.
    expect(await rowText(page, 0)).toBe("20 MeV/nucl");
    // But MeV/nucl per-nucleon is meaningless for a proton — the spec
    // wants this row to show a validation message ("MeV/nucl is not
    // available for Proton (A=1)") in unit-handling.md:203-205.
    // The current implementation interprets MeV/nucl as MeV/nucl with A=1
    // (which is numerically OK but UX-wise bypasses the rule). We just
    // assert the input value is preserved here.
  });

  test("He 80 MeV → switch to proton: typed number stays '80'", async ({ page }) => {
    await selectParticle(page, "helium");
    await typeInRow(page, 0, "80 MeV");
    // Helium with 80 MeV total → 20 MeV/nucl in the conversion column.
    expect(await mevNuclCell(page, 0)).toContain("20");

    await selectParticle(page, "hydrogen");
    expect(await rowText(page, 0)).toBe("80 MeV");
    // For proton the MeV/nucl column is just the same numeric value.
    expect(await mevNuclCell(page, 0)).toContain("80");
  });

  test("Proton 100 MeV → switch to carbon → switch back to hydrogen: number unchanged", async ({
    page,
  }) => {
    // Default state already has hydrogen + 100.
    expect(await rowText(page, 0)).toBe("100");
    await selectParticle(page, "carbon");
    expect(await rowText(page, 0)).toBe("100");
    await selectParticle(page, "hydrogen");
    expect(await rowText(page, 0)).toBe("100");
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

  test("Carbon 12 MeV → toggle unit to MeV/nucl: text is rewritten with new suffix, NUMBER is unchanged", async ({
    page,
  }) => {
    await selectParticle(page, "carbon");
    await typeInRow(page, 0, "12 MeV");

    // Carbon 12 MeV total = 1 MeV/nucl
    expect(await mevNuclCell(page, 0)).toContain("1");

    // Use the per-row Unit dropdown to switch the row to MeV/nucl.
    const unitSelect = page.locator("tbody tr").first().locator("select").first();
    await unitSelect.selectOption("MeV/nucl");

    // Per `setRowUnit()` in calculator.svelte.ts: the numeric value is NOT
    // converted — only the suffix is replaced. So "12 MeV" → "12 MeV/nucl",
    // and the MeV/nucl column now reads 12 (kinetic energy 4× larger).
    expect(await rowText(page, 0)).toBe("12 MeV/nucl");
    expect(await mevNuclCell(page, 0)).toContain("12");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Desired behaviour: kinetic energy conservation on particle/unit switch.
//
// These are intentionally `test.fixme()` — they describe the behaviour the
// project owner has requested. They will be flipped to active once
// `docs/04-feature-specs/unit-handling.md` is updated to mandate KE
// conservation and the implementation lands.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Particle/unit switching — kinetic energy conservation (DESIRED, not yet implemented)", () => {
  test.beforeEach(async ({ page }) => {
    await waitForWasm(page);
    await waitForTable(page);
  });

  test.fixme(
    "He 20 MeV/nucl → proton: row should show 80 MeV (KE conserved)",
    async ({ page }) => {
      await selectParticle(page, "helium");
      await typeInRow(page, 0, "20 MeV/nucl");
      expect(await mevNuclCell(page, 0)).toContain("20");

      await selectParticle(page, "hydrogen");
      // DESIRED: text becomes "80 MeV", per-nucleon column shows 80
      expect(await rowText(page, 0)).toBe("80 MeV");
      expect(await mevNuclCell(page, 0)).toContain("80");
    },
  );

  test.fixme(
    "He 20 MeV/nucl → proton → He: row should round-trip back to 20 MeV/nucl",
    async ({ page }) => {
      await selectParticle(page, "helium");
      await typeInRow(page, 0, "20 MeV/nucl");

      await selectParticle(page, "hydrogen");
      expect(await rowText(page, 0)).toBe("80 MeV");

      await selectParticle(page, "helium");
      // DESIRED: KE conserved across two switches.
      expect(await rowText(page, 0)).toBe("20 MeV/nucl");
    },
  );

  test.fixme(
    "Carbon 12 MeV → toggle row unit MeV → MeV/nucl: number should become 1 (1 MeV/nucl), KE conserved",
    async ({ page }) => {
      await selectParticle(page, "carbon");
      await typeInRow(page, 0, "12 MeV");

      const unitSelect = page.locator("tbody tr").first().locator("select").first();
      await unitSelect.selectOption("MeV/nucl");

      // DESIRED: the numeric value converts on unit toggle.
      // 12 MeV total ÷ 12 nucleons = 1 MeV/nucl.
      expect(await rowText(page, 0)).toBe("1 MeV/nucl");
      expect(await mevNuclCell(page, 0)).toContain("1");
    },
  );

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
      expect(await rowText(page, 0)).toBe("1200");
    },
  );

  test.fixme(
    "He 20 MeV/nucl + multiple rows: KE conservation applies independently to each row",
    async ({ page }) => {
      await selectParticle(page, "helium");
      await typeInRow(page, 0, "20 MeV/nucl");
      await typeInRow(page, 1, "50 MeV");

      await selectParticle(page, "hydrogen");
      // DESIRED: row 0 → 80 MeV, row 1 → 50 MeV (no per-nucleon info to rescale)
      expect(await rowText(page, 0)).toBe("80 MeV");
      expect(await rowText(page, 1)).toBe("50 MeV");

      await selectParticle(page, "helium");
      // DESIRED: row 0 round-trips back, row 1 stays at 50 MeV total.
      expect(await rowText(page, 0)).toBe("20 MeV/nucl");
      expect(await rowText(page, 1)).toBe("50 MeV");
    },
  );

  test.fixme(
    "Switching to electron from a heavy ion clears MeV/nucl rows or remaps to MeV (electron has no nucleons)",
    async ({ page }) => {
      await selectParticle(page, "helium");
      await typeInRow(page, 0, "20 MeV/nucl");

      // DESIRED: electron only supports MeV; the row should be remapped to
      // 80 MeV (KE conserved as total energy) — OR explicitly invalidated
      // with a clear inline message. The current code preserves "20 MeV/nucl"
      // verbatim, which would fail the unit-availability rule.
      await selectParticle(page, "electron");
      expect(await rowText(page, 0)).toBe("80 MeV");
      const alerts = await page.locator('[role="alert"]').allTextContents();
      expect(alerts.join("|")).not.toMatch(/MeV\/nucl is not available/);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Add-row UX — there is no explicit "Add row" button; rows auto-append.
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

  test("there is no explicit 'Add row' button rendered in the result table", async ({ page }) => {
    // The legacy `energy-input.svelte` used to render an "Add row" button,
    // but the unified `result-table.svelte` relies on auto-append. Lock this
    // in as a behavioural assertion so a future regression that re-introduces
    // the button has to update this test deliberately.
    await expect(page.getByRole("button", { name: /^Add row$/i })).toHaveCount(0);
  });
});
