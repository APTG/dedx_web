# Early development deploy to web_dev (21 April 2026)

**Model:** Claude Sonnet 4.6 via Claude Code
**Branch:** `feat/early-deploy-web-dev` (from `develop`)

## Context

The project is at Stage 3 (WASM pipeline complete). Stage 4 (SvelteKit scaffolding)
has not started yet, so there is no buildable app. The user wants to establish the
deployment pipeline early — before the real app exists — so that:

1. The `APTG/web_dev` GitHub Pages site is live and visible now.
2. The CI/CD machinery is exercised before Stage 8 makes it critical.
3. The `develop` → `web_dev` link is confirmed working before switching to
   `master` → `web_dev` in Stage 8.

## Changes made

### New: `.github/workflows/deploy.yml`

Deploys a static "Construction ongoing…" placeholder HTML page from every
push to `develop`. The page includes:
- A badge and brief description of the rebuild.
- A link to `docs/00-redesign-plan.md` (dynamically constructed from
  `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/blob/…`).
- Branch name and commit SHA shown in a footer.

The workflow uses `peaceiris/actions-gh-pages@v4` with `external_repository:
APTG/web_dev` and authenticates via a PAT stored as `WEB_DEV_DEPLOY_TOKEN`
secret in the `dedx_web` repo.

A GitHub Environment named `dev` is referenced in the workflow so deployments
appear in the GitHub UI at the known URL `https://aptg.github.io/web_dev/`.

The file has a Phase 1 / Phase 2 comment header describing exactly what to
change in Stage 8 (trigger → `master` + `v*`, replace placeholder build with
`pnpm build`, add production conditional for `APTG/web`).

### Updated: `docs/08-deployment.md`

- Added **§5.1 Early deploy phase** subsection documenting the pre-Stage 4
  placeholder deploy, the trigger change timeline, and the one-time repo
  setup required.
- Added footnote to the §1 environment table noting the current `develop`
  trigger (instead of the planned `master`).

### Updated: `docs/00-redesign-plan.md`

Added **Stage 3.8** block (early development deploy) between Stage 3.7 and
Stage 4, with the rationale, deliverables, and Stage 8 migration note.

## One-time repo setup required

See `docs/08-deployment.md §5.1` for full details. In brief:

1. **Create a GitHub fine-grained PAT** with `Contents: Read and write`
   permission scoped to the `APTG/web_dev` repository.
2. **Add secret** `WEB_DEV_DEPLOY_TOKEN` to `dedx_web` repo settings
   → Secrets and variables → Actions.
3. **Enable GitHub Pages** on `APTG/web_dev`:
   Settings → Pages → Source: Deploy from branch → Branch: `gh-pages` / `/ (root)`.
4. **Create GitHub Environment** `dev` in `dedx_web` repo settings
   → Environments → New environment → name: `dev`.
   (Protection rules are optional for dev; recommended for the future
   `production` environment added in Stage 8.)

## Stage 8 migration

When Stage 8 arrives, the migration in `deploy.yml` is:

```diff
 on:
   push:
-    branches: [develop]
+    branches: [master]
+    tags: ['v*']

 jobs:
   deploy-dev:
+    if: github.ref == 'refs/heads/master'
     steps:
-      - name: Build placeholder site
-        ...build static HTML...
+      - name: Build SvelteKit app
+        run: pnpm build
       - name: Deploy to APTG/web_dev
         ...

+  deploy-prod:
+    if: startsWith(github.ref, 'refs/tags/v')
+    steps:
+      - name: Build SvelteKit app
+        run: pnpm build
+      - name: Deploy to APTG/web
+        uses: peaceiris/actions-gh-pages@v4
+        with:
+          personal_token: ${{ secrets.WEB_DEPLOY_TOKEN }}
+          external_repository: APTG/web
+          ...
```
