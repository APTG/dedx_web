<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { ProgramEntity } from "$lib/wasm/types";
  import type { ExternalProgramEntity } from "$lib/state/external-compatibility";
  import type { SelectedProgram, AutoSelectProgram } from "$lib/state/entity-selection.svelte";
  import { getProgramDescription } from "$lib/config/program-names";
  import { programKind } from "$lib/utils/program-kind";
  import ProgramTag from "./program-tag.svelte";

  type AnyProgram = SelectedProgram | ProgramEntity | ExternalProgramEntity;

  interface Props {
    builtinPrograms: ProgramEntity[];
    externalPrograms: ExternalProgramEntity[];
    currentProgram: SelectedProgram;
    isMultiMode: boolean;
    multiIds: (number | string)[];
    autoResolved: ProgramEntity | null;
    onSelect: (program: AnyProgram) => void;
    onToggleMulti: (id: number | string) => void;
    getProgramName: (id: number | string) => string;
  }

  let {
    builtinPrograms,
    externalPrograms,
    currentProgram,
    isMultiMode,
    multiIds,
    autoResolved,
    onSelect,
    onToggleMulti,
    getProgramName,
  }: Props = $props();

  const isAuto = $derived(currentProgram.id === -1);

  function isMultiSelected(id: number | string): boolean {
    return multiIds.includes(id);
  }

  function isAnchor(id: number | string): boolean {
    return multiIds[0] === id;
  }
</script>

<!-- Tiny-bucket: flat tappable list without scroll container -->
<div class="space-y-0.5" data-testid="picker-program-inline-list">
  {#if !isMultiMode}
    <!-- Auto-select hero row -->
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
      onclick={() => onSelect({ id: -1, name: "Auto-select", resolvedProgram: null } as AutoSelectProgram)}
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
  {/if}

  <ul role="listbox" aria-label="Programs" aria-multiselectable={isMultiMode} data-testid="picker-program-list">
    {#each builtinPrograms as program (program.id)}
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
              if (!anchor) onToggleMulti(program.id);
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

    {#each externalPrograms as program (program.id)}
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
              if (!anchor) onToggleMulti(program.id);
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
  </ul>
</div>
