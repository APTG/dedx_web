<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { getProgramKindMeta, type ProgramKind } from "$lib/utils/program-kind";

  interface Props {
    kind: ProgramKind;
    class?: string;
  }

  let { kind, class: className }: Props = $props();

  const meta = $derived(getProgramKindMeta(kind));
</script>

<span
  class={cn(
    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
    kind === "TAB" && "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
    kind === "FN" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    kind === "EXT" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    className,
  )}
  data-tag={kind}
  data-testid="v8-program-tag-{kind}"
  title={meta.description}
  aria-label={meta.description}
>
  <span aria-hidden="true">{meta.glyph}</span>
  <span>{meta.badge}</span>
</span>
