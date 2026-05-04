# 2026-05-04 — Branch protection: incident, recovery, and prevention

## Session Narrative

### Prompt 1: archive opencode session transcript

The raw opencode session file `session-ses_20de.md` (Stage 6 Plot export,
Qwen3.5-397B-A17B-FP8) was sitting in the repo root after the PLGrid session
completed. Moved it to `docs/ai-logs/2026-05-04-stage6-plot-export-qwen-session.md`
following the `YYYY-MM-DD-<slug>-qwen-session.md` naming convention and added an
index entry in `docs/ai-logs/README.md`.

### Prompt 2: incident — Qwen pushed directly to master

During the Stage 6 Plot export opencode session, Qwen3.5-397B did not create a
feature branch before committing. All 10 feature commits landed directly on
`master` and were pushed to origin.

**Affected commits** (`625a1ce` → `0acc379`, plus `f416fd4` archive commit):

| Commit    | Message                                                         |
| --------- | --------------------------------------------------------------- |
| `625a1ce` | feat(export): add formatPlotCsv() and downloadPlotCsv()         |
| `620dde2` | fix(export): remove dead code and fix double BOM                |
| `2d1f0c5` | feat(plot): add SVG image export with "Export image ▾" dropdown |
| `f686f16` | fix(plot): correct SVG dropdown label and filename per spec     |
| `2ab5032` | feat(export): add generatePlotPdf() for Plot page PDF export    |
| `1d6a7b1` | fix(export): remove undeclared seriesIndex from generatePlotPdf |
| `a798d9c` | feat(plot): wire toolbar Export CSV and Export PDF buttons      |
| `553a4c4` | test(e2e): add Plot page export tests                           |
| `d4ef51a` | fix(e2e): add PDF button assertion and fix any type             |
| `0acc379` | docs: add Stage 6 Plot export session log                       |
| `f416fd4` | docs: archive Stage 6 Plot export opencode session transcript   |

### Prompt 3: recovery plan

The last "clean" master commit before Qwen's work: `19fa809`
(`feat(opencode): add multi-agent orchestrator/implementer/reviewer setup`).

**Recovery steps executed:**

```sh
# 1. Create branch at current HEAD — captures all 11 commits
git checkout -b qwen/stage-6-plot-export
git push origin qwen/stage-6-plot-export

# 2. Reset master to before Qwen's commits
git checkout master
git reset --hard 19fa809

# 3. Force-push master (branch protection temporarily disabled in GitHub Settings)
git push origin master --force-with-lease

# 4. Re-enable branch protection in GitHub Settings

# 5. Open PR: qwen/stage-6-plot-export → master
```

### Prompt 4: prevention measures

**`AGENTS.md` §6 updated** — added a mandatory branching sub-section as the
very first item under "Working process", before any other rules:

- Explicit `NEVER commit or push directly to master`
- Step-by-step: `git checkout -b qwen/<slug>` then `git push -u origin qwen/<slug>`
- Consequence stated: remote will reject; model must output `TASK BLOCKED`
  (not force-push)

**GitHub branch protection** (recommended, to be enabled by maintainer):

- Settings → Branches → Add rule for `master`
- Enable: "Require a pull request before merging"
- Enable: "Allow force pushes" → Admins only (preserves recovery escape hatch)

## Tasks

### Archive session transcript

- **Status**: completed
- **Files changed**: `docs/ai-logs/2026-05-04-stage6-plot-export-qwen-session.md` (new), `docs/ai-logs/README.md`

### Recover master from direct Qwen push

- **Status**: completed (executed by maintainer)
- **Decision**: create branch at current HEAD first (preserves all commits), then
  reset master backwards — not the reverse, which would lose commits

### Add branching safeguard to AGENTS.md

- **Status**: completed
- **Files changed**: `AGENTS.md` §6
- **Decision**: placed as the first sub-section of §6, above all other working
  rules, to maximise visibility at session start
