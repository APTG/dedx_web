<script lang="ts">
  import EntityPanel from "./entity-panel.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_UNSUPPORTED_SHORT } from "$lib/config/libdedx-version";
  import { getParticleLabel, getParticleSearchText } from "$lib/utils/particle-label";

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
      available:
        particle.id !== 1001 &&
        state.availableParticles.some((p) => p.id === particle.id),
      label: getParticleLabel(particle),
      description: particle.id === 1001 ? ELECTRON_UNSUPPORTED_SHORT : undefined,
      searchText: getParticleSearchText(particle),
    };
  }

  const commonParticles = $derived.by(() =>
    state.allParticles
      .filter((p) => COMMON_PARTICLE_IDS.has(p.id))
      .sort(
        (a, b) =>
          COMMON_PARTICLE_ORDER.indexOf(a.id) -
          COMMON_PARTICLE_ORDER.indexOf(b.id),
      )
      .map(toParticleItem),
  );

  const ionParticles = $derived.by(() =>
    state.allParticles
      .filter((p) => !COMMON_PARTICLE_IDS.has(p.id))
      .sort((a, b) => a.id - b.id)
      .map(toParticleItem),
  );

  const elements = $derived.by(() => {
    return state.allMaterials
      .filter((m) => m.id >= 1 && m.id <= 98)
      .sort((a, b) => a.id - b.id)
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
      .filter((m) => m.id > 98 || m.id === 906)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((material) => ({
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      }));
  });

  const programItems = $derived.by(() => {
    const result = [];

    const autoSelect = state.selectedProgram;
    if (autoSelect.id === -1 && autoSelect.resolvedProgram) {
      result.push({
        entity: autoSelect,
        available: true,
        label: `Auto-select → ${autoSelect.resolvedProgram.name}`,
      });
    } else {
      result.push({
        entity: autoSelect,
        available: true,
        label: "Auto-select",
      });
    }

    for (const program of state.availablePrograms) {
      result.push({
        entity: program,
        available: true,
        label: `${program.name} — ${program.version}`,
      });
    }

    return result;
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
      ]}
      selectedId={state.selectedParticle?.id ?? null}
      maxHeight="260px"
      onItemSelect={(particle: ParticleEntity) => {
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
      ]}
      selectedId={state.selectedMaterial?.id ?? null}
      maxHeight="260px"
      onItemSelect={(material: MaterialEntity) => {
        state.selectMaterial(material.id);
      }}
      onClear={() => state.clearMaterial()}
    />
  </div>

  <EntityPanel
    label="③ Program"
    items={programItems}
    selectedId={state.selectedProgram?.id ?? null}
    maxHeight="150px"
    onItemSelect={(item: any) => {
      if ("id" in item) {
        state.selectProgram(item.id);
      }
    }}
  />
</div>
