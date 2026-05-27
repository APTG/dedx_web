/**
 * SVG / PNG export helpers for the plot page.
 *
 * Encapsulates the DOM-level fallbacks used when JSROOT's own SVG export
 * callback is unavailable (e.g. before the plot has finished its first
 * render).
 */

const FALLBACK_EXPORT_WIDTH = 800;
const FALLBACK_EXPORT_HEIGHT = 600;

export function getSvgFromRenderedPlot(): string | null {
  const svgEl = document.querySelector('[role="img"] svg');
  if (!(svgEl instanceof SVGElement)) return null;
  return new XMLSerializer().serializeToString(svgEl);
}

/** Resolve SVG via the supplied JSROOT callback, falling back to a DOM scrape. */
export async function resolveSvgForExport(
  getSvg: (() => Promise<string | null>) | null,
): Promise<string | null> {
  if (getSvg) {
    const svg = await getSvg();
    if (svg) return svg;
  }
  return getSvgFromRenderedPlot();
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadPlotSvg(
  getSvg: (() => Promise<string | null>) | null,
): Promise<void> {
  const svgString =
    (await resolveSvgForExport(getSvg)) ??
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FALLBACK_EXPORT_WIDTH}" height="${FALLBACK_EXPORT_HEIGHT}"></svg>`;

  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, "dedx_plot.svg");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPlotPng(
  getSvg: (() => Promise<string | null>) | null,
): Promise<void> {
  const svgString = await resolveSvgForExport(getSvg);
  let pngDataUrl: string | null = null;

  if (svgString) {
    const { svgToPng } = await import("$lib/export/pdf.js");
    pngDataUrl = await svgToPng(svgString, 210, 148); // A5 landscape approx
  } else {
    // Fallback: export directly from the rendered canvas output when SVG is unavailable.
    const renderedCanvas = document.querySelector('[role="img"] canvas');
    if (renderedCanvas instanceof HTMLCanvasElement) {
      pngDataUrl = renderedCanvas.toDataURL("image/png");
    }
  }

  if (!pngDataUrl) {
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = FALLBACK_EXPORT_WIDTH;
    fallbackCanvas.height = FALLBACK_EXPORT_HEIGHT;
    pngDataUrl = fallbackCanvas.toDataURL("image/png");
  }

  triggerDownload(pngDataUrl, "dedx_plot.png");
}
