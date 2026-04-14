<script lang="ts">
  import JsrootPlot from "$lib/JsrootPlot.svelte";

  // Reactive series state
  let series = $state<{ x: number[]; y: number[]; label: string }[]>([
    {
      label: "Series A",
      x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
      y: Array.from({ length: 100 }, (_, i) => Math.sin(0.01 + i * 0.1) + 2),
    },
    {
      label: "Series B",
      x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
      y: Array.from({ length: 100 }, (_, i) => Math.cos(0.01 + i * 0.1) + 3),
    },
  ]);

  function addSeries() {
    series = [
      ...series,
      {
        label: `Series ${String.fromCharCode(65 + series.length)}`,
        x: Array.from({ length: 100 }, (_, i) => 0.01 + i * 0.1),
        y: Array.from({ length: 100 }, (_, i) => 1.5 + Math.random()),
      },
    ];
  }

  function removeAll() {
    series = [];
  }

  function mutateFirst() {
    if (series.length === 0) return;
    series = [
      {
        ...series[0],
        y: series[0].y.map((v) => v * (0.8 + Math.random() * 0.4)),
      },
      ...series.slice(1),
    ];
  }
</script>

<h1>JSROOT 7 + Svelte 5 Spike</h1>

<div style="margin-bottom: 1rem;">
  <button onclick={addSeries}>Add series</button>
  <button onclick={removeAll}>Remove all</button>
  <button onclick={mutateFirst}>Mutate first series</button>
  <span>Series count: {series.length}</span>
</div>

<div style="width: 800px; height: 500px; border: 1px solid #ccc;">
  <JsrootPlot {series} />
</div>

<div style="height: 2000px; background: linear-gradient(white, #eee);">
  <p>Scroll area — verify wheel scrolls the page, not the plot.</p>
</div>
