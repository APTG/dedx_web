<script lang="ts">
  import { cn } from "$lib/utils.js";

  /**
   * Small, unobtrusive "Calculated with <program>" annotation shown near the
   * results on the Calculator and Plot pages.
   *
   * Basic mode hides the program selector and picks the recommended program
   * behind the scenes (issue #816); this annotation preserves transparency by
   * naming the program that produced the numbers.
   *
   * - `autoSelected` appends the "(auto-selected)" qualifier. The Calculator
   *   drives it from the live selection state, so it stays accurate in both
   *   modes — always true in Basic (which now always auto-selects, see #816),
   *   and true in Advanced only when the user leaves the picker on Auto-select.
   *   The Plot deliberately omits it: its annotation aggregates the program(s)
   *   behind a *committed set* of series that can mix auto-selected and
   *   explicitly-chosen curves (added in Advanced mode or restored from a
   *   shared URL), so claiming they were all auto-selected would be wrong
   *   (PR #821 review). There it just names the program(s).
   * - `detail` is optional trailing text (e.g. the valid energy range) rendered
   *   inline after the program, letting the Calculator show a single compact
   *   row instead of two stacked lines.
   */
  interface Props {
    /** Resolved program name(s). Empty string renders nothing. */
    programName: string;
    /** Append "(auto-selected)" — the program was chosen by Auto-select. */
    autoSelected?: boolean;
    /** Optional trailing detail (e.g. "valid range …") shown on the same line. */
    detail?: string;
    class?: string;
    testId?: string;
  }

  let {
    programName,
    autoSelected = false,
    detail = "",
    class: className = "",
    testId = "program-annotation",
  }: Props = $props();
</script>

{#if programName}
  <p class={cn("text-xs text-muted-foreground", className)} data-testid={testId}>
    Calculated with <span class="font-medium text-foreground">{programName}</span
    >{#if autoSelected}&nbsp;(auto-selected){/if}{#if detail}&nbsp;·&nbsp;{detail}{/if}
  </p>
{/if}
