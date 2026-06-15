<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/state";
  import {
    buildAdvancedCalculatorExampleUrl,
    buildBasicCalculatorExampleUrl,
    buildSrimCalculatorExampleUrl,
    buildSrimPlotExampleUrl,
  } from "$lib/utils/external-data-example-urls";

  const basicCalculatorExampleHref = $derived(buildBasicCalculatorExampleUrl(page.url.origin));
  const advancedCalculatorExampleHref = $derived(
    buildAdvancedCalculatorExampleUrl(page.url.origin),
  );
  const calculatorExampleHref = $derived(buildSrimCalculatorExampleUrl(page.url.origin));
  const plotExampleHref = $derived(buildSrimPlotExampleUrl(page.url.origin));
</script>

<svelte:head>
  <title>User Guide - webdedx</title>
  <meta
    name="description"
    content="How to use webdedx to calculate particle stopping power (dE/dx) and range, plot curves, and share results — runs entirely in your browser."
  />
</svelte:head>

<article class="mx-auto max-w-3xl space-y-10">
  <header class="space-y-3">
    <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">User Guide</h1>
    <p class="text-base leading-relaxed text-muted-foreground sm:text-lg">
      <strong class="text-foreground">webdedx</strong> calculates the
      <strong class="text-foreground">stopping power</strong> (dE/dx) and
      <strong class="text-foreground">range</strong> of charged particles in matter. There is nothing
      to install — every calculation runs locally in your browser, and the page works on both phones and
      desktops.
    </p>
    <p class="text-sm text-muted-foreground">Two-minute tour below. Jump to a section:</p>
    <nav aria-label="On this page">
      <ul class="flex flex-wrap gap-2 text-sm">
        {#each [["calculator", "Calculator"], ["plot", "Plot"], ["tips", "Tips"], ["sharing", "Shareable links"], ["external-data", "External data"], ["keyboard", "Keyboard"]] as [id, label] (id)}
          <li>
            <a
              href={`#${id}`}
              class="inline-block rounded-full border bg-card px-3 py-1 transition-colors hover:bg-muted"
            >
              {label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </header>

  <!-- 1. CALCULATOR ------------------------------------------------------ -->
  <section id="calculator" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">1. Calculate stopping power &amp; range</h2>
    <p class="text-muted-foreground">
      Open the <strong class="text-foreground">Calculator</strong> tab to get the stopping power and CSDA
      range for a particle in a material, at one energy or a list of energies.
    </p>

    <figure class="space-y-2">
      <picture>
        <source media="(max-width: 640px)" srcset={`${base}/screenshots/calculator-mobile.png`} />
        <img
          src={`${base}/screenshots/calculator-desktop.png`}
          alt="The Calculator page: a proton in liquid water at 100 MeV showing a stopping power of 0.7286 keV/µm and a CSDA range of 7.721 cm."
          loading="lazy"
          class="w-full rounded-lg border shadow-sm"
        />
      </picture>
      <figcaption class="text-center text-xs text-muted-foreground">
        Calculator — proton in liquid water at 100&nbsp;MeV.
      </figcaption>
    </figure>

    <ol class="ml-1 space-y-3">
      {#each [["Pick a particle, material, and program.", "Choose e.g. proton, Water (liquid), and a program. Leaving the program on Auto lets webdedx pick a compatible one (here, ICRU 49)."], ["Enter an energy.", "Type a value into the Energy field — results update instantly. A 100 MeV proton in liquid water gives 0.7286 keV/µm and a 7.721 cm range."], ["Add more rows.", "Use + Add row to compare several energies side by side."], ["Go Advanced when you need more.", "The Basic / Advanced switch (top right) unlocks density and I-value overrides, inverse lookups (find the energy for a given range or stopping power), and multi-entity comparisons."], ["Export or share.", "Export PDF / CSV, or use Share URL — the entire app state lives in the link, so it reproduces exactly what you see."]] as [title, body], i (title)}
        <li class="flex gap-3">
          <span
            class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <span class="text-muted-foreground">
            <strong class="text-foreground">{title}</strong>
            {body}
          </span>
        </li>
      {/each}
    </ol>
  </section>

  <!-- 2. PLOT ------------------------------------------------------------ -->
  <section id="plot" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">2. Plot curves</h2>
    <p class="text-muted-foreground">
      The <strong class="text-foreground">Plot</strong> tab draws stopping power (or range) versus energy
      as an interactive curve, so you can see the whole picture at a glance.
    </p>

    <figure class="space-y-2">
      <picture>
        <source media="(max-width: 640px)" srcset={`${base}/screenshots/plot-mobile.png`} />
        <img
          src={`${base}/screenshots/plot-desktop.png`}
          alt="The Plot page showing the stopping-power curve of a proton in liquid water on log-log axes."
          loading="lazy"
          class="w-full rounded-lg border shadow-sm"
        />
      </picture>
      <figcaption class="text-center text-xs text-muted-foreground">
        Plot — stopping power of a proton in liquid water across the full energy range.
      </figcaption>
    </figure>

    <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
      <li>Choose the particle and material just like in the calculator.</li>
      <li>
        Switch the <strong class="text-foreground">Y unit</strong> (keV/µm, MeV/cm, MeV·cm²/g) and
        toggle <strong class="text-foreground">log / linear</strong> axes with the buttons above the chart.
      </li>
      <li>
        Use <strong class="text-foreground">+ Add Series</strong> to overlay several particles or materials
        for comparison.
      </li>
      <li>
        Export the chart as an image with <strong class="text-foreground">Export image</strong>.
      </li>
    </ul>
  </section>

  <!-- 3. TIPS ------------------------------------------------------------ -->
  <section id="tips" class="scroll-mt-24 space-y-3">
    <h2 class="text-2xl font-semibold">Good to know</h2>
    <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
      <li>
        <strong class="text-foreground">Everything is in the URL.</strong> Bookmark or send a link and
        it restores the particle, material, program, energies, units, and advanced options.
      </li>
      <li>
        <strong class="text-foreground">Units convert on the fly.</strong> Change stopping-power or energy
        units from the column headers / axis toggles — the underlying calculation does not re-run.
      </li>
      <li>
        <strong class="text-foreground">Works offline.</strong> Once the page has loaded, calculations
        run entirely in your browser.
      </li>
    </ul>
  </section>

  <!-- SHAREABLE LINKS ---------------------------------------------------- -->
  <section id="sharing" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Shareable link examples</h2>
    <p class="text-muted-foreground">
      The app stores calculator and plot state in the URL so you can bookmark or share exact
      scenarios. These examples use the current <code class="rounded bg-muted px-1 py-0.5 text-sm"
        >urlv=2</code
      > syntax.
    </p>

    <div class="space-y-2">
      <h3 class="font-semibold">Basic calculator</h3>
      <p class="text-sm text-muted-foreground">
        Proton, liquid water, ICRU 49, and a single 100&nbsp;MeV row:
      </p>
      <a class="block break-all text-sm text-primary underline" href={basicCalculatorExampleHref}>
        {basicCalculatorExampleHref}
      </a>
    </div>

    <div class="space-y-2">
      <h3 class="font-semibold">Advanced calculator</h3>
      <p class="text-sm text-muted-foreground">Carbon-12 in liquid water with three energy rows:</p>
      <a
        class="block break-all text-sm text-primary underline"
        href={advancedCalculatorExampleHref}
      >
        {advancedCalculatorExampleHref}
      </a>
    </div>
  </section>

  <!-- EXTERNAL DATA ------------------------------------------------------ -->
  <section id="external-data" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Loading your own datasets</h2>
    <p class="text-muted-foreground">
      External stopping-power tables can be loaded by opening Calculator or Plot with an
      <code class="rounded bg-muted px-1 py-0.5 text-sm">extdata</code> query parameter, in the form
      <code class="rounded bg-muted px-1 py-0.5 text-sm"
        >extdata=&lt;label&gt;:&lt;encoded dataset URL&gt;</code
      >, where the URL points to the root of a hosted
      <code class="rounded bg-muted px-1 py-0.5 text-sm">.webdedx</code> directory.
    </p>
    <p class="text-muted-foreground">
      After loading, the source appears in a collapsible <strong class="text-foreground"
        >External Data Sources</strong
      >
      panel below the entity selectors. Its programs show up in the
      <strong class="text-foreground">Program</strong>
      selector under an <strong class="text-foreground">External</strong> group (🔗 prefix,
      <code class="rounded bg-muted px-1 py-0.5 text-sm">(ext)</code> suffix); external-only
      particles and materials appear in their own <strong class="text-foreground">External</strong> groups.
    </p>

    <div class="space-y-2">
      <h3 class="font-semibold">Calculator with the SRIM reference dataset</h3>
      <p class="text-sm text-muted-foreground">
        Proton in liquid water, ICRU 49, single 100&nbsp;MeV row:
      </p>
      <a class="block break-all text-sm text-primary underline" href={calculatorExampleHref}>
        {calculatorExampleHref}
      </a>
    </div>

    <div class="space-y-2">
      <h3 class="font-semibold">Plot with the same dataset</h3>
      <a class="block break-all text-sm text-primary underline" href={plotExampleHref}>
        {plotExampleHref}
      </a>
    </div>
  </section>

  <!-- KEYBOARD ----------------------------------------------------------- -->
  <section id="keyboard" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Keyboard shortcuts</h2>
    <p class="text-muted-foreground">
      The entity picker (Particle / Material / Program) is built for keyboard-first navigation:
    </p>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b">
            <th class="py-2 pr-4 text-left font-semibold">Key</th>
            <th class="py-2 text-left font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each [["/", "Focus the search field (expands the panel if collapsed)"], ["↑ / ↓", "Move the highlight up / down through the list"], ["↵ Enter", "Select the highlighted item; jumps to the next empty field"], ["Escape", "Blur focus and collapse the picker (on the Calculator page)"], ["← / →", "Cycle Particle / Material / Program tabs (when a tab is focused)"]] as [key, action] (key)}
            <tr class="border-b border-muted/30">
              <td class="whitespace-nowrap py-2 pr-4 font-mono">{key}</td>
              <td class="py-2 text-muted-foreground">{action}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-sm text-muted-foreground">
      Tip: press <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">/</code>, type to
      filter, use ↑↓ to highlight, then ↵ to confirm and move to the next field.
    </p>
  </section>
</article>
