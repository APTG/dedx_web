/**
 * Element data lookup table and resolver utilities.
 *
 * Provides atomic weight data for all 118 elements (IUPAC-standard values)
 * and element symbol/atomic number lookups for chemical formula parsing.
 *
 * @packageDocumentation
 */

/** Element entry with symbol and standard atomic weight */
export interface ElementData {
  /** Atomic number Z (1–118) */
  atomicNumber: number;
  /** Chemical symbol (e.g., "H", "Fe") */
  symbol: string;
  /** Full element name (e.g., "Hydrogen", "Iron") */
  name: string;
  /** Standard atomic weight in g/mol (IUPAC 2021 values) */
  atomicWeight: number;
  /**
   * Mean excitation energy I (eV) for the chemical elements as adopted in ICRU Report 37 (1984),
   * derived by Berger & Seltzer (1982) and retained in ICRU Report 49 (1993).
   * Not available for Z > 92.
   */
  meanExcitationEnergy?: number;
}

/**
 * Standard atomic weights for all 118 elements (IUPAC 2021).
 * Values are in g/mol.
 *
 * I-values (eV) are derived from ICRU Report 37 (1984) / Berger & Seltzer (1982)
 * for elements Z=1 to Z=92.
 *

 * For elements with no stable isotopes, the mass number of the longest-lived
 * or most common isotope is given in parentheses.
 */
export const ELEMENTS: ReadonlyArray<ElementData> = [
  {
    atomicNumber: 1,
    symbol: "H",
    name: "Hydrogen",
    atomicWeight: 1.008,
    meanExcitationEnergy: 19.2,
  },
  {
    atomicNumber: 2,
    symbol: "He",
    name: "Helium",
    atomicWeight: 4.0026,
    meanExcitationEnergy: 41.8,
  },
  {
    atomicNumber: 3,
    symbol: "Li",
    name: "Lithium",
    atomicWeight: 6.94,
    meanExcitationEnergy: 40.0,
  },
  {
    atomicNumber: 4,
    symbol: "Be",
    name: "Beryllium",
    atomicWeight: 9.0122,
    meanExcitationEnergy: 63.7,
  },
  { atomicNumber: 5, symbol: "B", name: "Boron", atomicWeight: 10.81, meanExcitationEnergy: 76.0 },
  {
    atomicNumber: 6,
    symbol: "C",
    name: "Carbon",
    atomicWeight: 12.011,
    meanExcitationEnergy: 78.0,
  },
  {
    atomicNumber: 7,
    symbol: "N",
    name: "Nitrogen",
    atomicWeight: 14.007,
    meanExcitationEnergy: 82.0,
  },
  {
    atomicNumber: 8,
    symbol: "O",
    name: "Oxygen",
    atomicWeight: 15.999,
    meanExcitationEnergy: 95.0,
  },
  {
    atomicNumber: 9,
    symbol: "F",
    name: "Fluorine",
    atomicWeight: 18.998,
    meanExcitationEnergy: 115.0,
  },
  {
    atomicNumber: 10,
    symbol: "Ne",
    name: "Neon",
    atomicWeight: 20.18,
    meanExcitationEnergy: 137.0,
  },
  {
    atomicNumber: 11,
    symbol: "Na",
    name: "Sodium",
    atomicWeight: 22.99,
    meanExcitationEnergy: 149.0,
  },
  {
    atomicNumber: 12,
    symbol: "Mg",
    name: "Magnesium",
    atomicWeight: 24.305,
    meanExcitationEnergy: 156.0,
  },
  {
    atomicNumber: 13,
    symbol: "Al",
    name: "Aluminium",
    atomicWeight: 26.982,
    meanExcitationEnergy: 166.0,
  },
  {
    atomicNumber: 14,
    symbol: "Si",
    name: "Silicon",
    atomicWeight: 28.085,
    meanExcitationEnergy: 173.0,
  },
  {
    atomicNumber: 15,
    symbol: "P",
    name: "Phosphorus",
    atomicWeight: 30.974,
    meanExcitationEnergy: 173.0,
  },
  {
    atomicNumber: 16,
    symbol: "S",
    name: "Sulfur",
    atomicWeight: 32.06,
    meanExcitationEnergy: 180.0,
  },
  {
    atomicNumber: 17,
    symbol: "Cl",
    name: "Chlorine",
    atomicWeight: 35.45,
    meanExcitationEnergy: 174.0,
  },
  {
    atomicNumber: 18,
    symbol: "Ar",
    name: "Argon",
    atomicWeight: 39.948,
    meanExcitationEnergy: 188.0,
  },
  {
    atomicNumber: 19,
    symbol: "K",
    name: "Potassium",
    atomicWeight: 39.098,
    meanExcitationEnergy: 190.0,
  },
  {
    atomicNumber: 20,
    symbol: "Ca",
    name: "Calcium",
    atomicWeight: 40.078,
    meanExcitationEnergy: 191.0,
  },
  {
    atomicNumber: 21,
    symbol: "Sc",
    name: "Scandium",
    atomicWeight: 44.956,
    meanExcitationEnergy: 216.0,
  },
  {
    atomicNumber: 22,
    symbol: "Ti",
    name: "Titanium",
    atomicWeight: 47.867,
    meanExcitationEnergy: 233.0,
  },
  {
    atomicNumber: 23,
    symbol: "V",
    name: "Vanadium",
    atomicWeight: 50.942,
    meanExcitationEnergy: 245.0,
  },
  {
    atomicNumber: 24,
    symbol: "Cr",
    name: "Chromium",
    atomicWeight: 51.996,
    meanExcitationEnergy: 257.0,
  },
  {
    atomicNumber: 25,
    symbol: "Mn",
    name: "Manganese",
    atomicWeight: 54.938,
    meanExcitationEnergy: 272.0,
  },
  {
    atomicNumber: 26,
    symbol: "Fe",
    name: "Iron",
    atomicWeight: 55.845,
    meanExcitationEnergy: 286.0,
  },
  {
    atomicNumber: 27,
    symbol: "Co",
    name: "Cobalt",
    atomicWeight: 58.933,
    meanExcitationEnergy: 297.0,
  },
  {
    atomicNumber: 28,
    symbol: "Ni",
    name: "Nickel",
    atomicWeight: 58.693,
    meanExcitationEnergy: 311.0,
  },
  {
    atomicNumber: 29,
    symbol: "Cu",
    name: "Copper",
    atomicWeight: 63.546,
    meanExcitationEnergy: 322.0,
  },
  {
    atomicNumber: 30,
    symbol: "Zn",
    name: "Zinc",
    atomicWeight: 65.38,
    meanExcitationEnergy: 330.0,
  },
  {
    atomicNumber: 31,
    symbol: "Ga",
    name: "Gallium",
    atomicWeight: 69.723,
    meanExcitationEnergy: 334.0,
  },
  {
    atomicNumber: 32,
    symbol: "Ge",
    name: "Germanium",
    atomicWeight: 72.63,
    meanExcitationEnergy: 350.0,
  },
  {
    atomicNumber: 33,
    symbol: "As",
    name: "Arsenic",
    atomicWeight: 74.922,
    meanExcitationEnergy: 347.0,
  },
  {
    atomicNumber: 34,
    symbol: "Se",
    name: "Selenium",
    atomicWeight: 78.971,
    meanExcitationEnergy: 348.0,
  },
  {
    atomicNumber: 35,
    symbol: "Br",
    name: "Bromine",
    atomicWeight: 79.904,
    meanExcitationEnergy: 343.0,
  },
  {
    atomicNumber: 36,
    symbol: "Kr",
    name: "Krypton",
    atomicWeight: 83.798,
    meanExcitationEnergy: 352.0,
  },
  {
    atomicNumber: 37,
    symbol: "Rb",
    name: "Rubidium",
    atomicWeight: 85.468,
    meanExcitationEnergy: 363.0,
  },
  {
    atomicNumber: 38,
    symbol: "Sr",
    name: "Strontium",
    atomicWeight: 87.62,
    meanExcitationEnergy: 366.0,
  },
  {
    atomicNumber: 39,
    symbol: "Y",
    name: "Yttrium",
    atomicWeight: 88.906,
    meanExcitationEnergy: 379.0,
  },
  {
    atomicNumber: 40,
    symbol: "Zr",
    name: "Zirconium",
    atomicWeight: 91.224,
    meanExcitationEnergy: 393.0,
  },
  {
    atomicNumber: 41,
    symbol: "Nb",
    name: "Niobium",
    atomicWeight: 92.906,
    meanExcitationEnergy: 417.0,
  },
  {
    atomicNumber: 42,
    symbol: "Mo",
    name: "Molybdenum",
    atomicWeight: 95.95,
    meanExcitationEnergy: 424.0,
  },
  {
    atomicNumber: 43,
    symbol: "Tc",
    name: "Technetium",
    atomicWeight: 98,
    meanExcitationEnergy: 428.0,
  },
  {
    atomicNumber: 44,
    symbol: "Ru",
    name: "Ruthenium",
    atomicWeight: 101.07,
    meanExcitationEnergy: 441.0,
  },
  {
    atomicNumber: 45,
    symbol: "Rh",
    name: "Rhodium",
    atomicWeight: 102.91,
    meanExcitationEnergy: 449.0,
  },
  {
    atomicNumber: 46,
    symbol: "Pd",
    name: "Palladium",
    atomicWeight: 106.42,
    meanExcitationEnergy: 470.0,
  },
  {
    atomicNumber: 47,
    symbol: "Ag",
    name: "Silver",
    atomicWeight: 107.87,
    meanExcitationEnergy: 470.0,
  },
  {
    atomicNumber: 48,
    symbol: "Cd",
    name: "Cadmium",
    atomicWeight: 112.41,
    meanExcitationEnergy: 469.0,
  },
  {
    atomicNumber: 49,
    symbol: "In",
    name: "Indium",
    atomicWeight: 114.82,
    meanExcitationEnergy: 488.0,
  },
  {
    atomicNumber: 50,
    symbol: "Sn",
    name: "Tin",
    atomicWeight: 118.71,
    meanExcitationEnergy: 488.0,
  },
  {
    atomicNumber: 51,
    symbol: "Sb",
    name: "Antimony",
    atomicWeight: 121.76,
    meanExcitationEnergy: 487.0,
  },
  {
    atomicNumber: 52,
    symbol: "Te",
    name: "Tellurium",
    atomicWeight: 127.6,
    meanExcitationEnergy: 485.0,
  },
  {
    atomicNumber: 53,
    symbol: "I",
    name: "Iodine",
    atomicWeight: 126.9,
    meanExcitationEnergy: 491.0,
  },
  {
    atomicNumber: 54,
    symbol: "Xe",
    name: "Xenon",
    atomicWeight: 131.29,
    meanExcitationEnergy: 482.0,
  },
  {
    atomicNumber: 55,
    symbol: "Cs",
    name: "Caesium",
    atomicWeight: 132.91,
    meanExcitationEnergy: 488.0,
  },
  {
    atomicNumber: 56,
    symbol: "Ba",
    name: "Barium",
    atomicWeight: 137.33,
    meanExcitationEnergy: 491.0,
  },
  {
    atomicNumber: 57,
    symbol: "La",
    name: "Lanthanum",
    atomicWeight: 138.91,
    meanExcitationEnergy: 501.0,
  },
  {
    atomicNumber: 58,
    symbol: "Ce",
    name: "Cerium",
    atomicWeight: 140.12,
    meanExcitationEnergy: 523.0,
  },
  {
    atomicNumber: 59,
    symbol: "Pr",
    name: "Praseodymium",
    atomicWeight: 140.91,
    meanExcitationEnergy: 535.0,
  },
  {
    atomicNumber: 60,
    symbol: "Nd",
    name: "Neodymium",
    atomicWeight: 144.24,
    meanExcitationEnergy: 546.0,
  },
  {
    atomicNumber: 61,
    symbol: "Pm",
    name: "Promethium",
    atomicWeight: 145,
    meanExcitationEnergy: 560.0,
  },
  {
    atomicNumber: 62,
    symbol: "Sm",
    name: "Samarium",
    atomicWeight: 150.36,
    meanExcitationEnergy: 574.0,
  },
  {
    atomicNumber: 63,
    symbol: "Eu",
    name: "Europium",
    atomicWeight: 151.96,
    meanExcitationEnergy: 580.0,
  },
  {
    atomicNumber: 64,
    symbol: "Gd",
    name: "Gadolinium",
    atomicWeight: 157.25,
    meanExcitationEnergy: 591.0,
  },
  {
    atomicNumber: 65,
    symbol: "Tb",
    name: "Terbium",
    atomicWeight: 158.93,
    meanExcitationEnergy: 614.0,
  },
  {
    atomicNumber: 66,
    symbol: "Dy",
    name: "Dysprosium",
    atomicWeight: 162.5,
    meanExcitationEnergy: 628.0,
  },
  {
    atomicNumber: 67,
    symbol: "Ho",
    name: "Holmium",
    atomicWeight: 164.93,
    meanExcitationEnergy: 650.0,
  },
  {
    atomicNumber: 68,
    symbol: "Er",
    name: "Erbium",
    atomicWeight: 167.26,
    meanExcitationEnergy: 658.0,
  },
  {
    atomicNumber: 69,
    symbol: "Tm",
    name: "Thulium",
    atomicWeight: 168.93,
    meanExcitationEnergy: 674.0,
  },
  {
    atomicNumber: 70,
    symbol: "Yb",
    name: "Ytterbium",
    atomicWeight: 173.05,
    meanExcitationEnergy: 684.0,
  },
  {
    atomicNumber: 71,
    symbol: "Lu",
    name: "Lutetium",
    atomicWeight: 174.97,
    meanExcitationEnergy: 694.0,
  },
  {
    atomicNumber: 72,
    symbol: "Hf",
    name: "Hafnium",
    atomicWeight: 178.49,
    meanExcitationEnergy: 705.0,
  },
  {
    atomicNumber: 73,
    symbol: "Ta",
    name: "Tantalum",
    atomicWeight: 180.95,
    meanExcitationEnergy: 718.0,
  },
  {
    atomicNumber: 74,
    symbol: "W",
    name: "Tungsten",
    atomicWeight: 183.84,
    meanExcitationEnergy: 727.0,
  },
  {
    atomicNumber: 75,
    symbol: "Re",
    name: "Rhenium",
    atomicWeight: 186.21,
    meanExcitationEnergy: 736.0,
  },
  {
    atomicNumber: 76,
    symbol: "Os",
    name: "Osmium",
    atomicWeight: 190.23,
    meanExcitationEnergy: 746.0,
  },
  {
    atomicNumber: 77,
    symbol: "Ir",
    name: "Iridium",
    atomicWeight: 192.22,
    meanExcitationEnergy: 757.0,
  },
  {
    atomicNumber: 78,
    symbol: "Pt",
    name: "Platinum",
    atomicWeight: 195.08,
    meanExcitationEnergy: 790.0,
  },
  {
    atomicNumber: 79,
    symbol: "Au",
    name: "Gold",
    atomicWeight: 196.97,
    meanExcitationEnergy: 790.0,
  },
  {
    atomicNumber: 80,
    symbol: "Hg",
    name: "Mercury",
    atomicWeight: 200.59,
    meanExcitationEnergy: 800.0,
  },
  {
    atomicNumber: 81,
    symbol: "Tl",
    name: "Thallium",
    atomicWeight: 204.38,
    meanExcitationEnergy: 810.0,
  },
  {
    atomicNumber: 82,
    symbol: "Pb",
    name: "Lead",
    atomicWeight: 207.2,
    meanExcitationEnergy: 823.0,
  },
  {
    atomicNumber: 83,
    symbol: "Bi",
    name: "Bismuth",
    atomicWeight: 208.98,
    meanExcitationEnergy: 823.0,
  },
  {
    atomicNumber: 84,
    symbol: "Po",
    name: "Polonium",
    atomicWeight: 209,
    meanExcitationEnergy: 830.0,
  },
  {
    atomicNumber: 85,
    symbol: "At",
    name: "Astatine",
    atomicWeight: 210,
    meanExcitationEnergy: 825.0,
  },
  { atomicNumber: 86, symbol: "Rn", name: "Radon", atomicWeight: 222, meanExcitationEnergy: 794.0 },
  {
    atomicNumber: 87,
    symbol: "Fr",
    name: "Francium",
    atomicWeight: 223,
    meanExcitationEnergy: 827.0,
  },
  {
    atomicNumber: 88,
    symbol: "Ra",
    name: "Radium",
    atomicWeight: 226,
    meanExcitationEnergy: 826.0,
  },
  {
    atomicNumber: 89,
    symbol: "Ac",
    name: "Actinium",
    atomicWeight: 227,
    meanExcitationEnergy: 841.0,
  },
  {
    atomicNumber: 90,
    symbol: "Th",
    name: "Thorium",
    atomicWeight: 232.04,
    meanExcitationEnergy: 847.0,
  },
  {
    atomicNumber: 91,
    symbol: "Pa",
    name: "Protactinium",
    atomicWeight: 231.04,
    meanExcitationEnergy: 878.0,
  },
  {
    atomicNumber: 92,
    symbol: "U",
    name: "Uranium",
    atomicWeight: 238.03,
    meanExcitationEnergy: 890.0,
  },
  { atomicNumber: 93, symbol: "Np", name: "Neptunium", atomicWeight: 237 },
  { atomicNumber: 94, symbol: "Pu", name: "Plutonium", atomicWeight: 244 },
  { atomicNumber: 95, symbol: "Am", name: "Americium", atomicWeight: 243 },
  { atomicNumber: 96, symbol: "Cm", name: "Curium", atomicWeight: 247 },
  { atomicNumber: 97, symbol: "Bk", name: "Berkelium", atomicWeight: 247 },
  { atomicNumber: 98, symbol: "Cf", name: "Californium", atomicWeight: 251 },
  { atomicNumber: 99, symbol: "Es", name: "Einsteinium", atomicWeight: 252 },
  { atomicNumber: 100, symbol: "Fm", name: "Fermium", atomicWeight: 257 },
  { atomicNumber: 101, symbol: "Md", name: "Mendelevium", atomicWeight: 258 },
  { atomicNumber: 102, symbol: "No", name: "Nobelium", atomicWeight: 259 },
  { atomicNumber: 103, symbol: "Lr", name: "Lawrencium", atomicWeight: 266 },
  { atomicNumber: 104, symbol: "Rf", name: "Rutherfordium", atomicWeight: 267 },
  { atomicNumber: 105, symbol: "Db", name: "Dubnium", atomicWeight: 268 },
  { atomicNumber: 106, symbol: "Sg", name: "Seaborgium", atomicWeight: 269 },
  { atomicNumber: 107, symbol: "Bh", name: "Bohrium", atomicWeight: 270 },
  { atomicNumber: 108, symbol: "Hs", name: "Hassium", atomicWeight: 277 },
  { atomicNumber: 109, symbol: "Mt", name: "Meitnerium", atomicWeight: 278 },
  { atomicNumber: 110, symbol: "Ds", name: "Darmstadtium", atomicWeight: 281 },
  { atomicNumber: 111, symbol: "Rg", name: "Roentgenium", atomicWeight: 282 },
  { atomicNumber: 112, symbol: "Cn", name: "Copernicium", atomicWeight: 285 },
  { atomicNumber: 113, symbol: "Nh", name: "Nihonium", atomicWeight: 286 },
  { atomicNumber: 114, symbol: "Fl", name: "Flerovium", atomicWeight: 289 },
  { atomicNumber: 115, symbol: "Mc", name: "Moscovium", atomicWeight: 290 },
  { atomicNumber: 116, symbol: "Lv", name: "Livermorium", atomicWeight: 293 },
  { atomicNumber: 117, symbol: "Ts", name: "Tennessine", atomicWeight: 294 },
  { atomicNumber: 118, symbol: "Og", name: "Oganesson", atomicWeight: 294 },
] as const;

/** Lookup table: atomic number (1–118) → ElementData */
const ELEMENT_BY_Z: ReadonlyMap<number, ElementData> = new Map(
  ELEMENTS.map((e) => [e.atomicNumber, e]),
);

/** Lookup table: lowercase symbol → ElementData */
const ELEMENT_BY_SYMBOL: ReadonlyMap<string, ElementData> = new Map(
  ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]),
);

/** Lookup table: lowercase name → ElementData */
const ELEMENT_BY_NAME: ReadonlyMap<string, ElementData> = new Map(
  ELEMENTS.map((e) => [e.name.toLowerCase(), e]),
);

/**
 * Resolve an element from user input.
 *
 * Accepts:
 * - Atomic number as string (e.g., "1", "26")
 * - Element symbol (case-insensitive, e.g., "H", "fe", "Fe")
 * - Full element name (case-insensitive, e.g., "hydrogen", "IRON")
 *
 * @param input - User input string to resolve
 * @returns ElementData if found, undefined if not recognized
 */
export function resolveElement(input: string): ElementData | undefined {
  const trimmed = input.trim();

  if (!trimmed) return undefined;

  // Try parsing as atomic number (Z)
  if (/^\d+$/.test(trimmed)) {
    const z = parseInt(trimmed, 10);
    if (z >= 1 && z <= 118) {
      return ELEMENT_BY_Z.get(z);
    }
  }

  // Try symbol lookup (case-insensitive)
  const bySymbol = ELEMENT_BY_SYMBOL.get(trimmed.toLowerCase());
  if (bySymbol) return bySymbol;

  // Try name lookup (case-insensitive)
  const byName = ELEMENT_BY_NAME.get(trimmed.toLowerCase());
  if (byName) return byName;

  return undefined;
}

/**
 * Get atomic weight for an element by atomic number.
 *
 * @param atomicNumber - Atomic number Z (1–118)
 * @returns Atomic weight in g/mol, or undefined if Z is invalid
 */
export function getAtomicWeight(atomicNumber: number): number | undefined {
  return ELEMENT_BY_Z.get(atomicNumber)?.atomicWeight;
}

/**
 * Get element symbol by atomic number.
 *
 * @param atomicNumber - Atomic number Z (1–118)
 * @returns Element symbol (e.g., "H", "Fe"), or undefined if Z is invalid
 */
export function getElementSymbol(atomicNumber: number): string | undefined {
  return ELEMENT_BY_Z.get(atomicNumber)?.symbol;
}

/**
 * Get element name by atomic number.
 *
 * @param atomicNumber - Atomic number Z (1–118)
 * @returns Full element name (e.g., "Hydrogen", "Iron"), or undefined if Z is invalid
 */
export function getElementName(atomicNumber: number): string | undefined {
  return ELEMENT_BY_Z.get(atomicNumber)?.name;
}

/**
 * Validate that an atomic number is in the valid range.
 *
 * @param atomicNumber - Value to validate
 * @returns true if Z ∈ [1, 118]
 */
export function isValidAtomicNumber(atomicNumber: number): boolean {
  return Number.isInteger(atomicNumber) && atomicNumber >= 1 && atomicNumber <= 118;
}

/**
 * Compute molecular weight from elemental composition.
 *
 * @param elements - Array of { atomicNumber, atomCount } pairs
 * @returns Molecular weight in g/mol, or undefined if any element is invalid
 */
export function computeMolecularWeight(
  elements: Array<{ atomicNumber: number; atomCount: number }>,
): number | undefined {
  let total = 0;
  for (const { atomicNumber, atomCount } of elements) {
    const atomicWeight = getAtomicWeight(atomicNumber);
    if (atomicWeight === undefined) {
      return undefined;
    }
    total += atomicWeight * atomCount;
  }
  return total;
}

/**
 * Compute weight fractions from elemental composition.
 *
 * @param elements - Array of { atomicNumber, atomCount } pairs
 * @returns Array of { atomicNumber, weightFraction } or undefined if any element is invalid
 */
export function computeWeightFractions(
  elements: Array<{ atomicNumber: number; atomCount: number }>,
): Array<{ atomicNumber: number; weightFraction: number }> | undefined {
  const molecularWeight = computeMolecularWeight(elements);
  if (molecularWeight === undefined || molecularWeight === 0) {
    return undefined;
  }

  return elements.map(({ atomicNumber, atomCount }) => {
    const atomicWeight = getAtomicWeight(atomicNumber)!;
    const contribution = atomicWeight * atomCount;
    return {
      atomicNumber,
      weightFraction: contribution / molecularWeight,
    };
  });
}

/**
 * Compute atom counts from weight fractions.
 *
 * Formula: n_i = w_i / M_i, where w_i is weight fraction and M_i is atomic weight.
 *
 * @param weightFractions - Array of { atomicNumber, weightFraction } pairs
 * @returns Array of { atomicNumber, atomCount } or undefined if any element is invalid
 */
export function computeAtomCounts(
  weightFractions: Array<{ atomicNumber: number; weightFraction: number }>,
): Array<{ atomicNumber: number; atomCount: number }> | undefined {
  const result: Array<{ atomicNumber: number; atomCount: number }> = [];

  for (const { atomicNumber, weightFraction } of weightFractions) {
    const atomicWeight = getAtomicWeight(atomicNumber);
    if (atomicWeight === undefined) {
      return undefined;
    }
    result.push({
      atomicNumber,
      atomCount: weightFraction / atomicWeight,
    });
  }

  return result;
}

/**
 * Normalize atom counts to smallest integer ratio.
 *
 * Divides all atom counts by the minimum value and rounds to reasonable precision
 * for simple stoichiometric formulas. Useful for displaying weight-fraction
 * input results in formula mode.
 *
 * @param elements - Array of { atomicNumber, atomCount } pairs
 * @param precision - Decimal places for rounding (default: 4)
 * @returns Normalized array with same atomic numbers
 */
export function normalizeAtomCounts(
  elements: Array<{ atomicNumber: number; atomCount: number }>,
  precision: number = 4,
): Array<{ atomicNumber: number; atomCount: number }> {
  if (elements.length === 0) return [];

  const minCount = Math.min(...elements.map((e) => e.atomCount));
  if (minCount <= 0) return elements;

  const multiplier = Math.pow(10, precision);
  return elements.map((e) => ({
    atomicNumber: e.atomicNumber,
    atomCount: Math.round((e.atomCount / minCount) * multiplier) / multiplier,
  }));
}

/**
 * Calculate the Bragg I-value for a list of elements based on the Bragg additivity rule:
 * ln(I_compound) = sum(n_j * Z_j * ln(I_j)) / sum(n_j * Z_j)
 *
 * @param elements - Array of { atomicNumber, atomCount } pairs
 * @returns Computed Bragg I-value in eV, or undefined if any element is missing an I-value (Z > 92) or if empty
 */
export function computeBraggIValue(
  elements: Array<{ atomicNumber: number; atomCount: number }>,
): number | undefined {
  if (!elements || elements.length === 0) return undefined;

  let sumNumerator = 0;
  let sumDenominator = 0;

  for (const { atomicNumber, atomCount } of elements) {
    if (atomCount <= 0) continue;

    const elData = ELEMENT_BY_Z.get(atomicNumber);
    if (!elData || elData.meanExcitationEnergy === undefined) {
      // Cannot compute via Bragg additivity if any constituent lacks an I-value (e.g., Z > 92)
      return undefined;
    }

    const n = atomCount;
    const Z = atomicNumber;
    const I = elData.meanExcitationEnergy;

    sumNumerator += n * Z * Math.log(I);
    sumDenominator += n * Z;
  }

  if (sumDenominator === 0) return undefined;

  return Math.exp(sumNumerator / sumDenominator);
}
