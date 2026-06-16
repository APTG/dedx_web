# 2026-06-15 — Issue #594: Ship the user guide as an in-app page

> Follow-up to [2026-06-05-issue-594-screenshots-guide.md](2026-06-05-issue-594-screenshots-guide.md).

## Session Narrative

### Prompt: "ship the guide at /docs/user-guide instead of a markdown file — human-friendly, readable, responsive for mobile + desktop"

**AI response**: Converted the end-user guide from a standalone markdown file
into the in-app route so it is served at `/docs/user-guide` (and on GitHub
Pages):

- Rewrote `src/routes/docs/user-guide/+page.svelte` into a human-readable,
  responsive guide: short intro, an in-page jump-nav of pill links, a numbered
  Calculator walkthrough, a Plot section, a "Good to know" tips list, and the
  pre-existing shareable-link / external-data / keyboard-shortcut sections
  (kept, since they were already useful). Styled with utility classes (the
  project has no `@tailwindcss/typography`), constrained to `max-w-3xl`.
- Each screenshot uses `<picture>` with a `(max-width: 640px)` `<source>` so
  phones get the mobile capture and larger screens the desktop one; images are
  `loading="lazy"` with descriptive `alt` text.
- Moved screenshot output from `docs/assets/` to `static/screenshots/` so the
  app serves them at `${base}/screenshots/*.png` (works on the `/dedx_web/`
  Pages base too). Updated `tests/docs-screenshots.spec.ts` `OUT_DIR` + header
  comment and `playwright.docs.config.ts` header comment to match.
- Removed `docs/user-guide.md` and its `docs/README.md` index row — the route
  is now the single source of truth.
- Verified by building, capturing `/docs/user-guide` at 1280×720 and 375×667,
  and confirming the layout, the mobile/desktop image swap, and that
  `pnpm check` / `lint` / `format:check` are all clean.

Branch had been fast-forwarded through Copilot's `master` merge (`b1aa90b`)
before this work; the three earlier Copilot review threads were already
resolved. A second Copilot review then flagged stale path references after the
move (config/log/changelog/PR-description still pointing at `docs/assets/` and
`docs/user-guide.md`); those were corrected, including splitting this session
into its own dated log.

## Tasks

### Ship user guide in-app + relocate screenshots

- **Status**: completed
- **Stage**: Stage 8 (Open Beta & User Feedback) — documentation
- **Files changed**:
  - `src/routes/docs/user-guide/+page.svelte` (rewritten)
  - `tests/docs-screenshots.spec.ts` (`OUT_DIR` → `static/screenshots/`)
  - `playwright.docs.config.ts` (header comment)
  - `static/screenshots/*.png` (new; moved from `docs/assets/`)
  - `docs/user-guide.md` (removed), `docs/README.md` (index row removed)
  - `CHANGELOG-AI.md`, `docs/ai-logs/README.md` (index)
- **Decision**: Used `<picture>` with a 640px media source so mobile users get
  the mobile screenshots and desktop users the desktop ones — the page must read
  well on both.
- **Decision**: Screenshots live under `static/` (not `docs/assets/`) because
  only `static/` is served by the SvelteKit app; this also keeps them on the
  deployed GitHub Pages site that hosts the guide.
