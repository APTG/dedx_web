# 2026-06-01 — Issue #672: linkifier-safe URL list separator

## Session Narrative

### Prompt 1: Work on issue #672, create PR when ready

**User request**: Fix the bad link formatting reported in #672 — when a shareable
URL is pasted into Signal (and similar messengers), only the part up to the first
comma is auto-linked. Implement the fix with a strong unit/component/E2E test
battery and all static checks passing.

**AI response**: Confirmed the root cause from the issue's own analysis: our
shareable URLs emit a **literal comma** as the list-item separator for
`energies`, `particles`, `materials`, `programs`, `lookups`, `mat_elements`, and
`series`. Messenger/email auto-linkifiers are heuristic and terminate a link at
the first comma (sentence punctuation), so almost every multi-row shared link was
truncated.

Implemented Option B from the issue plan: switch the canonical separator to `~`
(RFC 3986 _unreserved_; never dropped by linkifiers), while decoders accept both
`~` and the legacy `,` so every previously shared/bookmarked link keeps working.

Key implementation points:

- **Shared constants** in `url-shared.ts`: `URL_LIST_SEPARATOR = "~"` and
  `URL_LIST_SPLIT_RE = /[,~]/`, reused across all codecs so the separator cannot
  drift between modules.
- **Encoders** join with `~`: `calculator-url.ts` (energies/particles/lookups),
  `plot-url.ts` (series), `external-data/ids.ts` (`formatEntityIdList`),
  `url-shared.ts` (`encodeMatElements`).
- **Decoders** split on `/[,~]/` at the matching choke-points (backward compat).
- **Serializers**: `URLSearchParams.toString()` percent-encodes `~` as `%7E`, so
  `calculatorUrlQueryString`/`plotUrlQueryString` now restore `%7E` → `~` (and
  dropped the now-unnecessary `%2C` → `,` un-escaping). `:` stays literal.
- **`isUrlSafeNumeric`** also rejects `~` so an invalid row can never inject the
  separator.
- **Grammar** (`url-grammar.peggy`): list rules use a new `list-sep = "~" / ","`;
  `LookupUnitToken` excludes `~`. The fallback `RawValue` already made the change
  safe even before the grammar update, but the grammar now keeps structured items
  and spans accurate for `~` lists.
- **Version bump to v3**: `CALCULATOR_URL_VERSION` / `CURRENT_URL_MAJOR = 3`.
  Because a naive bump would have made `negotiateVersion` reject every existing
  v2 link (the old check accepted only `v === CURRENT`), `negotiateVersion` now
  accepts the whole `[MIN_SUPPORTED_URL_MAJOR (2), CURRENT_URL_MAJOR (3)]` range.
  v2 links hydrate identically (decoders read both separators) and are rewritten
  to canonical v3 `~` form via the existing `replaceState`. `migrateUrl` stays the
  identity (no token rewriting needed). v1 remains retired.

### Decisions

- **Why `~` (not `%2C` or `+`/`-`/`_`/`.`)**: `~` is unreserved (never
  percent-encoded in human terms), survives linkification, and is unused in our
  token grammar. `+` decodes to space under `URLSearchParams`; `-`/`_`/`.` are
  already used inside unit tokens / param names / series triplets.
- **Why accept a version range rather than keep `urlv=2`**: bumping to v3 lets a
  pre-#672 client show a clean "unsupported link" banner for a v3 `~` URL instead
  of silently misparsing `100~200` as one row; making `negotiateVersion` accept
  `[2,3]` preserves backward compatibility for the new client.

## Tasks

### Switch list separator `,` → `~` (linkifier-safe), keep `,` on read

- **Status**: completed
- **Stage**: Shareable URLs (docs/04-feature-specs/shareable-urls.md)
- **Files changed**:
  - `src/lib/utils/url-shared.ts` (constants, `encodeMatElements`, `mat_elements` split)
  - `src/lib/utils/calculator-url.ts` (encode/decode/serializer, version → 3, guard)
  - `src/lib/utils/plot-url.ts` (series encode/decode, serializer)
  - `src/lib/external-data/ids.ts` (`parseEntityIdList`/`formatEntityIdList`)
  - `src/lib/utils/url-grammar.peggy` (`list-sep` rule)
  - `src/lib/utils/url-version.ts` (`CURRENT_URL_MAJOR = 3`, range negotiation)
  - `src/lib/state/multi-program.svelte.ts` (comment)
  - Docs: `shareable-urls.md` (v8), `shareable-urls-formal.md` (v9) — ABNF
    `list-sep`, version detection range, canonicalization, rationale, examples
  - Tests: updated existing fixtures (`,` → `~`, `urlv=2` → `urlv=3` for encoder
    output only; legacy `,` inputs kept to prove backward compat); added
    `src/tests/unit/url-separator-672.test.ts` (no-comma guards, legacy-comma
    decode, round-trip, linkifier regression, v2→v3 upgrade); added `~` parse
    cases to `url-parse.test.ts`; new E2E in `calculator-url.spec.ts` and
    `url-parser.spec.ts`.
- **Decision**: separator change is backward-compatible on read; only the
  canonical (emitted) form changes, hence the major bump and the
  `negotiateVersion` range widening.
- **Issue**: the 3 pre-existing `guard-forbidden-files.test.ts` failures are
  unrelated (they fail on a clean tree too — they need git base refs not present
  in this environment).
