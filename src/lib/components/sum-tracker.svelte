<script lang="ts">
  import { Button } from "$lib/components/ui/button";

  interface Props {
    weightTexts: string[];
    elementSymbols: string[];
    onRescale: () => void;
  }

  let { weightTexts, elementSymbols, onRescale }: Props = $props();

  const segmentColors = [
    "bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500",
    "bg-rose-500", "bg-orange-500", "bg-yellow-500", "bg-green-500",
    "bg-teal-500", "bg-cyan-500"
  ];

  let totalSum = $derived(weightTexts.reduce((sum, val) => sum + (parseFloat(val) || 0), 0));
  let scaleMax = $derived(Math.max(100, totalSum));

  // Allow a small epsilon for floating point errors (±0.1% as per spec)
  let isTargetSum = $derived(Math.abs(totalSum - 100) <= 0.1);
  let isDanger = $derived(!isTargetSum);
</script>

<div class="mt-4 flex flex-col gap-2 rounded-md border p-3">
  <div class="flex items-center justify-between">
    <div class="text-sm font-medium">
      Total:
      <span class={isDanger ? "text-destructive" : "text-green-600 dark:text-green-500"}>
        {totalSum.toFixed(2)}%
        {#if isTargetSum}
          ✓
        {/if}
      </span>
    </div>
    {#if isDanger && totalSum > 0}
      <Button variant="outline" size="sm" onclick={onRescale}>Auto-rescale</Button>
    {/if}
  </div>

  <div class="relative mt-2 h-4 w-full overflow-hidden rounded-full bg-muted">
    {#each weightTexts as text, i}
      {@const val = parseFloat(text) || 0}
      {#if val > 0}
        <div
          class="h-full float-left transition-all duration-300 {segmentColors[i % segmentColors.length]}"
          style="width: {(val / scaleMax) * 100}%"
          title="{elementSymbols[i]}: {val}%"
        ></div>
      {/if}
    {/each}
    <div
      class="absolute top-0 h-full w-[2px] bg-foreground/50 z-10"
      style="left: {(100 / scaleMax) * 100}%"
      title="100% Mark"
    ></div>
  </div>
</div>
