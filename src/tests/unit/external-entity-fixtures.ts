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
              id: "mu",
              name: "Muon",
              symbol: "μ",
              Z: 0,
              A: 0,
              atomicMass: 0.113,
              pdgCode: 13,
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
