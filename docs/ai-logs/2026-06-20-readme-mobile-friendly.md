# 2026-06-20 — README mobile-friendly rewrite

## Session Narrative

### Prompt 1: Make README mobile-friendly; move developer docs to GitHub Pages

The README contained a wide Markdown table in the "Try it" section that rendered poorly on mobile
(visible in screenshot attached to issue #759 — columns clipped, text overflowing on a 375 px
viewport). The user requested:

- Replace the table with mobile-friendly plain text
- Move developer documentation links to `https://aptg.github.io/web_dev/docs/technical`
- Keep project aim, v1/v2 history, and prominent links to the two GitHub Pages sites
- Keep minimal "run locally" instructions for v2

**AI response**: Rewrote `README.md` — replaced the "Try it" table with two sub-sections
(`### v2 (development)` and `### v1.1.0 (stable)`) each with a bold link and a one-line
description. Collapsed the "For developers" section to just "Run locally" commands plus a single
link to the GitHub Pages technical-reference page. Removed the documentation-links table from the
README entirely.

Extended `src/routes/docs/technical/+page.svelte` to open with a new "Developer resources" section
listing all seven links (redesign plan, project vision, feature specs, WASM API, testing strategy,
deployment, AI changelog) that were previously in the README table, plus moved the E2E testing
instructions and the dependency-management policy from the README to this page.

## Tasks

### README mobile-friendly rewrite (issue #759)

- **Status**: completed
- **Stage**: Stage 8 — Open Beta
- **Files changed**:
  - `README.md`
  - `src/routes/docs/technical/+page.svelte`
- **Decision**: Used `###` sub-headers + bold links instead of a table for the "Try it" section —
  these render identically on desktop and mobile without any horizontal overflow.
- **Decision**: Kept only the WASM build + `pnpm dev` commands in the README; everything else
  (E2E, security policy, doc links) moved to the GitHub Pages technical-reference page so the
  README stays minimal and readable at a glance.
