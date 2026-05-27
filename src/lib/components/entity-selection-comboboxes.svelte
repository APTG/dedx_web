<script lang="ts">
  import EntityCombobox from "./entity-combobox.svelte";
  import { cn } from "$lib/utils.js";
  import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
  import type {
    ExternalOnlyMaterial,
    ExternalOnlyParticle,
    ExternalProgramEntity,
  } from "$lib/state/external-compatibility";
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

  type ParticleOption = ParticleEntity | ExternalOnlyParticle;
  type MaterialOption = MaterialEntity | ExternalOnlyMaterial;
  type ProgramOption = SelectedProgram | ProgramEntity | ExternalProgramEntity;

  interface Props {
    selectionState: EntitySelectionState;
    class?: string;
    onParticleSelect?: (particleId: number | string) => void;
  }

  let { selectionState, class: className, onParticleSelect }: Props = $props();

  function getMaterialPhase(
    material: MaterialEntity | ExternalOnlyMaterial | null,
  ): "gas" | "liquid" | "solid" | null {
    if (!material) return null;
    if ("isGasByDefault" in material && material.isGasByDefault) return "gas";
    if (material.name.toLowerCase().includes("liquid")) return "liquid";
    if ("isGasByDefault" in material) return "solid";
    return null; // external-only material: no phase info
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

  function handleDeleteCompound(compound?: StoredCompoundInternal | null) {
    const target = compound ?? editingCompound;
    if (target) {
      customCompounds.delete(target.id);
      compoundModalOpen = false;
      editingCompound = null;
    }
  }

  function isExternalParticle(particle: ParticleOption): particle is ExternalOnlyParticle {
    return typeof particle.id === "string";
  }

  function particleZ(particle: ParticleOption): number {
    return isExternalParticle(particle) ? particle.Z : (particle.id as number);
  }

  const particleItems = $derived.by(() => {
    function toItem(particle: ParticleOption) {
      if (isExternalParticle(particle)) {
        return {
          entity: particle,
          available: selectionState.availableParticles.some((p) => p.id === particle.id),
          // Spec §7.1: external-only particles prefixed with 🔗 icon
          label: `🔗 ${particle.name}`,
          description: particle.label,
          searchText: `${particle.localId} ${particle.name} ${particle.symbol} ${particle.label} ext external`,
        };
      }

      const isElectron = particle.id === 1001;
      return {
        entity: particle,
        available:
          !isElectron && selectionState.availableParticles.some((p) => p.id === particle.id),
        label: getParticleLabel(particle),
        ...(isElectron ? { description: ELECTRON_UNSUPPORTED_SHORT } : {}),
        searchText: getParticleSearchText(particle),
      };
    }

    return [...selectionState.allParticles, ...selectionState.externalOnlyParticles]
      .sort((a, b) => particleZ(a) - particleZ(b))
      .map(toItem);
  });

  interface MaterialGroup {
    type: "section";
    label: string;
  }

  interface MaterialItem {
    type: "item";
    entity: MaterialOption;
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
      .filter((m) => (m.id as number) >= 1 && (m.id as number) <= 98)
      .sort((a, b) => (a.id as number) - (b.id as number));
    const compounds = selectionState.allMaterials
      .filter((m) => (m.id as number) > 98 || m.id === 906)
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
            onClick: () => handleDeleteCompound(compound),
          },
        ],
      };
    });

    const externalMaterials: MaterialItem[] = selectionState.externalOnlyMaterials.map(
      (material) => ({
        type: "item" as const,
        entity: material,
        available: selectionState.availableMaterials.some((m) => m.id === material.id),
        // Spec §7.1: external-only materials prefixed with 🔗 icon
        label: `🔗 ${material.name}`,
        description: material.label,
        searchText: `${material.localId} ${material.name} ${material.label} ext external`,
      }),
    );

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
      ...(externalMaterials.length > 0
        ? [{ type: "section" as const, label: "External" }, ...externalMaterials]
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
    entity: ProgramOption;
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
      resolvedProgram:
        currentProgram.id === -1 ? (currentProgram as AutoSelectProgram).resolvedProgram : null,
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
    const tabulatedPrograms = selectionState.availablePrograms.filter(
      (p) => (p.id as number) <= 90,
    );
    const analyticalPrograms = selectionState.availablePrograms.filter(
      (p) => (p.id as number) > 90,
    );

    result.push({ type: "section", label: "Tabulated data" });

    for (const program of tabulatedPrograms) {
      const desc = getProgramDescription(program.id as number);
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
        const desc = getProgramDescription(program.id as number);
        result.push({
          type: "item" as const,
          entity: program,
          available: true,
          label: desc ? `${program.name} — ${desc}` : program.name,
          searchText: `${program.name} ${program.version} ${desc ?? ""}`,
        });
      }
    }

    if (selectionState.availableExternalPrograms.length > 0) {
      result.push({ type: "section", label: "External" });

      for (const program of selectionState.availableExternalPrograms) {
        result.push({
          type: "item" as const,
          entity: program,
          available: true,
          // Spec §7.1: external programs prefixed with 🔗 icon and "(ext)" suffix
          label: `🔗 ${program.name} (ext)`,
          description: [program.label, program.version].filter(Boolean).join(" · "),
          searchText: `${program.name} ${program.label} ${program.version ?? ""} ${program.localId} ext external`,
        });
      }
    }

    return result;
  });
</script>

<div class={cn("grid grid-cols-1 items-start gap-3 desktop:grid-cols-3", className)}>
  <div class="w-full">
    <EntityCombobox
      label="Particle"
      items={particleItems}
      selectedId={selectionState.selectedParticle?.id ?? null}
      placeholder="Select particle"
      onItemSelect={(particle: ParticleOption) => {
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
        onItemSelect={(material: MaterialOption) => {
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
      onItemSelect={(program: ProgramOption) => {
        selectionState.selectProgram(program.id);
      }}
    />
  </div>

  <div class="desktop:col-span-3 desktop:text-right">
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
