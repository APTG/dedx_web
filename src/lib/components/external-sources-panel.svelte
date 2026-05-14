<script lang="ts">
  /**
   * Collapsible "External Data Sources" attribution panel.
   * See docs/04-feature-specs/external-data.md §7.3.
   *
   * Replaces the original simple inline badge with a richer disclosure that
   * surfaces metadata.name, version, author, license, description, coverage
   * counts and the source URL — collapsed by default and expandable per
   * source. Renders nothing when no external sources are loaded.
   */
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import { externalDataService } from "$lib/external-data/service";

  interface Props {
    sources: ExternalSourceDescriptor[];
  }

  const { sources }: Props = $props();

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "…";
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

      <ul class="mt-2 space-y-3">
        {#each sources as src (src.label)}
          {@const meta = externalDataService.getMetadata(src.label)}
          <li class="rounded border bg-background px-3 py-2">
            <div class="flex flex-wrap items-baseline gap-2">
              <span class="font-mono font-semibold">{src.label}</span>
              {#if meta}
                <span>— {meta.name}</span>
                {#if meta.version}
                  <span class="text-muted-foreground">v{meta.version}</span>
                {/if}
              {/if}
            </div>
            {#if meta}
              <dl
                class="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-muted-foreground"
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
                    .materials.length}
                  materials
                </dd>
                <dt class="font-medium">URL</dt>
                <dd>
                  <a
                    class="break-all text-primary underline"
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer">{src.url}</a
                  >
                </dd>
              </dl>
            {/if}
          </li>
        {/each}
      </ul>
    </details>
  </section>
{/if}
