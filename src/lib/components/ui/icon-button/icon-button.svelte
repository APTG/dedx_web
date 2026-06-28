<!--
  IconButton — a square icon-only button with an honest touch target and a
  native tooltip (#793).

  Why this exists: the series strip used to render bare emoji `👁` / `✕`
  characters as click targets — tiny, no hover/active feedback, and no
  accessible name. This wraps a real <button> so each action reads as a control:
  it carries an `aria-label` (the accessible name) and a matching `title` (the
  hover tooltip), and it honours the project mobile-target rule — ≥44px below
  `sm`, ≥36px from `sm` up.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  interface Props {
    /** Accessible name + native hover tooltip (e.g. "Hide series proton"). */
    label: string;
    onclick: (event: MouseEvent) => void;
    children: Snippet;
    /** `danger` tints the hover state with the destructive colour (remove). */
    variant?: "default" | "danger";
    /** Toggle state for two-state controls (e.g. the eye toggle). */
    pressed?: boolean;
    disabled?: boolean;
    testid?: string;
    class?: string;
  }

  let {
    label,
    onclick,
    children,
    variant = "default",
    pressed,
    disabled = false,
    testid,
    class: className,
  }: Props = $props();
</script>

<button
  type="button"
  data-testid={testid}
  title={label}
  aria-label={label}
  aria-pressed={pressed}
  {disabled}
  onclick={(e) => onclick(e)}
  class={cn(
    // ≥44px target on mobile (< sm), ≥36px from sm up — per the mobile-target rule.
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 sm:h-9 sm:w-9",
    variant === "danger" ? "hover:text-destructive" : "hover:text-foreground",
    className,
  )}
>
  {@render children()}
</button>
