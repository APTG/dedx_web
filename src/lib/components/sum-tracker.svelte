<script lang="ts">
  import { Button } from "$lib/components/ui/button";

  interface Props {
    weightTexts: string[];
    onRescale: () => void;
  }

  let { weightTexts, onRescale }: Props = $props();

  let totalSum = $derived(weightTexts.reduce((sum, val) => sum + (parseFloat(val) || 0), 0));

  // Allow a small epsilon for floating point errors (±0.1% as per spec)
  let isTargetSum = $derived(Math.abs(totalSum - 100) <= 0.1);
  let isDanger = $derived(!isTargetSum);
</script>

<div class="mt-4 flex items-center justify-between rounded-md border p-3">
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
