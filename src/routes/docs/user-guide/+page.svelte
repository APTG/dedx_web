<script lang="ts">
  import { base } from "$app/paths";

  // Build example URLs relative to the current SvelteKit base path so the
  // links stay correct in every deployment (localhost dev, GitHub Pages
  // /web_dev, future hosts) — see review feedback on PR #476.
  const extdataQuery =
    "urlv=1&extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F";
  const calculatorExampleHref = `${base}/calculator?${extdataQuery}&particle=1&material=276&program=7&energies=100&eunit=MeV`;
  const plotExampleHref = `${base}/plot?${extdataQuery}&particle=1&material=276&program=7`;
</script>

<svelte:head>
  <title>User Guide - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">User Guide</h1>

  <div class="prose max-w-none">
    <p class="text-muted-foreground">The user guide is under construction. It will cover:</p>
    <ul class="mt-4 list-disc pl-6 space-y-2 text-muted-foreground">
      <li>Getting started with stopping power calculations</li>
      <li>Choosing particles, materials, and programs</li>
      <li>Understanding energy units (MeV, MeV/nucl, MeV/u)</li>
      <li>Creating and comparing plots</li>
      <li>Exporting data to CSV and PDF</li>
      <li>Using advanced options (density override, MSTAR modes)</li>
      <li>Loading external .webdedx data files</li>
    </ul>

    <section class="mt-8 space-y-4">
      <h2 class="text-2xl font-semibold">Loading external datasets</h2>
      <p class="text-muted-foreground">
        External stopping-power tables can be loaded by opening Calculator or Plot with an
        <code>extdata</code> query parameter. The format is
        <code>extdata=&lt;label&gt;:&lt;encoded dataset URL&gt;</code>, where the dataset URL points
        to the root of a hosted <code>.webdedx</code> directory.
      </p>
      <p class="text-muted-foreground">
        After loading, the source appears in a collapsible <strong>External Data Sources</strong>
        panel below the entity selectors. Programs from the loaded source are listed in the
        <strong>Program</strong>
        selector under an <strong>External</strong> group with a 🔗 prefix and an <code>(ext)</code>
        suffix. External-only particles and materials (those that don't merge with a built-in libdedx
        entry) appear in <strong>External</strong> groups in their respective selectors.
      </p>

      <h3 class="mt-4 text-xl font-semibold">Calculator example</h3>
      <p class="text-muted-foreground">
        Open Calculator with the public SRIM GUI reference dataset, proton in liquid water, ICRU 49,
        and a single 100 MeV row:
      </p>
      <p>
        <a class="break-all text-primary underline" href={calculatorExampleHref}
          >{calculatorExampleHref}</a
        >
      </p>

      <h3 class="mt-4 text-xl font-semibold">Plot example</h3>
      <p class="text-muted-foreground">
        Open Plot with the same SRIM dataset, proton in liquid water, and ICRU 49 as the built-in
        program:
      </p>
      <p>
        <a class="break-all text-primary underline" href={plotExampleHref}>{plotExampleHref}</a>
      </p>
    </section>
  </div>
</div>
