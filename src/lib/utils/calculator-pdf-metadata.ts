import type { AdvancedPdfMetadata } from "$lib/export/pdf.js";
import type { EntitySelectionState } from "$lib/state/entity-selection.svelte";
import type { AdvancedOptions } from "$lib/wasm/types";

/**
 * Build the advanced PDF metadata object for the calculator page.
 *
 * Returns null when entity selection is incomplete (no particle or no material),
 * which signals to the PDF exporter to omit the advanced-metadata section.
 */
export function buildCalculatorPdfMetadata(
  entityState: EntitySelectionState,
  advancedOptionsValue: AdvancedOptions,
): AdvancedPdfMetadata | null {
  const particle = entityState.selectedParticle;
  const material = entityState.selectedMaterial;
  const program = entityState.selectedProgram;

  if (!particle || !material) return null;

  const programs: { name: string; type: "built-in" }[] = [];
  if ("resolvedProgram" in program && program.resolvedProgram) {
    programs.push({ name: program.resolvedProgram.name, type: "built-in" });
  } else {
    programs.push({ name: program.name, type: "built-in" });
  }

  const builtinParticle = "massNumber" in particle ? particle : null;
  const builtinMaterial = "isGasByDefault" in material ? material : null;
  return {
    particle: {
      name: particle.name,
      massNumber: builtinParticle?.massNumber ?? ("A" in particle ? particle.A : 0),
      atomicNumber:
        builtinParticle && typeof builtinParticle.id === "number"
          ? builtinParticle.id
          : "Z" in particle
            ? particle.Z
            : 0,
    },
    material: {
      name: material.name,
      density: builtinMaterial?.density ?? material.density ?? 0,
      densityUnit: "g/cm³",
      phase: builtinMaterial?.isGasByDefault ? "gas" : "condensed",
    },
    programs,
    advancedOptions: advancedOptionsValue,
  };
}
