<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { getService } from "$lib/wasm/loader";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { Button } from "$lib/components/ui/button";
  import { canExport, exportCsv, exportPdf } from "$lib/state/export.svelte";

  let { children } = $props();
  let pathname = $derived(page.url.pathname);
  let routePath = $derived(
    pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname,
  );

  let copied = $state(false);
  let copyError = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleResetFeedback() {
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied = false;
      copyError = false;
      copyTimeout = null;
    }, 2000);
  }

  async function shareUrl() {
    if (typeof navigator === "undefined") return;
    const url = window.location.href;
    try {
      if (!navigator.clipboard?.writeText) {
        // Insecure context / older browser — surface a non-fatal error so the
        // user knows the click registered but the URL was not copied.
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      copied = true;
      copyError = false;
    } catch {
      copied = false;
      copyError = true;
    } finally {
      scheduleResetFeedback();
    }
  }

  $effect(() => {
    getService()
      .then(() => {
        wasmReady.value = true;
      })
      .catch((e) => {
        wasmError.value = e;
      });

    return () => {
      if (copyTimeout) {
        clearTimeout(copyTimeout);
        copyTimeout = null;
      }
    };
  });
</script>

<div class="min-h-screen bg-background">
  <nav class="border-b bg-card">
    <div class="container mx-auto px-4">
      <div class="flex h-14 items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0">
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
        <div class="flex items-center gap-2 shrink-0">
          <div class="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={routePath !== "/calculator" || !canExport.value}
              aria-label="Export PDF"
              onclick={() => {
                if (routePath === "/calculator") exportPdf();
              }}
            >
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={routePath !== "/calculator" || !canExport.value}
              aria-label="Export CSV"
              onclick={() => {
                if (routePath === "/calculator") exportCsv();
              }}
            >
              Export CSV
            </Button>
          </div>
          <Button variant="outline" size="sm" onclick={shareUrl}>
            {#if copied}
              <span aria-live="polite">Copied!</span>
            {:else if copyError}
              <span aria-live="polite">Copy failed</span>
            {:else}
              Share URL
            {/if}
          </Button>
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
