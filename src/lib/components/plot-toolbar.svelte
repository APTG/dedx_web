<script lang="ts">
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import { canExport } from "$lib/state/export.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { downloadPlotSvg, downloadPlotPng } from "$lib/export/plot-image";

  // App-level plot toolbar (#794): replaces JSROOT's native on-canvas toolbar /
  // context menu with the only controls a web user needs — − / + / Reset zoom /
  // Export. Mounted directly above the canvas; zoom actions wire to the host
  // (jsroot-plot) via the callbacks below.
  let {
    onZoomIn,
    onZoomOut,
    onResetZoom,
    getSvg,
  }: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    getSvg: (() => Promise<string | null>) | null;
  } = $props();

  // ── Export image dropdown (relocated here from the controls bar) ──
  let showExportMenu = $state(false);
  const exportMenuId = "export-menu-" + Math.random().toString(36).slice(2);

  function toggleExportMenu() {
    if (!canExport.value) return;
    showExportMenu = !showExportMenu;
  }

  $effect(() => {
    if (!showExportMenu) return;
    const closeMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`[aria-controls="${exportMenuId}"]`) &&
        !target.closest(`#${exportMenuId}`)
      ) {
        showExportMenu = false;
      }
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  });

  $effect(() => {
    if (!showExportMenu) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") showExportMenu = false;
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  });
</script>

<div
  data-testid="plot-toolbar"
  class="flex flex-wrap items-center justify-between gap-2"
  role="toolbar"
  aria-label="Plot controls"
>
  <!-- Left: zoom controls -->
  <div class="flex items-center gap-1">
    <button
      data-testid="plot-zoom-out"
      aria-label="Zoom out"
      onclick={onZoomOut}
      class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-accent"
    >
      <ZoomOut class="h-4 w-4" aria-hidden="true" />
    </button>
    <button
      data-testid="plot-zoom-in"
      aria-label="Zoom in"
      onclick={onZoomIn}
      class="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-accent"
    >
      <ZoomIn class="h-4 w-4" aria-hidden="true" />
    </button>
    <!-- Reset zoom — always visible, coral accent so it reads as the primary
         "get me back" affordance (double-click stays as the power-user shortcut). -->
    <button
      data-testid="plot-reset-zoom"
      aria-label="Reset zoom"
      onclick={onResetZoom}
      class="ml-1 inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e7663b] px-3 text-sm font-medium text-[#e7663b] hover:bg-[#e7663b]/10"
    >
      <RotateCcw class="h-4 w-4" aria-hidden="true" />
      Reset zoom
    </button>
  </div>

  <!-- Right: export image dropdown -->
  <div class="relative">
    <button
      data-testid="export-image-btn"
      aria-label="Export plot as image"
      aria-haspopup="true"
      aria-expanded={showExportMenu}
      aria-controls={exportMenuId}
      onclick={toggleExportMenu}
      disabled={!canExport.value}
      class="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      Export image ▾
    </button>

    {#if showExportMenu}
      <div
        id={exportMenuId}
        role="menu"
        aria-label="Export options"
        class="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 shadow-md"
      >
        <button
          data-testid="export-image-svg"
          role="menuitem"
          onclick={async () => {
            try {
              await downloadPlotSvg(getSvg);
            } finally {
              showExportMenu = false;
            }
          }}
          class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          SVG vector
        </button>
        {#if isAdvancedMode.value}
          <button
            data-testid="export-image-png"
            role="menuitem"
            onclick={async () => {
              try {
                await downloadPlotPng(getSvg);
              } finally {
                showExportMenu = false;
              }
            }}
            class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            PNG image
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
