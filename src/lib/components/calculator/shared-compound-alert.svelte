<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import type { StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";

  let {
    sharedUrlCompound = null,
    sharedUrlWarning = null,
    fromTransient = false,
    canEdit = false,
    onSaveToLibrary,
    onEditAndSaveCopy,
    onDismiss,
  }: {
    sharedUrlCompound: StoredCompoundInternal | null;
    sharedUrlWarning: string | null;
    /** Sender shared an unsaved (transient) compound — changes the banner copy. */
    fromTransient?: boolean;
    /** Whether an editable draft exists (valid transient or recoverable partial). */
    canEdit?: boolean;
    onSaveToLibrary: () => void;
    onEditAndSaveCopy: () => void;
    onDismiss: () => void;
  } = $props();
</script>

{#if sharedUrlCompound || sharedUrlWarning}
  <div
    class="flex flex-wrap items-center justify-between gap-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900"
    data-testid="compound-from-url-banner"
  >
    <span role="status" aria-live="polite">
      {#if sharedUrlCompound}
        {#if fromTransient}
          Loaded an unsaved custom compound “{sharedUrlCompound.name}” from a shared URL.
        {:else}
          Loaded custom compound “{sharedUrlCompound.name}” from shared URL.
        {/if}
      {:else}
        Custom compound URL parameters could not be restored: {sharedUrlWarning}
      {/if}
    </span>
    <div class="flex items-center gap-2">
      {#if sharedUrlCompound}
        <Button
          size="sm"
          variant="outline"
          onclick={onSaveToLibrary}
          data-testid="compound-url-save">Save to library</Button
        >
      {/if}
      {#if canEdit}
        <Button
          size="sm"
          variant="outline"
          onclick={onEditAndSaveCopy}
          data-testid="compound-url-edit-copy">Edit &amp; save copy</Button
        >
      {/if}
      <Button size="sm" variant="ghost" onclick={onDismiss} data-testid="compound-url-dismiss"
        >Dismiss</Button
      >
    </div>
  </div>
{/if}
