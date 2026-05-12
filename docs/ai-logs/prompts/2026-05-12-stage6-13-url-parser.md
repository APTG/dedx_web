# opencode task prompt — 2026-05-12

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation (TDD)
> **Branch:** `qwen/stage6-13-url-parser`
> **MCPs needed:** playwright, tailwind, svelte
> **TDD rule:** Write the failing test(s) first, then minimal impl. Fix all
> lint/type errors before committing.

---

## Meta-prompt

Stage 6.13 upgrades the URL codec to full ABNF conformance. Three deltas over
the current state:

1. **`urlv` major-version negotiation + warning banner** — `calculator-url.ts`
   already parses `urlv` but throws it away (`void _urlv`). Wire it up.
2. **Parse-pipeline conformance** — `URLSearchParams.get()` returns the *first*
   duplicate value; the spec mandates *last* wins (§3.2). Fix the decoder.
   Unknown params are already dropped implicitly by the encode/decode cycle;
   add explicit tests.
3. **`material=custom` + `mat_*` round-trip** — already implemented in 6.10.
   Top up the contract tests only (no new codec logic needed).

Stage 6.10 is merged. `material=custom` codec is live in `calculator-url.ts`.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 runes, build commands, AI logging rules.
2. `.opencode/lessons-learned.md` — **MUST READ before writing any code.**
   Pay special attention to:
   - Entry 1 (snapshot reactive deps synchronously before any async call)
   - Entry 3 (cross-page parity checklist — Calculator AND Plot)
   - Entry 7 (`replaceState` inside `$effect` must use `untrack()`)
   - Entry 12 (`waitForTimeout()` ban in E2E — use `expect.poll` instead)
   - Entry 14 (keep tasks ≤40 steps; pass spec inline in each task)
   - Entry 24 (URL numeric parsing must reject partial tokens)
   - Entry 27 (E2E coverage must mirror spec, not easier implementation)
3. `docs/04-feature-specs/stage-6-13-url-parser.md` — read fully. This is the
   normative spec for 6.13.
4. `docs/04-feature-specs/shareable-urls-formal.md` — read §3.1 (parse
   pipeline, steps 1–14) and §3.2 (duplicate resolution).
5. `src/lib/utils/calculator-url.ts` — study the full file. Key lines:
   - `CALCULATOR_URL_VERSION = 1` (line 10)
   - `const _urlv = parseInt(...); void _urlv;` (lines 413–415) — **this is
     what Task 1 replaces**
   - `encodeCalculatorUrl` — already emits `urlv=1` as first param (line 256)
   - Custom compound decode block starting at `if (isAdvancedMode) {`

Key source files:

- `src/lib/utils/calculator-url.ts` — primary codec (Tasks 1, 2)
- `src/lib/utils/plot-url.ts` — mirror codec (Task 5)
- `src/routes/calculator/+page.svelte` — URL `$effect` wiring (Task 4)
- `src/routes/plot/+page.svelte` — URL `$effect` wiring (Task 5)

Test files:

- `src/tests/unit/url-version.test.ts` — **new** (Task 1)
- `src/tests/unit/calculator-url.test.ts` — extend (Task 2)
- `src/tests/unit/url-version-warning-banner.test.ts` — **new** (Task 3)
- `src/tests/contracts/url-codec.contract.test.ts` — extend (Task 2)
- `src/tests/contracts/page-init.contract.test.ts` — extend (Task 4)
- `tests/e2e/url-parser.spec.ts` — **new** (Task 6)

Run tests:

```sh
pnpm lint && pnpm format       # must be clean before committing
pnpm test                      # Vitest unit + component tests (no WASM)
pnpm exec playwright test      # E2E (needs WASM in static/wasm/)
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(AI Session Logging section). Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## Task 1 — `negotiateVersion()` utility

**Spec:** `stage-6-13-url-parser.md` §"Test Plan — Unit tests"
(`url-version.test.ts` block).

### Acceptance criteria

- `negotiateVersion(version?: number): VersionNegotiationResult` exported from
  `src/lib/utils/url-version.ts`.
- `CURRENT_URL_MAJOR = 1` and `MIN_SUPPORTED_URL_MAJOR = 1` exported as consts.
- `type VersionNegotiationResult = { status: "ok" } | { status: "mismatch"; version: number }`
- `negotiateVersion(1)` → `{ status: "ok" }`
- `negotiateVersion(undefined)` → `{ status: "ok" }` (absent = assumed version 1)
- `negotiateVersion(999)` → `{ status: "mismatch", version: 999 }`
- `negotiateVersion(0)` → `{ status: "mismatch", version: 0 }`

### Step 1a — tests first (`src/tests/unit/url-version.test.ts`)

```typescript
import { negotiateVersion } from "$lib/utils/url-version.js";

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
```

### Step 1b — implement (`src/lib/utils/url-version.ts`)

```typescript
export const CURRENT_URL_MAJOR = 1;
export const MIN_SUPPORTED_URL_MAJOR = 1;

export type VersionNegotiationResult =
  | { status: "ok" }
  | { status: "mismatch"; version: number };

export function negotiateVersion(version: number | undefined): VersionNegotiationResult {
  const v = version ?? CURRENT_URL_MAJOR;
  if (v === CURRENT_URL_MAJOR) return { status: "ok" };
  return { status: "mismatch", version: v };
}
```

### Done when

`pnpm test src/tests/unit/url-version.test.ts` green; then commit:

```
feat(url-version): add negotiateVersion utility with version negotiation result type
```

---

## Task 2 — Duplicate-param resolution + unknown-param drop

> **Depends on nothing.** Pure codec logic — no UI.

**Spec:** `stage-6-13-url-parser.md` §"Acceptance Scenarios 5 & 6" and
`shareable-urls-formal.md` §3.2 (duplicate params → last wins).

### Acceptance criteria

- New `resolveLastWins(params: URLSearchParams): URLSearchParams` (non-exported
  helper) added at the top of `calculator-url.ts`. Iterating params with `set()`
  ensures last value wins for each key.
- `decodeCalculatorUrl` calls `resolveLastWins(params)` as its **first line**
  before any `params.get()` calls.
- `plot-url.ts`: mirror the same `resolveLastWins` call in `decodePlotUrl` /
  equivalent decode entry-point.
- Unit test: decoding `?particle=1&particle=2` uses `particle=2` (last wins).
- Unit test: encoding state from `?urlv=1&particle=1&material=276&energies=100&foo=bar`
  produces a URL string that does NOT contain `foo=`.
- Contract test addition in `url-codec.contract.test.ts`:
  - `urlv` is always present in encoded output.
  - `material` discriminated-union round-trip: builtin numeric ID vs `"custom"`.

### Step 2a — tests first (`src/tests/unit/calculator-url.test.ts`)

Add to the existing test file:

```typescript
describe("duplicate params — last wins (§3.2)", () => {
  it("duplicate particle uses last value", () => {
    const params = new URLSearchParams("particle=1&particle=2&material=276&program=auto&energies=100&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.particleId).toBe(2);
  });

  it("duplicate material uses last value", () => {
    const params = new URLSearchParams("particle=1&material=100&material=276&program=auto&energies=100&eunit=MeV");
    const state = decodeCalculatorUrl(params);
    expect(state.materialId).toBe(276);
  });
});

describe("unknown params dropped from canonical URL", () => {
  it("unknown foo=bar is absent from encoded output", () => {
    const params = new URLSearchParams("urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&foo=bar&unknown=xyz");
    const state = decodeCalculatorUrl(params);
    const encoded = calculatorUrlQueryString(state);
    expect(encoded).not.toContain("foo=");
    expect(encoded).not.toContain("unknown=");
    expect(encoded).toContain("urlv=1");
    expect(encoded).toContain("particle=1");
  });
});
```

Extend `src/tests/contracts/url-codec.contract.test.ts`:

```typescript
// urlv always present
test("encoded URL always contains urlv param", () => {
  const params = encodeCalculatorUrl({
    particleId: 1, materialId: 276, programId: null,
    rows: [{ rawInput: "100", unit: "MeV", unitFromSuffix: false }],
    masterUnit: "MeV",
  });
  expect(params.get("urlv")).toBe("1");
});

// material discriminated-union round-trip
const MATERIAL_URL_ROUNDTRIP = {
  builtin: "276",
  custom: "custom",
} satisfies Record<"builtin" | "custom", string>;

test.each(Object.entries(MATERIAL_URL_ROUNDTRIP))(
  "material round-trip: %s → %s",
  (_label, value) => {
    const params = new URLSearchParams(
      `urlv=1&particle=1&material=${value}&program=auto&energies=100&eunit=MeV&mode=advanced&qfocus=both`,
    );
    const state = decodeCalculatorUrl(params);
    if (value === "custom") {
      expect(state.materialId).toBeNull();
    } else {
      expect(state.materialId).toBe(276);
    }
  },
);
```

### Step 2b — implement

In `src/lib/utils/calculator-url.ts`, add before `decodeCalculatorUrl`:

```typescript
function resolveLastWins(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    out.set(key, value); // set() overwrites → last occurrence wins
  }
  return out;
}
```

At the top of `decodeCalculatorUrl`, rename the parameter and add the call:

```typescript
export function decodeCalculatorUrl(rawParams: URLSearchParams): CalculatorUrlState {
  const params = resolveLastWins(rawParams);
  // ... rest of function unchanged
```

In `src/lib/utils/plot-url.ts`, apply the same `resolveLastWins` pattern to the
plot URL decoder entry-point. Read the file first to find the decode function name.

### Done when

`pnpm test` green (all calc-url + custom-compound tests still pass); then commit:

```
fix(url-codec): resolve duplicate params as last-wins per §3.2; add unknown-param drop tests
```

---

## Task 3 — `UrlVersionWarningBanner` Svelte component

> **Depends on Task 1** — imports `VersionNegotiationResult` type shape.

**Spec:** `stage-6-13-url-parser.md` §"Appendix: data-testid Reference" and
Scenario 1 acceptance criteria.

### Acceptance criteria

- Component at `src/lib/components/url-version-warning-banner.svelte`.
- Props (Svelte 5 `$props()`):
  - `version: number` — the foreign major version number
  - `onLoadDefaults: () => void`
  - `onTryMigration?: (() => void) | undefined` (optional)
- DOM structure:
  - Root element: `role="alert"` + `data-testid="url-version-warning"`
  - Must display the `version` number in its text content
  - Must contain a "Load defaults" button: `data-testid="url-version-warning-load-defaults"`
  - When `onTryMigration` is provided, shows an optional "Try migration" button:
    `data-testid="url-version-warning-try-migration"`
- Vitest component test verifies `version` appears in text and both buttons render.

### Step 3a — tests first (`src/tests/unit/url-version-warning-banner.test.ts`)

```typescript
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import UrlVersionWarningBanner from "$lib/components/url-version-warning-banner.svelte";

test("renders with version number in text", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 999, onLoadDefaults: vi.fn() },
  });
  expect(screen.getByTestId("url-version-warning")).toBeInTheDocument();
  expect(screen.getByTestId("url-version-warning")).toHaveTextContent("999");
});

test("Load defaults button present and fires callback", async () => {
  const fn = vi.fn();
  const { getByTestId } = render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: fn },
  });
  await userEvent.click(getByTestId("url-version-warning-load-defaults"));
  expect(fn).toHaveBeenCalledOnce();
});

test("Try migration button absent when onTryMigration not provided", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: vi.fn() },
  });
  expect(screen.queryByTestId("url-version-warning-try-migration")).not.toBeInTheDocument();
});

test("Try migration button present when onTryMigration provided", () => {
  render(UrlVersionWarningBanner, {
    props: { version: 5, onLoadDefaults: vi.fn(), onTryMigration: vi.fn() },
  });
  expect(screen.getByTestId("url-version-warning-try-migration")).toBeInTheDocument();
});
```

### Step 3b — implement

Create `src/lib/components/url-version-warning-banner.svelte`:

```svelte
<script lang="ts">
  interface Props {
    version: number;
    onLoadDefaults: () => void;
    onTryMigration?: (() => void) | undefined;
  }
  const { version, onLoadDefaults, onTryMigration }: Props = $props();
</script>

<div
  data-testid="url-version-warning"
  role="alert"
  class="flex flex-wrap items-center gap-3 rounded-md border border-yellow-400
         bg-yellow-50 px-4 py-3 text-sm text-yellow-900"
>
  <span>
    This link was created with a newer version of the app
    (<strong>{version}</strong>). Some settings may not load correctly.
  </span>
  <button
    data-testid="url-version-warning-load-defaults"
    onclick={onLoadDefaults}
    class="rounded bg-yellow-200 px-3 py-1 font-medium hover:bg-yellow-300"
  >
    Load defaults
  </button>
  {#if onTryMigration}
    <button
      data-testid="url-version-warning-try-migration"
      onclick={onTryMigration}
      class="rounded bg-yellow-100 px-3 py-1 font-medium hover:bg-yellow-200"
    >
      Try migration
    </button>
  {/if}
</div>
```

### Done when

`pnpm test src/tests/unit/url-version-warning-banner.test.ts` green; then commit:

```
feat(url-version-warning): add UrlVersionWarningBanner component with load-defaults and try-migration buttons
```

---

## Task 4 — Calculator page: wire `urlv` negotiation + banner

> **Depends on Tasks 1, 3.** Imports `negotiateVersion` and `UrlVersionWarningBanner`.

**Spec:** `stage-6-13-url-parser.md` §"Cross-Page Parity Checklist" (Calculator
column), Scenario 1 and Scenario 2 acceptance criteria.

### Acceptance criteria

- `src/routes/calculator/+page.svelte` imports `negotiateVersion` from
  `$lib/utils/url-version.js` and `UrlVersionWarningBanner` from
  `$lib/components/url-version-warning-banner.svelte`.
- Component-level state: `let urlVersionMismatch = $state<{ version: number } | null>(null)`.
- In the URL-parsing `$effect` (where `_urlv` was previously voided):
  - Parse `urlv`: `const urlvRaw = parseInt(params.get("urlv") ?? "1", 10);`
  - Call `negotiateVersion(urlvRaw)` — if `status === "mismatch"` set
    `urlVersionMismatch = { version: result.version }`; if `"ok"` clear it.
- Calculation effect is **blocked** while `urlVersionMismatch !== null` — add
  an early-return guard at the top of the calculation `$effect`.
- Banner rendered in the page template when `urlVersionMismatch !== null`:
  ```svelte
  {#if urlVersionMismatch}
    <UrlVersionWarningBanner
      version={urlVersionMismatch.version}
      onLoadDefaults={handleLoadDefaults}
    />
  {/if}
  ```
- `handleLoadDefaults()`: navigates to `/calculator` without params (clearing
  the mismatch URL) and sets `urlVersionMismatch = null`.
- Contract test extension in `src/tests/contracts/page-init.contract.test.ts`:
  ```typescript
  test("calculator page source contains negotiateVersion call", () => {
    const src = readFileSync("src/routes/calculator/+page.svelte", "utf8");
    expect(src).toContain("negotiateVersion");
  });
  ```
- **Cross-page parity audit** (Entry 3) grep before declaring TASK DONE:
  ```sh
  grep -n "negotiateVersion\|urlVersionMismatch" src/routes/calculator/+page.svelte
  ```

### Step 4a — read the page first

Read `src/routes/calculator/+page.svelte` fully. Locate:
1. The URL-parsing `$effect` — search for `_urlv` or `decodeCalculatorUrl`.
2. The calculation trigger `$effect` — search for `calculate` or `getService`.
3. The template area near the top of the main content — where to insert the banner.
4. Any existing navigate-to-defaults or reset function.

### Step 4b — implement

Make the three surgical changes described in the acceptance criteria above.

### Done when

`pnpm test` green (including new contract test); `pnpm build` succeeds; then commit:

```
feat(calculator): wire urlv negotiation and version-mismatch warning banner
```

---

## Task 5 — Plot page: wire `urlv` negotiation + banner (cross-page parity)

> **Depends on Tasks 1, 3, 4.** Mirrors Task 4 exactly for the Plot page.

**Spec:** `stage-6-13-url-parser.md` §"Cross-Page Parity Checklist" (Plot column).

### Acceptance criteria

- Same four pillars as Task 4, applied to `src/routes/plot/+page.svelte`.
- Contract test extension in `page-init.contract.test.ts`:
  ```typescript
  test("plot page source contains negotiateVersion call", () => {
    const src = readFileSync("src/routes/plot/+page.svelte", "utf8");
    expect(src).toContain("negotiateVersion");
  });
  ```
- Run the Entry 3 cross-page parity grep audit before committing:
  ```sh
  grep -n "negotiateVersion\|urlVersionMismatch" src/routes/calculator/+page.svelte src/routes/plot/+page.svelte
  ```

### Step 5a — read the page first

Read `src/routes/plot/+page.svelte`. Find the URL-parsing `$effect` and the
calculation/plot trigger block.

### Step 5b — implement

Apply the same three surgical changes as Task 4.

### Done when

`pnpm test` green; `pnpm build` succeeds; both pages appear in the grep audit;
then commit:

```
feat(plot): wire urlv negotiation and version-mismatch warning banner (cross-page parity)
```

---

## Task 6 — E2E tests: `tests/e2e/url-parser.spec.ts`

> **Depends on Tasks 4 and 5.** All 6 acceptance scenarios from the spec.

**Spec:** `stage-6-13-url-parser.md` §"Acceptance Scenarios" (all 6).

### Acceptance criteria

- `tests/e2e/url-parser.spec.ts` created with 7 tests covering all scenarios.
- **WASM guard** (`test.skip(!wasmOk, "WASM binary absent")`) used ONLY on:
  - Scenario 1b "load-defaults restores calculation" (second test for Scenario 1)
  - Scenario 4 "custom compound round-trip" (full test)
- Scenarios 1a banner-visible, 2, 3, 5, 6 do NOT need WASM — they check URL
  state / DOM visibility only.
- `waitForTimeout()` is **banned** (Entry 12). Use `expect.poll` or
  `waitForFunction` everywhere.
- All `expect.poll` calls have explicit `{ timeout: N }` values (≥5 000 ms).

### Step 6a — write file (`tests/e2e/url-parser.spec.ts`)

```typescript
import { test, expect } from "@playwright/test";

async function checkWasmAvailable(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    const resp = await page.request.get("/wasm/libdedx.mjs");
    return resp.ok();
  } catch {
    return false;
  }
}

test.describe("Stage 6.13 — URL parser", () => {
  // ── Scenario 1a: urlv mismatch shows banner (no WASM needed) @smoke ───────
  test("urlv=999: version-mismatch banner visible with correct version @smoke", async ({
    page,
  }) => {
    await page.goto("/calculator?urlv=999&particle=1&material=276&energies=100");
    const banner = page.locator('[data-testid="url-version-warning"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("999");
    await expect(
      page.locator('[data-testid="url-version-warning-load-defaults"]'),
    ).toBeVisible();
  });

  // ── Scenario 1b: load-defaults restores calculation (WASM needed) @smoke ──
  test("urlv=999: load-defaults dismisses banner and restores calculation @smoke", async ({
    page,
  }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip calculation assertion");

    await page.goto("/calculator?urlv=999&particle=1&material=276&energies=100");
    const banner = page.locator('[data-testid="url-version-warning"]');
    await expect(banner).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="url-version-warning-load-defaults"]');
    await expect(banner).not.toBeVisible({ timeout: 3000 });

    const stpCell = page.locator('[data-testid="stp-cell-0"]');
    await expect
      .poll(async () => parseFloat((await stpCell.textContent()) ?? ""), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
  });

  // ── Scenario 2: urlv=1 (current) — no warning @regression ────────────────
  test("urlv=1: no warning banner shown @regression", async ({ page }) => {
    await page.goto(
      "/calculator?urlv=1&particle=1&material=276&energies=100&eunit=MeV",
    );
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.locator('[data-testid="url-version-warning"]'),
    ).not.toBeVisible({ timeout: 3000 });
  });

  // ── Scenario 3: missing urlv — assumed 1, no warning @regression ──────────
  test("missing urlv: no warning banner (assumed version 1) @regression", async ({
    page,
  }) => {
    await page.goto("/calculator?particle=1&material=276&energies=100");
    await page.waitForLoadState("domcontentloaded");
    await expect(
      page.locator('[data-testid="url-version-warning"]'),
    ).not.toBeVisible({ timeout: 3000 });
  });

  // ── Scenario 4: custom compound round-trip (WASM needed) @smoke ──────────
  test("custom compound URL round-trip: mat_* params restore compound @smoke", async ({
    page,
  }) => {
    const wasmOk = await checkWasmAvailable(page);
    test.skip(!wasmOk, "WASM binary absent — skip custom compound E2E");

    const url =
      "/calculator?urlv=1&particle=1&material=custom&mat_name=LiF-test" +
      "&mat_density=2.64&mat_elements=3%3A1%2C9%3A1&mode=advanced&program=auto&energies=100";

    await page.goto(url);
    await expect(
      page.locator('[data-testid="compound-from-url-banner"]'),
    ).toBeVisible({ timeout: 5000 });
    await expect
      .poll(
        async () =>
          parseFloat(
            (await page.locator('[data-testid="stp-cell-0"]').textContent()) ?? "",
          ),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
  });

  // ── Scenario 5: duplicate params use last value @regression ───────────────
  test("duplicate particle param: last value (2) used @regression", async ({
    page,
  }) => {
    await page.goto(
      "/calculator?particle=1&particle=2&material=276&energies=100",
    );
    await expect
      .poll(async () => page.url(), { timeout: 5000 })
      .toMatch(/particle=2/);
    const searchParams = new URL(page.url()).searchParams;
    expect(searchParams.getAll("particle")).toHaveLength(1);
    expect(searchParams.get("particle")).toBe("2");
  });

  // ── Scenario 6: unknown params dropped @regression ────────────────────────
  test("unknown params dropped from canonical URL @regression", async ({
    page,
  }) => {
    await page.goto(
      "/calculator?urlv=1&particle=1&material=276&energies=100&foo=bar&unknown=xyz",
    );
    await page.waitForFunction(() => !window.location.search.includes("foo="), {
      timeout: 5000,
    });
    expect(page.url()).not.toContain("foo=");
    expect(page.url()).not.toContain("unknown=");
    expect(page.url()).toContain("particle=1");
  });
});
```

### Done when

`pnpm exec playwright test tests/e2e/url-parser.spec.ts` — all tests pass or are
`test.skip`-ed with the WASM-absent guard. Then commit:

```
test(e2e): add url-parser.spec.ts with all 6 Stage 6.13 acceptance scenarios
```

---

## Cross-task notes

- Execute in order: Tasks 1 → 2 → 3 (pure logic/UI, no page wiring). Safe to
  commit individually without touching the pages.
- Task 4 (Calculator) before Task 5 (Plot) — use diff from Task 4 as the
  template for Task 5 (Entry 3 parity pattern).
- Task 6 is isolated. If playwright hangs or WASM is absent, commit with the
  `test.skip` guards in place — the implementation in Tasks 1–5 is still valid.
- After all tasks:
  1. Write `CHANGELOG-AI.md` row (prepend to table body).
  2. Write `docs/ai-logs/2026-05-12-stage6-13-url-parser.md` session log.
  3. Mark Stage 6.13 ✅ in `docs/00-redesign-plan.md`.
  4. Update `docs/04-feature-specs/README.md` status for 6.13.
  5. Run `pnpm lint && pnpm format` before every commit.
  6. **Do not push** unless explicitly requested. Output the manual push
     command in your `TASK DONE` message.

---

## Out of scope / deferred

- `extdata=` external data parameter — Stage 7.
- `ext-ref` entity grammar — Stage 7.
- Migration chain for `urlv < CURRENT` — infrastructure scaffolded but empty.
- Plot page custom compound in series (`series=` param with `ext:custom:...`) —
  not yet specified in `shareable-urls-formal.md`.
