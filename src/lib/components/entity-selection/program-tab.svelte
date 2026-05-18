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
  import { computeBucket } from "./size-bucket";
  import ProgramTag from "./program-tag.svelte";
  import ProgramInlineList from "./program-inline-list.svelte";

  type AnyProgram = SelectedProgram | ProgramEntity | ExternalProgramEntity;

  interface Props {
    selectionState: EntitySelectionState;
    onSelect: (program: AnyProgram) => void;
    /** Shared search query owned by `<EntitySelection>` (picker-level row). */
    query?: string;
    /** Whether the advanced toolbar (Compare-across) is visible. Multi-select mode is only active when this is true. */
    showAdvancedToolbar?: boolean;
  }

  let { selectionState, onSelect, query = "", showAdvancedToolbar = false }: Props = $props();

  function matches(p: { name: string; version?: string | undefined }, q: string): boolean {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return true;
    return (
      p.name.toLowerCase().includes(trimmed) || (p.version ?? "").toLowerCase().includes(trimmed)
    );
  }

  const builtin = $derived(selectionState.availablePrograms);
  const external = $derived(selectionState.availableExternalPrograms);

  const totalCount = $derived(builtin.length + external.length);
  const bucket = $derived(computeBucket(totalCount));

  const filteredBuiltin = $derived(builtin.filter((p) => matches(p, query)));
  const filteredExternal = $derived(external.filter((p) => matches(p, query)));

  const currentProgram = $derived(selectionState.selectedProgram);
  const isAuto = $derived(currentProgram.id === -1);
  const autoResolved = $derived.by<ProgramEntity | null>(() => {
    if (!isAuto) return null;
    const p = currentProgram as AutoSelectProgram;
    return p.resolvedProgram;
  });

  // Multi-select mode: active only when the advanced toolbar is visible AND across=program.
  const isMultiMode = $derived(showAdvancedToolbar && selectionState.across === "program");
  const multiIds = $derived(selectionState.multiSelected.program);

  function isMultiSelected(id: number | string): boolean {
    return multiIds.includes(id);
  }

  function isAnchor(id: number | string): boolean {
    return multiIds[0] === id;
  }

  function getProgramName(id: number | string): string {
    const b = builtin.find((p) => p.id === id);
    if (b) return b.name;
    const e = external.find((p) => p.id === id);
    return e?.name ?? String(id);
  }
</script>

<div class="space-y-3" data-testid="picker-program-tab">
  {#if isMultiMode}
    {#if multiIds.length > 0}
      <div
        class="flex flex-wrap gap-1.5"
        aria-label="Selected programs for comparison"
        data-testid="picker-program-multi-selected"
      >
        {#each multiIds as id (id)}
          {@const anchor = isAnchor(id)}
          <span
            class={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              anchor
                ? "border-primary bg-primary/15 text-primary"
                : "border-muted bg-muted text-muted-foreground",
            )}
          >
            {getProgramName(id)}
            {#if !anchor}
              <button
                type="button"
                aria-label="Remove {getProgramName(id)} from comparison"
                class="ml-0.5 rounded-full hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                onclick={() => selectionState.toggleMulti("program", id)}
              >×</button>
            {/if}
          </span>
        {/each}
      </div>
    {/if}
  {:else if !isAuto}
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm transition-colors hover:bg-primary/15"
      data-testid="picker-program-selected"
      aria-label="Selected: {currentProgram.name}. Click to clear."
      onclick={() => selectionState.selectProgram(-1)}
    >
      <span class="font-medium">{currentProgram.name}</span>
      {#if typeof currentProgram.id !== "string"}
        {@const desc = getProgramDescription(currentProgram.id as number)}
        {#if desc}
          <span class="font-mono text-xs text-muted-foreground">{desc}</span>
        {/if}
      {/if}
      <span
        class="ml-auto rounded border border-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        aria-hidden="true"
      >× clear</span>
    </button>
  {/if}

  {#if bucket === "tiny"}
    <!-- Tiny bucket: flat list without search bar or scroll container -->
    <ProgramInlineList
      builtinPrograms={filteredBuiltin}
      externalPrograms={filteredExternal}
      {currentProgram}
      {isMultiMode}
      {multiIds}
      {autoResolved}
      {onSelect}
      onAutoSelect={() => selectionState.selectProgram(-1)}
      onToggleMulti={(id) => selectionState.toggleMulti("program", id)}
    />
  {:else}
    <!-- Medium+ bucket: auto-select hero + bounded-scroll list -->
    {#if !isMultiMode}
      <button
        type="button"
        class={cn(
          "flex w-full items-start gap-3 rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors",
          isAuto
            ? "border-primary bg-primary/10"
            : "border-primary/30 bg-primary/5 hover:bg-primary/10",
        )}
        data-testid="picker-program-auto-hero"
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
              {getProgramDescription(autoResolved.id) ??
                "Recommended for the current particle/material."}
            {:else}
              No compatible program for the current particle / material.
            {/if}
          </p>
        </span>
        {#if autoResolved}
          <ProgramTag kind={programKind(autoResolved.id)} />
        {/if}
      </button>
    {/if}

    <ul
      role="listbox"
      aria-label="Programs"
      aria-multiselectable={isMultiMode}
      tabindex="0"
      class="max-h-52 overflow-auto space-y-0.5"
      data-testid="picker-program-list"
    >
      {#each filteredBuiltin as program (program.id)}
        {@const isSingleSelected = !isMultiMode && currentProgram.id === program.id}
        {@const inMulti = isMultiMode && isMultiSelected(program.id)}
        {@const anchor = isMultiMode && isAnchor(program.id)}
        {@const desc = getProgramDescription(program.id)}
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={isMultiMode ? inMulti : isSingleSelected}
            aria-disabled={isMultiMode && anchor}
            data-testid="picker-program-item-{program.id}"
            tabindex={-1}
            disabled={isMultiMode && anchor}
            class={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
              (isMultiMode ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
            )}
            onclick={() => {
              if (isMultiMode) {
                if (!anchor) selectionState.toggleMulti("program", program.id);
              } else {
                onSelect(program);
              }
            }}
          >
            {#if isMultiMode}
              <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
            {/if}
            <span class="flex-1 justify-between gap-3 flex items-center">
              <span>
                <span>{program.name}</span>
                {#if desc}<span class="text-muted-foreground"> · {desc}</span>{/if}
              </span>
              <ProgramTag kind={programKind(program.id)} />
            </span>
            {#if isMultiMode && anchor}
              <span class="text-xs text-muted-foreground">(anchor)</span>
            {/if}
          </button>
        </li>
      {/each}

      {#each filteredExternal as program (program.id)}
        {@const isSingleSelected = !isMultiMode && currentProgram.id === program.id}
        {@const inMulti = isMultiMode && isMultiSelected(program.id)}
        {@const anchor = isMultiMode && isAnchor(program.id)}
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={isMultiMode ? inMulti : isSingleSelected}
            aria-disabled={isMultiMode && anchor}
            data-testid="picker-program-item-{program.id}"
            tabindex={-1}
            disabled={isMultiMode && anchor}
            class={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
              (isMultiMode ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
            )}
            onclick={() => {
              if (isMultiMode) {
                if (!anchor) selectionState.toggleMulti("program", program.id);
              } else {
                onSelect(program);
              }
            }}
          >
            {#if isMultiMode}
              <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
            {/if}
            <span class="flex-1 justify-between gap-3 flex items-center">
              <span>🔗 {program.name}</span>
              {#if program.label}<span class="text-muted-foreground"> · {program.label}</span>{/if}
              <ProgramTag kind="EXT" />
            </span>
            {#if isMultiMode && anchor}
              <span class="text-xs text-muted-foreground">(anchor)</span>
            {/if}
          </button>
        </li>
      {/each}

      {#if filteredBuiltin.length === 0 && filteredExternal.length === 0}
        <li class="px-2 py-4 text-center text-sm text-muted-foreground">No programs match.</li>
      {/if}
    </ul>
  {/if}

  <div
    class="flex flex-wrap items-center gap-3 border-t pt-2 text-xs text-muted-foreground"
    data-testid="picker-program-legend"
  >
    <span class="font-medium uppercase tracking-wider">Legend</span>
    <span class="flex items-center gap-1"><ProgramTag kind="TAB" /> data tables</span>
    <span class="flex items-center gap-1"><ProgramTag kind="FN" /> analytical model</span>
    <span class="flex items-center gap-1"><ProgramTag kind="EXT" /> external file</span>
  </div>
</div>
