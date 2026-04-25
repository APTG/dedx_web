<script lang="ts">
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";

  interface Props {
    state: EntitySelectionState;
  }

  let { state }: Props = $props();
</script>

<div
  role="status"
  aria-live="polite"
  class="sr-only"
>
  {state.selectionSummary}
</div>
