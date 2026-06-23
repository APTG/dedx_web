<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { getProgramKindMeta, type ProgramKind } from "$lib/utils/program-kind";
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "$lib/components/ui/tooltip";

  interface Props {
    kind: ProgramKind;
    class?: string;
  }

  let { kind, class: className }: Props = $props();

  const meta = $derived(getProgramKindMeta(kind));
</script>

<!--
  Tooltip wraps the badge so the kind description (previously only on `title=`) is
  reachable on hover, keyboard focus, and touch tap. The span is the trigger via
  Bits UI's child snippet — this avoids rendering a nested <button> when the badge
  appears inside a list-item button.
-->
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <span
          {...props}
          class={cn(
            "inline-flex cursor-default items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            kind === "TAB" &&
              "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
            kind === "FN" &&
              "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
            kind === "EXT" &&
              "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
            className,
          )}
          data-tag={kind}
          data-testid="picker-program-tag-{kind}"
          aria-label={meta.description}
          tabindex="-1"
        >
          <span aria-hidden="true">{meta.glyph}</span>
          <span>{meta.badge}</span>
        </span>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent>{meta.description}</TooltipContent>
  </Tooltip>
</TooltipProvider>
