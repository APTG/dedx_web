<script lang="ts">
  import { untrack } from "svelte";
  import ElementPicker from "../element-picker.svelte";
  import { ELEMENTS, resolveElement } from "$lib/utils/element-data";

  interface Props {
    mode: "ADD" | "EDIT";
    /** Atomic numbers already in the compound (dimmed in ADD mode). */
    usedZ: Set<number>;
    /** The row's current element, in EDIT mode. */
    currentZ: number | null;
    /** Commit the chosen element. */
    onSelect: (z: number) => void;
    onCancel: () => void;
  }

  let { mode, usedZ, currentZ, onSelect, onCancel }: Props = $props();

  // The pending choice. In EDIT mode it seeds from the current element so the
  // footer reads "Change to X" immediately and the tile is highlighted.
  // Seeded once from the initial props — the overlay is remounted per open, so
  // capturing the initial value here is intentional (untrack silences the warning).
  let pendingZ = $state<number | null>(untrack(() => (mode === "EDIT" ? currentZ : null)));
  let query = $state("");

  let searchInput: HTMLInputElement | null = $state(null);
  $effect(() => {
    searchInput?.focus();
  });

  // Live resolution as the user types; an exact symbol/name/Z match becomes the
  // pending selection so Enter (or Add) commits it.
  $effect(() => {
    const text = query.trim();
    if (!text) return;
    const resolved = resolveElement(text);
    if (resolved) pendingZ = resolved.atomicNumber;
  });

  let pendingName = $derived(
    pendingZ === null ? null : (ELEMENTS.find((e) => e.atomicNumber === pendingZ)?.name ?? null),
  );
  let pendingSymbol = $derived(
    pendingZ === null ? "" : (ELEMENTS.find((e) => e.atomicNumber === pendingZ)?.symbol ?? ""),
  );

  // In ADD mode the element must not already be present.
  let canCommit = $derived(
    pendingZ !== null && (mode === "EDIT" || pendingZ === currentZ || !usedZ.has(pendingZ)),
  );

  function commit() {
    if (pendingZ !== null && canCommit) onSelect(pendingZ);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }
</script>

<div class="flex h-full flex-col bg-background" data-testid="compound-editor-mobile-picker">
  <div class="border-b p-3">
    <input
      bind:this={searchInput}
      bind:value={query}
      onkeydown={onKeyDown}
      type="text"
      inputmode="text"
      placeholder="Type symbol, name, or Z…"
      class="w-full rounded-md border bg-background px-3 py-2 text-base"
      onfocus={(e) => e.currentTarget.scrollIntoView({ block: "center" })}
      data-testid="mobile-picker-search"
    />
    <p class="mt-1 min-h-[20px] text-sm text-muted-foreground" data-testid="mobile-picker-helper">
      {#if pendingName}
        → {pendingName} · Z={pendingZ}
        {#if canCommit}<span class="opacity-70">— ↵ add</span>{:else}
          <span class="text-destructive">— already in compound</span>{/if}
      {/if}
    </p>
  </div>

  <div class="flex-1 overflow-auto p-3">
    <ElementPicker
      {mode}
      {usedZ}
      {currentZ}
      highlightZ={pendingZ}
      onSelect={(z) => (pendingZ = z)}
    />
  </div>

  <div
    class="sticky bottom-0 flex gap-2 border-t bg-background p-3"
    style="padding-bottom: max(12px, env(safe-area-inset-bottom));"
  >
    <button
      type="button"
      class="flex-1 rounded-md border px-4 py-3 text-base font-medium hover:bg-accent"
      onclick={onCancel}
      data-testid="mobile-picker-cancel"
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={!canCommit}
      class="flex-1 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
      onclick={commit}
      data-testid="mobile-picker-commit"
    >
      {#if mode === "EDIT"}Change to {pendingSymbol || "…"}{:else}Add {pendingSymbol} →{/if}
    </button>
  </div>
</div>
