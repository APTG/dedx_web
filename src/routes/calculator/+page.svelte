<script lang="ts">
  import { wasmReady } from '$lib/state/ui.svelte';
</script>

<svelte:head>
  <title>Calculator - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Calculator</h1>
  <p class="text-muted-foreground">
    Select a particle, material, and program to calculate stopping powers and CSDA ranges.
  </p>

  {#if !wasmReady.value}
    <div class="rounded-lg border bg-card p-6 text-center">
      <p class="text-muted-foreground">Loading WASM module...</p>
    </div>
  {:else}
    <div class="rounded-lg border bg-card p-6">
      <p class="text-muted-foreground">Calculator form coming soon...</p>
      <p class="mt-2 text-sm">
        This is a placeholder. The Calculator page will be implemented in Stage 6 per
        <a href="/docs" class="underline hover:no-underline">feature specs</a>.
      </p>
    </div>
  {/if}
</div>
