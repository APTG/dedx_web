<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { getService } from "$lib/wasm/loader";
  import { wasmReady, wasmError } from "$lib/state/ui.svelte";
  import { isAdvancedMode, toggleAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { Button } from "$lib/components/ui/button";
  import CsvExportModal from "$lib/components/CsvExportModal.svelte";
  import {
    canExport,
    exportCsv,
    exportPdf,
    exportPlotCsv,
    exportPlotPdf,
    showCsvModal,
    performCsvDownload,
  } from "$lib/state/export.svelte";
  import BuildInfoBadge from "$lib/components/build-info-badge.svelte";

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
  <a href="#main-content" class="skip-link">Skip to content</a>
  <header class="border-b bg-card" data-testid="app-header">
    <div class="container mx-auto px-4">
      <!-- Row 1: logo + secondary controls (mode toggle, export, share) -->
      <div class="flex h-12 items-center justify-between gap-2">
        <a href={`${base}/`} class="flex items-center gap-2 font-bold text-xl shrink-0">
          <img src={`${base}/favicon.svg`} alt="webdedx" class="h-6 w-6" />
          <span class="hidden sm:inline">webdedx</span>
        </a>

        <div class="flex items-center gap-2 shrink-0">
          {#if !routePath.startsWith("/docs")}
            <!-- Export buttons: desktop only, hidden on Docs (not applicable there) -->
            <div class="hidden sm:flex items-center gap-2">
              <Button
                data-testid="export-pdf-btn"
                variant="secondary"
                size="sm"
                disabled={!canExport.value}
                aria-disabled={!canExport.value}
                aria-label="Export PDF"
                onclick={() => {
                  if (routePath === "/calculator") exportPdf();
                  else if (routePath === "/plot") exportPlotPdf();
                }}
              >
                Export PDF
              </Button>
              <Button
                data-testid="export-csv-btn"
                variant="secondary"
                size="sm"
                disabled={!canExport.value}
                aria-disabled={!canExport.value}
                aria-label="Export CSV"
                onclick={() => {
                  if (routePath === "/calculator") {
                    exportCsv();
                  } else if (routePath === "/plot") {
                    exportPlotCsv();
                  }
                }}
              >
                Export CSV
              </Button>
            </div>
          {/if}

          <!-- Share URL: always visible -->
          <Button variant="outline" size="sm" onclick={shareUrl}>
            {#if copied}
              <span aria-live="polite">Copied!</span>
            {:else if copyError}
              <span aria-live="polite">Copy failed</span>
            {:else}
              Share URL
            {/if}
          </Button>

          {#if !routePath.startsWith("/docs")}
            <!-- Basic/Advanced mode toggle chip: hidden on Docs (not applicable there) -->
            <div
              class="flex items-center rounded-md border border-border overflow-hidden text-sm"
              role="group"
              aria-label="Display mode"
            >
              <button
                type="button"
                class={`px-3 py-1.5 transition-colors ${!isAdvancedMode.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                aria-pressed={!isAdvancedMode.value}
                aria-label="Switch to Basic mode"
                onclick={() => {
                  if (isAdvancedMode.value) toggleAdvancedMode();
                }}
              >
                Basic
              </button>
              <button
                type="button"
                class={`px-3 py-1.5 transition-colors ${isAdvancedMode.value ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                aria-pressed={isAdvancedMode.value}
                aria-label="Switch to Advanced mode"
                onclick={() => {
                  if (!isAdvancedMode.value) toggleAdvancedMode();
                }}
              >
                Advanced
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Row 2: primary route navigation tabs — muted strip so active tab pops out -->
      <nav
        aria-label="Primary"
        class="flex border-t border-border/40 bg-muted/60"
        data-testid="route-tabs"
      >
        <a
          href={`${base}/calculator`}
          class="route-tab"
          class:route-tab-active={routePath === "/calculator"}
          class:route-tab-inactive={routePath !== "/calculator"}
          aria-current={routePath === "/calculator" ? "page" : undefined}
          data-testid="route-tab-calculator"
        >
          Calculator
        </a>
        <a
          href={`${base}/plot`}
          class="route-tab"
          class:route-tab-active={routePath === "/plot"}
          class:route-tab-inactive={routePath !== "/plot"}
          aria-current={routePath === "/plot" ? "page" : undefined}
          data-testid="route-tab-plot"
        >
          Plot
        </a>
        <a
          href={`${base}/docs`}
          class="route-tab"
          class:route-tab-active={routePath.startsWith("/docs")}
          class:route-tab-inactive={!routePath.startsWith("/docs")}
          aria-current={routePath.startsWith("/docs") ? "page" : undefined}
          data-testid="route-tab-docs"
        >
          Docs
        </a>
      </nav>
    </div>
  </header>

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

  <main id="main-content" tabindex="-1" class="container mx-auto px-4 pt-3 pb-6 sm:py-6">
    {@render children()}
  </main>

  <!-- CSV Export Modal (advanced mode only) -->
  <CsvExportModal
    open={showCsvModal.value}
    defaultFilename={showCsvModal.mode === "plot" ? "dedx_plot_data.csv" : "dedx_export.csv"}
    onConfirm={(options, filename) => {
      performCsvDownload(options, filename);
      showCsvModal.value = false;
    }}
    onCancel={() => {
      showCsvModal.value = false;
    }}
  />

  <footer class="border-t bg-card mt-auto">
    <div class="container mx-auto px-4 py-4">
      <div
        class="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <p>webdedx — Stopping power calculations</p>
          <BuildInfoBadge />
        </div>
        <p class="sm:text-right">Built with Svelte 5 + WASM</p>
      </div>
    </div>
  </footer>
</div>

<style>
  /* Skip link: off-screen until focused, then slides into view (WCAG 2.4.1) */
  .skip-link {
    position: absolute;
    left: 0.5rem;
    top: -3.5rem;
    z-index: 50;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: var(--radius-md);
    background-color: var(--card);
    color: var(--foreground);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
    transition: top 0.15s ease;
  }

  .skip-link:focus-visible {
    top: 0.5rem;
    outline: 2px solid var(--ring, var(--primary));
    outline-offset: 2px;
  }

  /* The skip target is programmatically focusable but should not show a ring */
  #main-content:focus {
    outline: none;
  }

  .route-tab {
    display: flex;
    flex: 1 1 0%;
    align-items: center;
    justify-content: center;
    min-height: 3rem; /* 48px — meets WCAG touch target on mobile */
    padding-inline: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-align: center;
    transition:
      background-color 0.15s,
      color 0.15s;
    position: relative;
  }

  @media (min-width: 640px) {
    .route-tab {
      min-height: 2.25rem; /* 36px on desktop — compact */
    }
  }

  /* Active tab: card (white) bg pops out of the muted strip — raised-tab pattern */
  .route-tab-active {
    color: var(--foreground);
    font-weight: 600;
    background-color: var(--card);
    /* Bottom accent instead of ::after so box model stays simple */
    box-shadow: inset 0 -2px 0 var(--primary);
  }

  /* Inactive tabs: muted-foreground is a contrast-safe secondary colour */
  .route-tab-inactive {
    color: var(--muted-foreground);
  }

  .route-tab-inactive:hover {
    color: var(--foreground);
    background-color: color-mix(in oklch, var(--card) 55%, var(--muted));
  }

  /* Visible focus ring for keyboard navigation */
  .route-tab:focus-visible {
    outline: 2px solid var(--ring, var(--primary));
    outline-offset: -2px;
  }
</style>
