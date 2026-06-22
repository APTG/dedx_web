<!--
  HelpHint — a small, accessible "ⓘ" contextual-help affordance.

  Wraps the shared Bits UI tooltip primitive so help content gains the
  WCAG 1.4.13 behaviours for free: it opens on hover AND keyboard focus, the
  content is hoverable + persistent, and Escape dismisses it without moving
  focus. The trigger is a real focusable <button>, so on touch devices a tap
  focuses it and reveals the content (no hover required).

  Content comes either from the `help-text.ts` registry (`term`) or from an
  inline `text` override. An optional deep-link renders as "Learn more →" so
  the tooltip is never a dead end — the same destination is reachable from the
  /docs navigation, covering keyboard and touch users if the in-tooltip link is
  awkward to reach.
-->
<script lang="ts">
  import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
  } from "$lib/components/ui/tooltip";
  import { base } from "$app/paths";
  import Info from "@lucide/svelte/icons/info";
  import { cn } from "$lib/utils.js";
  import { HELP_TEXT, type HelpKey } from "$lib/config/help-text";

  interface Props {
    /** Registry key (docs/10-terminology.md sourced); supplies text + href. */
    term?: HelpKey;
    /** Inline gloss; overrides the registry text when both are given. */
    text?: string;
    /** Base-relative deep-link for the "Learn more" line; overrides registry. */
    href?: string;
    /** Visible label for the deep-link. */
    moreLabel?: string;
    /** Accessible name for the trigger button. */
    label?: string;
    side?: "top" | "right" | "bottom" | "left";
    /** Icon size in px. */
    size?: number;
    /** `data-testid` applied to the trigger button. */
    testId?: string;
    class?: string;
  }

  let {
    term,
    text,
    href,
    moreLabel = "Learn more",
    label,
    side = "top",
    size = 14,
    testId,
    class: className,
  }: Props = $props();

  const entry = $derived(term ? HELP_TEXT[term] : undefined);
  const body = $derived(text ?? entry?.text ?? "");
  const linkHref = $derived(href ?? entry?.href);
  const ariaLabel = $derived(label ?? (body ? `More information: ${body}` : "More information"));
</script>

<TooltipProvider delayDuration={150}>
  <Tooltip>
    <TooltipTrigger
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      onclick={(e: MouseEvent) => {
        // Never let the icon trigger an enclosing control (e.g. a list row).
        e.preventDefault();
        e.stopPropagation();
      }}
      class={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Info {size} aria-hidden="true" />
    </TooltipTrigger>
    <TooltipContent {side} class="max-w-xs flex-col items-start gap-1 text-left">
      <p>{body}</p>
      {#if linkHref}
        <a
          href={`${base}${linkHref}`}
          class="font-medium underline underline-offset-2 hover:opacity-80"
        >
          {moreLabel} →
        </a>
      {/if}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
