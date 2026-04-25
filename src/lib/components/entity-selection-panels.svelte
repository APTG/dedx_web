<script lang="ts">
  import EntityPanel from "./entity-panel.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
  import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";

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
      description: particle.id === 1001 ? "Not available in libdedx v1.4.0" : undefined,
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
  <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
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
  </div>

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

  <div class="flex gap-4">
    <button
      type="button"
      class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      + Add Series
    </button>
    <button
      type="button"
      class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      onclick={() => state.resetAll()}
    >
      Reset all
    </button>
  </div>
</div>
