<script lang="ts">
  import EntityPanel from "./entity-panel.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
  import { ELECTRON_UNSUPPORTED_SHORT } from "$lib/config/libdedx-version";

  interface Props {
    state: EntitySelectionState;
    class?: string;
  }

  let { state, class: className }: Props = $props();

  function getParticleLabel(particle: ParticleEntity): string {
    if (particle.id === 1001) {
      return "Electron";
    }
    const atomicNumber = particle.id > 0 ? particle.id : "";
    const symbol = particle.symbol || "";
    return `${atomicNumber ? `Z=${atomicNumber} ` : ""}${particle.name}${symbol ? ` (${symbol})` : ""}`;
  }

  const particleItems = $derived.by(() => {
    return state.allParticles.map((particle) => ({
      entity: particle,
      available: state.availableParticles.some((p) => p.id === particle.id),
      label: getParticleLabel(particle),
      description: particle.id === 1001 ? ELECTRON_UNSUPPORTED_SHORT : undefined,
    }));
  });

  const elements = $derived.by(() => {
    return state.allMaterials
      .filter((m) => m.id >= 1 && m.id <= 98)
      .sort((a, b) => a.id - b.id)
      .map((material) => ({
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: `${material.id}  ${material.name}`,
      }));
  });

  const compounds = $derived.by(() => {
    return state.allMaterials
      .filter((m) => m.id > 98 || m.id === 906)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((material) => ({
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: `${material.id}  ${material.name}`,
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
  <EntityPanel
    label="① Particle"
    items={particleItems}
    selectedId={state.selectedParticle?.id ?? null}
    maxHeight="300px"
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
    maxHeight="300px"
    onItemSelect={(material: MaterialEntity) => {
      state.selectMaterial(material.id);
    }}
    onClear={() => state.clearMaterial()}
  />

  <EntityPanel
    label="③ Program"
    items={programItems}
    selectedId={state.selectedProgram?.id ?? null}
    maxHeight="200px"
    onItemSelect={(item: any) => {
      if ("id" in item) {
        state.selectProgram(item.id);
      }
    }}
  />
</div>
