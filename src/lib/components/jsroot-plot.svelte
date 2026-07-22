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
    AXIS_X_TITLE_OFFSET,
    AXIS_Y_TITLE_OFFSET,
    PAD_LEFT_MARGIN,
    PAD_BOTTOM_MARGIN,
    zoomRange,
    ZOOM_STEP_IN,
    ZOOM_STEP_OUT,
    isRangeZoomed,
    buildExportLegend,
    type ExportLegendItem,
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

        Reflect.deleteProperty(g, JSROOT_PROMISE_KEY);
        reject(new Error("JSROOT not found after load"));
      };

      const onError = () => {
        Reflect.deleteProperty(g, JSROOT_PROMISE_KEY);
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

  // JSROOT creates a fresh canvas/pad on every draw, reading its margins from
  // the global `gStyle`. Widen the left/bottom margins so the pushed-out axis
  // titles (see AXIS_*_TITLE_OFFSET) sit inside the SVG instead of being clipped
  // at its edge. Snapshot and restore so we never leak the change to other
  // plots (e.g. the off-screen export pad runs its own apply/restore). gStyle is
  // not in jsroot's bundled types, so widen it locally; if it is unavailable the
  // restore is a no-op and the plot simply keeps JSROOT's defaults.
  function applyPadMargins(JSROOT: JSROOTModule): () => void {
    const gStyle = (
      JSROOT as unknown as {
        gStyle?: { fPadLeftMargin: number; fPadBottomMargin: number };
      }
    ).gStyle;
    if (!gStyle) return () => {};
    const prevLeft = gStyle.fPadLeftMargin;
    const prevBottom = gStyle.fPadBottomMargin;
    gStyle.fPadLeftMargin = PAD_LEFT_MARGIN;
    gStyle.fPadBottomMargin = PAD_BOTTOM_MARGIN;
    return () => {
      gStyle.fPadLeftMargin = prevLeft;
      gStyle.fPadBottomMargin = prevBottom;
    };
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
    // Imperative zoom controls exposed to the parent's plot toolbar (#794).
    // eslint-disable-next-line no-useless-assignment -- $bindable creates parent binding
    resetZoom = $bindable<(() => void) | null>(null),
    // eslint-disable-next-line no-useless-assignment -- $bindable creates parent binding
    zoomIn = $bindable<(() => void) | null>(null),
    // eslint-disable-next-line no-useless-assignment -- $bindable creates parent binding
    zoomOut = $bindable<(() => void) | null>(null),
    // True while the plot is zoomed in past its full data range; lets the parent
    // disable "Reset zoom" when there is nothing to reset (#812).
    // eslint-disable-next-line no-useless-assignment -- $bindable creates parent binding
    isZoomed = $bindable(false),
  }: {
    series: PlotSeries[];
    preview: PlotSeries | null;
    stpUnit: StpUnit;
    xLog: boolean;
    yLog: boolean;
    axisRanges: AxisRanges;
    requestExportSvg?: (() => Promise<string | null>) | null | undefined;
    resetZoom?: (() => void) | null | undefined;
    zoomIn?: (() => void) | null | undefined;
    zoomOut?: (() => void) | null | undefined;
    isZoomed?: boolean | undefined;
  } = $props();

  let container = $state<HTMLDivElement | null>(null);
  let jsrootReady = $state(false);
  let jsrootError = $state<string | null>(null);

  // JSROOT frame painter — the object that owns axis ranges and zoom/unzoom.
  // Its full data range lives in `{x,y}{min,max}` and the currently displayed
  // range in `scale_{x,y}{min,max}`; `logx`/`logy` are non-zero on log axes.
  interface JsrootFramePainter {
    xmin: number;
    xmax: number;
    ymin: number;
    ymax: number;
    scale_xmin: number;
    scale_xmax: number;
    scale_ymin: number;
    scale_ymax: number;
    logx: number;
    logy: number;
    zoom: (
      xmin?: number,
      xmax?: number,
      ymin?: number,
      ymax?: number,
    ) => Promise<boolean> | boolean;
    unzoom: (kind?: string) => Promise<boolean> | boolean;
  }

  interface JsrootPainter {
    cleanup?: () => void;
    getFramePainter?: () => JsrootFramePainter | null | undefined;
  }
  let currentPainter = $state<JsrootPainter | null>(null);
  // Latest frame painter, refreshed on every (re)draw. Read by the imperative
  // zoom controls; plain `let` (not reactive) since only the exposed callbacks
  // consume it, at call time.
  let currentFrame: JsrootFramePainter | null = null;

  // Apply a single − / + zoom step around the centre of the visible range,
  // honouring each axis's log/lin scale. The result is clamped to the full data
  // range so zoom-out never expands past it (and zoom-out at full range is a
  // no-op — JSROOT treats a full-range zoom as an unzoom).
  function applyZoomStep(factor: number): void {
    const fp = currentFrame;
    if (!fp) return;
    const x = zoomRange(fp.scale_xmin, fp.scale_xmax, fp.logx !== 0, factor);
    const y = zoomRange(fp.scale_ymin, fp.scale_ymax, fp.logy !== 0, factor);
    void fp.zoom(
      Math.max(x.min, fp.xmin),
      Math.min(x.max, fp.xmax),
      Math.max(y.min, fp.ymin),
      Math.min(y.max, fp.ymax),
    );
  }

  // Keep `isZoomed` in sync with the frame painter (#812). Every zoom path —
  // box-drag, double-click reset, and the toolbar − / + / Reset — funnels
  // through the frame painter's zoom()/unzoom(), so wrapping them (rather than
  // polling) catches them all. Each (re)draw builds a fresh frame painter, so we
  // re-wrap and re-read on every draw; a data/scale change redraws to the full
  // range → not zoomed. The `currentFrame === fp` guard drops a stale async
  // result from a frame painter that a newer draw has already superseded.
  function trackZoomState(fp: JsrootFramePainter): void {
    // A fresh (re)draw always renders the full range, so start unzoomed and let
    // the wrapped zoom()/unzoom() drive the flag from the first interaction —
    // more robust than measuring scale_* against a range JSROOT may round.
    isZoomed = false;
    const refresh = () => {
      if (currentFrame === fp) isZoomed = isRangeZoomed(fp);
    };
    const origZoom = fp.zoom.bind(fp);
    const origUnzoom = fp.unzoom.bind(fp);
    fp.zoom = (...args: Parameters<JsrootFramePainter["zoom"]>) => {
      const r = origZoom(...args);
      Promise.resolve(r).then(refresh, refresh);
      return r;
    };
    fp.unzoom = (kind?: string) => {
      const r = origUnzoom(kind);
      Promise.resolve(r).then(refresh, refresh);
      return r;
    };
  }

  // Expose the imperative zoom controls to the parent toolbar. resetZoom calls
  // unzoom across all axes; JSROOT then redraws the pad, re-rendering the
  // full-range axes/titles (the title offsets and pad margins from #795/#801
  // persist on the histogram/gStyle, so they re-apply on that redraw).
  $effect(() => {
    resetZoom = () => {
      void currentFrame?.unzoom("xyz");
    };
    zoomIn = () => applyZoomStep(ZOOM_STEP_IN);
    zoomOut = () => applyZoomStep(ZOOM_STEP_OUT);
    return () => {
      resetZoom = null;
      zoomIn = null;
      zoomOut = null;
    };
  });
  // Serialize draw/cleanup operations so a re-render (or fast page navigation)
  // never calls JSROOT.cleanup() while a previous JSROOT.draw() is still
  // in flight on the same element — that produces JSROOT's
  // "pad drawing is not completed when cleanup is called" warning.
  let drawChain: Promise<unknown> = Promise.resolve();

  $effect(() => {
    const snapshot = { series, preview, stpUnit, xLog, yLog, axisRanges };
    const el = container;
    if (!el) return;

    // Draw whenever any series/preview carries real data — even if every curve
    // is currently hidden (all eyes toggled off). buildMultigraph then plots
    // only the visible curves but always builds the histogram frame, so an
    // all-hidden plot shows the empty framed axes rather than collapsing to the
    // "Loading…" placeholder — hiding the last series leaves the canvas on
    // screen (#812 follow-up). The placeholder is reserved for the genuinely
    // empty initial state (no series, no preview): drawing an empty multigraph
    // there races the ObjectPainter module evaluation and throws.
    const hasConfiguredData = (s: PlotSeries): boolean =>
      Array.isArray(s.result.energies) &&
      Array.isArray(s.result.stoppingPowers) &&
      s.result.energies.length > 0 &&
      s.result.stoppingPowers.length > 0;
    const hasData =
      (snapshot.preview !== null && hasConfiguredData(snapshot.preview)) ||
      snapshot.series.some((s) => hasConfiguredData(s));
    if (!hasData) {
      jsrootError = null;
      jsrootReady = false;
      drawChain = drawChain
        .catch(() => {})
        .then(() => {
          currentPainter?.cleanup?.();
          currentPainter = null;
          currentFrame = null;
          isZoomed = false;
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
        currentFrame = painter.getFramePainter?.() ?? null;
        if (currentFrame) trackZoomState(currentFrame);
        else isZoomed = false;
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
        currentFrame = null;
        isZoomed = false;
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

  // JSROOT pans the axes on a middle-button (or left+right) drag — its
  // startRectSel() handles `evnt.button === 1 || evnt.buttons === 3`. That pan
  // looks like the data series sliding sideways and there is no JSROOT setting
  // to disable it without also losing left-drag rectangular zoom. Swallow those
  // mousedowns in the capture phase, before JSROOT's mousedown handler (bound on
  // the inner <svg>) ever sees them. Left-drag zoom and double-click reset stay.
  $effect(() => {
    if (!container) return;
    const el = container;
    const blockPan = (e: MouseEvent) => {
      if (e.button === 1 || e.buttons === 3) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("mousedown", blockPan, { capture: true });
    return () => el.removeEventListener("mousedown", blockPan, { capture: true });
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
      let restorePadMargins: (() => void) | null = null;
      try {
        const JSROOT = await getJsroot();
        // Widen the pad margins so the exported SVG matches the on-screen plot
        // (titles inside the frame, not clipped); restored in finally.
        restorePadMargins = applyPadMargins(JSROOT);
        // Read current reactive values at call time; exclude preview (preview: null)
        const mg = buildMultigraph(JSROOT, {
          series,
          preview: null,
          stpUnit,
          axisRanges,
          withLegend: true,
          xLog,
          yLog,
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
        restorePadMargins?.();
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

    // JSROOT.settings is global; snapshot the flags we flip so cleanup can
    // restore them (DragGraphs/ToolBar/ContextMenu are not in jsroot's bundled
    // types — widen here).
    const settings = JSROOT.settings as typeof JSROOT.settings & {
      DragGraphs: boolean;
      ToolBar: boolean | string;
      ContextMenu: boolean;
    };

    const prevZoomWheel = settings.ZoomWheel;
    // Wheel scroll must scroll the page, never zoom the axes.
    settings.ZoomWheel = false;

    // Replace JSROOT's native chrome with our app toolbar (#794): hide the
    // on-canvas ROOT toolbar and the right-click ROOT context menu, neither of
    // which makes sense for a web user. Snapshot/restore so the global change
    // never leaks to other plots (e.g. the off-screen export pad).
    const prevToolBar = settings.ToolBar;
    settings.ToolBar = false;
    const prevContextMenu = settings.ContextMenu;
    settings.ContextMenu = false;

    const prevZoomTouch = settings.ZoomTouch;
    const prevDragGraphs = settings.DragGraphs;
    // Use both (pointer: coarse) and maxTouchPoints so that touch devices
    // where the media query returns false (some Android browsers, hybrid
    // laptops in touch mode) are still detected correctly.
    if (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0) {
      // On touch devices every gesture must pass through to the browser so the
      // page scrolls/zooms normally. Disable pinch-zoom of the axes (ZoomTouch)
      // and dragging of TGraph points (DragGraphs, on by default) — the latter
      // is what makes a one-finger swipe drag a data series under the finger.
      settings.ZoomTouch = false;
      settings.DragGraphs = false;
    }

    const restorePadMargins = applyPadMargins(JSROOT);

    const restore = () => {
      settings.ZoomWheel = prevZoomWheel;
      settings.ZoomTouch = prevZoomTouch;
      settings.DragGraphs = prevDragGraphs;
      settings.ToolBar = prevToolBar;
      settings.ContextMenu = prevContextMenu;
      restorePadMargins();
    };

    const mg = buildMultigraph(JSROOT, opts);
    const drawOpts = buildDrawOptions(opts.xLog, opts.yLog);

    let painter: JsrootPainter;
    try {
      painter = (await JSROOT.draw(el, mg, drawOpts)) as JsrootPainter;
    } catch (err) {
      // If the draw rejects, restore the global settings/margins here — the
      // caller only receives (and invokes) `restore` on success, so without
      // this the flipped ToolBar/ContextMenu/margins would leak into the next
      // draw or other pads after a transient failure.
      restore();
      throw err;
    }
    return { painter, restore };
  }

  function buildMultigraph(
    JSROOT: unknown,
    opts: {
      series: PlotSeries[];
      preview: PlotSeries | null;
      stpUnit: StpUnit;
      axisRanges: AxisRanges;
    } & (
      | // Attach an in-canvas TLegend (#797). Export pad only — never the live
        // plot, which keeps the HTML strip as its legend (per Q1, #793). The
        // legend auto-places into the emptiest frame corner, so the export caller
        // MUST supply the axis log flags it maps the sample points with — the
        // union makes TypeScript enforce that whenever `withLegend` is set.
        { withLegend: true; xLog: boolean; yLog: boolean }
      | { withLegend?: false; xLog?: boolean; yLog?: boolean }
    ),
  ) {
    const JSROOT_any = JSROOT as any;

    const allVisible = [
      ...(opts.preview && opts.preview.visible ? [opts.preview] : []),
      ...opts.series.filter((s) => s.visible),
    ];

    const energyAxisUnit = getPlotEnergyAxisUnit(allVisible);

    const legendItems: ExportLegendItem[] = [];
    const legendPoints: Array<{ x: number[]; y: number[] }> = [];
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
      // The preview is ephemeral and never appears in exports, so it is also
      // omitted from the legend (the export path passes preview: null anyway).
      if (!isPreview) {
        legendItems.push({ graph: tgraph, label: s.label });
        legendPoints.push({ x: xData, y: yData });
      }
      return tgraph;
    });

    const mg = JSROOT_any.createTMultiGraph(...graphs);

    if (opts.withLegend) {
      // Auto-place the legend into the emptiest frame corner so it never sits
      // on top of a curve (epic open question 1).
      const legend = buildExportLegend((t) => JSROOT_any.create(t), legendItems, {
        series: legendPoints,
        ranges: opts.axisRanges,
        xLog: opts.xLog,
        yLog: opts.yLog,
      });
      if (legend) {
        // TMultiGraph's painter draws everything in fFunctions, so the legend
        // rides along with the curves on the export pad.
        if (!mg.fFunctions) mg.fFunctions = JSROOT_any.create("TList");
        mg.fFunctions.arr.push(legend);
        mg.fFunctions.opt.push("");
      }
    }

    const hist = JSROOT_any.createHistogram("TH1F", 20);
    hist.fXaxis.fTitle = getPlotEnergyAxisLabel(allVisible);
    hist.fXaxis.fXmin = opts.axisRanges.xMin;
    hist.fXaxis.fXmax = opts.axisRanges.xMax;
    hist.fYaxis.fTitle = `Stopping Power [${opts.stpUnit}]`;
    // Push the axis titles clear of their tick labels. JSROOT resets these on
    // every redraw, so they are re-applied here on each (re)build — covering
    // log↔lin toggles, series add/remove, resize, and the off-screen export pad.
    hist.fXaxis.fTitleOffset = AXIS_X_TITLE_OFFSET;
    hist.fYaxis.fTitleOffset = AXIS_Y_TITLE_OFFSET;
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
  <!-- touch-action lets the browser own scrolling and pinch-zoom of the page so
       JSROOT's touch handlers can't hijack a swipe/pinch over the canvas. -->
  <div
    bind:this={container}
    role="img"
    aria-label="Stopping power vs energy plot with {numVisibleSeries} data series"
    style="width: 100%; height: 100%; touch-action: pan-x pan-y pinch-zoom;"
    class:invisible={!jsrootReady}
  ></div>
{/if}
