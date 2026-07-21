# 2026-07-21 — SRIM Dataset S3 Migration + CORS Runbook

## Session Narrative

### Prompt 1: Update the SRIM example dataset to the new S3 location

The user reported the hosted SRIM reference dataset moved from
`s3.cloud.cyfronet.pl` to `s3p.cloud.cyfronet.pl`, with a possibly-changed
bucket name, and shared an `s3cmd ls --recursive` listing of the new bucket.

**AI response**: Searched the repo for references to the old host and found
a single source of truth: `src/lib/utils/external-data-example-urls.ts`
(consumed by the calculator/plot example links and the in-app user guide,
which derives its links from this helper rather than hardcoding a URL).
Updated the host to `s3p.cloud.cyfronet.pl`; the bucket name (`dedxweb`)
was unchanged, but the object key gained an extra `dedxweb/` prefix segment
per the shared listing (now `dedxweb/dedxweb/srim-gui.webdedx/...`).
Verified with `curl` that the new path resolves (`zarr.json` → `200`), but
also discovered — by comparing `curl -H "Origin: ..."` responses against
the old host — that the new endpoint sent no `Access-Control-Allow-Origin`
header at all, i.e. CORS was not configured on the new bucket. Flagged this
rather than attempting to fix it myself (no bucket credentials, and it's
infra config outside the repo). Created branch `fix/srim-s3p-endpoint`,
committed, and pushed after the user asked to push.

### Prompt 2: Write an s3cmd CORS setup runbook

The user asked for step-by-step instructions on configuring CORS with
`s3cmd`, as a markdown file included in the repo's technical documentation.

**AI response**: Confirmed the CORS gap independently with `s3cmd info
s3://dedxweb` (showed `CORS: none`) and, for reference, probed the old
(still-resolving) host's preflight `OPTIONS` responses to document what the
previous configuration allowed (an explicit origin list, not a wildcard).
Wrote `docs/13-external-data-hosting-cors.md`: prerequisites (`~/.s3cfg` for
the path-style S3P endpoint), two complete `cors.xml` templates (open `*`
origin vs. a restricted list matching the old config), `s3cmd setcors`/
`delcors` usage, and `curl`-based verification (simple `GET` +
preflight `OPTIONS`, since `s3cmd` has no `getcors` subcommand). Cross-linked
the new doc from `docs/README.md`, `docs/08-deployment.md`, and
`docs/04-feature-specs/external-data.md` §10.4.

### Prompt 3: Fix a MalformedXML error

The user pasted the *restricted-origin* snippet into `cors.xml` and ran
`s3cmd setcors`, which failed with `400 MalformedXML`.

**AI response**: The restricted-origin example in the doc was written as a
bare `<CORSRule>` fragment (to highlight only what differs from the first
example), not a complete document — missing the XML declaration and the
`<CORSConfiguration>` root. Provided the user a corrected, complete
`cors.xml`, and fixed the doc so both examples are copy-pasteable
standalone files, with a note warning against pasting just the inner rule.

### Prompt 4: Open a PR

The user confirmed they successfully applied CORS on the new bucket (`s3cmd
info` now shows the rule, and `curl` confirms `Access-Control-Allow-Origin`/
`-Methods`/`-Expose-Headers` on both `GET` and preflight `OPTIONS`) and asked
for a PR with a proper description.

**AI response**: Verified CORS end-to-end via `curl`, removed the scratch
`cors.xml` from the repo root, and opened
[APTG/dedx_web#859](https://github.com/APTG/dedx_web/pull/859).

### Prompt 5: Address Copilot review

Copilot's automated PR review flagged: the two 2026-07-21 changelog bullets
should be one session entry with a linked log (this file); the first
changelog bullet's CORS status was stale (said CORS "needs to be
reconfigured", contradicting the PR description which says it's now fixed);
and the CORS runbook's verification `grep` commands used `\|` alternation,
which isn't portable to BSD/macOS `grep`; and the note that
`Access-Control-Expose-Headers` matters on the preflight response was
misleading (`Expose-Headers` is a browser directive read from the actual
`GET`/`HEAD` response, not the `OPTIONS` preflight — the preflight itself
only needs `Allow-Methods`/`Allow-Headers`).

**AI response**: Consolidated the changelog into a single session entry
linking here, updated it to reflect that CORS is now live and verified.
Rewrote the runbook's `grep` invocations as `grep -Ei "^(HTTP|access-control)"`
(portable, no unescaped alternation). Reworded the "what to expect" note in
§5 so it correctly attributes `Access-Control-Expose-Headers` to the actual
`GET`/`HEAD` response rather than implying it's required on the preflight.

## Tasks

### Migrate SRIM example dataset URL + document CORS setup

- **Status**: completed
- **Stage**: N/A (external-data feature maintenance, post-Stage 7.5)
- **Files changed**:
  - `src/lib/utils/external-data-example-urls.ts`
  - `docs/13-external-data-hosting-cors.md` (new)
  - `docs/README.md`
  - `docs/08-deployment.md`
  - `docs/04-feature-specs/external-data.md`
  - `CHANGELOG-AI.md`
- **Decision**: Documented both an open (`AllowedOrigin: *`) and a
  restricted-origin `cors.xml` template rather than prescribing one, since
  the dataset is public/read-only (no confidentiality trade-off either way)
  but the previous bucket used a restricted list — left the choice to
  whoever administers the bucket.
- **Issue**: None outstanding. CORS is live and verified on
  `s3p.cloud.cyfronet.pl` as of this session.
