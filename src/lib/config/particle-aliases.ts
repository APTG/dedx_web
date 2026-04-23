export interface ParticleAliasData {
  aliases: string[];
  chemicalSymbol: string;
}

export const PARTICLE_ALIASES: Map<number, ParticleAliasData> = new Map([
  [1, { aliases: ["proton", "p", "H-1", "hydrogen"], chemicalSymbol: "H" }],
  [2, { aliases: ["alpha", "α", "He-4", "helium"], chemicalSymbol: "He" }],
  [3, { aliases: ["Li", "lithium"], chemicalSymbol: "Li" }],
  [4, { aliases: ["Be", "beryllium"], chemicalSymbol: "Be" }],
  [5, { aliases: ["B", "boron"], chemicalSymbol: "B" }],
  [6, { aliases: ["C-12", "carbon"], chemicalSymbol: "C" }],
  [7, { aliases: ["N", "nitrogen"], chemicalSymbol: "N" }],
  [8, { aliases: ["O", "oxygen"], chemicalSymbol: "O" }],
  [9, { aliases: ["F", "fluorine"], chemicalSymbol: "F" }],
  [10, { aliases: ["Ne", "neon"], chemicalSymbol: "Ne" }],
  [11, { aliases: ["Na", "sodium"], chemicalSymbol: "Na" }],
  [12, { aliases: ["Mg", "magnesium"], chemicalSymbol: "Mg" }],
  [13, { aliases: ["Al", "aluminum"], chemicalSymbol: "Al" }],
  [14, { aliases: ["Si", "silicon"], chemicalSymbol: "Si" }],
  [15, { aliases: ["P", "phosphorus"], chemicalSymbol: "P" }],
  [16, { aliases: ["S", "sulfur"], chemicalSymbol: "S" }],
  [17, { aliases: ["Cl", "chlorine"], chemicalSymbol: "Cl" }],
  [18, { aliases: ["Ar", "argon"], chemicalSymbol: "Ar" }],
  [1001, { aliases: ["e⁻", "e-", "beta", "electron"], chemicalSymbol: "e⁻" }],
]);

export function getParticleAliases(particleId: number): string[] {
  return PARTICLE_ALIASES.get(particleId)?.aliases ?? [];
}

export function getParticleSymbol(particleId: number): string {
  return PARTICLE_ALIASES.get(particleId)?.chemicalSymbol ?? "";
}

export function findParticleIdByAlias(alias: string): number | null {
  const lowerAlias = alias.toLowerCase();
  for (const [id, data] of PARTICLE_ALIASES.entries()) {
    if (data.aliases.some((a) => a.toLowerCase() === lowerAlias)) {
      return id;
    }
  }
  return null;
}
