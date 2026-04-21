<script lang="ts">
  import { wasmReady } from '$lib/state/ui.svelte';
</script>

<svelte:head>
  <title>User Guide - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">User Guide</h1>

  <div class="prose max-w-none">
    <p class="text-muted-foreground">
      The user guide is under construction. It will cover:
    </p>
    <ul class="mt-4 list-disc pl-6 space-y-2 text-muted-foreground">
      <li>Getting started with stopping power calculations</li>
      <li>Choosing particles, materials, and programs</li>
      <li>Understanding energy units (MeV, MeV/nucl, MeV/u)</li>
      <li>Creating and comparing plots</li>
      <li>Exporting data to CSV and PDF</li>
      <li>Using advanced options (density override, MSTAR modes)</li>
      <li>Loading external .webdedx data files</li>
    </ul>
  </div>
</div>
