<script lang="ts">
  import EntityCombobox from "./entity-combobox.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
  import { getProgramDescription } from "$lib/config/program-names";
  import { getParticleLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import type {
    EntitySelectionState,
    SelectedProgram,
    AutoSelectProgram,
  } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_UNSUPPORTED_SHORT } from "$lib/config/libdedx-version";
  import { customCompounds, type StoredCompoundInternal } from "$lib/state/custom-compounds.svelte";
  import CompoundEditorModal from "./compound-editor-modal.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";

  interface Props {
    selectionState: EntitySelectionState;
    class?: string;
    onParticleSelect?: (particleId: number) => void;
  }

  let { selectionState, class: className, onParticleSelect }: Props = $props();

  function getMaterialPhase(material: MaterialEntity | null): "gas" | "liquid" | "solid" | null {
    if (!material) return null;
    if (material.isGasByDefault) return "gas";
    if (material.name.toLowerCase().includes("liquid")) return "liquid";
    return "solid";
  }

  let materialPhase = $derived.by(() => getMaterialPhase(selectionState.selectedMaterial));

  // Compound editor modal state
  let compoundModalOpen = $state(false);
  let editingCompound = $state<StoredCompoundInternal | null>(null);

  function handleAddCompound() {
    editingCompound = null;
    compoundModalOpen = true;
  }

  function handleEditCompound(compound: StoredCompoundInternal) {
    editingCompound = compound;
    compoundModalOpen = true;
  }

  function handleSaveCompound(data: {
    name: string;
    density: number;
    iValue?: number;
    elements: Array<{ atomicNumber: number; atomCount: number }>;
    phase: "gas" | "condensed";
  }) {
    if (editingCompound) {
      customCompounds.update(editingCompound.id, data);
    } else {
      customCompounds.create(data);
    }
    compoundModalOpen = false;
  }

  function handleDeleteCompound() {
    if (editingCompound) {
      customCompounds.delete(editingCompound.id);
      compoundModalOpen = false;
      editingCompound = null;
    }
  }

  const particleItems = $derived.by(() => {
    // "Common particles" group: proton (1), alpha (2), electron (1001)
    const COMMON_IDS = new Set([1, 2, 1001]);
    const commonParticles = selectionState.allParticles
      .filter((p) => COMMON_IDS.has(p.id))
      .sort((a, b) => {
        // fixed order: proton, alpha particle, electron
        const ORDER = [1, 2, 1001];
        return ORDER.indexOf(a.id) - ORDER.indexOf(b.id);
      });

    const ionParticles = selectionState.allParticles
      .filter((p) => !COMMON_IDS.has(p.id))
      .sort((a, b) => a.id - b.id);

    function toItem(particle: ParticleEntity) {
      return {
        entity: particle,
        available:
          particle.id !== 1001 && selectionState.availableParticles.some((p) => p.id === particle.id),
        label: getParticleLabel(particle),
        description: particle.id === 1001 ? ELECTRON_UNSUPPORTED_SHORT : undefined,
        searchText: getParticleSearchText(particle),
      };
    }

    // Use same section-header pattern as materialItems
    return [
      { type: "section" as const, label: "Common particles" },
      ...commonParticles.map(toItem),
      { type: "section" as const, label: "Ions" },
      ...ionParticles.map(toItem),
    ];
  });

  interface MaterialGroup {
    type: "section";
    label: string;
  }

  interface MaterialItem {
    type: "item";
    entity: MaterialEntity;
    available: boolean;
    label: string;
    description?: string;
    searchText: string;
    actions?: Array<{ label: string; icon?: "edit" | "delete" | "trash"; onClick: () => void }>;
  }

  interface MaterialAddButton {
    type: "add-button";
    label?: string;
    onClick: () => void;
  }

  type MaterialEntry = MaterialGroup | MaterialItem | MaterialAddButton;

  let materialItems = $state<MaterialEntry[]>([]);

  $effect(() => {
    const compoundsArray = customCompounds.compounds;
    const elements = selectionState.allMaterials
      .filter((m) => m.id >= 1 && m.id <= 98)
      .sort((a, b) => a.id - b.id);
    const compounds = selectionState.allMaterials
      .filter((m) => m.id > 98 || m.id === 906)
      .sort((a, b) => a.name.localeCompare(b.name));

    const customCompoundsItems: MaterialItem[] = compoundsArray.map((compound) => {
      const desc = `${compound.density} g/cm³`;
      return {
        type: "item" as const,
        entity: {
          id: compound.id,
          name: compound.name,
          density: compound.density,
          iValue: compound.iValue,
          phase: compound.phase,
          elements: compound.elements,
          isGasByDefault: compound.phase === "gas",
        } satisfies MaterialEntity,
        available: true,
        label: compound.name,
        description: desc,
        searchText: `${compound.id} ${compound.name}`,
        actions: [
          {
            label: "Edit compound",
            icon: "edit",
            onClick: () => handleEditCompound(compound),
          },
          {
            label: "Delete compound",
            icon: "trash",
            onClick: () => handleDeleteCompound(),
          },
        ],
      };
    });

    const result: MaterialEntry[] = [
      { type: "section", label: "Elements" },
      ...elements.map((material) => ({
        type: "item" as const,
        entity: material,
        available: selectionState.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      })),
      { type: "section", label: "Compounds" },
      ...compounds.map((material) => ({
        type: "item" as const,
        entity: material,
        available: selectionState.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      })),
      ...(isAdvancedMode.value
        ? [
            { type: "section" as const, label: "Custom Compounds" },
            ...customCompoundsItems,
            {
              type: "add-button" as const,
              label: "+ Add compound",
              onClick: handleAddCompound,
            },
          ]
        : []),
    ];

    materialItems = result;
  });

  interface ProgramGroup {
    type: "section";
    label: string;
  }

  interface ProgramItem {
    type: "item";
    entity: SelectedProgram | ProgramEntity;
    available: boolean;
    label: string;
    description?: string;
    searchText?: string;
  }

  type ProgramEntry = ProgramGroup | ProgramItem;

  const programItems = $derived.by<ProgramEntry[]>(() => {
    const result: ProgramEntry[] = [];

    // Auto-select is always shown at the top; resolvedProgram only populated when currently
    // in auto-select mode so the trigger can display "Auto-select → <resolved program>"
    const currentProgram = selectionState.selectedProgram;
    const autoSelectEntity: AutoSelectProgram = {
      id: -1,
      name: "Auto-select",
      resolvedProgram: currentProgram.id === -1 ? currentProgram.resolvedProgram : null,
    };
    const autoSelectLabel = autoSelectEntity.resolvedProgram
      ? `Auto-select → ${autoSelectEntity.resolvedProgram.name}`
      : "Auto-select";
    result.push({
      type: "item" as const,
      entity: autoSelectEntity,
      available: true,
      // Keep the trigger label fully informative: when Auto-select is active we show
      // the resolved concrete runtime program (spec AC: "Auto-select → <program>").
      label: autoSelectLabel,
      searchText: `auto select ${autoSelectEntity.resolvedProgram?.name ?? ""}`,
    });

    // availablePrograms is already filtered in compatibility-matrix.ts to hide
    // DEDX_ICRU (id=9). The UI must only show the synthetic Auto-select entry.
    const tabulatedPrograms = selectionState.availablePrograms.filter((p) => p.id <= 90);
    const analyticalPrograms = selectionState.availablePrograms.filter((p) => p.id > 90);

    result.push({ type: "section", label: "Tabulated data" });

    for (const program of tabulatedPrograms) {
      const desc = getProgramDescription(program.id);
      result.push({
        type: "item" as const,
        entity: program,
        available: true,
        label: desc ? `${program.name} — ${desc}` : program.name,
        searchText: `${program.name} ${program.version} ${desc ?? ""}`,
      });
    }

    if (analyticalPrograms.length > 0) {
      result.push({ type: "section", label: "Analytical models" });

      for (const program of analyticalPrograms) {
        const desc = getProgramDescription(program.id);
        result.push({
          type: "item" as const,
          entity: program,
          available: true,
          label: desc ? `${program.name} — ${desc}` : program.name,
          searchText: `${program.name} ${program.version} ${desc ?? ""}`,
        });
      }
    }

    return result;
  });
</script>

<div class={cn("grid grid-cols-1 items-start gap-3 lg:grid-cols-3", className)}>
  <div class="w-full">
    <EntityCombobox
      label="Particle"
      items={particleItems}
      selectedId={selectionState.selectedParticle?.id ?? null}
      placeholder="Select particle"
      onItemSelect={(particle: ParticleEntity) => {
        if (particle.id === 1001) {
          return;
        }
        if (onParticleSelect) {
          onParticleSelect(particle.id);
        } else {
          selectionState.selectParticle(particle.id);
        }
      }}
      onClear={() => selectionState.clearParticle()}
    />
  </div>

  <div class="flex items-center gap-2 w-full">
    <div class="flex-1">
      <EntityCombobox
        label="Material"
        items={materialItems}
        selectedId={selectionState.selectedMaterial?.id ?? null}
        placeholder="Select material"
        onItemSelect={(material: MaterialEntity) => {
          selectionState.selectMaterial(material.id);
        }}
        onClear={() => selectionState.clearMaterial()}
      />
    </div>
    {#if materialPhase}
      <span
        class="mt-6 inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-medium"
        data-testid="phase-badge"
      >
        {materialPhase}
      </span>
    {/if}
  </div>

  <!-- Keep all three selectors in one desktop row and avoid pointer-intercept overlap. -->
  <div class="w-full">
    <EntityCombobox
      label="Program"
      items={programItems}
      selectedId={selectionState.selectedProgram?.id ?? null}
      placeholder="Select program"
      onItemSelect={(program: SelectedProgram | ProgramEntity) => {
        selectionState.selectProgram(program.id);
      }}
    />
  </div>

  <div class="lg:col-span-3 lg:text-right">
    <button
      type="button"
      title="Restores Proton / Water / Auto-select"
      class="text-sm text-muted-foreground hover:text-foreground"
      onclick={() => {
        selectionState.resetAll();
      }}
    >
      Restore defaults
    </button>
  </div>
</div>

<CompoundEditorModal
  open={compoundModalOpen}
  compound={editingCompound}
  onOpenChange={(open) => {
    compoundModalOpen = open;
    if (!open) editingCompound = null;
  }}
  onSave={handleSaveCompound}
  onDelete={handleDeleteCompound}
/>
