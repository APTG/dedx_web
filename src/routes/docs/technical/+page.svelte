<script lang="ts">
  // Static reference page. The grammar shown here mirrors the executable PEG
  // grammar in src/lib/utils/url-grammar.peggy; the normative definition lives
  // in docs/04-feature-specs/shareable-urls-formal.md §2.
  const grammar = `query        = [pair *("&" [pair])]

pair         = extdata-pair / energies-pair / lookups-pair / series-pair
             / mat-elements-pair / entity-list-pair / scalar-pair / unknown-pair

; structured, list-bearing params
energies-pair     = "energies=" energy-item *("," energy-item)
energy-item       = number [":" energy-unit-token]
lookups-pair      = ("lookups=" / "ivalues=") lookup-item *("," lookup-item)
series-pair       = "series=" series-item *("," series-item)
series-item       = entity-id "." entity-id "." entity-id   ; program.particle.material
mat-elements-pair = "mat_elements=" mat-element *("," mat-element)
mat-element       = digits ":" number                       ; Z:count
entity-list-pair  = ("programs=" / "particles=" / "materials=") entity-id *("," entity-id)
extdata-pair      = "extdata=" label ":" url                ; split on the first ':'

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
</script>

<svelte:head>
  <title>Technical Reference - webdedx</title>
</svelte:head>

<div class="space-y-8">
  <h1 class="text-3xl font-bold">Technical Reference</h1>

  <!-- ─── Shareable URL grammar ─────────────────────────────────────── -->
  <section class="prose max-w-none">
    <h2>Shareable URL contract</h2>
    <p>
      Every calculator and plot view is fully described by its query string, so a URL can be copied,
      bookmarked, and shared to reproduce the exact state. The query string follows a formal
      <abbr title="Augmented Backus–Naur Form (RFC 5234)">ABNF</abbr>-style grammar, implemented as
      a
      <a href="https://peggyjs.org/" target="_blank" rel="noreferrer" class="underline">Peggy</a>
      parser that produces an abstract syntax tree. The current schema is <strong>v2</strong>
      (<code>urlv=2</code>); links using the retired v1 format are no longer parsed and instead show
      an "unsupported link" notice with a one-click "load defaults" action.
    </p>

    <h3>Grammar (v2, abridged)</h3>
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
        >…energies=100,200:foo
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

  <!-- ─── Remaining sections (still under construction) ─────────────── -->
  <section class="prose max-w-none">
    <h2>Coming soon</h2>
    <ul>
      <li>Architecture overview and component tree</li>
      <li>WASM module build pipeline</li>
      <li>TypeScript API contract</li>
      <li>State management with Svelte 5 runes</li>
      <li>JSROOT integration</li>
      <li>Testing strategy</li>
    </ul>
  </section>
</div>
