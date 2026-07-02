<script lang="ts">
  import { cn } from "$lib/utils.js";

  /**
   * Small, unobtrusive "Calculated with <program> (auto-selected)" annotation
   * shown near the results on the Calculator and Plot pages.
   *
   * Basic mode hides the program selector and picks the recommended program
   * behind the scenes (issue #816); this annotation preserves transparency by
   * naming the program that produced the numbers. `autoSelected` appends the
   * "(auto-selected)" qualifier — always true in Basic mode, and true in
   * Advanced mode when the user leaves the picker on Auto-select.
   */
  interface Props {
    /** Resolved program name(s). Empty string renders nothing. */
    programName: string;
    /** Append "(auto-selected)" — the program was chosen by Auto-select. */
    autoSelected?: boolean;
    class?: string;
    testId?: string;
  }

  let {
    programName,
    autoSelected = false,
    class: className = "",
    testId = "program-annotation",
  }: Props = $props();
</script>

{#if programName}
  <p class={cn("text-xs text-muted-foreground", className)} data-testid={testId}>
    Calculated with <span class="font-medium text-foreground">{programName}</span
    >{#if autoSelected}&nbsp;(auto-selected){/if}
  </p>
{/if}
