<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { customCompounds, type StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
  import { appInit } from "$lib/state/app-init.svelte";

  let {
    sharedUrlCompound = $bindable(null),
    sharedUrlWarning = $bindable(null),
  }: {
    sharedUrlCompound: StoredCompoundInternal | null;
    sharedUrlWarning: string | null;
  } = $props();

  function saveSharedUrlCompound() {
    if (!sharedUrlCompound || !appInit.entityState) return;
    const result = customCompounds.create({
      name: sharedUrlCompound.name,
      density: sharedUrlCompound.density,
      iValue: sharedUrlCompound.iValue,
      elements: sharedUrlCompound.elements,
      phase: sharedUrlCompound.phase,
    });
    if (result.success) {
      customCompounds.removeTransient(sharedUrlCompound.id);
      appInit.entityState.selectMaterial(result.compound.id);
      sharedUrlCompound = null;
    }
  }

  function dismissSharedUrlCompound() {
    sharedUrlCompound = null;
    sharedUrlWarning = null;
  }
</script>

{#if sharedUrlCompound || sharedUrlWarning}
  <div
    class="flex flex-wrap items-center justify-between gap-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900"
    data-testid="compound-from-url-banner"
  >
    <span role="status" aria-live="polite">
      {#if sharedUrlCompound}
        Loaded custom compound “{sharedUrlCompound.name}” from shared URL.
      {:else}
        Custom compound URL parameters could not be restored: {sharedUrlWarning}
      {/if}
    </span>
    <div class="flex items-center gap-2">
      {#if sharedUrlCompound}
        <Button size="sm" variant="outline" onclick={saveSharedUrlCompound}>Save to library</Button>
      {/if}
      <Button size="sm" variant="ghost" onclick={dismissSharedUrlCompound}>Dismiss</Button>
    </div>
  </div>
{/if}
