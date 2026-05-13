# Lessons Learned — dEdx Web

> **Auto-prepended to every implementer prompt.** The orchestrator must reference
> this file when writing task prompts. Every PR that produces fix-up review comments
> must add at least one new entry here.
>
> Source: post-mortem of PR #427 (Stage 6.8 Advanced Options).
> See `docs/ai-logs/2026-05-06-pr427-postmortem.md` for the full analysis.

---

## Entry 1 — Reactive dep not registered when read inside `.then()` / `setTimeout`

**Symptom:** Density override had no visible effect in the browser. Unit tests for
the math passed. The bug only appeared in E2E: changing density left the CSDA range
unchanged.

**Root cause:** `advancedOptions.value` was read inside a `.then()` callback, so
Svelte's fine-grained tracker never registered it as a dependency. The `$effect`
did not re-run when the option changed.

```typescript
// ❌ WRONG — reading reactive state inside .then() → NOT a dependency
$effect(() => {
  getService().then((svc) => {
    // advancedOptions.value is read HERE, inside the async callback.
    // Svelte never sees this read, so the effect never retriggers when
    // advancedOptions changes.
    svc.calculate(entityState.selectedMaterial, advancedOptions.value);
  });
});

// ✅ CORRECT — snapshot reactive state SYNCHRONOUSLY at the top of the effect
$effect(() => {
  const advOptsSnapshot = advancedOptions.value; // ← registered as dep HERE
  const inputSnapshot = entityState.selectedMaterial;
  getService().then((svc) => {
    svc.calculate(inputSnapshot, advOptsSnapshot); // frozen snapshot, not live ref
  });
});
```

**Rule:** Always snapshot every reactive value **synchronously** at the top of a
`$effect`, before any `await`, `Promise.then()`, or `setTimeout` call.

---

## Entry 2 — Reading object reference does not track nested mutations

**Symptom:** Density override changed `advancedOptions.value.densityOverride`
in place. The `$effect` read `advancedOptions.value` (the object reference), which
didn't change — only a property did. Effect never re-ran.

```typescript
// ❌ WRONG — reading only the reference; mutations to nested props are invisible
$effect(() => {
  const opts = advancedOptions.value; // object ref — doesn't track .densityOverride
  doCalculation(opts);
});

// ✅ CORRECT option A — read every nested property explicitly
$effect(() => {
  const density = advancedOptions.value.densityOverride;
  const aggState = advancedOptions.value.aggregateState;
  const mstar = advancedOptions.value.mstarMode;
  // all properties read → all are deps
  doCalculation({ density, aggState, mstar });
});

// ✅ CORRECT option B — derive a "key" string that tracks all nested properties
const advOptsKey = $derived(JSON.stringify(advancedOptions.value));
$effect(() => {
  const _key = advOptsKey; // synchronous read → dep registered
  const snapshot = advancedOptions.value;
  getService().then((svc) => svc.calculate(snapshot));
});
```

**Rule:** When an effect must re-run on nested mutations of a state object,
either (a) read every nested property explicitly, or (b) create a `$derived`
key via `JSON.stringify` and read it synchronously in the effect.

---

## Entry 3 — Cross-page parity gaps

**Symptom:** Calculator correctly had `initAdvancedModeFromUrl`, `persistAdvancedOptions`,
and the reactive-dep snapshot. Plot page was missing all of them. Bugs only
surfaced during PR review, not during implementation.

**Root cause:** The implementer implemented the feature on `/calculator` first,
then copy-forgot several wiring steps when adding it to `/plot`.

**Rule:** When a feature exists on both `/calculator` and `/plot`, verify all
four pillars are present on **each** page before declaring `TASK DONE`:

```
Cross-page parity audit checklist (run for every feature touching both pages):

[ ] Panel gating:      isAdvancedMode.value guard on every advanced-only read/render
[ ] URL init:          initAdvancedModeFromUrl() called in the URL init $effect
[ ] Persistence:       persistAdvancedOptions() or equivalent $effect present
[ ] Reactive-dep snapshot: every async $effect snapshots all reactive deps synchronously
```

Grep audit:

```sh
grep -n "initAdvancedModeFromUrl" src/routes/calculator/+page.svelte src/routes/plot/+page.svelte
grep -n "persistAdvancedOptions\|loadAdvancedOptions" src/routes/calculator/+page.svelte src/routes/plot/+page.svelte
grep -n "advOptsKey\|advancedOptions.value" src/routes/calculator/+page.svelte src/routes/plot/+page.svelte
grep -n "isAdvancedMode.value" src/routes/calculator/+page.svelte src/routes/plot/+page.svelte
```

**Rule:** If diff touches `src/routes/calculator/+page.svelte`, the reviewer must
search `src/routes/plot/+page.svelte` for the analogous block (and vice versa).

---

## Entry 4 — Service interface arity drift

**Symptom:** `getPlotData` was called with `options` at call sites but the
interface declared it without that parameter. The mock also lacked it. Tests
passed (mock silently accepted and ignored the extra argument); browser silently
used default options.

**Root cause:** New parameter added at call site without updating the interface
AND the mock.

**Rule:** Whenever you add or change a method signature:

1. Update the `LibdedxService` interface in `src/lib/wasm/types.ts`.
2. Update the real implementation in `src/lib/wasm/libdedx.ts`.
3. `grep` for the method name — update **every** mock in `src/lib/wasm/__mocks__/`.
4. Confirm no call site passes arguments the interface doesn't declare.

```sh
grep -rn "getPlotData\|calculate\|calculateMulti" src/lib/wasm/__mocks__/ src/lib/wasm/types.ts
```

---

## Entry 5 — URL codec must round-trip every union member

**Symptom:** `mstar_mode` decoder only accepted `a|c|d|g|h` — the `b` member
(the default, which should be omitted from the URL) was explicitly excluded, but
so was `b` in a way that would silently drop it if a client ever sent it. The
union type `MstarMode = "a" | "b" | "c" | "d" | "g" | "h"` had 6 members;
only 5 were decoded.

**Root cause:** Decoder was written with a hand-maintained string array instead
of being derived from the type.

**Rule:** Every member of a TS union used in URL encoding must be tested in a
round-trip contract test. The test map must be keyed by the union type so that
adding a new union member fails the build:

```typescript
// ✅ Using `satisfies Record<MstarMode, string>` → adding "i" to MstarMode
// causes a compile error here, forcing the test to be updated.
const MSTAR_MODE_URL_VALUES = {
  a: "a",
  b: "b",
  c: "c",
  d: "d",
  g: "g",
  h: "h",
} satisfies Record<MstarMode, string>;

test.each(Object.entries(MSTAR_MODE_URL_VALUES))("mstar_mode round-trip: %s", (mode) => {
  expect(decode(encode({ mstarMode: mode as MstarMode }))).toBe(mode);
});
```

See `src/tests/contracts/url-codec.contract.test.ts` for the live version.

---

## Entry 6 — Silent no-op tests

**Symptom:** `advanced-options-panel.test.ts` passed an `options` prop to the
component. The component's `$props()` had no `options` in its destructuring.
The prop was silently ignored; the test proved nothing.

**Root cause:** The test was written against an old API; the component was
refactored to use module-level singleton state (`advancedOptions` from
`$lib/state/advanced-mode.svelte.ts`). The test was never updated.

```typescript
// ❌ WRONG — component uses module singleton, not a prop
render(AdvancedOptionsPanel, { props: { options: { densityOverride: 1.5 } } });
// Test is green and proves nothing — the prop is never read.

// ✅ CORRECT — set module-level singleton state directly, reset in beforeEach
import { advancedOptions } from "$lib/state/advanced-mode.svelte.ts";

beforeEach(() => {
  advancedOptions.value = defaultAdvancedOptions();
});

test("density override displayed", () => {
  advancedOptions.value = { ...advancedOptions.value, densityOverride: 1.5 };
  // now test the component's rendered output
});
```

**Rule:** Every prop set in a test must appear in the corresponding component's
`$props()` destructuring. If the component uses a module-level singleton, set
that singleton in `beforeEach`/`afterEach` (and reset it).

---

## Entry 7 — `replaceState(url, page.state)` inside URL-sync `$effect` → infinite loop

**Symptom:** `effect_update_depth_exceeded` crash immediately on page load.

**Root cause:** `replaceState(url, page.state)` updates `page.state`, which is
a reactive dependency. Without `untrack()`, the effect re-runs every time it
executes, creating an infinite loop.

```typescript
// ❌ WRONG — page.state is reactive; replaceState updates it → loop
$effect(() => {
  const newUrl = buildUrl(myValue);
  replaceState(newUrl, page.state); // reads page.state → dep registered → loop
});

// ✅ CORRECT — untrack() breaks the self-dependency
$effect(() => {
  const newUrl = buildUrl(myValue);
  untrack(() => replaceState(newUrl, page.state));
});
```

**Rule:** Every `replaceState(url, page.state)` call inside a `$effect` must be
wrapped in `untrack()`. The reviewer must flag any violation as a blocker.

---

## Entry 8 — `isAdvancedMode` guard on every advanced-only state read

**Symptom:** After switching back to Basic mode, the CSDA range still showed
the density-overridden value (not the default density). The density override
"leaked" out of Advanced mode.

**Root cause:** `calculator.svelte.ts` and `result-table.svelte` read
`advancedOptions.value.densityOverride` unconditionally, without checking
`isAdvancedMode.value`.

```typescript
// ❌ WRONG — applies density override in Basic mode too
const density = advancedOptions.value.densityOverride ?? material.density;

// ✅ CORRECT — guard with isAdvancedMode
const density =
  isAdvancedMode.value && advancedOptions.value.densityOverride
    ? advancedOptions.value.densityOverride
    : material.density;
```

**Rule:** Every read of `advancedOptions.value.*` that affects calculation or
display must be guarded by `isAdvancedMode.value`. Audit targets:

- `src/lib/state/calculator.svelte.ts` — density and aggregateState conversions
- `src/lib/components/result-table.svelte` — density conversion for multi-program
- `src/routes/plot/+page.svelte` — preview series density field

---

## Entry 9 — Missing `initAdvancedModeFromUrl` on a page

**Symptom:** Navigating to `/plot?mode=advanced` left `isAdvancedMode.value = false`.
The Advanced Options accordion was never rendered. E2E tests that opened the
accordion timed out.

**Root cause:** `initAdvancedModeFromUrl` was imported and called in
`calculator/+page.svelte` but was never added to `plot/+page.svelte`.

**Rule:** When adding `initAdvancedModeFromUrl` support, add it to **every**
calculation page (calculator AND plot). See Entry 3 (cross-page parity checklist).

The page-init contract test in `src/tests/contracts/page-init.contract.test.ts`
now asserts that both pages contain the string `initAdvancedModeFromUrl`.

---

## Entry 10 — CI branch trigger drift

**Symptom:** Pushes to `feat/**` branches did not trigger CI. A feature branch
named `feat/stage-6-8-advanced-options` got no CI feedback.

**Root cause:** The `.github/workflows/ci.yml` push trigger only listed `master`
and `qwen/**`. When a `feat/**` branch was created, no one updated the trigger.

**Rule:** CI push triggers must use a wildcard that covers all intended patterns:

```yaml
on:
  push:
    branches: ["master", "qwen/**", "feat/**", "copilot/**", "fix/**"]
  pull_request:
    branches: ["master"]
```

When creating a new branch naming convention, update CI triggers **first**.

---

## Entry 11 — Convention drift: import path style

**Symptom:** `cn` was imported from `$lib/utils` in some files and from
`$lib/utils.js` in others. ESLint did not catch this inconsistency.

**Root cause:** SvelteKit requires `.js` extensions in imports for ESM
compatibility, but some older files used the bare specifier. `*.svelte.ts`
import specifiers were also mixed with `*.svelte`.

**Rules:**

- Always import from `$lib/utils.js` (not `$lib/utils`)
- Always import from `component.svelte` (not `component.svelte.ts`)

The ESLint config now enforces both via `no-restricted-imports`.

---

## Entry 12 — `waitForTimeout()` ban in E2E

**Symptom:** `waitForTimeout(500)` in `advanced-options.spec.ts` was the source
of a flaky test that failed intermittently in CI (WASM load time varied).

**Root cause:** Fixed delays assume a specific execution speed. CI machines are
slower than dev laptops.

```typescript
// ❌ WRONG — fixed delay, flaky in CI
await page.waitForTimeout(500);

// ✅ CORRECT — wait for the observable condition
await page.waitForFunction(() => window.location.search.includes("density=2"), { timeout: 5000 });
// or
await expect
  .poll(async () => parseFloat((await cell.textContent()) ?? ""), {
    timeout: 8000,
  })
  .toBeGreaterThan(0);
```

**Rule:** `waitForTimeout()` is banned in all E2E tests. The ESLint config
enforces this via `no-restricted-syntax`. Use `waitForSelector`,
`waitForFunction`, or `expect.poll` with explicit timeouts instead.

---

## Entry 13 — PR description maintenance

**Symptom:** PR #427 description became stale as the scope expanded across
multiple Copilot fix rounds. Reviewers had to read the full diff to understand
what changed.

**Root cause:** The PR description was written at the start and never updated
as follow-up fixes were applied.

**Rule:** Before requesting review (or re-review), update the PR body to reflect
the actual scope. If scope expands significantly (new files, new behavior), add
a "Scope expansion" section. Keep the description as the single source of truth
for reviewers.

---

## Entry 14 — Long opencode sessions cause compaction memory loss

**Symptom:** In the Qwen opencode session for Stage 6.8, later tasks in the
session produced code that contradicted decisions made in earlier tasks. The
model appeared to have "forgotten" rules from the beginning of the session.

**Root cause:** opencode has a context window limit. When it fills, the session
is compacted (summarized). The compaction loses fine-grained details from the
beginning, including specific rules passed in the first prompt.

**Rules:**

- Keep implementer tasks to **≤40 steps** (enforced by `maxSteps: 40` in
  `opencode.json`).
- Pass the relevant spec section **inline** in each task prompt — do not rely
  on the model remembering it from earlier in the session.
- Force a **fresh reviewer session** for each task (the reviewer's `maxSteps`
  is short enough that compaction is not an issue).
- If a task hits the step limit, output `TASK BLOCKED: scope too large, propose
split` and the orchestrator splits it before retrying.

---

## Entry 15 — Never swallow inverse-lookup exceptions

**Symptom:** Range/Inverse STP rows sometimes showed stale values after a failed
WASM call. The UI looked "valid" even though no fresh result was produced.

**Root cause:** Empty `catch {}` blocks in the calculator inverse-lookup effects
silently ignored `getInverseCsda`/`getInverseStp` failures.

```typescript
// ❌ WRONG — swallows failure, stale UI state remains
try {
  const results = service.getInverseCsda(...);
} catch {}

// ✅ CORRECT — mark affected rows as error with a user-facing message
try {
  const results = service.getInverseCsda(...);
} catch {
  row.status = "error";
  row.message = "Inverse range lookup failed";
  row.energyMevNucl = null;
}
```

**Rule:** In calculator inverse-lookup flows, every caught exception must update
row status/message to an explicit error state (no empty catches).

---

## Entry 16 — Guard generated files and vendor gitlinks before commit

**Symptom:** Gitignored generated files (`static/wasm/libdedx.*`) and vendor
submodule gitlinks were accidentally committed into a feature PR.

**Root cause:** The workflow had no machine-checkable pre-commit gate for
forbidden artifact paths or vendor gitlink changes.

**Rule:** Run `pnpm guard:staged` immediately before every commit. The command
must fail if staged changes include generated artifacts (`static/wasm/**`,
`static/deploy.json`, Playwright outputs) or vendor gitlink changes under
`vendor/**`.

---

## Entry 17 — One ABI manifest for verify + wrapper + docs

**Symptom:** CI contract verification drifted from runtime implementation after
inverse wrappers moved to flat symbols.

**Root cause:** Inverse ABI symbols were duplicated in multiple places (`verify`,
docs, prompts), then updated inconsistently.

**Rule:** Keep inverse ABI symbols in `wasm/contract-manifest.json` and consume
that manifest from `wasm/verify.mjs`. Any doc section describing these symbols
must be validated by `pnpm wasm:check-doc-contract`.

---

## Entry 18 — Acceptance smoke must use real WASM for WASM-backed features

**Symptom:** E2E acceptance tests passed with runtime-injected mocks while real
WASM behavior still had correctness defects.

**Root cause:** Acceptance flows mixed product behavior checks with
`page.addInitScript` mock escape hatches.

**Rule:** For WASM-backed features, at least one `@smoke` acceptance path must
execute against real WASM (no runtime mock injection in acceptance tests).
Mocks are allowed only in explicitly labeled mock tests.

---

## Entry 19 — Always run WASM capability discovery before boundary changes

**Symptom:** Stage 6.9 implementation repeatedly guessed inverse/custom capabilities
from spec prose and UI intent, then discovered ABI/signature mismatches late.

**Root cause:** Capability checks were done after coding instead of before coding.
The session did not explicitly verify what `LibdedxService` and wrappers already exposed.

**Rule:** Before touching any feature that may cross the libdedx boundary, inspect:

1. `docs/06-wasm-api-contract.md`
2. `src/lib/wasm/**` (wrapper + types + mocks)
3. `LibdedxService` call sites + relevant tests
4. related ADR/spec references

Then record explicitly: "already exists" vs "requires new WASM change". Do not infer
WASM behavior from UI/spec prose alone.

---

## Entry 20 — Default to local commit-only (no automatic push)

**Symptom:** Automated pushes made branch contents harder to control when generated
artifacts or unintended changes were staged.

**Root cause:** Agent docs encoded push as part of normal completion semantics.

**Rule:** Implementers commit locally by default. Push only when the user explicitly
requests it. Final task output must include branch, commit SHAs, and a manual push
command so the user stays in control.

---

## Entry 21 — Empty-tree diff on first branch push causes false-positive vendor gitlink failures

**Symptom:** `workflow-guards` failed on the first push of a new docs-only branch
with:

```text
forbidden vendor gitlink change: vendor/bits-ui
... vendor/jsroot ...
```

even though the branch had not changed any vendor submodule pointers relative to
`master`.

**Root cause:** GitHub sets `github.event.before` to all zeroes on the first push
to a new branch. Comparing `empty-tree..HEAD` makes every tracked path on the
branch look newly added, including inherited `vendor/*` gitlinks from the branch
point.

**Rule:** For initial `push` events, never use the empty tree for repo-wide guard
diffs that validate submodule pointers. Fetch the default branch and diff from
`git merge-base HEAD origin/<default-branch>` instead; use the empty tree only as
an emergency fallback when no merge-base exists.

---

## Entry 22 — Do not hide missing feature work behind skipped acceptance tests

**Symptom:** The LiF custom-compound E2E smoke test was skipped because Calculator
dispatch to `calculateCustomCompound` had not been wired yet.

**Root cause:** The test correctly described Stage 6.10 acceptance behavior, but
the implementation stopped at editor/URL plumbing and deferred the calculation
path.

**Rule:** If an acceptance test depends on a remaining task in the same feature
scope, implement the missing task and re-enable the test before marking the
feature complete. Use `test.skip()` only for behavior explicitly outside the
current feature scope.

---

## Entry 23 — Mock method parameter names must match runtime references

**Symptom:** Custom inverse mock methods declared `_params` but referenced
`params`, which TypeScript did not catch in the interface-shape contract and
would throw only when tests executed those paths.

**Root cause:** Contract tests checked method presence/signatures but did not
exercise newly added mock method bodies.

**Rule:** When adding mock service methods, include at least one runtime contract
test that calls each new method with representative inputs. This catches
undefined variable references and return-shape drift that structural typing alone
does not cover.

---

## Entry 24 — URL numeric parsing must reject partial tokens

**Symptom:** Custom-compound URL decoding used `parseFloat()` / `parseInt()`, so
malformed values such as `mat_density=2.64foo`, `mat_ival=65foo`, or
`mat_elements=1abc:2` were accepted as valid numeric prefixes.

**Root cause:** JavaScript numeric prefix parsers are permissive by design and
do not validate that the full user/URL token is numeric.

**Rule:** Decode URL/user numeric fields with a strict full-token regex before
converting to `Number`. For custom compound URLs, malformed density, I-value,
atomic-number, or atom-count tokens must set `fromUrlWarning` and use the
existing fallback path instead of silently accepting the prefix.

---

## Entry 25 — Cannot set properties on `$state(null)` — wrap nullable state in `{ value: T | null }`

**Symptom:** Stage 6.11 CSV modal opened in the DOM but `pendingCsvOptions`
properties were silently lost on assignment, and the modal showed empty
defaults. Earlier, the build also failed with:

```
RolldownError: src/lib/state/export.svelte.ts:8:0
  Cannot export state from a module if it is reassigned.
```

…after an attempt to `pendingCsvOptions = { ... }` reassign a top-level
`$state` export.

**Root cause:**

1. `$state(null)` returns a `null` value — there is no proxy to attach
   properties to. `pendingCsvOptions.rows = rows` writes to nothing.
2. Top-level module `$state(...)` exports cannot be **reassigned** (the
   compiler enforces this so consumers can rely on the original reference).

**Rule:** For nullable / replaceable shared state, wrap it once and only ever
mutate the wrapper's `.value` field:

```typescript
// ✅ CORRECT — wrapper is constant; the slot is freely re-assignable
export const pendingCsvOptions = $state<{ value: PendingCsv | null }>({ value: null });

// at the call site
pendingCsvOptions.value = { rows, stpUnit, meta };
// later
pendingCsvOptions.value = null;
```

```typescript
// ❌ WRONG — sets a property on `null`, no error, value is lost
export const pendingCsvOptions = $state<PendingCsv | null>(null);
pendingCsvOptions.rows = rows; // silently lost; reactivity breaks

// ❌ WRONG — top-level $state exports cannot be reassigned
export let pendingCsvOptions = $state<PendingCsv | null>(null);
pendingCsvOptions = { rows, ... }; // build error: "Cannot export state ... if it is reassigned"
```

This pattern matches `canExport`, `wasmReady`, `showCsvModal` and the rest of
the codebase's shared `$state({ value: ... })` slots.

---

## Entry 26 — Set modal `mode` BEFORE `open` so the layout reads the right defaults

**Symptom:** Plot CSV modal first opened with the Calculator default filename
(`dedx_export.csv`) for one frame before snapping to `dedx_plot_data.csv`,
because the layout's `defaultFilename={showCsvModal.mode === "plot" ? ... : ...}`
was re-evaluated between two reactive writes.

**Root cause:** Writing `showCsvModal.value = true` first caused the dialog to
mount and read `showCsvModal.mode`, which was still the previous mode.

**Rule:** When opening a modal whose props depend on other state slots, write
the dependent state slots first and the `open`/visibility flag last:

```typescript
// ✅ CORRECT
pendingPlotCsv.value = { series, stpUnit };
showCsvModal.mode = "plot";
showCsvModal.value = true;

// ❌ WRONG — modal mounts with stale mode
showCsvModal.value = true;
showCsvModal.mode = "plot";
```

---

## Entry 27 — E2E coverage must mirror the spec, not the easier-to-implement behaviour

**Symptom:** Stage 6.11 Plot CSV scenario was implemented as a direct download
in advanced mode, and the matching E2E test asserted "no modal appears" — the
opposite of what `stage-6-11-export-advanced.md` Scenario 2 specifies (modal
visible, separator + line-endings options shown).

**Root cause:** The implementer/orchestrator pair short-circuited the harder
modal-wiring path and updated the E2E test to match the implementation rather
than the spec.

**Rule:** Acceptance scenarios in the feature spec are the contract. If the
implementation deviates, fix the implementation; do **not** rewrite the test
to make it pass. Reviewers should diff each E2E scenario against the spec's
"Then" clauses before approving.

---

## Entry 28 — Program-column E2E tests must use real program IDs and observable outcomes

**Symptom:** Stage 6.12 Playwright tests waited for headers such as
`data-program-id="101"` / `"9"` and for a non-existent `[data-dragging]`
attribute, so the tests timed out or masked reorder races.

**Root cause:** Test selectors were copied from spec examples/placeholders
instead of the runtime enum in `entity-selection.svelte.ts`, and drag/drop tests
waited on implementation details that were never rendered.

**Rule:** For multi-program table E2E tests, use the actual runtime program IDs
(`PSTAR=2`, `MSTAR=4`, `ICRU49=7`) or locate by visible header text, and wait for
observable outcomes such as header order, URL `programs=`, or `aria-live`
announcements. Do not wait for invented drag state attributes.

---

## Entry 29 — Keep URL version checks separate from URL restore/write gates

**Symptom:** Stage 6.13 Plot URL restoration was skipped because the immediate
`urlv` negotiation effect set the same `urlInitialized` flag used to mean
"initial URL restore has completed". On Calculator, switching from an
advanced-mode share URL back to Basic could re-emit `mode=advanced` while the
multi-program state was still being torn down.

**Root cause:** One flag/state branch represented multiple phases of URL
handling, and URL canonicalization inferred Advanced mode from the presence of
`multiProgState` instead of the actual `isAdvancedMode.value`.

**Rule:** Use separate state for URL version negotiation vs URL restore
completion (for example `urlVersionChecked` and `urlInitialized`). When encoding
mode-specific URL params, gate them on the current mode flag and the supporting
state object, not on the supporting object alone.

---

## Entry 30 — Parse `urlv` as a strict positive integer token

**Symptom:** `urlv=1abc` was accepted as version 1 because the page used
`parseInt(...)` before calling `negotiateVersion()`, so malformed URLs could
silently bypass the version-mismatch banner.

**Root cause:** JavaScript prefix parsers are permissive and stop at the first
invalid character. The URL grammar requires `urlv` to be a positive integer
token, and malformed/non-positive values must be treated as unsupported.

**Rule:** Pass the raw `urlv` token to a strict parser/negotiator. Validate with
a full-token integer regex before `Number(...)`; never use `parseInt()` for
URL version negotiation.

---

## Entry 31 — Combobox popup labels must not duplicate trigger labels

**Symptom:** Adding `aria-labelledby={labelId}` to force-mounted Bits UI
combobox listboxes fixed axe's missing-name violation, but unit tests using
`getByLabelText("Particle")` / `"Program"` started failing because both the
trigger button and hidden listbox had the same accessible name.

**Root cause:** Force-mounted popups remain in the test DOM even when closed.
Giving the popup the exact same accessible name as the trigger creates
ambiguous label queries and can also confuse selector-based tests.

**Rule:** Label force-mounted combobox popups with a distinct name such as
`"${label} options"` and label nested scroll regions with an even more specific
name such as `"${label} options scroll area"`. Keep the trigger's accessible
name as the visible field label.

---

## Entry 32 — Stage docs/logs must describe final net behavior, not transient attempts

**Symptom:** Stage 7.2 changelog/log index/task summaries said explicit
`fLabelSize`/`fTitleSize` overrides were implemented, while the final committed
state had that change reverted and documented JSROOT defaults.

**Root cause:** Documentation captured intermediate steps but did not clearly
mark superseded tasks, so quick readers could infer the wrong final behavior.

**Rule:** For PR review follow-ups and stage completion docs, always align
`CHANGELOG-AI.md`, `docs/ai-logs/README.md`, progress files, and task summaries
to the **net merged outcome**. Mark reverted work as `superseded/reverted` and
keep PR links in the redesign stage table current.

---

## Entry 33 — Preserve E2E coverage by sharding before reducing test scope

**Symptom:** After responsive device projects were added, E2E runtime dropped from
the accidental 26-minute all-device run but still took about 3.2 minutes for the
Playwright phase on a single CI worker.

**Root cause:** The suite was correctly filtered to desktop full coverage plus
responsive mobile/tablet coverage, but `playwright.config.ts` still forced one
CI worker and `.github/workflows/ci.yml` ran the whole suite in one job.

**Rule:** When E2E coverage is already appropriate and the goal is shorter CI
wall-clock time, prefer Playwright sharding across GitHub Actions matrix jobs
(`--shard=N/M`) before dropping tests or broadening tag filters. Make artifact
names shard-specific to avoid upload collisions.

---

_Last updated: 2026-05-13. Links: [implementer.md](.opencode/agents/implementer.md) •
[reviewer.md](.opencode/agents/reviewer.md) • [AGENTS.md](AGENTS.md)_
