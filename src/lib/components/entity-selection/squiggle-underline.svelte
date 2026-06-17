<script lang="ts">
  import { cn } from "$lib/utils.js";

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();

  // Unique pattern id so multiple instances on a page never collide.
  const patternId = `squiggle-${Math.random().toString(36).slice(2)}`;
</script>

<!--
  Decorative coral squiggle for the active-target tab underline (the "squiggle"
  from the wireframes). A tiling SVG <pattern> keeps the wave period constant
  regardless of tab width. Static (no animation), so reduced-motion is a no-op.
-->
<svg
  class={cn("block h-full w-full text-orange-500", className)}
  fill="none"
  preserveAspectRatio="none"
  aria-hidden="true"
  data-testid="picker-tab-squiggle"
>
  <defs>
    <pattern id={patternId} width="8" height="6" patternUnits="userSpaceOnUse">
      <path d="M0 3 Q2 0.75 4 3 T8 3" stroke="currentColor" stroke-width="1.5" fill="none" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#{patternId})" />
</svg>
