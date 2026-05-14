import type { ExternalStoreMetadata } from "$lib/external-data/schema";

export function makeExternalEntityStore(
  options: { includeExternalOnlyParticle?: boolean } = {},
): ExternalStoreMetadata {
  return {
    label: "srim",
    url: "https://example.test/srim.webdedx/",
    name: "SRIM GUI reference stopping-power tables",
    programs: [{ id: "srim-2013-gui", name: "SRIM GUI", version: "SRIM-2013.00" }],
    particles: [
      {
        id: "p",
        name: "Proton",
        symbol: "p",
        Z: 1,
        A: 1,
        atomicMass: 1.007,
        pdgCode: 2212,
        index: 0,
      },
      ...(options.includeExternalOnlyParticle
        ? [
            {
              // Antiproton: PDG -2212 and Z=-1 don't collide with any built-in
              // libdedx particle by either PDG primary key or (Z, A) fallback.
              id: "antiproton",
              name: "Antiproton",
              symbol: "p̄",
              Z: -1,
              A: 1,
              atomicMass: 1.007,
              pdgCode: -2212,
              index: 1,
            },
          ]
        : []),
    ],
    materials: [
      {
        id: "water",
        name: "Water (liquid)",
        icruId: 276,
        density: 1,
        index: 0,
        linearUnitsAvailable: true,
      },
      {
        id: "poly",
        name: "External Polymer",
        density: 1.2,
        index: 1,
        linearUnitsAvailable: true,
      },
    ],
    energyGrid: [1, 10, 100],
    energyUnit: "MeV",
    stpUnit: "MeV·cm²/g",
    hasCsdaRange: true,
  };
}
