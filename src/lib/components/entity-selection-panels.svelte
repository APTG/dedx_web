<script lang="ts">
  import EntityPanel from "./entity-panel.svelte";
  import { cn } from "$lib/utils.js";
  import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import type {
    ExternalOnlyMaterial,
    ExternalOnlyParticle,
  } from "$lib/state/external-compatibility";
  import { ELECTRON_UNSUPPORTED_SHORT } from "$lib/config/libdedx-version";
  import { getParticleLabel, getParticleSearchText } from "$lib/utils/particle-label";
  import { customCompounds } from "$lib/state/custom-compounds.svelte";
  import { isAdvancedMode } from "$lib/state/advanced-mode.svelte";

  interface Props {
    state: EntitySelectionState;
    class?: string;
  }

  let { state, class: className }: Props = $props();

  const COMMON_PARTICLE_IDS = new Set([1, 2, 1001]);
  const COMMON_PARTICLE_ORDER = [1, 2, 1001];

  function toParticleItem(particle: ParticleEntity) {
    return {
      entity: particle,
      // Electron is intentionally non-selectable until ESTAR is wired up.
      available: particle.id !== 1001 && state.availableParticles.some((p) => p.id === particle.id),
      label: getParticleLabel(particle),
      searchText: getParticleSearchText(particle),
      ...(particle.id === 1001 ? { description: ELECTRON_UNSUPPORTED_SHORT } : {}),
    };
  }

  const commonParticles = $derived.by(() =>
    state.allParticles
      .filter((p) => typeof p.id === "number" && COMMON_PARTICLE_IDS.has(p.id))
      .sort(
        (a, b) =>
          COMMON_PARTICLE_ORDER.indexOf(a.id as number) -
          COMMON_PARTICLE_ORDER.indexOf(b.id as number),
      )
      .map(toParticleItem),
  );

  const ionParticles = $derived.by(() =>
    state.allParticles
      .filter((p) => typeof p.id === "number" && !COMMON_PARTICLE_IDS.has(p.id))
      .sort((a, b) => (a.id as number) - (b.id as number))
      .map(toParticleItem),
  );

  const externalParticles = $derived.by(() =>
    state.externalOnlyParticles.map((particle) => ({
      entity: particle,
      available: state.availableParticles.some((p) => p.id === particle.id),
      // Spec §7.1: external-only particles prefixed with 🔗 icon
      label: `🔗 ${particle.name}`,
      description: particle.label,
      searchText: `${particle.localId} ${particle.name} ${particle.symbol} ${particle.label} ext external`,
    })),
  );

  const elements = $derived.by(() => {
    return state.allMaterials
      .filter((m) => typeof m.id === "number" && m.id >= 1 && m.id <= 98)
      .sort((a, b) => (a.id as number) - (b.id as number))
      .map((material) => ({
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        // ID is intentionally not in the visible label — too noisy alongside
        // the element list. Keep it as a hidden search keyword so users can
        // still type "276" to find Water.
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      }));
  });

  const compounds = $derived.by(() => {
    return state.allMaterials
      .filter((m) => typeof m.id === "number" && (m.id > 98 || m.id === 906))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((material) => ({
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      }));
  });

  const customCompoundItems = $derived.by(() => {
    if (!isAdvancedMode.value) return [];
    return customCompounds.compounds.map((compound) => ({
      entity: {
        id: compound.id,
        name: compound.name,
        density: compound.density,
        phase: compound.phase,
        elements: compound.elements,
        isGasByDefault: compound.phase === "gas",
        ...(compound.iValue !== undefined ? { iValue: compound.iValue } : {}),
      } satisfies MaterialEntity,
      available: true,
      label: compound.name,
      searchText: `${compound.id} ${compound.name}`,
      description: `${compound.density} g/cm³`,
    }));
  });

  const externalMaterials = $derived.by(() =>
    state.externalOnlyMaterials.map((material) => ({
      entity: material,
      available: state.availableMaterials.some((m) => m.id === material.id),
      // Spec §7.1: external-only materials prefixed with 🔗 icon
      label: `🔗 ${material.name}`,
      description: material.label,
      searchText: `${material.localId} ${material.name} ${material.label} ext external`,
    })),
  );

  // Plot does not yet support external program series (would require
  // loadStpSlice + interpolation pipeline). Show external programs grouped
  // separately and mark them unavailable so users can see the dataset is
  // loaded but won't be confused by a non-functional selection. Spec
  // §8.1 calls for an "External" separator/group; this preserves the
  // grouping and signals the limitation explicitly.
  type ProgramPanelEntity = { id: number | string; name: string };
  type ProgramPanelItem = {
    entity: ProgramPanelEntity;
    available: boolean;
    label: string;
    description?: string;
    searchText?: string;
  };

  const builtinProgramItems = $derived.by<ProgramPanelItem[]>(() =>
    state.availablePrograms.map((program) => ({
      entity: program,
      available: true,
      label: `${program.name} — ${program.version}`,
    })),
  );

  const externalProgramItems = $derived.by<ProgramPanelItem[]>(() =>
    state.availableExternalPrograms.map((program) => ({
      entity: program,
      available: false,
      label: `🔗 ${program.name} (ext)`,
      description: `${program.label}${program.version ? ` · ${program.version}` : ""} — Plot series not yet supported`,
      searchText: `${program.name} ${program.label} ${program.version ?? ""} ${program.localId}`,
    })),
  );

  const autoSelectItem = $derived.by<ProgramPanelItem>(() => {
    const selectedProgram = state.selectedProgram;
    const autoLabel =
      selectedProgram.id === -1 &&
      "resolvedProgram" in selectedProgram &&
      selectedProgram.resolvedProgram
        ? `Auto-select → ${selectedProgram.resolvedProgram.name}`
        : "Auto-select";
    return {
      entity: { id: -1, name: "Auto-select" },
      available: true,
      label: autoLabel,
    };
  });

  const programGroups = $derived.by(() => {
    const groups: Array<{ groupName: string; items: ProgramPanelItem[] }> = [
      { groupName: "Programs", items: [autoSelectItem, ...builtinProgramItems] },
    ];
    if (externalProgramItems.length > 0) {
      groups.push({ groupName: "External", items: externalProgramItems });
    }
    return groups;
  });
</script>

<div class={cn("grid gap-4", className)}>
  <!--
    Spec: docs/04-feature-specs/entity-selection.md § Layout & Panels (Plot Page)
    Particle and Material live side-by-side in a 1fr+2fr sub-grid; Program
    spans the full sidebar width below with a shorter list height (~150px).
  -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
    <EntityPanel
      label="① Particle"
      items={[]}
      grouped={true}
      groups={[
        { groupName: "Common particles", items: commonParticles },
        { groupName: "Ions", items: ionParticles },
        ...(externalParticles.length > 0
          ? [{ groupName: "External", items: externalParticles }]
          : []),
      ]}
      selectedId={state.selectedParticle?.id ?? null}
      maxHeight="260px"
      onItemSelect={(particle: ParticleEntity | ExternalOnlyParticle) => {
        if (particle.id === 1001) {
          return;
        }
        state.selectParticle(particle.id);
      }}
      onClear={() => state.clearParticle()}
    />

    <EntityPanel
      label="② Material"
      items={[]}
      grouped={true}
      groups={[
        { groupName: "Elements", items: elements },
        { groupName: "Compounds", items: compounds },
        ...(isAdvancedMode.value ? [{ groupName: "Custom", items: customCompoundItems }] : []),
        ...(externalMaterials.length > 0
          ? [{ groupName: "External", items: externalMaterials }]
          : []),
      ]}
      selectedId={state.selectedMaterial?.id ?? null}
      maxHeight="260px"
      onItemSelect={(material: MaterialEntity | ExternalOnlyMaterial) => {
        state.selectMaterial(material.id);
      }}
      onClear={() => state.clearMaterial()}
    />
  </div>

  <EntityPanel
    label="③ Program"
    items={[]}
    grouped={true}
    groups={programGroups}
    selectedId={state.selectedProgram?.id ?? null}
    maxHeight="180px"
    onItemSelect={(item: any) => {
      if ("id" in item) {
        state.selectProgram(item.id);
      }
    }}
  />
</div>
