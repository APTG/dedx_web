import JSROOT from 'jsroot';
import type { CalculationResult } from '$lib/wasm/types';

export interface Series {
  label: string;
  data: CalculationResult;
  color?: number;
}

export async function drawPlot(
  container: HTMLDivElement,
  series: Series[]
): Promise<unknown> {
  JSROOT.settings.ZoomWheel = false;

  if (window.matchMedia('(pointer: coarse)').matches) {
    JSROOT.settings.ZoomTouch = false;
  }

  if (!series.length || !container) {
    return null;
  }

  const mgraph = (JSROOT as any).create('TMultiGraph');

  series.forEach((s, idx) => {
    const { energies, stoppingPowers } = s.data;
    const graph = (JSROOT as any).create('TGraph', energies.length);

    for (let i = 0; i < energies.length; i++) {
      graph.SetPoint(i, energies[i], stoppingPowers[i]);
    }

    graph.fLineColor = s.color ?? idx + 1;
    graph.fLineWidth = 2;
    mgraph.Add(graph);
  });

  const painter = await (JSROOT as any).draw(container, mgraph, 'APL');

  return {
    painter,
    cleanup: () => {
      if (painter && typeof painter.cleanup === 'function') {
        painter.cleanup();
      }
    }
  };
}
