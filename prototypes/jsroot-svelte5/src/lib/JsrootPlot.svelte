<script lang="ts">
  import { untrack } from "svelte";

  interface SeriesData {
    x: number[];
    y: number[];
    label: string;
  }

  let { series }: { series: SeriesData[] } = $props();

  let container: HTMLDivElement;
  let currentPainter: unknown = null;

  $effect(() => {
    // `series` is tracked here — $effect re-runs when it changes.
    const seriesSnapshot = series;

    // Cleanup previous draw without tracking `currentPainter`.
    untrack(() => {
      cleanupPlot();
    });

    if (seriesSnapshot.length === 0) return;

    drawPlot(container, seriesSnapshot).then((painter) => {
      currentPainter = painter;
    });

    // Cleanup on effect disposal (component unmount or next re-run).
    return () => {
      cleanupPlot();
    };
  });

  function cleanupPlot() {
    if (currentPainter && typeof (currentPainter as any).cleanup === "function") {
      (currentPainter as any).cleanup();
    }
    currentPainter = null;
    // Also clear the container's innerHTML as a fallback.
    if (container) container.innerHTML = "";
  }

  async function drawPlot(
    el: HTMLDivElement,
    data: SeriesData[],
  ): Promise<unknown> {
    const JSROOT = await import("jsroot");

    // Disable wheel zoom so page scrolls normally.
    JSROOT.settings.ZoomWheel = false;

    const mg = JSROOT.createTMultiGraph();

    for (const s of data) {
      const gr = JSROOT.createTGraph(s.x.length, s.x, s.y);
      gr.fTitle = s.label;
      gr.fLineWidth = 2;
      mg.fGraphs.Add(gr);
    }

    mg.fTitle = "Spike: JSROOT in Svelte 5";

    // 'AP' = axes + polyline. 'logx logy' for log-log axes.
    return JSROOT.draw(el, mg, "AP logx logy");
  }
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
