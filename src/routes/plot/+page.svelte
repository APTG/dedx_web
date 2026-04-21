<script lang="ts">
  import { wasmReady } from '$lib/state/ui.svelte';
</script>

<svelte:head>
  <title>Plot - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Plot</h1>
  <p class="text-muted-foreground">
    Visualize stopping power curves with JSROOT. Add multiple series for comparison.
  </p>

  {#if !wasmReady.value}
    <div class="rounded-lg border bg-card p-6 text-center">
      <p class="text-muted-foreground">Loading WASM module...</p>
    </div>
  {:else}
    <div class="rounded-lg border bg-card p-6">
      <p class="text-muted-foreground">Plot page coming soon...</p>
      <p class="mt-2 text-sm">
        This is a placeholder. The Plot page will be implemented in Stage 6 per
        <a href="/docs" class="underline hover:no-underline">feature specs</a>.
      </p>
    </div>
  {/if}
</div>
