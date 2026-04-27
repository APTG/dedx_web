<script lang="ts">
  import type { PlotSeries } from "$lib/state/plot.svelte";
  import type { StpUnit } from "$lib/wasm/types";
  import { convertStpForDisplay, buildDrawOptions } from "$lib/utils/plot-utils";

  interface AxisRanges {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  }

  let {
    series,
    preview,
    stpUnit,
    xLog,
    yLog,
    axisRanges,
  }: {
    series: PlotSeries[];
    preview: PlotSeries | null;
    stpUnit: StpUnit;
    xLog: boolean;
    yLog: boolean;
    axisRanges: AxisRanges;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let jsrootReady = $state(false);
  let jsrootError = $state<string | null>(null);

  interface JsrootPainter {
    cleanup?: () => void;
  }
  let currentPainter = $state<JsrootPainter | null>(null);

  $effect(() => {
    const snapshot = { series, preview, stpUnit, xLog, yLog, axisRanges };
    let cancelled = false;
    let restoreSettings: (() => void) | null = null;

    drawPlot(container, snapshot)
      .then(({ painter, restore }) => {
        if (cancelled) {
          painter?.cleanup?.();
          restore();
          return;
        }
        currentPainter = painter;
        restoreSettings = restore;
        jsrootReady = true;
      })
      .catch((err) => {
        if (!cancelled) {
          jsrootError =
            "Failed to load the plot engine. Please refresh the page.";
          console.error("JsrootPlot error:", err);
        }
      });

    return () => {
      cancelled = true;
      currentPainter?.cleanup?.();
      currentPainter = null;
      restoreSettings?.();
      restoreSettings = null;
    };
  });

  $effect(() => {
    if (!container) return;
    const observer = new ResizeObserver(() => {
      import("jsroot").then((mod) => {
        const JSROOT = mod.default;
        if (typeof JSROOT.resize === "function") JSROOT.resize(container);
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  async function drawPlot(
    el: HTMLDivElement,
    opts: {
      series: PlotSeries[];
      preview: PlotSeries | null;
      stpUnit: StpUnit;
      xLog: boolean;
      yLog: boolean;
      axisRanges: AxisRanges;
    },
  ): Promise<{ painter: JsrootPainter; restore: () => void }> {
    const JSROOT = (await import("jsroot")).default;

    const prevZoomWheel = JSROOT.settings.ZoomWheel;
    JSROOT.settings.ZoomWheel = false;

    const prevZoomTouch = JSROOT.settings.ZoomTouch;
    if (window.matchMedia("(pointer: coarse)").matches) {
      JSROOT.settings.ZoomTouch = false;
    }

    const restore = () => {
      JSROOT.settings.ZoomWheel = prevZoomWheel;
      JSROOT.settings.ZoomTouch = prevZoomTouch;
    };

    const mg = buildMultigraph(JSROOT, opts);
    const drawOpts = buildDrawOptions(opts.xLog, opts.yLog);

    if (typeof JSROOT.cleanup === "function") JSROOT.cleanup(el);

    const painter = (await JSROOT.draw(
      el,
      mg,
      drawOpts,
    )) as JsrootPainter;
    return { painter, restore };
  }

  function buildMultigraph(
    JSROOT: unknown,
    opts: {
      series: PlotSeries[];
      preview: PlotSeries | null;
      stpUnit: StpUnit;
      axisRanges: AxisRanges;
    },
  ) {
    const JSROOT_any = JSROOT as any;

    const allVisible = [
      ...(opts.preview && opts.preview.visible ? [opts.preview] : []),
      ...opts.series.filter((s) => s.visible),
    ];

    const graphs = allVisible.map((s) => {
      const yData = convertStpForDisplay(
        s.result.stoppingPowers,
        s.density,
        opts.stpUnit,
      );
      const tgraph = JSROOT_any.createTGraph(
        s.result.energies.length,
        s.result.energies,
        yData,
      );
      const isPreview = s.seriesId === 0;
      tgraph.fLineColor = isPreview ? 1 : s.colorIndex + 2;
      tgraph.fLineWidth = isPreview ? 1 : 2;
      tgraph.fLineStyle = isPreview ? 2 : 1;
      tgraph.fTitle = "";
      tgraph.InvertBit(JSROOT_any.BIT(18));
      return tgraph;
    });

    const mg = JSROOT_any.createTMultiGraph(...graphs);

    const hist = JSROOT_any.createHistogram("TH1F", 20);
    hist.fXaxis.fTitle = "Energy [MeV/nucl]";
    hist.fXaxis.fXmin = opts.axisRanges.xMin;
    hist.fXaxis.fXmax = opts.axisRanges.xMax;
    hist.fYaxis.fTitle = `Stopping Power [${opts.stpUnit}]`;
    hist.fMinimum = opts.axisRanges.yMin;
    hist.fMaximum = opts.axisRanges.yMax;
    hist.fXaxis.InvertBit(JSROOT_any.BIT(12));
    hist.fYaxis.InvertBit(JSROOT_any.BIT(12));
    hist.fTitle = "";
    mg.fHistogram = hist;

    return mg;
  }

  const numVisibleSeries = $derived(
    series.filter((s) => s.visible).length + (preview ? 1 : 0),
  );
</script>

{#if jsrootError}
  <div
    class="flex items-center justify-center text-destructive"
    style="width: 100%; height: 100%;"
  >
    {jsrootError}
  </div>
{:else}
  {#if !jsrootReady}
    <div
      class="flex items-center justify-center text-muted-foreground"
      style="width: 100%; height: 100%;"
    >
      Loading plot engine…
    </div>
  {/if}
  <div
    bind:this={container}
    role="img"
    aria-label="Stopping power vs energy plot with {numVisibleSeries} data series"
    style="width: 100%; height: 100%;"
    class:invisible={!jsrootReady}
  ></div>
{/if}
