<script lang="ts">
  import ZoomIn from "@lucide/svelte/icons/zoom-in";
  import ZoomOut from "@lucide/svelte/icons/zoom-out";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ImageDown from "@lucide/svelte/icons/image-down";
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
    canReset = true,
  }: {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    getSvg: (() => Promise<string | null>) | null;
    /** When false the plot is already at full range, so Reset zoom is disabled (#812). */
    canReset?: boolean;
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

<!-- Single row that never wraps, even at 360px (#799): icon-only − / +, a
     flex-grow Reset zoom that keeps its label (the discoverability anchor for
     touch, where pinch is the only other way back), and an Export button whose
     label collapses to an icon below the `xs` (420px) breakpoint. On `xs` and
     up a flex spacer pushes Export to the right, restoring the desktop layout
     (zoom + Reset left, Export right). -->
<div
  data-testid="plot-toolbar"
  class="flex flex-nowrap items-center gap-1.5"
  role="toolbar"
  aria-label="Plot controls"
>
  <!-- Zoom controls (icon-only on every width) -->
  <button
    data-testid="plot-zoom-out"
    aria-label="Zoom out"
    onclick={onZoomOut}
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-accent"
  >
    <ZoomOut class="h-4 w-4" aria-hidden="true" />
  </button>
  <button
    data-testid="plot-zoom-in"
    aria-label="Zoom in"
    onclick={onZoomIn}
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background hover:bg-accent"
  >
    <ZoomIn class="h-4 w-4" aria-hidden="true" />
  </button>
  <!-- Reset zoom — always visible with its label, coral accent so it reads as
       the primary "get me back" affordance (double-click/pinch stay as the
       power-user shortcuts). Below `xs` it flex-grows to fill the row; from
       `xs` up it sizes to content and the spacer below pushes Export right.
       Uses the darker coral #c2410c: the brand coral #e7663b is only 3.3:1 on
       white, below the WCAG 2 AA 4.5:1 text-contrast threshold, while #c2410c
       is ~5.2:1 and still reads as the same accent. -->
  <button
    data-testid="plot-reset-zoom"
    aria-label="Reset zoom"
    onclick={onResetZoom}
    disabled={!canReset}
    aria-disabled={!canReset}
    class="ml-0.5 inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#c2410c] px-3 text-sm font-medium text-[#c2410c] hover:bg-[#c2410c]/10 disabled:pointer-events-none disabled:border-border disabled:text-muted-foreground disabled:opacity-50 xs:ml-1 xs:flex-none xs:justify-start"
  >
    <RotateCcw class="h-4 w-4 shrink-0" aria-hidden="true" />
    Reset zoom
  </button>

  <!-- Spacer (xs and up): pushes Export to the right edge like the desktop
       layout. Hidden below xs so Reset can flex-grow into the gap instead. -->
  <div class="hidden flex-1 xs:block"></div>

  <!-- Export image dropdown: icon-only below xs, icon + label from xs up. -->
  <div class="relative shrink-0">
    <button
      data-testid="export-image-btn"
      aria-label="Export plot as image"
      aria-haspopup="true"
      aria-expanded={showExportMenu}
      aria-controls={exportMenuId}
      onclick={toggleExportMenu}
      disabled={!canExport.value}
      class="inline-flex h-9 w-9 items-center justify-center gap-1 rounded-md border bg-background px-0 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50 xs:w-auto xs:px-3"
    >
      <ImageDown class="h-4 w-4 shrink-0 xs:hidden" aria-hidden="true" />
      <span class="hidden xs:inline">Export image ▾</span>
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
