<script lang="ts">
  import EntityCombobox from "./entity-combobox.svelte";
  import { cn } from "$lib/utils";
  import type { ParticleEntity, MaterialEntity, ProgramEntity } from "$lib/wasm/types";
  import { getProgramDescription } from "$lib/config/program-names";
  import type {
    EntitySelectionState,
    SelectedProgram,
    AutoSelectProgram,
  } from "$lib/state/entity-selection.svelte";
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
    const symbol = particle.symbol || "";
    return symbol ? `${particle.name} (${symbol})` : particle.name;
  }

  function getParticleSearchText(particle: ParticleEntity): string {
    return [
      particle.name,
      particle.symbol,
      `z=${particle.id}`,
      `z${particle.id}`,
      String(particle.id),
      `a=${particle.massNumber}`,
      `a${particle.massNumber}`,
      String(particle.massNumber),
      ...(particle.aliases ?? []),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const particleItems = $derived.by(() => {
    const nonElectronParticles = state.allParticles
      .filter((p) => p.id !== 1001)
      .map((particle) => ({
        entity: particle,
        available: state.availableParticles.some((p) => p.id === particle.id),
        label: getParticleLabel(particle),
        description: undefined,
        searchText: getParticleSearchText(particle),
      }));

    const electronParticle = state.allParticles
      .filter((p) => p.id === 1001)
      .map((particle) => ({
        entity: particle,
        available: false,
        label: getParticleLabel(particle),
        description: ELECTRON_UNSUPPORTED_SHORT,
        searchText: getParticleSearchText(particle),
        isElectron: true as const,
      }));

    return [...nonElectronParticles, ...electronParticle];
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
    searchText: string;
  }

  type MaterialEntry = MaterialGroup | MaterialItem;

  const materialItems = $derived.by<MaterialEntry[]>(() => {
    const elements = state.allMaterials
      .filter((m) => m.id >= 1 && m.id <= 98)
      .sort((a, b) => a.id - b.id);
    const compounds = state.allMaterials
      .filter((m) => m.id > 98 || m.id === 906)
      .sort((a, b) => a.name.localeCompare(b.name));

    const result: MaterialEntry[] = [
      { type: "section", label: "Elements" },
      ...elements.map((material) => ({
        type: "item" as const,
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
      })),
      { type: "section", label: "Compounds" },
      ...compounds.map((material) => ({
        type: "item" as const,
        entity: material,
        available: state.availableMaterials.some((m) => m.id === material.id),
        label: material.name,
        searchText: `${material.id} ${material.name}`,
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
    const currentProgram = state.selectedProgram;
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
    const tabulatedPrograms = state.availablePrograms.filter((p) => p.id <= 90);
    const analyticalPrograms = state.availablePrograms.filter((p) => p.id > 90);

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
  </div>

  <div class="w-full">
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
  </div>

  <!-- Keep all three selectors in one desktop row and avoid pointer-intercept overlap. -->
  <div class="w-full">
    <EntityCombobox
      label="Program"
      items={programItems}
      selectedId={state.selectedProgram?.id ?? null}
      placeholder="Select program"
      onItemSelect={(program: SelectedProgram | ProgramEntity) => {
        state.selectProgram(program.id);
      }}
    />
  </div>

  <div class="lg:col-span-3 lg:text-right">
    <button
      type="button"
      title="Restores Proton / Water / Auto-select"
      class="text-sm text-muted-foreground hover:text-foreground"
      onclick={() => {
        state.resetAll();
      }}
    >
      Restore defaults
    </button>
  </div>
</div>
