<script lang="ts">
  // Static reference page. The grammar shown here mirrors the executable PEG
  // grammar in src/lib/utils/url-grammar.peggy; the normative definition lives
  // in docs/04-feature-specs/shareable-urls-formal.md §2.
  const grammar = `query        = [pair *("&" [pair])]

pair         = extdata-pair / energies-pair / lookups-pair / series-pair
             / mat-elements-pair / entity-list-pair / scalar-pair / unknown-pair

; structured, list-bearing params  (list-sep = "~" / "," — see below)
energies-pair     = "energies=" energy-item *(list-sep energy-item)
energy-item       = number [":" energy-unit-token]
lookups-pair      = ("lookups=" / "ivalues=") lookup-item *(list-sep lookup-item)
series-pair       = "series=" series-item *(list-sep series-item)
series-item       = entity-id "." entity-id "." entity-id   ; program.particle.material
mat-elements-pair = "mat_elements=" mat-element *(list-sep mat-element)
mat-element       = digits ":" number                       ; Z:count
entity-list-pair  = ("programs=" / "particles=" / "materials=") entity-id *(list-sep entity-id)
extdata-pair      = "extdata=" label ":" url                ; split on the first ':'

; list-item separator: "~" is canonical (v3+, issue #672); legacy "," accepted on read
list-sep          = "~" / ","

; single-valued params (value kept verbatim, then percent-decoded)
scalar-pair  = scalar-key "=" value
scalar-key   = "urlv" / "mode" / "particle" / "material" / "program"
             / "eunit" / "uanchor" / "across" / "qshow" / "imode" / "iunit"
             / "istpbranch" / "stp_unit" / "xscale" / "yscale" / …

; forward-compatible catch-all (dropped by the resolver, never re-emitted)
unknown-pair = key ["=" value]

; lexical
entity-id    = digits / ("ext:" label ":" id)
number       = digits ["." digits] [("e"/"E") ["+"/"-"] digits]
digits       = 1*DIGIT`;

  const repoBase = "https://github.com/APTG/dedx_web/blob/master";

  const devDocs = [
    {
      title: "Redesign plan",
      href: `${repoBase}/docs/00-redesign-plan.md`,
      description: "Stage-by-stage implementation plan and current status",
    },
    {
      title: "Project vision",
      href: `${repoBase}/docs/01-project-vision.md`,
      description: "Target audience, core use cases, design principles",
    },
    {
      title: "Feature specs",
      href: `${repoBase}/docs/04-feature-specs/`,
      description: "Per-feature specs with acceptance criteria",
    },
    {
      title: "WASM API contract",
      href: `${repoBase}/docs/06-wasm-api-contract.md`,
      description: "TypeScript ↔ libdedx interface",
    },
    {
      title: "Testing strategy",
      href: `${repoBase}/docs/07-testing-strategy.md`,
      description: "Vitest unit tests, Playwright E2E, WASM mocking",
    },
    {
      title: "Deployment",
      href: `${repoBase}/docs/08-deployment.md`,
      description: "GitHub Pages pipeline and CI",
    },
    {
      title: "AI changelog",
      href: `${repoBase}/CHANGELOG-AI.md`,
      description: "Log of all AI-assisted development sessions",
    },
  ];
</script>

<svelte:head>
  <title>Technical Reference - webdedx</title>
</svelte:head>

<div class="space-y-8">
  <h1 class="text-3xl font-bold">Technical Reference</h1>

  <!-- ─── Developer resources ──────────────────────────────────────────── -->
  <section class="prose max-w-none">
    <h2>Developer resources</h2>
    <p>
      The project's design documents, specs, and logs live in the repository under <code>docs/</code
      >.
    </p>
    <ul class="not-prose space-y-3">
      {#each devDocs as doc (doc.href)}
        <li class="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <a
            href={doc.href}
            target="_blank"
            rel="noreferrer"
            class="min-w-max font-medium underline hover:no-underline"
          >
            {doc.title}
          </a>
          <span class="text-muted-foreground">{doc.description}</span>
        </li>
      {/each}
    </ul>
  </section>

  <!-- ─── E2E tests ────────────────────────────────────────────────────── -->
  <section class="prose max-w-none">
    <h2>Running E2E tests locally</h2>
    <p>
      Playwright serves the built app with <code>pnpm preview</code>, so build first:
    </p>
    <pre class="overflow-x-auto rounded-lg border bg-muted p-4 text-sm"><code
        >pnpm build
pnpm test:e2e</code
      ></pre>
    <p>
      <code>pnpm build</code> runs <code>node scripts/deploy.cjs</code> via <code>prebuild</code>,
      so <code>static/deploy.json</code> is generated automatically — no extra manual step needed.
    </p>
  </section>

  <!-- ─── Dependency management ────────────────────────────────────────── -->
  <section class="prose max-w-none">
    <h2>Dependency management &amp; security policy</h2>
    <ul>
      <li>
        <strong>Prefer direct upgrades.</strong> If <code>pnpm audit</code> or Dependabot flags a vulnerability
        in a transitive dependency, upgrade the direct dependency that pulls it in. Do not add overrides
        as a first move.
      </li>
      <li>
        <strong>Minimal overrides.</strong> Only use overrides as a last resort if no compatible upstream
        release exists.
      </li>
      <li>
        <strong>Workspace-level configuration.</strong> Define overrides in the root
        <code>pnpm-workspace.yaml</code> under the <code>overrides:</code> key (not
        <code>package.json</code>'s <code>pnpm.overrides</code>) for workspace-wide consistency.
      </li>
      <li>
        <strong>Document overrides.</strong> Every override must have a YAML comment directly above it
        referencing the GHSA ID it mitigates and linking to the upstream issue.
      </li>
    </ul>
  </section>

  <!-- ─── Shareable URL grammar ─────────────────────────────────────────── -->
  <section class="prose max-w-none">
    <h2>Shareable URL contract</h2>
    <p>
      Every calculator and plot view is fully described by its query string, so a URL can be copied,
      bookmarked, and shared to reproduce the exact state. The query string follows a formal
      <abbr title="Augmented Backus–Naur Form (RFC 5234)">ABNF</abbr>-style grammar, implemented as
      a
      <a href="https://peggyjs.org/" target="_blank" rel="noreferrer" class="underline">Peggy</a>
      parser that produces an abstract syntax tree. The current schema is <strong>v3</strong>
      (<code>urlv=3</code>), which joins list values with <code>~</code> instead of <code>,</code>
      so messenger and email auto-linkifiers don't truncate a shared link at the first comma. Older
      <code>urlv=2</code> links (comma-separated) still load and are rewritten to the
      <code>~</code> form; links using the retired v1 format are no longer parsed and instead show an
      "unsupported link" notice with a one-click "load defaults" action.
    </p>

    <h3>Grammar (v3, abridged)</h3>
    <pre class="overflow-x-auto rounded-lg border bg-muted p-4 text-sm"><code>{grammar}</code></pre>

    <h3>How a URL is processed</h3>
    <ol>
      <li>
        <strong>Tokenize</strong> (<code>parseQuery</code>): split on raw <code>&amp;</code>/<code
          >=</code
        >, percent-decode each component, and build the AST. Pure syntax — no defaults or
        validation.
      </li>
      <li>
        <strong>Resolve</strong> (<code>resolveCalculatorState</code> /
        <code>resolvePlotState</code>): duplicate keys resolve last-wins; defaults are applied;
        advanced-only params are ignored in basic mode; values are validated.
      </li>
      <li>
        <strong>Canonicalize</strong>: the URL is rewritten into a deterministic, ordered form so
        the same logical state always yields the same URL.
      </li>
    </ol>

    <h3>Error reporting</h3>
    <p>
      Each AST node carries the exact character span it came from, so when a link is malformed or a
      value is invalid the app can point at the precise spot. Problems are reported as diagnostics
      with a severity, a message, and a caret underline of the offending text, for example:
    </p>
    <pre class="overflow-x-auto rounded-lg border bg-muted p-4 text-sm"><code
        >…energies=100~200:foo
                 ^^^
Expected an energy unit such as keV, MeV, or MeV/u.</code
      ></pre>
    <p>
      Fatal errors (an unreadable link) block the calculation and offer "load defaults"; warnings
      (e.g. an out-of-range value) drop just the offending part and continue; unknown parameters are
      dropped silently.
    </p>

    <p class="text-sm text-muted-foreground">
      Normative definition (full grammar, semantic rules, conformance vectors):
      <a
        href="https://github.com/APTG/dedx_web/blob/master/docs/04-feature-specs/shareable-urls-formal.md"
        target="_blank"
        rel="noreferrer"
        class="underline hover:no-underline">shareable-urls-formal.md</a
      >.
    </p>
  </section>
</div>
