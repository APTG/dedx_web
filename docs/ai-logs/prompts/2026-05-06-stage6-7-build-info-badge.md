# opencode task prompt — 2026-05-06

> **Model:** Qwen3.5-397B-A17B-FP8
> **Session type:** Multi-task implementation
> **Branch:** `qwen/stage-6-7-build-info`
> **MCPs needed:** tailwind (class lookup only), playwright (E2E run + inspect)
> **TDD rule:** Write the failing test(s) first, then minimal impl.

---

## Context

Read at session start (in order):

1. `AGENTS.md` — stack, Svelte 5 rules, build commands, AI logging
2. `docs/04-feature-specs/build-info.md` Final v1 — full spec for this feature
3. `src/routes/+layout.svelte` — existing footer at lines 205–212; note `base`
   import from `$app/paths` at line 4 (needed for fetch path)

Key source files:

- `src/routes/+layout.svelte` — add badge to footer
- `.github/workflows/deploy.yml` — add pre-build step

Test files:

- `src/tests/unit/build-info.test.ts` (new — pure functions from deploy script)
- `src/tests/components/build-info-badge.test.ts` (new — component behaviour)
- `tests/e2e/build-info.spec.ts` (new — Playwright E2E, footer badge visible)

Run tests:

```sh
pnpm test                        # Vitest unit + component tests (no WASM needed)
pnpm exec playwright test tests/e2e/build-info.spec.ts   # E2E badge tests
```

---

## AI Logging (MANDATORY)

Every task that changes code or docs must be logged. Rules are in `AGENTS.md`
(which refers to `.github/copilot-instructions.md` §"AI Session Logging").
Attribution: `(Qwen3.5-397B-A17B-FP8 via opencode)`.

---

## Task 1 — `scripts/deploy.cjs` — git metadata → `static/deploy.json`

**Spec:** `docs/04-feature-specs/build-info.md` §4 "Build-Time Injection".

### Acceptance criteria

- Running `node scripts/deploy.cjs` inside a git repo creates/overwrites
  `static/deploy.json` with valid JSON matching the schema below.
- `branch` has `heads/` prefix stripped (e.g. `heads/master` → `master`);
  tag refs are kept as-is (e.g. `tags/v1.0` → `tags/v1.0`).
- `date` is always `YYYY-MM-DD`, locale-independent.
- Script exits non-zero and prints an error if any `git` command fails.
- The pure helper `stripHeadsPrefix(ref)` is exported so it can be unit-tested
  without running the script as a whole.

### Step 1a — tests first (`src/tests/unit/build-info.test.ts`)

Create the file with a `describe("stripHeadsPrefix")` block:

```
"heads/master"       → "master"
"heads/feat/foo"     → "feat/foo"
"tags/v1.0"          → "tags/v1.0"
"master"             → "master"
""                   → ""
```

The function must be importable from `scripts/deploy.cjs` as a named export
(CommonJS `exports.stripHeadsPrefix = ...`).

> Vitest handles `require()` via the `commonjs` plugin or direct import with
> `createRequire`. Simplest: write `deploy.cjs` as CommonJS and import via
> `import { createRequire } from 'module'; const req = createRequire(import.meta.url); const { stripHeadsPrefix } = req('../../../scripts/deploy.cjs');`
> inside the test (guard the `main()` call so it only runs when
> `require.main === module`).

### Step 1b — implement (`scripts/deploy.cjs`)

```javascript
// CommonJS — intentionally NOT a module so it works with plain `node`.
const { execSync } = require("child_process");
const { writeFileSync, mkdirSync } = require("fs");
const { resolve, dirname } = require("path");

function stripHeadsPrefix(ref) {
  return ref.startsWith("heads/") ? ref.slice("heads/".length) : ref;
}
exports.stripHeadsPrefix = stripHeadsPrefix;

function main() {
  const run = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

  // All three git calls — fail loudly if git is unavailable.
  const commitFull = run("git rev-parse HEAD");
  const commit = run("git rev-parse --short HEAD");
  const rawRef = run("git describe --all");
  const branch = stripHeadsPrefix(rawRef);
  const date = new Date().toISOString().slice(0, 10);

  const info = {
    date,
    commit,
    commitFull,
    branch,
    repoUrl: "https://github.com/APTG/dedx_web",
  };

  const outDir = resolve(__dirname, "..", "static");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "deploy.json"), JSON.stringify(info, null, 2));
  console.log(`deploy.json written: ${commit} · ${date} · ${branch}`);
}

if (require.main === module) {
  main();
}
```

Add to `package.json` scripts:

```json
"deploy-info": "node scripts/deploy.cjs"
```

### Done when

`pnpm test` is green (unit tests for `stripHeadsPrefix` pass), then commit:

```
feat(build): add scripts/deploy.cjs — writes static/deploy.json at build time
```

---

## Task 2 — `BuildInfoBadge` component

**Spec:** `docs/04-feature-specs/build-info.md` §§3, 5, 6.

### Acceptance criteria

- Renders `Deployed: <hash-link> · YYYY-MM-DD · branch` when `deploy.json`
  loads successfully.
- Commit hash is an `<a>` with `href="{repoUrl}/commit/{commitFull}"` and
  `target="_blank" rel="noopener noreferrer"`.
- If `fetch` returns non-200, times out, or the JSON is malformed, the
  component renders nothing (no error, no layout shift).
- Font size and color match existing footer secondary text (muted, `text-xs`).
- Badge stays on one line at ≥ 360 px viewport width (`whitespace-nowrap`).
- `base` from `$app/paths` is prepended to the fetch URL so sub-path deploys
  (e.g. `/web_dev/deploy.json`) work correctly.

### Step 2a — tests first (`src/tests/components/build-info-badge.test.ts`)

Use Vitest + `@testing-library/svelte`. Mock `fetch` with `vi.stubGlobal`.

Test cases:

```
valid deploy.json → renders "Deployed: abc1234 · 2026-05-06 · main"
valid deploy.json → commit hash is an <a> with correct href and target="_blank"
fetch 404         → renders nothing (component root has no text content)
invalid JSON body → renders nothing
fetch throws      → renders nothing
```

> Mock `$app/paths` base as `""` (empty string) for tests:
> `vi.mock('$app/paths', () => ({ base: '' }))`

### Step 2b — implement (`src/lib/components/build-info-badge.svelte`)

```svelte
<script lang="ts">
  import { base } from "$app/paths";

  interface DeployInfo {
    date: string;
    commit: string;
    commitFull: string;
    branch: string;
    repoUrl: string;
  }

  let info = $state<DeployInfo | null>(null);

  $effect(() => {
    fetch(`${base}/deploy.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DeployInfo) => {
        info = data;
      })
      .catch(() => {
        info = null;
      });
  });
</script>

{#if info}
  <span class="text-xs text-muted-foreground whitespace-nowrap">
    Deployed:
    <a
      href={`${info.repoUrl}/commit/${info.commitFull}`}
      target="_blank"
      rel="noopener noreferrer"
      class="underline hover:text-foreground">{info.commit}</a
    >
    · {info.date} · {info.branch}
  </span>
{/if}
```

Use the `tailwind` MCP to verify class names if uncertain.

### Done when

`pnpm test` is green (all component tests pass), then commit:

```
feat(ui): add BuildInfoBadge component — fetches deploy.json, renders commit/date/branch
```

---

## Task 3 — Wire badge into footer + CI pre-build step

**Spec:** `docs/04-feature-specs/build-info.md` §§2, 4, 6.

### Acceptance criteria

- The badge appears bottom-left in the footer on every page.
- `deploy.yml` runs `node scripts/deploy.cjs` before `pnpm build` so the
  deployed site always has an up-to-date `deploy.json`.
- `pnpm dev` still works without running `deploy.cjs` first — the badge is
  simply absent (the `fetch('/deploy.json')` returns 404 and is silently
  swallowed).

### Step 3a — tests first

No new tests needed (the component is already tested). Instead, update the
existing layout snapshot or smoke test if one exists; otherwise skip.

### Step 3b — implement: `src/routes/+layout.svelte`

Import and render the badge in the footer. Current footer (lines 205–212):

```svelte
<footer class="border-t bg-card mt-auto">
  <div class="container mx-auto px-4 py-4">
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <p>webdedx — Stopping power calculations</p>
      <p>Built with Svelte 5 + WASM</p>
    </div>
  </div>
</footer>
```

Replace with:

```svelte
<script>
  // add to existing imports at the top of the <script> block:
  import BuildInfoBadge from "$lib/components/build-info-badge.svelte";
</script>

<footer class="border-t bg-card mt-auto">
  <div class="container mx-auto px-4 py-4">
    <div class="flex items-center justify-between text-xs text-muted-foreground">
      <div class="flex flex-col gap-0.5">
        <p>webdedx — Stopping power calculations</p>
        <BuildInfoBadge />
      </div>
      <p>Built with Svelte 5 + WASM</p>
    </div>
  </div>
</footer>
```

### Step 3c — implement: `.github/workflows/deploy.yml`

In the `deploy-dev` job, add a step immediately before "Build SvelteKit app":

```yaml
- name: Write deploy.json
  run: node scripts/deploy.cjs
```

### Done when

`pnpm test` is green and `pnpm build` succeeds (may need `node scripts/deploy.cjs`
first locally), then commit:

```
feat(footer): render BuildInfoBadge; add deploy.json pre-build step to CI
```

---

## Task 4 — Playwright E2E tests (`tests/e2e/build-info.spec.ts`)

**Spec:** `docs/04-feature-specs/build-info.md` §§2, 3, 5, 6.

### Acceptance criteria

- Badge text matches `Deployed: <hash> · YYYY-MM-DD · <branch>` when
  `deploy.json` is served successfully.
- Commit hash is a link pointing to `{repoUrl}/commit/{commitFull}`.
- Link opens in a new tab (`target="_blank"`).
- When `deploy.json` returns 404, the badge is absent with no error text.
- Badge is in the footer (lower-left area), visible on every page.

### Step 4a — implement (`tests/e2e/build-info.spec.ts`)

Use `page.route()` to intercept `/deploy.json` requests so the tests are
reliable regardless of whether `static/deploy.json` physically exists.

```typescript
import { test, expect } from "@playwright/test";

const MOCK_DEPLOY = {
  date: "2026-05-06",
  commit: "abc1234",
  commitFull: "abc1234def5678901234567890123456789012345",
  branch: "feat/build-info",
  repoUrl: "https://github.com/APTG/dedx_web",
};

// Helper: mock deploy.json response and navigate.
async function gotoWithBadge(page: import("@playwright/test").Page, path = "/") {
  await page.route("**/deploy.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DEPLOY),
    }),
  );
  await page.goto(path);
}

test.describe("Build info badge", () => {
  test("badge visible in footer with correct format", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");

    const badge = page.getByText(/^Deployed:/);
    await expect(badge).toBeVisible({ timeout: 5000 });

    const text = await badge.textContent();
    expect(text).toContain("abc1234");
    expect(text).toContain("2026-05-06");
    expect(text).toContain("feat/build-info");
  });

  test("commit hash is a link to the correct GitHub commit URL", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");

    await expect(page.getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });

    const link = page.getByRole("link", { name: "abc1234" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/APTG/dedx_web/commit/abc1234def5678901234567890123456789012345",
    );
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("badge is inside the footer element", async ({ page }) => {
    await gotoWithBadge(page, "/calculator");
    await expect(page.getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });

    // Badge must be a descendant of <footer>
    const badgeInFooter = page.locator("footer").getByText(/^Deployed:/);
    await expect(badgeInFooter).toBeVisible();
  });

  test("badge visible on plot page too (appears on every route)", async ({ page }) => {
    await gotoWithBadge(page, "/plot");
    await expect(page.locator("footer").getByText(/^Deployed:/)).toBeVisible({ timeout: 5000 });
  });

  test("badge absent when deploy.json returns 404", async ({ page }) => {
    await page.route("**/deploy.json", (route) => route.fulfill({ status: 404 }));
    await page.goto("/calculator");

    // Give the fetch time to settle (poll instead of waitForTimeout).
    await expect
      .poll(
        () =>
          page
            .locator("footer")
            .getByText(/^Deployed:/)
            .count(),
        { timeout: 3000 },
      )
      .toBe(0);

    // No error text visible either.
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test("badge absent when deploy.json returns malformed JSON", async ({ page }) => {
    await page.route("**/deploy.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "NOT_JSON{{" }),
    );
    await page.goto("/calculator");

    await expect
      .poll(
        () =>
          page
            .locator("footer")
            .getByText(/^Deployed:/)
            .count(),
        { timeout: 3000 },
      )
      .toBe(0);
  });
});
```

> **No `waitForTimeout`** — use `expect.poll`, `toBeVisible`, and `waitForSelector`
> only. This is a standing rule in `.opencode/agents/implementer.md`.

### Step 4b — run with playwright MCP

Use the `playwright` MCP to execute the spec and confirm all 6 tests pass:

```sh
pnpm exec playwright test tests/e2e/build-info.spec.ts
```

If any test fails, diagnose from the trace/screenshot output and fix before
committing.

### Done when

All 6 Playwright tests pass, then commit:

```
test(e2e): add Playwright tests for build info badge (footer visibility + 404 fallback)
```

---

## Final checklist before handing back

- [ ] `pnpm test` green (Vitest unit + component)
- [ ] `pnpm exec playwright test tests/e2e/build-info.spec.ts` green (6 E2E tests)
- [ ] `pnpm lint` clean
- [ ] `node scripts/deploy.cjs && pnpm build` succeeds end-to-end
- [ ] `static/deploy.json` is listed in `.gitignore` (generated file, not committed)
- [ ] Each task has a Conventional Commit
- [ ] `CHANGELOG-AI.md` has one new row at the top
- [ ] `docs/ai-logs/YYYY-MM-DD-stage6-7-build-info.md` session log created
- [ ] `docs/ai-logs/README.md` has a pointer to the new log

---

## Notes

- **`.gitignore`** — `static/deploy.json` must be gitignored (it's a build
  artifact). Check that `static/` is not already broadly gitignored; if not,
  add `static/deploy.json` specifically.
- **`$app/paths` mock** — Vitest needs `vi.mock('$app/paths', () => ({ base: '' }))`
  for any test that imports the badge component. Add this to the test file's
  setup, not globally.
- **Svelte 5 only** — use `$state` and `$effect`; never `onMount`.
- **No shadcn component needed** — the badge is plain HTML `<span>/<a>` with
  Tailwind classes.
