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
        {#each [["calculator", "Calculator"], ["choosing-a-program", "Programs"], ["quantities", "Quantities & units"], ["plot", "Plot"], ["advanced-options", "Advanced mode"], ["inverse-lookups", "Inverse lookups"], ["custom-compounds", "Custom compounds"], ["tips", "Tips"], ["sharing", "Shareable links"], ["external-data", "External data"], ["keyboard", "Keyboard"]] as [id, label] (id)}
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

  <!-- 1b. CHOOSING A PROGRAM --------------------------------------------- -->
  <section id="choosing-a-program" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Choosing a program (data source)</h2>
    <p class="text-muted-foreground">
      The <strong class="text-foreground">program</strong> is the
      <strong class="text-foreground">source of the numbers</strong> — the same particle in the same
      material gives slightly different stopping power and range depending on which dataset or model
      you pick. That is why the picker calls it a "data source". Leave it on
      <strong class="text-foreground">Auto-select</strong> to let webdedx choose a compatible one, or
      pick explicitly. Programs that have no data for the current particle/material are greyed out.
    </p>
    <p class="text-muted-foreground">Programs come in three kinds, shown as a small badge:</p>
    <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
      <li>
        <strong class="text-foreground">▦ DATA (tabulated)</strong> — values interpolated from
        published tables: <strong class="text-foreground">PSTAR</strong> (protons, NIST/ICRU 49),
        <strong class="text-foreground">ASTAR</strong> (alpha particles),
        <strong class="text-foreground">ESTAR</strong> (electrons),
        <strong class="text-foreground">ICRU 73</strong> and
        <strong class="text-foreground">MSTAR</strong> (heavier ions).
      </li>
      <li>
        <strong class="text-foreground">∫ FN (analytical)</strong> — computed from a formula (<strong
          class="text-foreground">Bethe</strong
        >). Use when no tabulated data exists for your case.
      </li>
      <li>
        <strong class="text-foreground">🔗 EXT (external)</strong> — loaded from a
        <code>.webdedx</code> file you supply (see External data below).
      </li>
    </ul>
    <p class="text-muted-foreground">
      Rule of thumb: prefer the tabulated program validated for your particle and energy range, and
      fall back to the analytical Bethe model only when nothing tabulated covers it.
    </p>
  </section>

  <!-- 1c. QUANTITIES & UNITS --------------------------------------------- -->
  <section id="quantities" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Quantities &amp; units</h2>
    <p class="text-muted-foreground">
      Every result is one of two quantities. Both are reported side by side — range is a distinct
      physical quantity, not an afterthought.
    </p>
    <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
      <li>
        <strong class="text-foreground">Stopping power</strong> — the rate of energy loss per unit
        path length. It is the sum of an <strong class="text-foreground">electronic</strong>
        component (collisions with atomic electrons, dominant at most energies) and a
        <strong class="text-foreground">nuclear</strong> component (elastic collisions with nuclei, dominant
        only at very low energy).
      </li>
      <li>
        <strong class="text-foreground">CSDA range</strong> — the
        Continuous-Slowing-Down-Approximation range: the total path length a particle travels before
        coming to rest, obtained by integrating 1 / stopping power over energy. The
        <strong class="text-foreground">Bragg peak</strong> — the sharp dose maximum at the end of the
        track — sits just before the CSDA range.
      </li>
    </ul>

    <div id="units" class="scroll-mt-24 space-y-3">
      <h3 class="font-semibold">Units</h3>
      <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          <strong class="text-foreground">Stopping power.</strong>
          <strong class="text-foreground">MeV·cm²/g</strong> is the
          <em>mass</em> stopping power (stopping power ÷ density) — geometry-independent, so values
          are comparable across materials. <strong class="text-foreground">keV/µm</strong> and
          <strong class="text-foreground">MeV/cm</strong> are <em>linear</em> units (energy lost per unit
          length) and need the material density to convert.
        </li>
        <li>
          <strong class="text-foreground">CSDA range.</strong>
          <strong class="text-foreground">g/cm²</strong> is the geometry-independent
          <em>mass</em> range; <strong class="text-foreground">cm</strong> is the physical depth,
          obtained by dividing by the density (R<sub>cm</sub> = R<sub>g/cm²</sub> / ρ).
        </li>
        <li>
          <strong class="text-foreground">Energy.</strong> For ions, energy is normalised by mass:
          <strong class="text-foreground">MeV/nucl</strong> divides by the integer mass number A,
          while
          <strong class="text-foreground">MeV/u</strong> divides by the actual atomic mass in
          unified mass units — the two differ by ~0.8% for a proton but are equal for carbon-12.
          Electrons (ESTAR) use plain <strong class="text-foreground">MeV</strong>, since
          per-nucleon energy is undefined for leptons.
        </li>
      </ul>
    </div>
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

  <!-- 2b. ADVANCED MODE -------------------------------------------------- -->
  <section id="advanced-options" class="scroll-mt-24 space-y-4">
    <h2 class="text-2xl font-semibold">Advanced mode</h2>
    <p class="text-muted-foreground">
      The <strong class="text-foreground">Basic / Advanced</strong> switch in the top bar controls
      how much of the app is shown. <strong class="text-foreground">Basic</strong> keeps the
      essentials — one program, an energy table, and export.
      <strong class="text-foreground">Advanced</strong> unlocks multi-program comparison, the inverse
      lookups described below, custom compounds, MSTAR modes, and density / I-value overrides. The choice
      is remembered and travels in shared links.
    </p>

    <h3 class="font-semibold">Overrides &amp; options</h3>
    <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
      <li>
        <strong class="text-foreground">Aggregate state (Gas / Condensed).</strong> The same
        substance has a different <em>mean excitation energy (I-value)</em> as a gas versus condensed
        matter, which shifts stopping power by a few percent at intermediate energies. It also sets the
        default stopping-power unit (gas → MeV·cm²/g, condensed → keV/µm).
      </li>
      <li>
        <strong class="text-foreground">Density override (g/cm³).</strong> Affects only the conversion
        between mass units (MeV·cm²/g, g/cm²) and linear units (keV/µm, MeV/cm, cm) — the underlying mass
        stopping power is unchanged. Useful for gases at non-standard pressure/temperature or for powders
        and pressed pellets.
      </li>
      <li>
        <strong class="text-foreground">I-value override (eV).</strong> The mean excitation energy appears
        in the Bethe formula; a higher I-value gives a lower electronic stopping power. Leave blank to
        use the tabulated material constant, or enter a measured value for your sample.
      </li>
      <li>
        <strong class="text-foreground">Interpolation.</strong> Controls how values between
        tabulated points are computed: the axis scale (<strong class="text-foreground"
          >log-log</strong
        >
        vs
        <strong class="text-foreground">lin-lin</strong>) and the method (<strong
          class="text-foreground">linear</strong
        >
        vs <strong class="text-foreground">spline</strong>). The setting applies to every data
        source; mixing settings across compared series is not supported.
      </li>
    </ul>

    <h3 class="font-semibold">MSTAR modes (heavy ions)</h3>
    <p class="text-muted-foreground">
      When <strong class="text-foreground">MSTAR</strong> is the active program, a mode selector
      chooses its calculation variant. <strong class="text-foreground">B</strong> (auto special) is the
      recommended default.
    </p>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b">
            <th class="py-2 pr-4 text-left font-semibold">Mode</th>
            <th class="py-2 text-left font-semibold">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {#each [["A", "Auto base: C for condensed targets, G for gaseous"], ["B", "Auto special: D for condensed, H for gaseous (default)"], ["C", "Condensed standard"], ["D", "Condensed special (downgrades to C for target Z ≤ 3)"], ["G", "Gas standard"], ["H", "Gas special (projectile Z = 3–11 and 16–18; downgrades to G otherwise)"]] as [mode, meaning] (mode)}
            <tr class="border-b border-muted/30">
              <td class="whitespace-nowrap py-2 pr-4 font-mono">{mode}</td>
              <td class="py-2 text-muted-foreground">{meaning}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- INVERSE LOOKUPS --------------------------------------------------- -->
    <div id="inverse-lookups" class="scroll-mt-24 space-y-3 pt-2">
      <h3 class="font-semibold">Inverse lookups</h3>
      <p class="text-muted-foreground">
        The forward table goes energy → stopping power and range. Advanced mode adds two reverse
        tabs that solve for the energy instead:
      </p>
      <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          <strong class="text-foreground">Range →.</strong> Enter a target CSDA range; the app returns
          the energy that produces it, plus the stopping power at that energy. The mapping from range
          to energy is one-to-one.
        </li>
        <li>
          <strong class="text-foreground">STP →.</strong> Enter a target stopping power; the app
          returns the energy. Because stopping power rises to a maximum at the
          <strong class="text-foreground">Bragg peak</strong> and falls off on either side,
          <em>two</em> energies can give the same value — a low-energy and a high-energy branch — so both
          are shown. A target above the Bragg-peak maximum has no solution.
        </li>
      </ul>
    </div>

    <!-- CUSTOM COMPOUNDS -------------------------------------------------- -->
    <div id="custom-compounds" class="scroll-mt-24 space-y-3 pt-2">
      <h3 class="font-semibold">Custom compounds</h3>
      <p class="text-muted-foreground">
        Define your own material from its elemental composition and density. Stopping powers are
        then computed from the elements using the <strong class="text-foreground"
          >Bragg additivity rule</strong
        >
        (a weight-fraction-weighted sum of the elemental mass stopping powers).
      </p>
      <ul class="ml-1 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          <strong class="text-foreground">Composition.</strong> Enter it either as
          <strong class="text-foreground">atom counts</strong> per formula unit (Formula mode) or as
          <strong class="text-foreground">weight fractions</strong> in % (Weight fraction mode). The two
          views are kept in sync; weight fractions must total 100%.
        </li>
        <li>
          <strong class="text-foreground">Phase.</strong> Gas or condensed — the same aggregate-state
          choice as above, used for I-value selection and the default display unit.
        </li>
        <li>
          <strong class="text-foreground">I-value (optional).</strong> Leave it blank to derive an effective
          value from the elements via Bragg additivity, or enter a measured mean excitation energy in
          eV.
        </li>
      </ul>
    </div>
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
        >urlv=3</code
      >
      syntax. Lists of values (energy rows, compared programs, plot series) are joined with
      <code class="rounded bg-muted px-1 py-0.5 text-sm">~</code> so messenger and email auto-linkifiers
      do not truncate a shared link at a comma. Older links that used commas still open correctly.
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
