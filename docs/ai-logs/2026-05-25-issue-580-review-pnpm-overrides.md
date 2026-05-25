# 2026-05-25 — Review and simplify pnpm.overrides

## Session Narrative

### Prompt 1: Can you use gh tool to list issues in this project ?

**AI response**: Listed the 24 open issues in APTG/dedx_web.

### Prompt 2: Can you start work on the #580 using dedicated worktree (just don't name it opencode) ? Commit when ready

**AI response**: 
- Created a dedicated git worktree named `worktree-issue-580` checked out on branch `qwen/issue-580`.
- Audited the current transitive dependency tree and determined that `devalue` and `svelte` are already resolved to safe versions, making their overrides redundant.
- `cookie` is required to be pinned to `^0.7.0` because `@sveltejs/kit` has a transitive dependency range `^0.6.0` which resolves to a vulnerable version.
- Removed redundant overrides for `svelte` and `devalue`, keeping only `cookie` in `pnpm-workspace.yaml` with a security comment.
- Ran `pnpm install` in the worktree to update `pnpm-lock.yaml`.
- Verified `pnpm audit` is clean with the new overrides.
- Verified local validation checks (`pnpm run check`, `pnpm run lint`, `pnpm run test`, `pnpm run build`) and Playwright E2E smoke tests (`pnpm run test:e2e:smoke`) all pass successfully.
- Added a "Dependency Management & Security Policy" section to `README.md`.
- Staged all changes, ran `pnpm guard:staged` (which passed), and committed the changes with Conventional Commit format.

## Tasks

### Remove redundant pnpm overrides and document remaining pins

- **Status**: completed
- **Stage**: CI / docs / infrastructure
- **Files changed**:
  - [`package.json`](../../package.json)
  - [`pnpm-lock.yaml`](../../pnpm-lock.yaml)
  - [`README.md`](../../README.md)
- **Decision**: Svelte and devalue overrides were dropped because direct upgrades pulled in safe transitive versions. Cookie override was kept and simplified to the `cookie: "^0.7.0"` format in `pnpm-workspace.yaml` with a YAML `#` comment documenting the mitigation of GHSA-pxg6-pf52-xh8x and linking to upstream SvelteKit issue #13089.
- **Issue**: None
