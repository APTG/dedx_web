export interface ParticleAliasData {
  aliases: string[];
  chemicalSymbol: string;
}

/**
 * Aliases + chemical symbols for every libdedx particle ID.
 *
 * Coverage:
 * - IDs 1 and 2 carry rich aliases (`proton`/`p`/`H-1` and
 *   `alpha`/`α`/`He-4`) so physicists can search for a beam by its
 *   conventional name. Per the entity-selection spec, the UI labels
 *   them as "proton" and "alpha particle" rather than "Hydrogen" /
 *   "Helium" — see `docs/04-feature-specs/entity-selection.md`
 *   §"Particle naming preferences".
 * - IDs 3..118 carry the IUPAC chemical symbol so the searchable
 *   combobox can match `Sn` → Tin, `Sb` → Antimony, etc., and so each
 *   row in the dropdown shows `Tin (Sn)` rather than the bare element
 *   name. The English element name is included as an alias for
 *   robustness against locale / spelling differences.
 * - ID 1001 is the electron — the C API returns "" for its name so
 *   we reserve a friendly label here.
 *
 * The list is exhaustive (Z=1..118) so a libdedx update that exposes
 * a heavier ion will not regress to an empty `(?)` symbol like the
 * 2026-04-26 screenshot of Tin / Antimony / Iodine / Copernicium.
 */
export const PARTICLE_ALIASES: Map<number, ParticleAliasData> = new Map([
  [1, { aliases: ["proton", "p", "p+", "H-1", "hydrogen"], chemicalSymbol: "H" }],
  [2, { aliases: ["alpha", "alpha particle", "α", "He-4", "helium"], chemicalSymbol: "He" }],
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
  [13, { aliases: ["Al", "aluminum", "aluminium"], chemicalSymbol: "Al" }],
  [14, { aliases: ["Si", "silicon"], chemicalSymbol: "Si" }],
  [15, { aliases: ["P", "phosphorus"], chemicalSymbol: "P" }],
  [16, { aliases: ["S", "sulfur", "sulphur"], chemicalSymbol: "S" }],
  [17, { aliases: ["Cl", "chlorine"], chemicalSymbol: "Cl" }],
  [18, { aliases: ["Ar", "argon"], chemicalSymbol: "Ar" }],
  [19, { aliases: ["K", "potassium"], chemicalSymbol: "K" }],
  [20, { aliases: ["Ca", "calcium"], chemicalSymbol: "Ca" }],
  [21, { aliases: ["Sc", "scandium"], chemicalSymbol: "Sc" }],
  [22, { aliases: ["Ti", "titanium"], chemicalSymbol: "Ti" }],
  [23, { aliases: ["V", "vanadium"], chemicalSymbol: "V" }],
  [24, { aliases: ["Cr", "chromium"], chemicalSymbol: "Cr" }],
  [25, { aliases: ["Mn", "manganese"], chemicalSymbol: "Mn" }],
  [26, { aliases: ["Fe", "iron"], chemicalSymbol: "Fe" }],
  [27, { aliases: ["Co", "cobalt"], chemicalSymbol: "Co" }],
  [28, { aliases: ["Ni", "nickel"], chemicalSymbol: "Ni" }],
  [29, { aliases: ["Cu", "copper"], chemicalSymbol: "Cu" }],
  [30, { aliases: ["Zn", "zinc"], chemicalSymbol: "Zn" }],
  [31, { aliases: ["Ga", "gallium"], chemicalSymbol: "Ga" }],
  [32, { aliases: ["Ge", "germanium"], chemicalSymbol: "Ge" }],
  [33, { aliases: ["As", "arsenic"], chemicalSymbol: "As" }],
  [34, { aliases: ["Se", "selenium"], chemicalSymbol: "Se" }],
  [35, { aliases: ["Br", "bromine"], chemicalSymbol: "Br" }],
  [36, { aliases: ["Kr", "krypton"], chemicalSymbol: "Kr" }],
  [37, { aliases: ["Rb", "rubidium"], chemicalSymbol: "Rb" }],
  [38, { aliases: ["Sr", "strontium"], chemicalSymbol: "Sr" }],
  [39, { aliases: ["Y", "yttrium"], chemicalSymbol: "Y" }],
  [40, { aliases: ["Zr", "zirconium"], chemicalSymbol: "Zr" }],
  [41, { aliases: ["Nb", "niobium"], chemicalSymbol: "Nb" }],
  [42, { aliases: ["Mo", "molybdenum"], chemicalSymbol: "Mo" }],
  [43, { aliases: ["Tc", "technetium"], chemicalSymbol: "Tc" }],
  [44, { aliases: ["Ru", "ruthenium"], chemicalSymbol: "Ru" }],
  [45, { aliases: ["Rh", "rhodium"], chemicalSymbol: "Rh" }],
  [46, { aliases: ["Pd", "palladium"], chemicalSymbol: "Pd" }],
  [47, { aliases: ["Ag", "silver"], chemicalSymbol: "Ag" }],
  [48, { aliases: ["Cd", "cadmium"], chemicalSymbol: "Cd" }],
  [49, { aliases: ["In", "indium"], chemicalSymbol: "In" }],
  [50, { aliases: ["Sn", "tin"], chemicalSymbol: "Sn" }],
  [51, { aliases: ["Sb", "antimony"], chemicalSymbol: "Sb" }],
  [52, { aliases: ["Te", "tellurium"], chemicalSymbol: "Te" }],
  [53, { aliases: ["I", "iodine"], chemicalSymbol: "I" }],
  [54, { aliases: ["Xe", "xenon"], chemicalSymbol: "Xe" }],
  [55, { aliases: ["Cs", "caesium", "cesium"], chemicalSymbol: "Cs" }],
  [56, { aliases: ["Ba", "barium"], chemicalSymbol: "Ba" }],
  [57, { aliases: ["La", "lanthanum"], chemicalSymbol: "La" }],
  [58, { aliases: ["Ce", "cerium"], chemicalSymbol: "Ce" }],
  [59, { aliases: ["Pr", "praseodymium"], chemicalSymbol: "Pr" }],
  [60, { aliases: ["Nd", "neodymium"], chemicalSymbol: "Nd" }],
  [61, { aliases: ["Pm", "promethium"], chemicalSymbol: "Pm" }],
  [62, { aliases: ["Sm", "samarium"], chemicalSymbol: "Sm" }],
  [63, { aliases: ["Eu", "europium"], chemicalSymbol: "Eu" }],
  [64, { aliases: ["Gd", "gadolinium"], chemicalSymbol: "Gd" }],
  [65, { aliases: ["Tb", "terbium"], chemicalSymbol: "Tb" }],
  [66, { aliases: ["Dy", "dysprosium"], chemicalSymbol: "Dy" }],
  [67, { aliases: ["Ho", "holmium"], chemicalSymbol: "Ho" }],
  [68, { aliases: ["Er", "erbium"], chemicalSymbol: "Er" }],
  [69, { aliases: ["Tm", "thulium"], chemicalSymbol: "Tm" }],
  [70, { aliases: ["Yb", "ytterbium"], chemicalSymbol: "Yb" }],
  [71, { aliases: ["Lu", "lutetium"], chemicalSymbol: "Lu" }],
  [72, { aliases: ["Hf", "hafnium"], chemicalSymbol: "Hf" }],
  [73, { aliases: ["Ta", "tantalum"], chemicalSymbol: "Ta" }],
  [74, { aliases: ["W", "tungsten", "wolfram"], chemicalSymbol: "W" }],
  [75, { aliases: ["Re", "rhenium"], chemicalSymbol: "Re" }],
  [76, { aliases: ["Os", "osmium"], chemicalSymbol: "Os" }],
  [77, { aliases: ["Ir", "iridium"], chemicalSymbol: "Ir" }],
  [78, { aliases: ["Pt", "platinum"], chemicalSymbol: "Pt" }],
  [79, { aliases: ["Au", "gold"], chemicalSymbol: "Au" }],
  [80, { aliases: ["Hg", "mercury"], chemicalSymbol: "Hg" }],
  [81, { aliases: ["Tl", "thallium"], chemicalSymbol: "Tl" }],
  [82, { aliases: ["Pb", "lead"], chemicalSymbol: "Pb" }],
  [83, { aliases: ["Bi", "bismuth"], chemicalSymbol: "Bi" }],
  [84, { aliases: ["Po", "polonium"], chemicalSymbol: "Po" }],
  [85, { aliases: ["At", "astatine"], chemicalSymbol: "At" }],
  [86, { aliases: ["Rn", "radon"], chemicalSymbol: "Rn" }],
  [87, { aliases: ["Fr", "francium"], chemicalSymbol: "Fr" }],
  [88, { aliases: ["Ra", "radium"], chemicalSymbol: "Ra" }],
  [89, { aliases: ["Ac", "actinium"], chemicalSymbol: "Ac" }],
  [90, { aliases: ["Th", "thorium"], chemicalSymbol: "Th" }],
  [91, { aliases: ["Pa", "protactinium"], chemicalSymbol: "Pa" }],
  [92, { aliases: ["U", "uranium"], chemicalSymbol: "U" }],
  [93, { aliases: ["Np", "neptunium"], chemicalSymbol: "Np" }],
  [94, { aliases: ["Pu", "plutonium"], chemicalSymbol: "Pu" }],
  [95, { aliases: ["Am", "americium"], chemicalSymbol: "Am" }],
  [96, { aliases: ["Cm", "curium"], chemicalSymbol: "Cm" }],
  [97, { aliases: ["Bk", "berkelium"], chemicalSymbol: "Bk" }],
  [98, { aliases: ["Cf", "californium"], chemicalSymbol: "Cf" }],
  [99, { aliases: ["Es", "einsteinium"], chemicalSymbol: "Es" }],
  [100, { aliases: ["Fm", "fermium"], chemicalSymbol: "Fm" }],
  [101, { aliases: ["Md", "mendelevium"], chemicalSymbol: "Md" }],
  [102, { aliases: ["No", "nobelium"], chemicalSymbol: "No" }],
  [103, { aliases: ["Lr", "lawrencium"], chemicalSymbol: "Lr" }],
  [104, { aliases: ["Rf", "rutherfordium"], chemicalSymbol: "Rf" }],
  [105, { aliases: ["Db", "dubnium"], chemicalSymbol: "Db" }],
  [106, { aliases: ["Sg", "seaborgium"], chemicalSymbol: "Sg" }],
  [107, { aliases: ["Bh", "bohrium"], chemicalSymbol: "Bh" }],
  [108, { aliases: ["Hs", "hassium"], chemicalSymbol: "Hs" }],
  [109, { aliases: ["Mt", "meitnerium"], chemicalSymbol: "Mt" }],
  [110, { aliases: ["Ds", "darmstadtium"], chemicalSymbol: "Ds" }],
  [111, { aliases: ["Rg", "roentgenium"], chemicalSymbol: "Rg" }],
  [112, { aliases: ["Cn", "copernicium"], chemicalSymbol: "Cn" }],
  [113, { aliases: ["Nh", "nihonium"], chemicalSymbol: "Nh" }],
  [114, { aliases: ["Fl", "flerovium"], chemicalSymbol: "Fl" }],
  [115, { aliases: ["Mc", "moscovium"], chemicalSymbol: "Mc" }],
  [116, { aliases: ["Lv", "livermorium"], chemicalSymbol: "Lv" }],
  [117, { aliases: ["Ts", "tennessine"], chemicalSymbol: "Ts" }],
  [118, { aliases: ["Og", "oganesson"], chemicalSymbol: "Og" }],
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
