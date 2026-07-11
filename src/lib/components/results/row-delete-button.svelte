<script lang="ts">
  // Shared row-removal control used by every calculator table (basic multi-row,
  // advanced energy, advanced range, inverse-STP). One component keeps the
  // affordance identical everywhere: a persistently visible "×" glyph inside a
  // 32px hit target that meets touch-friendly sizing on mobile (no hover
  // required to discover it). Hover/focus escalate to the destructive colour;
  // the disabled state (last remaining row) is dimmed and non-interactive.
  interface Props {
    onDelete: () => void;
    /** Accessible label, e.g. "Delete row 3". Also the button's text-node stays "×". */
    label: string;
    testId?: string;
    disabled?: boolean;
    class?: string;
  }

  let { onDelete, label, testId, disabled = false, class: className = "" }: Props = $props();
</script>

<button
  type="button"
  aria-label={label}
  aria-disabled={disabled}
  {disabled}
  data-testid={testId}
  class={`inline-flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none transition-colors ${
    disabled
      ? "cursor-not-allowed text-muted-foreground/25"
      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
  } ${className}`}
  onclick={() => {
    if (!disabled) onDelete();
  }}>×</button
>
