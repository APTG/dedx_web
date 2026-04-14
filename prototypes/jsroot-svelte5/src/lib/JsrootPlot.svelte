<script lang="ts">
  interface SeriesData {
    x: number[];
    y: number[];
    label: string;
  }

  /** Minimal interface for the object returned by JSROOT.draw(). */
  interface JsrootPainter {
    cleanup?: () => void;
  }

  let { series }: { series: SeriesData[] } = $props();

  let container: HTMLDivElement;
  let currentPainter: JsrootPainter | null = null;

  $effect(() => {
    // `series` is tracked here — $effect re-runs when it changes.
    const seriesSnapshot = series;

    // Per-run cancellation flag: set to true by the disposer so that a
    // slow async draw from a superseded run does not overwrite currentPainter.
    let cancelled = false;
    // Holds a restore callback returned by drawPlot once it resolves.
    let restoreSettings: (() => void) | null = null;

    if (seriesSnapshot.length === 0) return;

    drawPlot(container, seriesSnapshot)
      .then(({ painter, restore }) => {
        if (cancelled) {
          // This run was superseded (or the component unmounted) before the
          // draw resolved. Clean up the stale painter and restore globals.
          painter.cleanup?.();
          restore();
          return;
        }
        currentPainter = painter;
        restoreSettings = restore;
      })
      .catch((err) => {
        if (!cancelled) console.error("drawPlot failed:", err);
      });

    // Cleanup on effect disposal (component unmount or before next re-run).
    // Svelte 5 calls this before re-running the effect, so we rely on it
    // exclusively — no manual cleanupPlot() call at the start of the effect.
    return () => {
      cancelled = true;
      cleanupPlot();
      restoreSettings?.();
      restoreSettings = null;
    };
  });

  function cleanupPlot() {
    currentPainter?.cleanup?.();
    currentPainter = null;
    // Also clear the container's innerHTML as a fallback.
    if (container) container.innerHTML = "";
  }

  async function drawPlot(
    el: HTMLDivElement,
    data: SeriesData[],
  ): Promise<{ painter: JsrootPainter; restore: () => void }> {
    const JSROOT = await import("jsroot");

    // Save the previous value and disable wheel zoom so page scrolls normally.
    // The caller restores it via the returned `restore` callback so that other
    // plots/pages are not affected by this component's preference.
    const prevZoomWheel = JSROOT.settings.ZoomWheel;
    JSROOT.settings.ZoomWheel = false;
    const restore = () => {
      JSROOT.settings.ZoomWheel = prevZoomWheel;
    };

    const mg = JSROOT.createTMultiGraph();

    for (const s of data) {
      const gr = JSROOT.createTGraph(s.x.length, s.x, s.y);
      gr.fTitle = s.label;
      gr.fLineWidth = 2;
      mg.fGraphs.Add(gr);
    }

    mg.fTitle = "Spike: JSROOT in Svelte 5";

    // 'AP' = axes + polyline. 'logx logy' for log-log axes.
    const painter = (await JSROOT.draw(el, mg, "AP logx logy")) as JsrootPainter;
    return { painter, restore };
  }
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
