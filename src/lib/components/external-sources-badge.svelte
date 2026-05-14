<script lang="ts">
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import { externalDataService } from "$lib/external-data/service";

  interface Props {
    sources: ExternalSourceDescriptor[];
  }

  const { sources }: Props = $props();
</script>

{#if sources.length > 0}
  <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <span class="font-medium">External data:</span>
    {#each sources as src (src.label)}
      {@const meta = externalDataService.getMetadata(src.label)}
      <span
        class="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
        title={meta?.description ?? src.url}
      >
        <span class="font-mono font-semibold">{src.label}</span>
        {#if meta}
          <span class="opacity-70">— {meta.name}{meta.version ? ` v${meta.version}` : ""}</span>
        {/if}
      </span>
    {/each}
  </div>
{/if}
