# Feature: Build Info Display

> **Status:** Final v1 (12 April 2026)
>
> This spec covers the small deployment badge shown in the app footer.
> Its primary purpose is **debugging aid**: when a user spots an issue and
> takes a screenshot, the badge immediately identifies which exact build is
> running — commit, date, and branch or tag — without requiring access to
> deployment logs.

---

## 1. Purpose

Users and developers need to identify the exact version of the app from a
screenshot alone. The badge is permanently visible in the footer so it
appears in any full-page or partial screenshot that includes the bottom of
the page.

---

## 2. Location

The build info badge is placed in the **footer**, aligned to the
**lower-left** of the footer bar. It sits on the same line as (or below)
the existing copyright text, depending on footer layout.

---

## 3. Display Format

```
Deployed: abc1234 · 2026-04-12 · feat/my-branch
```

Where:

| Element | Value | Notes |
|---------|-------|-------|
| **Commit hash** | 7-character short hash | Rendered as a hyperlink (see §4). |
| **Date** | `YYYY-MM-DD` | ISO 8601; consistent across build locales. |
| **Branch / tag** | Branch name or tag | `heads/` prefix stripped (e.g., `heads/master` → `master`); tag refs kept as-is (e.g., `tags/v1.0`). |

The three elements are separated by ` · ` (space · space).

### Link

The commit hash is a hyperlink:

```
https://github.com/APTG/dedx_web/commit/{full-hash}
```

The link opens in a new tab (`target="_blank"`). Using the full 40-character
hash in the URL avoids any ambiguity on very large repos; the displayed text
remains the 7-character short hash.

---

## 4. Build-Time Injection

The `deploy.js` script (run as a pre-build step) writes `deploy.json` into
the source tree before the React build:

```json
{
  "date": "2026-04-12",
  "commit": "abc1234",
  "commitFull": "abc1234def5678901234567890123456789012345678",
  "branch": "feat/my-branch",
  "repoUrl": "https://github.com/APTG/dedx_web"
}
```

| Field | Source |
|-------|--------|
| `date` | `new Date().toISOString().slice(0, 10)` — always `YYYY-MM-DD` |
| `commit` | `git rev-parse --short HEAD` |
| `commitFull` | `git rev-parse HEAD` |
| `branch` | `git describe --all`, with `heads/` prefix stripped |
| `repoUrl` | Hard-coded repository URL |

> **Note:** `repoUrl` is hard-coded in `deploy.js` rather than read from
> `package.json` to avoid a dependency on the npm package manifest format.

The script must fail loudly (non-zero exit) if `git` commands fail, so the
CI pipeline catches builds made outside a git repository.

---

## 5. Fallback Behaviour

If `deploy.json` is absent, empty, or contains invalid JSON (e.g., during
`react-scripts start` without running the pre-build script first), the
footer omits the badge **silently** — no visible error, no broken layout.
The rest of the footer renders normally.

---

## 6. Styling

- Font size: `small` (same as existing footer secondary text).
- Color: muted (e.g., `#666`), consistent with the existing footer text style.
- The commit hash link inherits the page's default link color, or a
  subdued variant to match the footer tone.
- The badge must not wrap onto multiple lines on viewports ≥ 360 px wide.

---

## Acceptance Criteria

- [ ] The footer shows commit hash, ISO date, and branch/tag on every page.
- [ ] The commit hash is a hyperlink pointing to `{repoUrl}/commit/{commitFull}` and opens in a new tab.
- [ ] Date is in `YYYY-MM-DD` format regardless of build machine locale.
- [ ] `heads/` prefix is stripped from branch names; tag refs are kept as-is.
- [ ] If `deploy.json` is missing or malformed, the badge is omitted with no visible error.
- [ ] The badge is visible in the lower-left area of the footer on a full-page screenshot.
