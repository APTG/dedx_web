<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
  import type {
    ExternalOnlyParticle,
    ExternalOnlyMaterial,
    ExternalProgramEntity,
  } from "$lib/state/external-compatibility";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";
  import { getParticleListLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import { ELECTRON_ID } from "$lib/state/entity-selection.svelte";
  import { getProgramDescription } from "$lib/config/program-names";
  import { programKind } from "$lib/utils/program-kind";
  import ProgramTag from "./program-tag.svelte";
  import GroupedResultList from "./grouped-result-list.svelte";

  type PickerTab = "particle" | "material" | "program";
  type Particle = ParticleEntity | ExternalOnlyParticle;
  type Material = MaterialEntity | ExternalOnlyMaterial;
  type AnyProgram = ProgramEntity | ExternalProgramEntity;

  interface Props {
    selectionState: EntitySelectionState;
    activeTab: PickerTab;
    onClose: () => void;
    onParticleSelect: (p: Particle) => void;
    onMaterialSelect: (m: Material) => void;
    onProgramSelect: (p: AnyProgram) => void;
  }

  let {
    selectionState,
    activeTab,
    onClose,
    onParticleSelect,
    onMaterialSelect,
    onProgramSelect,
  }: Props = $props();

  let query = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);
  let closeButtonEl = $state<HTMLButtonElement | null>(null);
  const sheetHistoryKey = `picker-sheet:${Math.random().toString(36).slice(2)}`;

  // Autofocus the search input on mount — this is the sheet's sole keyboard owner.
  $effect(() => {
    queueMicrotask(() => inputEl?.focus());
  });

  // Lock body scroll and trap focus while open.
  $effect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let closedByPopstate = false;

    function getFocusable(): HTMLElement[] {
      if (!dialogEl) return [];
      return Array.from(
        dialogEl.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === null)) {
          e.preventDefault();
          last.focus();
        }
      }
    }

    // Handle hardware Back via popstate.
    function onPop(e: PopStateEvent) {
      e.preventDefault();
      closedByPopstate = true;
      onClose();
    }

    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    // Push a state entry so Back closes the sheet.
    history.pushState({ ...(history.state ?? {}), pickerSheetKey: sheetHistoryKey }, "");

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (!closedByPopstate && history.state?.pickerSheetKey === sheetHistoryKey) {
        history.back();
      }
    };
  });

  const placeholder = $derived(
    activeTab === "particle"
      ? "Search particles…"
      : activeTab === "material"
        ? "Search materials…"
        : "Search programs…",
  );

  // ── Particle list ─────────────────────────────────────────────────────────
  const NAMED_IDS = new Set([1, 2]);
  const ELECTRON_ID_VAL = ELECTRON_ID;

  const allBuiltinParticles = $derived(
    selectionState.allParticles.filter((p) => p.id !== ELECTRON_ID_VAL),
  );

  const flatParticles = $derived.by<Particle[]>(() => {
    const named = allBuiltinParticles
      .filter((p) => NAMED_IDS.has(p.id as number))
      .sort((a, b) => (a.id as number) - (b.id as number));
    const ions = allBuiltinParticles
      .filter((p) => !NAMED_IDS.has(p.id as number))
      .sort((a, b) => (a.id as number) - (b.id as number));
    const ext = [...selectionState.externalOnlyParticles].sort((a, b) => a.Z - b.Z);
    return [...named, ...ions, ...ext] as Particle[];
  });

  function particleSearchText(p: Particle): string {
    if (typeof p.id === "string") {
      const ep = p as ExternalOnlyParticle;
      return `${ep.localId} ${ep.name} ${ep.symbol} ${ep.label} ext external`;
    }
    return getParticleSearchText(p as ParticleEntity);
  }

  function particleMatches(p: Particle, q: string): boolean {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    const text = particleSearchText(p).toLowerCase();
    const zEq = t.match(/^z\s*=\s*(\d+)$/);
    if (zEq && typeof p.id === "number") return p.id === Number(zEq[1]);
    return text.includes(t);
  }

  const filteredParticles = $derived(flatParticles.filter((p) => particleMatches(p, query)));

  function isParticleExternal(p: Particle): p is ExternalOnlyParticle {
    return typeof p.id === "string";
  }

  function isNamed(p: Particle): boolean {
    return !isParticleExternal(p) && NAMED_IDS.has(p.id as number);
  }

  function particleZ(p: Particle): number {
    return isParticleExternal(p) ? (p as ExternalOnlyParticle).Z : (p.id as number);
  }

  function isParticleAvailable(p: Particle): boolean {
    return selectionState.availableParticles.some((q) => q.id === p.id);
  }

  // ── Material list ──────────────────────────────────────────────────────────
  const allMaterials = $derived<Material[]>([
    ...selectionState.allMaterials,
    ...selectionState.externalOnlyMaterials,
  ]);

  function isMaterialExternal(m: Material): boolean {
    return typeof m.id === "string" && (m.id as string).startsWith("ext:");
  }

  function isElementId(id: number): boolean {
    return id >= 1 && id <= 98;
  }

  function inElements(m: Material): boolean {
    if (!isMaterialExternal(m)) return isElementId(m.id as number);
    return (
      (m as ExternalOnlyMaterial).atomicNumber !== undefined &&
      isElementId((m as ExternalOnlyMaterial).atomicNumber!)
    );
  }

  function inCompounds(m: Material): boolean {
    if (!isMaterialExternal(m)) return (m.id as number) > 98 || m.id === 906;
    const an = (m as ExternalOnlyMaterial).atomicNumber;
    return !(an !== undefined && isElementId(an));
  }

  function materialSearchText(m: Material): string {
    if (isMaterialExternal(m)) {
      const em = m as ExternalOnlyMaterial;
      return `${em.localId} ${em.name} ${em.label} ext external`;
    }
    const bm = m as MaterialEntity;
    return `${bm.id} ${bm.name} ${bm.rawName ?? ""}`;
  }

  function materialMatches(m: Material, q: string): boolean {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return materialSearchText(m).toLowerCase().includes(t);
  }

  const filteredCompounds = $derived(
    allMaterials
      .filter(inCompounds)
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((m) => materialMatches(m, query)),
  );
  const filteredElements = $derived(
    allMaterials
      .filter(inElements)
      .sort((a, b) => {
        const ai = isMaterialExternal(a)
          ? ((a as ExternalOnlyMaterial).atomicNumber ?? 999)
          : (a.id as number);
        const bi = isMaterialExternal(b)
          ? ((b as ExternalOnlyMaterial).atomicNumber ?? 999)
          : (b.id as number);
        return ai - bi;
      })
      .filter((m) => materialMatches(m, query)),
  );

  const customItems = $derived.by(() => {
    if (!isAdvancedMode.value) return [];
    return [...customCompounds.compounds]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((compound) => ({
        id: compound.id,
        name: compound.name,
        density: compound.density,
        phase: compound.phase,
        elements: compound.elements,
        iValue: compound.iValue,
        isGasByDefault: compound.phase === "gas",
        source: compound,
      }))
      .filter((m) => materialMatches(m as unknown as Material, query));
  });

  function formatDensity(m: Material | { density: number }): string | undefined {
    const d = (m as { density: number }).density;
    if (isMaterialExternal(m as Material)) {
      return d !== undefined ? d.toFixed(4) : undefined;
    }
    return d.toFixed(d < 0.1 ? 4 : 2);
  }

  function isMaterialAvailable(m: Material): boolean {
    return selectionState.availableMaterials.some((q) => q.id === m.id);
  }

  const isMultiMaterial = $derived(selectionState.across === "material");
  const multiMaterialIds = $derived(selectionState.multiSelected.material);

  // ── Program list ───────────────────────────────────────────────────────────
  const builtinPrograms = $derived(selectionState.availablePrograms);
  const externalPrograms = $derived(selectionState.availableExternalPrograms);

  function programMatches(p: { name: string; version?: string }, q: string): boolean {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return p.name.toLowerCase().includes(t) || (p.version ?? "").toLowerCase().includes(t);
  }

  const filteredBuiltinPrograms = $derived(builtinPrograms.filter((p) => programMatches(p, query)));
  const filteredExternalPrograms = $derived(
    externalPrograms.filter((p) => programMatches(p, query)),
  );

  const currentProgram = $derived(selectionState.selectedProgram);
  const isMultiProgram = $derived(selectionState.across === "program");
  const multiProgramIds = $derived(selectionState.multiSelected.program);
</script>

<div
  class="fixed inset-0 z-50 flex flex-col bg-background"
  bind:this={dialogEl}
  role="dialog"
  aria-modal="true"
  aria-label="Search {activeTab}"
  data-testid="picker-sheet"
>
  <!-- Header -->
  <div class="flex items-center gap-2 border-b bg-card px-3 py-2">
    <button
      type="button"
      bind:this={closeButtonEl}
      class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Close search"
      onclick={onClose}
    >←</button>
    <input
      type="search"
      bind:this={inputEl}
      bind:value={query}
      {placeholder}
      class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      data-testid="picker-sheet-input"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
    />
    <button
      type="button"
      class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      aria-label="Clear search"
      onclick={() => {
        query = "";
        inputEl?.focus();
      }}
    >×</button>
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-auto p-2">
    {#if activeTab === "particle"}
      <ul role="listbox" aria-label="Particle results" class="space-y-0.5" tabindex="0">
        {#each filteredParticles as p (p.id)}
          {@const available = isParticleAvailable(p)}
          {@const named = isNamed(p)}
          {@const external = isParticleExternal(p)}
          {@const z = particleZ(p)}
          {@const isSingleSelected = selectionState.selectedParticle?.id === p.id}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isSingleSelected}
              aria-disabled={!available}
              data-testid="picker-particle-item-{p.id}"
              tabindex={-1}
              disabled={!available}
              class={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left",
                available ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none",
                isSingleSelected && "bg-primary/15 font-semibold",
                named && !isSingleSelected && "font-semibold",
              )}
              onclick={() => {
                if (!available) return;
                onParticleSelect(p);
                onClose();
              }}
            >
              {#if external}<span aria-hidden="true">🔗</span>{/if}
              <span class="flex-1">{getParticleListLabel(p, z)}</span>
            </button>
          </li>
        {/each}
        {#if filteredParticles.length === 0}
          <li class="px-2 py-4 text-center text-sm text-muted-foreground">No particles match.</li>
        {/if}
      </ul>
    {:else if activeTab === "material"}
      <GroupedResultList
        compounds={filteredCompounds}
        elements={filteredElements}
        {customItems}
        selectedId={selectionState.selectedMaterial?.id ?? null}
        isMultiMode={isMultiMaterial}
        multiIds={multiMaterialIds}
        onSelect={(m) => {
          onMaterialSelect(m as Material);
          if (!isMultiMaterial) onClose();
        }}
        onToggleMulti={(m) => selectionState.toggleMulti("material", m.id)}
        formatDensity={(m) => formatDensity(m as Material)}
        isAvailable={(m) => isMaterialAvailable(m as Material)}
      />
    {:else}
      <!-- Program results: flat list -->
      <ul role="listbox" aria-label="Program results" class="space-y-0.5" tabindex="0">
        {#each filteredBuiltinPrograms as program (program.id)}
          {@const isSingleSelected = !isMultiProgram && currentProgram.id === program.id}
          {@const inMulti = isMultiProgram && multiProgramIds.includes(program.id)}
          {@const anchor = multiProgramIds[0] === program.id}
          {@const desc = getProgramDescription(program.id)}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isMultiProgram ? inMulti : isSingleSelected}
              aria-disabled={isMultiProgram && anchor}
              data-testid="picker-program-item-{program.id}"
              tabindex={-1}
              disabled={isMultiProgram && anchor}
              class={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
                (isMultiProgram ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
              )}
              onclick={() => {
                if (isMultiProgram) {
                  if (!anchor) selectionState.toggleMulti("program", program.id);
                } else {
                  onProgramSelect(program);
                  onClose();
                }
              }}
            >
              {#if isMultiProgram}
                <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
              {/if}
              <span class="flex-1 flex items-center justify-between gap-3">
                <span>
                  {program.name}
                  {#if desc}<span class="text-muted-foreground"> · {desc}</span>{/if}
                </span>
                <ProgramTag kind={programKind(program.id)} />
              </span>
            </button>
          </li>
        {/each}
        {#each filteredExternalPrograms as program (program.id)}
          {@const isSingleSelected = !isMultiProgram && currentProgram.id === program.id}
          {@const inMulti = isMultiProgram && multiProgramIds.includes(program.id)}
          {@const anchor = multiProgramIds[0] === program.id}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isMultiProgram ? inMulti : isSingleSelected}
              aria-disabled={isMultiProgram && anchor}
              data-testid="picker-program-item-{program.id}"
              tabindex={-1}
              disabled={isMultiProgram && anchor}
              class={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent",
                (isMultiProgram ? inMulti : isSingleSelected) && "bg-primary/15 font-semibold",
              )}
              onclick={() => {
                if (isMultiProgram) {
                  if (!anchor) selectionState.toggleMulti("program", program.id);
                } else {
                  onProgramSelect(program);
                  onClose();
                }
              }}
            >
              {#if isMultiProgram}
                <span aria-hidden="true" class="w-3 text-center text-xs">{inMulti ? "✓" : ""}</span>
              {/if}
              <span class="flex-1 flex items-center gap-2">
                <span>🔗 {program.name}</span>
                <ProgramTag kind="EXT" />
              </span>
            </button>
          </li>
        {/each}
        {#if filteredBuiltinPrograms.length === 0 && filteredExternalPrograms.length === 0}
          <li class="px-2 py-4 text-center text-sm text-muted-foreground">No programs match.</li>
        {/if}
      </ul>
    {/if}
  </div>

  <!-- Done button (multi-select Advanced mode) -->
  {#if (activeTab === "material" && isMultiMaterial) || (activeTab === "program" && isMultiProgram)}
    <div class="border-t bg-card p-3">
      <button
        type="button"
        class="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        data-testid="picker-sheet-done"
        onclick={onClose}
      >
        Done
      </button>
    </div>
  {/if}
</div>
