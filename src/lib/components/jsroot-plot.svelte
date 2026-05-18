<script lang="ts">
  import type * as JSROOTNs from "jsroot";
  import { base } from "$app/paths";
  import type { PlotSeries } from "$lib/state/plot.svelte";
  import type { StpUnit } from "$lib/wasm/types";
  import {
    convertEnergyForDisplay,
    convertStpForDisplay,
    buildDrawOptions,
    getPlotEnergyAxisLabel,
    getPlotEnergyAxisUnit,
  } from "$lib/utils/plot-utils";

  type JSROOTModule = typeof JSROOTNs;

  // Load jsroot's pre-built UMD bundle (static/jsroot.min.js) via a <script> tag
  // instead of import("jsroot"). This bypasses Rollup's circular-dependency
  // evaluation-order bug in jsroot 7.11.0: ObjectPainter.mjs:1828 runs
  // Object.assign(internals.jsroot, …) before core.mjs has initialised
  // `internals` when Rollup linearises the static import graph.
  // The UMD bundle was built by jsroot's own Rollup with the correct order.
  const JSROOT_SCRIPT_ID = "jsroot-umd-loader";
  const JSROOT_PROMISE_KEY = "__jsrootPromise__";

  function getJsroot(): Promise<JSROOTModule> {
    const g = globalThis as Record<string, unknown>;
    if (g.JSROOT) return Promise.resolve(g.JSROOT as JSROOTModule);

    const existingPromise = g[JSROOT_PROMISE_KEY];
    if (existingPromise) return existingPromise as Promise<JSROOTModule>;

    const jsrootPromise = new Promise<JSROOTModule>((resolve, reject) => {
      const onLoad = () => {
        const jsroot = (globalThis as Record<string, unknown>).JSROOT;
        if (jsroot) {
          resolve(jsroot as JSROOTModule);
          return;
        }

        delete g[JSROOT_PROMISE_KEY];
        reject(new Error("JSROOT not found after load"));
      };

      const onError = () => {
        delete g[JSROOT_PROMISE_KEY];
        reject(new Error("Failed to load jsroot.min.js"));
      };

      const existingScript = document.getElementById(JSROOT_SCRIPT_ID) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener("load", onLoad, { once: true });
        existingScript.addEventListener("error", onError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = JSROOT_SCRIPT_ID;
      script.src = `${base}/jsroot.min.js`;
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    });

    g[JSROOT_PROMISE_KEY] = jsrootPromise;
    return jsrootPromise;
  }

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
    // eslint-disable-next-line no-useless-assignment -- $bindable creates parent binding
    requestExportSvg = $bindable<(() => Promise<string | null>) | null>(null),
  }: {
    series: PlotSeries[];
    preview: PlotSeries | null;
    stpUnit: StpUnit;
    xLog: boolean;
    yLog: boolean;
    axisRanges: AxisRanges;
    requestExportSvg?: (() => Promise<string | null>) | null | undefined;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let jsrootReady = $state(false);
  let jsrootError = $state<string | null>(null);

  interface JsrootPainter {
    cleanup?: () => void;
  }
  let currentPainter = $state<JsrootPainter | null>(null);
  // Serialize draw/cleanup operations so a re-render (or fast page navigation)
  // never calls JSROOT.cleanup() while a previous JSROOT.draw() is still
  // in flight on the same element — that produces JSROOT's
  // "pad drawing is not completed when cleanup is called" warning.
  let drawChain: Promise<unknown> = Promise.resolve();

  $effect(() => {
    const snapshot = { series, preview, stpUnit, xLog, yLog, axisRanges };
    const el = container;
    if (!el) return;

    // Guard: do not call JSROOT.draw() with an empty multigraph — it triggers a
    // module-evaluation race in ObjectPainter that throws on first navigation
    // before the default proton+water preview has been computed.
    // The "Loading plot engine…" placeholder stays visible during this brief window.
    const hasDrawableSeries = (s: PlotSeries): boolean =>
      s.visible &&
      Array.isArray(s.result.energies) &&
      Array.isArray(s.result.stoppingPowers) &&
      s.result.energies.length > 0 &&
      s.result.stoppingPowers.length > 0;
    const hasData =
      (snapshot.preview !== null && hasDrawableSeries(snapshot.preview)) ||
      snapshot.series.some((s) => hasDrawableSeries(s));
    if (!hasData) {
      jsrootError = null;
      jsrootReady = false;
      drawChain = drawChain
        .catch(() => {})
        .then(() => {
          currentPainter?.cleanup?.();
          currentPainter = null;
          el.innerHTML = "";
        });
      return;
    }

    let cancelled = false;
    let restoreSettings: (() => void) | null = null;

    const job = drawChain
      .catch(() => {})
      .then(async () => {
        if (cancelled) return;
        const { painter, restore } = await drawPlot(el, snapshot);
        if (cancelled) {
          painter?.cleanup?.();
          restore();
          return;
        }
        currentPainter = painter;
        restoreSettings = restore;
        jsrootError = null;
        jsrootReady = true;
      })
      .catch((err) => {
        if (!cancelled) {
          jsrootError = "Failed to load the plot engine. Please refresh the page.";
          jsrootReady = false;
          console.error("JsrootPlot error:", err);
        }
      });
    drawChain = job;

    return () => {
      cancelled = true;
      // Defer cleanup until the in-flight draw settles so JSROOT's pad
      // painter exists and can be torn down cleanly.
      drawChain = job.then(async () => {
        currentPainter?.cleanup?.();
        currentPainter = null;
        restoreSettings?.();
        restoreSettings = null;
        try {
          const JSROOT = await getJsroot();
          if (typeof JSROOT.cleanup === "function") JSROOT.cleanup(el);
        } catch {
          // Swallow cleanup errors during teardown to avoid breaking the page.
        }
      });
    };
  });

  $effect(() => {
    if (!container) return;
    const el = container;
    let disposed = false;
    const observer = new ResizeObserver(() => {
      if (disposed) return;
      getJsroot().then((JSROOT) => {
        if (disposed) return;
        if (typeof JSROOT.resize === "function") JSROOT.resize(el);
      });
    });
    observer.observe(el);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  });

  $effect(() => {
    if (!container) {
      requestExportSvg = null;
      return;
    }
    const el = container;
    requestExportSvg = async (): Promise<string | null> => {
      if (!el) return null;
      // Render an off-screen copy without the preview series, so the exported
      // SVG/PDF never contains the ephemeral preview curve (export spec §4.1).
      const offscreen = document.createElement("div");
      offscreen.style.cssText =
        "position:fixed;visibility:hidden;pointer-events:none;width:800px;height:600px;top:-9999px;left:-9999px;";
      document.body.appendChild(offscreen);
      try {
        const JSROOT = await getJsroot();
        // Read current reactive values at call time; exclude preview (preview: null)
        const mg = buildMultigraph(JSROOT, {
          series,
          preview: null,
          stpUnit,
          axisRanges,
        });
        const drawOpts = buildDrawOptions(xLog, yLog);
        await JSROOT.draw(offscreen, mg, drawOpts);
        const svgEl = offscreen.querySelector("svg");
        const result = svgEl ? new XMLSerializer().serializeToString(svgEl) : null;
        try {
          if (typeof JSROOT.cleanup === "function") JSROOT.cleanup(offscreen);
        } catch {
          // cleanup failure is non-fatal; the offscreen div is removed in finally
        }
        return result;
      } catch {
        // JSROOT draw failed (e.g. script not yet loaded).
        // Return null so the caller falls back to DOM serialization or empty canvas.
        return null;
      } finally {
        if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
      }
    };
    return () => {
      requestExportSvg = null;
    };
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
    const JSROOT = await getJsroot();

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

    const painter = (await JSROOT.draw(el, mg, drawOpts)) as JsrootPainter;
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

    const energyAxisUnit = getPlotEnergyAxisUnit(allVisible);

    const graphs = allVisible.map((s) => {
      const xData = convertEnergyForDisplay(s.result.energies, s, energyAxisUnit);
      const yData = convertStpForDisplay(s.result.stoppingPowers, s.density, opts.stpUnit);
      const tgraph = JSROOT_any.createTGraph(xData.length, xData, yData);
      const isPreview = s.seriesId === 0;
      const isExternal = typeof s.programId === "string";
      tgraph.fLineColor = isPreview ? 1 : s.colorIndex + 2;
      tgraph.fLineWidth = isPreview ? 1 : 2;
      tgraph.fLineStyle = isPreview || isExternal ? 2 : 1;
      tgraph.fTitle = "";
      tgraph.InvertBit(JSROOT_any.BIT(18));
      return tgraph;
    });

    const mg = JSROOT_any.createTMultiGraph(...graphs);

    const hist = JSROOT_any.createHistogram("TH1F", 20);
    hist.fXaxis.fTitle = getPlotEnergyAxisLabel(allVisible);
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

  const numVisibleSeries = $derived(series.filter((s) => s.visible).length + (preview ? 1 : 0));
</script>

{#if jsrootError}
  <div class="flex items-center justify-center text-destructive" style="width: 100%; height: 100%;">
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
