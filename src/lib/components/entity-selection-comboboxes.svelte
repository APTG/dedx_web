<script lang="ts">
  import EntityCombobox from "./entity-combobox.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity } from "$lib/wasm/types";
  import type { EntitySelectionState, SelectedProgram } from "$lib/state/entity-selection.svelte";

  interface Props {
    state: EntitySelectionState;
    class?: string;
  }

  let { state, class: className }: Props = $props();

  function getParticleLabel(particle: ParticleEntity): string {
    if (particle.id === 1001) {
      return "Electron";
    }
    const symbol = particle.symbol || "";
    return `Z=${particle.id} ${particle.name}${symbol ? ` (${symbol})` : ""}`;
  }

  const particleItems = $derived.by(() => {
    return state.availableParticles.map((particle) => {
      const isAvailable = state.availableParticles.some((p) => p.id === particle.id);
      return {
        entity: particle,
        available: particle.id !== 1001,
        label: getParticleLabel(particle),
        description: particle.id === 1001 ? "Not available in libdedx v1.4.0" : undefined,
      };
    });
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
  }

  type MaterialEntry = MaterialGroup | MaterialItem;

  const materialItems = $derived.by<MaterialEntry[]>(() => {
    const elements = state.availableMaterials
      .filter((m) => m.id >= 1 && m.id <= 98)
      .sort((a, b) => a.id - b.id);
    const compounds = state.availableMaterials
      .filter((m) => m.id > 98 || m.id === 906)
      .sort((a, b) => a.name.localeCompare(b.name));

    const result: MaterialEntry[] = [
      { type: "section", label: "Elements" },
      ...elements.map((material) => ({
        type: "item" as const,
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: `${material.id}  ${material.name}`,
      })),
      { type: "section", label: "Compounds" },
      ...compounds.map((material) => ({
        type: "item" as const,
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: `${material.id}  ${material.name}`,
      })),
    ];

    return result;
  });

  interface ProgramGroup {
    type: "section";
    label: string;
  }

  interface ProgramItem {
    type: "item";
    entity: SelectedProgram | { id: number; name: string; version: string };
    available: boolean;
    label: string;
    description?: string;
  }

  type ProgramEntry = ProgramGroup | ProgramItem;

  const programItems = $derived.by<ProgramEntry[]>(() => {
    const result: ProgramEntry[] = [];

    const autoSelect = state.selectedProgram;
    if (autoSelect.id === -1) {
      const resolvedLabel = autoSelect.resolvedProgram ? "Auto-select →" : "Auto-select";
      result.push({
        type: "item" as const,
        entity: autoSelect,
        available: true,
        label: resolvedLabel,
      });
    }

    const tabulatedPrograms = state.availablePrograms.filter((p) => p.id <= 90);
    const analyticalPrograms = state.availablePrograms.filter((p) => p.id > 90);

    result.push({ type: "section", label: "Tabulated Programs" });

    for (const program of tabulatedPrograms) {
      result.push({
        type: "item" as const,
        entity: program,
        available: true,
        label: `${program.name} — ${program.version}`,
      });
    }

    if (analyticalPrograms.length > 0) {
      result.push({ type: "section", label: "Analytical Programs" });

      for (const program of analyticalPrograms) {
        result.push({
          type: "item" as const,
          entity: program,
          available: true,
          label: `${program.name} — ${program.version}`,
        });
      }
    }

    return result;
  });
</script>

<div class={cn("space-y-3", className)}>
  <EntityCombobox
    label="Particle"
    items={particleItems}
    selectedId={state.selectedParticle?.id ?? null}
    placeholder="Select particle"
    onItemSelect={(particle: ParticleEntity) => {
      if (particle.id === 1001) {
        return;
      }
      state.selectParticle(particle.id);
    }}
    onClear={() => state.clearParticle()}
  />

  <EntityCombobox
    label="Material"
    items={materialItems}
    selectedId={state.selectedMaterial?.id ?? null}
    placeholder="Select material"
    onItemSelect={(material: MaterialEntity) => {
      state.selectMaterial(material.id);
    }}
    onClear={() => state.clearMaterial()}
  />

  <EntityCombobox
    label="Program"
    items={programItems}
    selectedId={state.selectedProgram?.id ?? null}
    placeholder="Select program"
    onItemSelect={(item: any) => {
      if ("id" in item) {
        state.selectProgram(item.id);
      }
    }}
  />

  <div class="text-center">
    <a href="#" class="text-sm text-muted-foreground hover:underline" onclick={(e) => {
      e.preventDefault();
      state.resetAll();
    }}>
      Reset all
    </a>
  </div>
</div>
