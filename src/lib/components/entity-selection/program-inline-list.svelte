<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { ProgramEntity } from "$lib/wasm/types";
  import type { ExternalProgramEntity } from "$lib/state/external-compatibility";
  import type { SelectedProgram } from "$lib/state/entity-selection.svelte";
  import { getProgramDescription, getProgramHelp } from "$lib/config/program-names";
  import { programKind } from "$lib/utils/program-kind";
  import ProgramTag from "./program-tag.svelte";
  import HelpHint from "$lib/components/help-hint.svelte";

  type AnyProgram = SelectedProgram | ProgramEntity | ExternalProgramEntity;

  interface Props {
    builtinPrograms: ProgramEntity[];
    externalPrograms: ExternalProgramEntity[];
    currentProgram: SelectedProgram;
    isMultiMode: boolean;
    multiIds: (number | string)[];
    autoResolved: ProgramEntity | ExternalProgramEntity | null;
    onSelect: (program: AnyProgram) => void;
    onAutoSelect: () => void;
    onToggleMulti: (id: number | string) => void;
  }

  let {
    builtinPrograms,
    externalPrograms,
    currentProgram,
    isMultiMode,
    multiIds,
    autoResolved,
    onSelect,
    onAutoSelect,
    onToggleMulti,
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
      onclick={onAutoSelect}
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
            {(typeof autoResolved.id === "number"
              ? getProgramDescription(autoResolved.id)
              : undefined) ?? "Recommended for the current particle/material."}
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
    data-testid="picker-program-list"
  >
    {#each builtinPrograms as program (program.id)}
      {@const isSingleSelected = !isMultiMode && currentProgram.id === program.id}
      {@const inMulti = isMultiMode && isMultiSelected(program.id)}
      {@const anchor = isMultiMode && isAnchor(program.id)}
      {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
      {@const desc = getProgramDescription(program.id)}
      {@const help = getProgramHelp(program.id)}
      <li role="presentation" class="flex items-center gap-1">
        <button
          type="button"
          role="option"
          aria-selected={isMultiMode ? inMulti : isSingleSelected}
          aria-disabled={isMultiMode && anchor}
          data-testid="picker-program-item-{program.id}"
          tabindex={-1}
          disabled={isMultiMode && anchor}
          class={cn(
            "flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
            isChecked && "ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
          )}
          onclick={() => {
            if (isMultiMode) {
              if (!anchor) onToggleMulti(program.id);
            } else {
              onSelect(program);
            }
          }}
        >
          <span
            aria-hidden="true"
            class="w-4 shrink-0 text-center text-xs {isChecked
              ? 'font-bold text-orange-700'
              : 'text-muted-foreground'}">{isChecked ? "✓" : isMultiMode ? "○" : ""}</span
          >
          <span class="flex-1 justify-between gap-3 flex items-center">
            <span>
              <span>{program.name}</span>
              {#if desc}<span class="text-muted-foreground"> · {desc}</span>{/if}
            </span>
            <ProgramTag kind={programKind(program.id)} />
          </span>
        </button>
        {#if help}
          <HelpHint
            text={help}
            label="About {program.name}"
            side="left"
            class="mr-1"
            testId="picker-program-help-{program.id}"
          />
        {/if}
      </li>
    {/each}

    {#each externalPrograms as program (program.id)}
      {@const isSingleSelected = !isMultiMode && currentProgram.id === program.id}
      {@const inMulti = isMultiMode && isMultiSelected(program.id)}
      {@const anchor = isMultiMode && isAnchor(program.id)}
      {@const isChecked = isMultiMode ? inMulti : isSingleSelected}
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
            isChecked && "ring-1 ring-inset ring-orange-400 bg-orange-50/60 font-semibold",
          )}
          onclick={() => {
            if (isMultiMode) {
              if (!anchor) onToggleMulti(program.id);
            } else {
              onSelect(program);
            }
          }}
        >
          <span
            aria-hidden="true"
            class="w-4 shrink-0 text-center text-xs {isChecked
              ? 'font-bold text-orange-700'
              : 'text-muted-foreground'}">{isChecked ? "✓" : isMultiMode ? "○" : ""}</span
          >
          <span class="flex-1 justify-between gap-3 flex items-center">
            <span>🔗 {program.name}</span>
            {#if program.label}<span class="text-muted-foreground"> · {program.label}</span>{/if}
            <ProgramTag kind="EXT" />
          </span>
        </button>
      </li>
    {/each}
  </ul>
</div>
