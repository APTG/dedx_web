# 2026-04-12 — Inverse Lookups Draft v3 → Final v4; Build Info spec

## Session Narrative

### Prompt 1: Status check and new requests

**User directives:**
1. Check what is left to do for inverse lookups.
2. Add a small general feature: a build info badge in the lower-left corner
   of the app (commit hash with GitHub link, ISO date, branch/tag name)
   visible on all screenshots — for debugging purposes.
3. Change Inverse STP multi-program layout from sub-rows to
   **one column pair per program** (same approach as the Range tab).

**AI response:**

Read `docs/04-feature-specs/inverse-lookups.md` (Draft v3), `docs/04-feature-specs/README.md`,
`src/Components/Footer/Footer.js`, `src/Components/Footer/deploy.json`,
`src/deploy.js`, and `docs/01-project-vision.md` to understand the current
state.

**Findings:**
- The footer already has a basic commit/date/branch display in `Footer.js`
  reading from `deploy.json`, but the commit hash is plain text (not a link)
  and the date format is locale-dependent.
- The `deploy.js` script populates the JSON at build time.
- `inverse-lookups.md` §3, §5.2, §5.5, and §8 all described Inverse STP
  multi-program as a sub-row expansion — this needed to be updated.

**Changes to `inverse-lookups.md` (Draft v3 → Draft v4):**

1. Status header bumped to Draft v4 (12 April 2026).
2. v4 changelog entry added to the header block.
3. §3 "Programs and Multi-Program Mode" — Inverse STP bullet updated:
   sub-row description replaced by "one E low column and one E high column
   per program" (mirrors Range tab).
4. §5.2 Table Columns — multi-program paragraph rewritten: no sub-row
   expansion; each program gets `{ProgramName} E low ({unit})` and
   `{ProgramName} E high ({unit})` columns; one row per input value.
5. §5.5 Wireframe — multi-program wireframe replaced with a wide column
   layout (ICRU 90 E low | ICRU 90 E high | PSTAR E low | PSTAR E high),
   one row per input value.
6. §8 Export — Inverse STP multi-program columns updated: `{ProgramName}
   E low ({unit})` / `{ProgramName} E high ({unit})` pairs per visible
   program; description "one data row per input value" (not one per program).

**New spec `docs/04-feature-specs/build-info.md` (Final v1):**

7. Created spec for the build info badge:
   - Location: footer, lower-left.
   - Format: `Deployed: {short-hash} · YYYY-MM-DD · {branch}` where the
     hash is a hyperlink to `{repoUrl}/commit/{commitFull}`.
   - `deploy.js` additions: `commitFull` (full 40-char hash) and `repoUrl`
     (hard-coded repo URL) fields in `deploy.json`; date field switched to
     `new Date().toISOString().slice(0, 10)` for locale-independent format.
   - Silent fallback when `deploy.json` is missing/malformed.
   - Acceptance criteria: 6 checks.

**Cross-spec updates:**

8. `docs/04-feature-specs/README.md`: `inverse-lookups.md` row updated to
   Draft v4; `build-info.md` row added.

---

### Prompt 2: Consistency review, missing links, mark Final

**User directive:** Check for consistency, fix if needed. Add missing links
to spec documents. Fill AI logs. Mark inverse lookup spec as Final.

**AI response:**

Read `docs/ai-logs/2026-04-10-inverse-lookups.md`, `CHANGELOG-AI.md`,
`docs/06-wasm-api-contract.md` §§2.3/3, `docs/04-feature-specs/shareable-urls.md`
§7.3, and `docs/01-project-vision.md` §4.4.

**Consistency issues found and fixed:**

1. `inverse-lookups.md` status: "Draft v4" → **"Final v4"**.
2. `inverse-lookups.md` Acceptance Criteria — Multi-Program group, line 2:
   still said "one sub-row per visible program per input value; program name
   inline in E low cell" — updated to match v4 column layout.
3. `inverse-lookups.md` Acceptance Criteria — Export group:
   still said "`Program`, `E low ({unit})`, `E high ({unit})`; one row per
   program per input value" — updated to paired column format, one row per
   input value.
4. `inverse-lookups.md` Open Questions footer: "v1–v3" → "v1–v4".
5. `docs/04-feature-specs/README.md`: `inverse-lookups.md` status "Draft v4"
   → "Final v4".
6. `docs/01-project-vision.md` §4.4: two `TODO` stub references replaced
   with proper Markdown links:
   - `TODO advanced-options.md` → `[advanced-options.md](04-feature-specs/advanced-options.md)`
   - `TODO inverse-lookups.md` → `[inverse-lookups.md](04-feature-specs/inverse-lookups.md)`

**Cross-spec links confirmed correct (no changes needed):**

- `docs/04-feature-specs/shareable-urls.md` §7.3 step 8 already links to
  `inverse-lookups.md` §9.
- `docs/06-wasm-api-contract.md` already has `getBraggPeakStp()`,
  `getInverseStp()` with `options?: AdvancedOptions`, and `getInverseCsda()`
  with `options?: AdvancedOptions` — all consistent with Final v4.
- `docs/04-feature-specs/shareable-urls-formal.md` v5 already has imode/ivalues/iunit
  ABNF — consistent with §9 of the final spec.

## Files Changed

| File | Change |
|------|--------|
| `docs/04-feature-specs/inverse-lookups.md` | **Updated** — Draft v3 → Draft v4 (Inverse STP multi-program column layout); Draft v4 → **Final v4** (consistency fixes, stale AC lines, status mark) |
| `docs/04-feature-specs/build-info.md` | **Created** — Final v1 (build info badge spec) |
| `docs/04-feature-specs/README.md` | Updated — `inverse-lookups.md` Draft v4 → Final v4; `build-info.md` row added |
| `docs/01-project-vision.md` | Updated — §4.4 TODO stubs for `advanced-options.md` and `inverse-lookups.md` replaced with proper links |
| `CHANGELOG-AI.md` | Updated with this session's entries |
| `docs/ai-logs/2026-04-12-inverse-lookups.md` | **Created** — this log |

## Open Questions Remaining

_None._
