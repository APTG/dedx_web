<script lang="ts">
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import type { MultiProgramState } from "$lib/state/multi-program.svelte";

  let { multiProgState }: { multiProgState: MultiProgramState | null } = $props();

  let showAdvancedHint = $state(false);
  let hintTimeout: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!isAdvancedMode.value || !multiProgState) return;

    const storageKey = "dedx_adv_hint_count";
    const count = parseInt(localStorage.getItem(storageKey) || "0", 10);

    if (count < 2) {
      showAdvancedHint = true;
      localStorage.setItem(storageKey, (count + 1).toString());

      hintTimeout = setTimeout(() => {
        showAdvancedHint = false;
      }, 8000);
    }
    return () => {
      if (hintTimeout) clearTimeout(hintTimeout);
    };
  });

  function dismissAdvancedHint(): void {
    showAdvancedHint = false;
    if (hintTimeout) clearTimeout(hintTimeout);
  }
</script>

{#if showAdvancedHint}
  <div
    class="flex items-start justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
    role="status"
    aria-live="polite"
  >
    <div class="flex-1 pr-4">
      <p class="font-medium">Multi-program comparison enabled</p>
      <p class="mt-1 text-blue-700 dark:text-blue-300">
        Select multiple programs to compare results side-by-side. Use the columns button to
        show/hide programs or change the quantity focus.
      </p>
    </div>
    <button
      type="button"
      class="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-lg leading-none"
      aria-label="Dismiss hint"
      onclick={dismissAdvancedHint}
    >
      ×
    </button>
  </div>
{/if}
