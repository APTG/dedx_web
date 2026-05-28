<script lang="ts">
  import { wasmError } from "$lib/state/ui.svelte";
  import { Button } from "$lib/components/ui/button";
  import { goto } from "$app/navigation";

  let {
    externalError,
    fallbackUrl,
  }: {
    externalError?: Error | null;
    fallbackUrl: string;
  } = $props();
</script>

{#if wasmError.value}
  <div
    class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
  >
    <p class="font-semibold text-destructive">Failed to load the calculation engine.</p>
    <p class="text-sm text-muted-foreground">
      Please try refreshing the page or use a different browser.
    </p>
    <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>Retry</Button>
    <details class="text-left text-xs text-muted-foreground mt-2">
      <summary class="cursor-pointer">Show details</summary>
      <pre class="mt-1 whitespace-pre-wrap">{wasmError.value.message}</pre>
    </details>
  </div>
{:else if externalError}
  <div
    class="mx-auto max-w-md rounded-lg border border-destructive bg-destructive/10 p-8 text-center space-y-4"
  >
    <p class="font-semibold text-destructive">Failed to load external data source.</p>
    <p class="text-sm text-muted-foreground">{externalError.message}</p>
    <div class="flex justify-center gap-2">
      <Button variant="destructive" size="sm" onclick={() => window.location.reload()}>
        Retry
      </Button>
      <Button variant="outline" size="sm" onclick={() => goto(fallbackUrl, { replaceState: true })}>
        Load without external data
      </Button>
    </div>
  </div>
{/if}
