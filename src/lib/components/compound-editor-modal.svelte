<script lang="ts">
  import { untrack } from "svelte";
  import { Dialog } from "bits-ui";
  import type { StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
  import {
    createCompoundEditorState,
    type SavedCompoundData,
  } from "$lib/state/compound-editor.svelte";
  import DesktopSheet from "./compound-editor/desktop-sheet.svelte";
  import MobileSheet from "./compound-editor/mobile-sheet.svelte";
  import type { CompoundEditorPrefill } from "./compound-editor/types";

  interface Props {
    open: boolean;
    compound: StoredCompoundInternal | null;
    onOpenChange: (open: boolean) => void;
    onSave: (data: SavedCompoundData) => void;
    onDelete: () => void;
    /**
     * Seed values for *create* mode (used when `compound` is null) — the
     * "Edit & save copy" / failed-URL recovery flows pre-fill the form (#648).
     */
    prefill?: CompoundEditorPrefill | null;
    /**
     * Amber notice text shown at the top of the modal when a shared URL could
     * not be fully restored. Fields named in the text are highlighted (#648).
     */
    initialWarning?: string | null;
  }

  let {
    open,
    compound,
    onOpenChange,
    onSave,
    onDelete,
    prefill = null,
    initialWarning = null,
  }: Props = $props();

  // Single shared controller: both the desktop and mobile views are thin
  // bindings over this state factory, so the editor logic lives in one place
  // (issue #762).
  const editor = createCompoundEditorState({ onSave: (data) => onSave(data) });

  // (Re)initialise the form whenever the modal opens or its seed props change.
  $effect(() => {
    const args = { open, compound, prefill, initialWarning };
    untrack(() => editor.load(args));
  });

  // Phone-only mobile layout: ≤ 640px AND a coarse pointer, matching the rest
  // of the entity-selection redesign. Guarded for jsdom (no matchMedia), where
  // it stays false so unit tests exercise the desktop layout.
  let isMobile = $state(false);
  let prefersReducedMotion = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px) and (pointer: coarse)");
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (prefersReducedMotion = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });
</script>

{#if isMobile && open}
  <!-- Wrap the full-screen mobile sheet in the same bits-ui Dialog primitive the
       desktop path uses, so it gets a focus trap, aria-modal semantics,
       background scroll-lock + inert, and Escape-to-close. -->
  <Dialog.Root {open} onOpenChange={(newOpen) => onOpenChange(newOpen)}>
    <Dialog.Portal>
      <Dialog.Content class="fixed inset-0 z-[60] outline-none">
        <Dialog.Title class="sr-only">
          {compound ? "Edit Compound" : "Compound Editor"}
        </Dialog.Title>
        <Dialog.Description class="sr-only">
          {compound ? "Update compound properties" : "Define a new compound material"}
        </Dialog.Description>
        <MobileSheet {editor} {prefersReducedMotion} onCancel={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{:else}
  <Dialog.Root {open} onOpenChange={(newOpen) => onOpenChange(newOpen)}>
    <Dialog.Portal>
      <Dialog.Overlay
        class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <Dialog.Content
        class="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-[500px] md:max-w-[650px] max-h-[95dvh] overflow-y-auto"
      >
        <DesktopSheet
          {editor}
          {compound}
          {initialWarning}
          onCancel={() => onOpenChange(false)}
          {onDelete}
        />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
