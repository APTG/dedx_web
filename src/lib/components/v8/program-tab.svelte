<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type {
    EntitySelectionState,
    SelectedProgram,
    AutoSelectProgram,
  } from "$lib/state/entity-selection.svelte";
  import type { ProgramEntity } from "$lib/wasm/types";
  import type { ExternalProgramEntity } from "$lib/state/external-compatibility";
  import { getProgramDescription } from "$lib/config/program-names";
  import { programKind } from "$lib/utils/program-kind";
  import SelectedPill from "./selected-pill.svelte";
  import SearchInput from "./search-input.svelte";
  import ProgramTag from "./program-tag.svelte";

  type AnyProgram = SelectedProgram | ProgramEntity | ExternalProgramEntity;

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (program: AnyProgram) => void;
  }

  let { selectionState, onSelect }: Props = $props();

  let query = $state("");
  let inputRef: HTMLInputElement | null = $state(null);

  $effect(() => {
    inputRef?.focus();
  });

  function matches(p: { name: string; version?: string | undefined }, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    return (
      p.name.toLowerCase().includes(trimmed) ||
      (p.version ?? "").toLowerCase().includes(trimmed)
    );
  }

  const builtin = $derived(selectionState.availablePrograms);
  const external = $derived(selectionState.availableExternalPrograms);

  const filteredBuiltin = $derived(builtin.filter((p) => matches(p, query)));
  const filteredExternal = $derived(external.filter((p) => matches(p, query)));

  const currentProgram = $derived(selectionState.selectedProgram);
  const isAuto = $derived(currentProgram.id === -1);
  const autoResolved = $derived.by<ProgramEntity | null>(() => {
    if (!isAuto) return null;
    const p = currentProgram as AutoSelectProgram;
    return p.resolvedProgram;
  });
</script>

<div class="space-y-3" data-testid="v8-program-tab">
  {#if !isAuto}
    <SelectedPill
      label={currentProgram.name}
      meta={typeof currentProgram.id === "string"
        ? undefined
        : (getProgramDescription(currentProgram.id as number) ?? undefined)}
      onClear={() => selectionState.selectProgram(-1)}
      data-testid="v8-program-selected"
    />
  {/if}

  <SearchInput
    value={query}
    onInput={(v) => (query = v)}
    bind:inputRef
    placeholder="Program name or version…"
    data-testid="v8-program-search"
  />

  <button
    type="button"
    class={cn(
      "flex w-full items-start gap-3 rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors",
      isAuto
        ? "border-primary bg-primary/10"
        : "border-primary/30 bg-primary/5 hover:bg-primary/10",
    )}
    data-testid="v8-program-auto-hero"
    aria-pressed={isAuto}
    onclick={() => selectionState.selectProgram(-1)}
  >
    <span class="text-base" aria-hidden="true">✦</span>
    <span class="flex-1">
      <span class="font-semibold">Auto-select</span>
      {#if autoResolved}
        <span class="text-muted-foreground"> → </span>
        <span>{autoResolved.name}</span>
      {/if}
      <p class="text-xs text-muted-foreground mt-0.5">
        {#if autoResolved}
          {getProgramDescription(autoResolved.id) ?? "Recommended for the current particle/material."}
        {:else}
          No compatible program for the current particle / material.
        {/if}
      </p>
    </span>
    {#if autoResolved}
      <ProgramTag kind={programKind(autoResolved.id)} />
    {/if}
  </button>

  <ul
    role="listbox"
    aria-label="Programs"
    class="max-h-64 overflow-auto space-y-0.5"
    data-testid="v8-program-list"
  >
    {#each filteredBuiltin as program (program.id)}
      {@const isSelected = currentProgram.id === program.id}
      {@const desc = getProgramDescription(program.id)}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          data-testid="v8-program-item-{program.id}"
          tabindex={-1}
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
            isSelected && "bg-primary/15 font-semibold",
          )}
          onclick={() => onSelect(program)}
        >
          <span class="flex-1">
            <span>{program.name}</span>
            {#if desc}<span class="text-muted-foreground"> · {desc}</span>{/if}
          </span>
          <ProgramTag kind={programKind(program.id)} />
        </button>
      </li>
    {/each}

    {#each filteredExternal as program (program.id)}
      {@const isSelected = currentProgram.id === program.id}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={isSelected}
          data-testid="v8-program-item-{program.id}"
          tabindex={-1}
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
            isSelected && "bg-primary/15 font-semibold",
          )}
          onclick={() => onSelect(program)}
        >
          <span class="flex-1">
            <span>🔗 {program.name}</span>
            {#if program.label}<span class="text-muted-foreground"> · {program.label}</span>{/if}
          </span>
          <ProgramTag kind="EXT" />
        </button>
      </li>
    {/each}

    {#if filteredBuiltin.length === 0 && filteredExternal.length === 0}
      <li class="px-2 py-4 text-center text-sm text-muted-foreground">No programs match.</li>
    {/if}
  </ul>

  <div
    class="flex flex-wrap items-center gap-3 border-t pt-2 text-xs text-muted-foreground"
    data-testid="v8-program-legend"
  >
    <span class="font-medium uppercase tracking-wider">Legend</span>
    <span class="flex items-center gap-1"><ProgramTag kind="TAB" /> tabulated data</span>
    <span class="flex items-center gap-1"><ProgramTag kind="FN" /> analytical model</span>
    <span class="flex items-center gap-1"><ProgramTag kind="EXT" /> external file</span>
  </div>
</div>
