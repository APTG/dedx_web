<script lang="ts">
  /**
   * Collapsible "External Data Sources" attribution panel with per-source
   * Remove button. See docs/04-feature-specs/external-data.md §7.3 and
   * GitHub issue #510.
   *
   * Renders nothing when no external sources are loaded.
   */
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import { externalDataService } from "$lib/external-data/service";

  interface Props {
    sources: ExternalSourceDescriptor[];
    onRemove?: (label: string) => void;
  }

  const { sources, onRemove }: Props = $props();

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "…";
  }

  function handleRemove(label: string): void {
    externalDataService.evict(label);
    onRemove?.(label);
  }
</script>

{#if sources.length > 0}
  <section
    class="rounded-md border bg-muted/30 px-3 py-2 text-xs"
    aria-label="External Data Sources"
    data-testid="external-sources-panel"
  >
    <details class="group">
      <summary
        class="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground select-none"
        data-testid="external-sources-summary"
      >
        <span class="opacity-70 transition-transform group-open:rotate-90" aria-hidden="true"
          >▶</span
        >
        <span>External Data Sources</span>
        <span class="opacity-70">({sources.length})</span>
      </summary>

      <ul class="mt-2 space-y-2">
        {#each sources as src (src.label)}
          {@const meta = externalDataService.getMetadata(src.label)}
          <li class="rounded border bg-background" data-testid="external-source-item">
            <details class="group/src">
              <summary
                class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 select-none"
                data-testid="external-source-summary-{src.label}"
              >
                <span
                  class="opacity-70 transition-transform group-open/src:rotate-90"
                  aria-hidden="true">▶</span
                >
                <span class="font-mono font-semibold">{src.label}</span>
                {#if meta}
                  <span class="text-muted-foreground">— {meta.name}</span>
                  {#if meta.version}
                    <span class="text-muted-foreground">v{meta.version}</span>
                  {/if}
                {/if}
                <button
                  type="button"
                  class="ml-auto rounded px-1.5 py-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label="Remove {src.label}"
                  data-testid="external-source-remove-{src.label}"
                  onclick={(e) => {
                    e.preventDefault();
                    handleRemove(src.label);
                  }}
                >
                  ×
                </button>
              </summary>

              {#if meta}
                <dl
                  class="mx-3 mb-2 mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-muted-foreground"
                >
                  {#if meta.author}
                    <dt class="font-medium">Author</dt>
                    <dd>{meta.author}</dd>
                  {/if}
                  {#if meta.license}
                    <dt class="font-medium">License</dt>
                    <dd>{meta.license}</dd>
                  {/if}
                  {#if meta.description}
                    <dt class="font-medium">Description</dt>
                    <dd>{truncate(meta.description, 200)}</dd>
                  {/if}
                  <dt class="font-medium">Coverage</dt>
                  <dd>
                    {meta.programs.length} programs, {meta.particles.length} particles, {meta
                      .materials.length} materials
                  </dd>
                  <dt class="font-medium">URL</dt>
                  <dd>
                    {#if src.url}
                      <a
                        class="break-all text-primary underline"
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer">{src.url}</a
                      >
                    {:else}
                      <span>Local directory (not shareable)</span>
                    {/if}
                  </dd>
                </dl>
              {/if}
            </details>
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/if}
