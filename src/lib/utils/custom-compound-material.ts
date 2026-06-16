import type { CompoundElement, MaterialEntity } from "$lib/wasm/types";
import { customCompounds } from "$lib/state/custom-compounds.svelte";

export type CustomMaterialEntity = MaterialEntity & {
  id: string;
  elements: Array<{ atomicNumber: number; atomCount: number }>;
};

export function isCustomMaterial(
  material: MaterialEntity | null | undefined,
): material is CustomMaterialEntity {
  return (
    !!material &&
    typeof material.id === "string" &&
    material.id.startsWith("cc_") &&
    Array.isArray(material.elements)
  );
}

export function customMaterialElementsForWasm(material: CustomMaterialEntity): CompoundElement[] {
  return material.elements.map((element) => ({
    atomicNumber: element.atomicNumber,
    fraction: element.atomCount,
    type: "atomic",
  }));
}

export function customMaterialUrlFields(material: CustomMaterialEntity) {
  return {
    materialIsCustom: true,
    materialId: null,
    matName: material.name,
    matDensity: material.density,
    matElements: material.elements,
    matIval: material.iValue,
    matPhase: material.phase ?? (material.isGasByDefault ? "gas" : "condensed"),
    materialIsGas: material.isGasByDefault,
    // Provenance hint: a compound still living in the transient store came from
    // a shared URL and was never saved to the local library (issue #648).
    ...(customCompounds.isTransient(material.id) ? { matSrc: "transient" as const } : {}),
  } as const;
}
