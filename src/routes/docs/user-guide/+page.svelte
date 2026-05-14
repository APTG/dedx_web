<script lang="ts">
  const srimExampleUrl =
    "https://aptg.github.io/web_dev/calculator?urlv=1&extdata=srim:https%3A%2F%2Fs3.cloud.cyfronet.pl%2Fdedxweb%2Fsrim-gui.webdedx%2F&particle=1&material=276&program=7&energies=100&eunit=MeV";
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
        Example: load the public SRIM GUI reference dataset, select proton in water, keep the
        built-in ICRU 49 program selected, and enter 100 MeV:
      </p>
      <p>
        <a class="break-all text-primary underline" href={srimExampleUrl}>{srimExampleUrl}</a>
      </p>
      <p class="text-muted-foreground">
        After the page loads, the external source appears below the selectors and its compatible
        programs, particles, and materials are available in the selector menus under
        <strong>External</strong>.
      </p>
    </section>
  </div>
</div>
