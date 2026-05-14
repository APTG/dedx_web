# Claude Handoff Prompt: Stage 7.5 External Data App Integration

Use this prompt with Claude Code to continue the work from the current branch.

---

You are continuing dEdx Web Stage 7.5: External data app integration for user-hosted Zarr v3 `.webdedx` stores.

## Current State

- Branch: `qwen/stage-7-5-external-data`.
- Stage 7.5 data-prep/tooling is already committed.
- App implementation has not started.
- GitHub Copilot stopped before writing implementation code and created this handoff.
- Real user-hosted SRIM GUI/headless store URLs were validated manually, but they must not be hardcoded, committed, or written into AI logs.

## First Commands

Run these before editing:

```bash
git status --short --branch
sed -n '1,220p' CLAUDE.md
sed -n '1,120p' CHANGELOG-AI.md
ls docs/progress
sed -n '1,220p' docs/prompts/2026-05-13-stage7-5-external-data-implementation-plan.md
```

Then read the feature specs that the plan references:

```bash
sed -n '1,260p' docs/04-feature-specs/external-data.md
sed -n '232,545p' docs/04-feature-specs/shareable-urls-formal.md
```

## Hard Constraints

- Do not write the real external store URLs into source, tests, docs, screenshots, logs, or committed config.
- Do not commit generated `.webdedx` stores or generated reports under `data/`.
- Do not change the libdedx C/WASM API for Stage 7.5.
- Use Svelte 5 runes only.
- Keep external data activation URL-only through `extdata`.
- No persistent browser cache for external data.
- Auto-select must not resolve to external programs.
- Keep zarrita default shard `HEAD` and Range behavior where possible.
- Run `pnpm guard:staged` before every commit.

## Start With Slice 1

Implement only the first commit-sized slice first: external URL and ID primitives.

Create or modify:

- `src/lib/external-data/types.ts`
- `src/lib/external-data/ids.ts`
- `src/lib/external-data/url.ts`
- `src/lib/external-data/index.ts`
- `src/tests/unit/external-data-url.test.ts`
- `src/lib/utils/calculator-url.ts`
- `src/lib/utils/plot-url.ts`
- `src/lib/state/multi-program.svelte.ts`

Required behavior:

- Parse and format `ext:{label}:{entityLocalId}`.
- Validate labels and local IDs with `/^[A-Za-z0-9_-]+$/`.
- Parse all `extdata` URL params in declaration order.
- Treat duplicate external labels as parse errors. Do not keep an ambiguous binding.
- Keep ordinary duplicate params last-wins.
- Canonical order: `urlv`, then all `extdata`, then normal params.
- Preserve only the `extdata` label separator colon literally. Keep the external URL portion percent-encoded.
- Add mixed `number | ext-ref` support where the formal URL grammar allows `entity-id`, especially advanced `programs`, `hidden_programs`, and Plot `series` triplets.

Important warning:

- Existing URL query serialization globally decodes `%3A` to `:` for readability.
- That must be fixed before emitting `extdata`, or `https%3A` inside the external URL will become an illegal literal colon.

Targeted tests for Slice 1:

```bash
pnpm test -- src/tests/unit/external-data-url.test.ts src/tests/unit/calculator-url.test.ts src/tests/unit/plot-url.test.ts
pnpm guard:staged
git status --short
git commit -m "feat: add external data URL primitives"
```

## Then Continue Through the Plan

After Slice 1 passes and is committed, continue through the detailed plan in:

```text
docs/prompts/2026-05-13-stage7-5-external-data-implementation-plan.md
```

The remaining slices are:

1. Validated zarrita loader and external lookup service.
2. Merge external entities into compatibility and selection state.
3. Calculator external forward calculations.
4. Plot external series.
5. Source attribution and error UI polish.
6. Docs, specs, E2E, full verification, and local-only real-data smoke.

## Logging

Continue the session log without recording real URLs:

```text
docs/ai-logs/2026-05-13-stage7-5-external-data-app.md
```

Also keep these in sync when the implementation reaches a meaningful milestone:

- `CHANGELOG-AI.md`
- `docs/ai-logs/README.md`
- `docs/00-redesign-plan.md`
- `docs/progress/`

## Success Criteria

Stop after Slice 1 only if the user asks for another handoff. Otherwise continue slice by slice with commits. The first slice is successful when URL helpers and URL codec tests pass, staged-file guard passes, and no real URL or generated data is staged.
