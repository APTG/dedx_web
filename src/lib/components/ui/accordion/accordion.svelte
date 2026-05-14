<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    // shadcn-svelte generated callers may pass `collapsible`; Bits UI 2 no
    // longer accepts it, so consume it here instead of forwarding to Root.
    collapsible = false,
    ...restProps
  }: AccordionPrimitive.RootProps & { collapsible?: boolean } = $props();
</script>

<AccordionPrimitive.Root
  bind:ref
  bind:value={value as never}
  data-slot="accordion"
  data-collapsible={collapsible ? "true" : undefined}
  class={cn("cn-accordion flex w-full flex-col", className)}
  {...restProps}
/>
