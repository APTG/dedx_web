# 2026-07-24 — typescript-eslint incompatible with TypeScript 7 (#879)

## Session Narrative

### Prompt 1: Look at PR #879 and fix it

**AI response**: PR #879 is dependabot's `javascript-tooling` group bump of
`typescript` 6.0.3 → 7.0.2. `Static Analysis (format, lint, check)` was the
only failing check; `pnpm install`/`format:check` passed, but `pnpm run lint`
crashed on import:

```
typescript-eslint does not support TS 7.0.
Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0
See also https://github.com/typescript-eslint/typescript-eslint/issues/10940
```

TypeScript 7.0 is Microsoft's new native, Go-ported compiler — a genuine
breaking release, not a routine minor bump. Confirmed there is no newer
`typescript-eslint` that already supports it: `npm view typescript-eslint
dist-tags` shows `latest: 8.65.0` (already what this repo pins) with only a
`canary` prerelease (`8.65.1-alpha.7`) ahead of it, and `npm view
typescript-eslint@8.65.0 peerDependencies` caps `typescript` at `<6.1.0`.
The upstream tracking issue (typescript-eslint#10940, "Use TS 7 (tsgo /
typescript-go) for type information") is still open. The guard that throws
lives inside `typescript-eslint`'s own entry point
(`typescript-eslint/dist/index.js:52`) and fires unconditionally before any
of this repo's `eslint.config.js` runs — there is no config-side workaround,
only "run typescript-eslint against a side-by-side TS 6 install," which the
TS team's own migration doc presents as the interim pattern for projects not
yet ready to drop type-aware linting.

Given no code-side fix exists, closed the PR rather than force it through,
and added a dependabot `ignore` rule
(`dependency-name: typescript`, `versions: [">=7.0.0"]`) to the npm update
block in `.github/dependabot.yml` so the same broken bump doesn't reopen on
the next daily run. Left a closing comment on the PR linking the upstream
issue and this ignore rule as the reason.

## Tasks

### Block the TypeScript 7 dependabot bump until typescript-eslint supports it

- **Status**: completed
- **Stage**: CI / tooling (not a redesign-plan stage)
- **Files changed**:
  - `.github/dependabot.yml`
  - `CHANGELOG-AI.md`
  - `docs/ai-logs/2026-07-24-typescript-7-eslint-incompatible.md`
- **Decision**: Block future `typescript` `>=7.0.0` bumps at the dependabot
  level rather than trying any local workaround (e.g. installing a second,
  older `typescript` copy just for the linter, per the TS team's own
  side-by-side migration doc). That pattern adds a permanent second compiler
  install for a temporary upstream gap, and the gap is explicitly tracked and
  expected to close — a plain ignore rule is a one-line revert once
  typescript-eslint#10940 ships, versus unwinding a dual-install setup later.
- **Issue**: Revisit once `typescript-eslint` publishes a release
  supporting TypeScript 7 — remove the `ignore` entry and let dependabot
  reopen the bump normally.
