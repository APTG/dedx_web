<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { getService } from "$lib/wasm/loader";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";

  let { children } = $props();
  let pathname = $derived($page.url.pathname);
  let routePath = $derived(
    pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname,
  );

  $effect(() => {
    getService()
      .then(() => {
        wasmReady.value = true;
      })
      .catch((e) => {
        wasmError.value = e;
      });
  });
</script>

<div class="min-h-screen bg-background">
  <nav class="border-b bg-card">
    <div class="container mx-auto px-4">
      <div class="flex h-14 items-center justify-between">
        <div class="flex items-center gap-6">
          <a href={`${base}/`} class="flex items-center gap-2 font-bold text-xl">
            <img src={`${base}/favicon.svg`} alt="" class="h-6 w-6" />
            webdedx
          </a>
          <div class="flex items-center gap-4 text-sm">
            <a
              href={`${base}/calculator`}
              class="transition-colors hover:text-foreground/80"
              class:text-foreground={routePath === "/calculator"}
              class:text-muted-foreground={routePath !== "/calculator"}
            >
              Calculator
            </a>
            <a
              href={`${base}/plot`}
              class="transition-colors hover:text-foreground/80"
              class:text-foreground={routePath === "/plot"}
              class:text-muted-foreground={routePath !== "/plot"}
            >
              Plot
            </a>
            <a
              href={`${base}/docs`}
              class="transition-colors hover:text-foreground/80"
              class:text-foreground={routePath.startsWith("/docs")}
              class:text-muted-foreground={!routePath.startsWith("/docs")}
            >
              Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  </nav>

  {#if wasmError.value}
    <div class="bg-destructive/15 border-b border-destructive/20 px-4 py-3">
      <div class="container mx-auto">
        <p class="text-destructive text-sm">
          <strong>WASM load error:</strong>
          {wasmError.value.message}
          <button
            onclick={() => window.location.reload()}
            class="ml-2 underline hover:no-underline"
          >
            Reload
          </button>
        </p>
      </div>
    </div>
  {:else if !wasmReady.value}
    <div class="bg-muted border-b px-4 py-3">
      <div class="container mx-auto">
        <p class="text-muted-foreground text-sm">Loading WASM module...</p>
      </div>
    </div>
  {/if}

  <main class="container mx-auto px-4 py-6">
    {@render children()}
  </main>

  <footer class="border-t bg-card mt-auto">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <p>webdedx — Stopping power calculations</p>
        <p>Built with Svelte 5 + WASM</p>
      </div>
    </div>
  </footer>
</div>
