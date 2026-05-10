import type { CompoundElement, MaterialEntity } from "$lib/wasm/types";

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
  } as const;
}
