<script lang="ts">
  interface Props {
    /** Element symbol of the row the sheet acts on. */
    symbol: string;
    /** Element name, used in the destructive label. */
    name: string;
    /** Whether removal is allowed (false for the last remaining row). */
    canRemove: boolean;
    onChangeElement: () => void;
    onRemove: () => void;
    onCancel: () => void;
  }

  let { symbol, name, canRemove, onChangeElement, onRemove, onCancel }: Props = $props();

  let removeButton: HTMLButtonElement | null = $state(null);

  // Per the spec the destructive action takes default focus — the sheet itself
  // is the confirmation, so the user can dismiss-or-delete in one reach.
  $effect(() => {
    removeButton?.focus();
  });
</script>

<div
  class="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50"
  data-testid="compound-editor-row-action-sheet"
  role="presentation"
  onclick={(e) => {
    if (e.target === e.currentTarget) onCancel();
  }}
>
  <div class="m-2 overflow-hidden rounded-2xl bg-background shadow-lg" role="menu">
    <div class="border-b px-4 py-3 text-center text-sm font-medium text-muted-foreground">
      {name} ({symbol})
    </div>
    <button
      type="button"
      role="menuitem"
      class="block w-full px-4 py-4 text-center text-base text-foreground hover:bg-accent"
      onclick={onChangeElement}
      data-testid="row-action-change"
    >
      Change element…
    </button>
    <button
      type="button"
      role="menuitem"
      bind:this={removeButton}
      disabled={!canRemove}
      class="block w-full border-t px-4 py-4 text-center text-base font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
      onclick={onRemove}
      data-testid="row-action-remove"
    >
      Remove from compound
    </button>
  </div>
  <button
    type="button"
    class="m-2 mt-1 rounded-2xl bg-background px-4 py-4 text-center text-base font-semibold text-foreground shadow-lg hover:bg-accent"
    onclick={onCancel}
    data-testid="row-action-cancel"
  >
    Cancel
  </button>
</div>
