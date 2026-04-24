/**
 * Human-friendly material name utilities.
 *
 * The libdedx C API returns ALL-CAPS, space-free material names
 * (e.g., "WATER", "CARBONDIOXIDE", "TISSUE_EQUIVALENTGAS_METHANEBASED").
 * This module mirrors the C-level override table in wasm/dedx_extra.c and
 * adds a JS-side formatter so the UI shows clean, readable names even before
 * a new WASM binary is available.
 */

/**
 * Converts a raw ALL-CAPS C name to title-case with spaces.
 * Underscores become spaces; each word is capitalised.
 * Example: "TISSUE_EQUIVALENT_GAS" → "Tissue Equivalent Gas"
 */
export function formatMaterialName(rawName: string): string {
  if (!rawName) return rawName;
  return rawName
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
}

/**
 * Override table for material IDs where auto-formatting is insufficient.
 * Mirrors the switch-statement in wasm/dedx_extra.c — keep both in sync.
 *
 * Key reasons for an override:
 *  - Disambiguation: "WATER" alone is ambiguous (liquid vs. vapor) → "Water (liquid)"
 *  - Run-on compound words: "CARBONDIOXIDE" → "Carbon Dioxide"
 *  - ICRP/ICRU suffixes: "BLOOD_ICRP" → "Blood (ICRP)"
 *  - Polymer trade names: "MYLAR" → "Mylar (PET)"
 */
export const MATERIAL_NAME_OVERRIDES: ReadonlyMap<number, string> = new Map([
  [99, "A-150 Tissue-Equivalent Plastic"],
  [103, "Adipose Tissue (ICRP)"],
  [104, "Air (dry, near sea level)"],
  [106, "Aluminum Oxide"],
  [113, "Barium Fluoride"],
  [114, "Barium Sulfate"],
  [116, "Beryllium Oxide"],
  [117, "Bismuth Germanium Oxide"],
  [118, "Blood (ICRP)"],
  [119, "Bone, Compact (ICRU)"],
  [120, "Bone, Cortical (ICRP)"],
  [121, "Boron Carbide"],
  [122, "Boron Oxide"],
  [123, "Brain (ICRP)"],
  [125, "N-Butyl Alcohol"],
  [127, "Cadmium Telluride"],
  [128, "Cadmium Tungstate"],
  [129, "Calcium Carbonate"],
  [130, "Calcium Fluoride"],
  [131, "Calcium Oxide"],
  [132, "Calcium Sulfate"],
  [133, "Calcium Tungstate"],
  [134, "Carbon Dioxide"],
  [135, "Carbon Tetrachloride"],
  [136, "Cellulose Acetate (Cellophane)"],
  [137, "Cellulose Acetate Butyrate"],
  [138, "Cellulose Nitrate"],
  [139, "Ceric Sulfate Dosimeter Solution"],
  [140, "Cesium Fluoride"],
  [141, "Cesium Iodide"],
  [142, "Chlorobenzene"],
  [143, "Chloroform"],
  [144, "Concrete (Portland)"],
  [145, "Cyclohexane"],
  [146, "Dichlorobenzene"],
  [147, "Dichlorodiethyl Ether"],
  [148, "Dichloroethane"],
  [149, "Diethyl Ether"],
  [150, "N,N-Dimethylformamide"],
  [151, "Dimethyl Sulfoxide"],
  [152, "Ethane"],
  [153, "Ethyl Alcohol"],
  [154, "Ethyl Cellulose"],
  [155, "Ethylene"],
  [156, "Eye Lens (ICRP)"],
  [157, "Ferric Oxide"],
  [159, "Ferrous Oxide"],
  [160, "Ferrous Sulfate Dosimeter Solution"],
  [161, "Freon-12"],
  [162, "Freon-12B2"],
  [163, "Freon-13"],
  [164, "Freon-13B1"],
  [165, "Freon-13I1"],
  [166, "Gadolinium Oxysulfide"],
  [167, "Gallium Arsenide"],
  [168, "Gel in Photographic Emulsion"],
  [169, "Glass (Pyrex)"],
  [170, "Glass (Lead)"],
  [171, "Glass (Plate)"],
  [172, "Glucose"],
  [174, "Glycerol"],
  [176, "Gypsum (Plaster of Paris)"],
  [177, "N-Heptane"],
  [178, "N-Hexane"],
  [179, "Kapton Polyimide Film"],
  [180, "Lanthanum Oxybromide"],
  [181, "Lanthanum Oxysulfide"],
  [182, "Lead Oxide"],
  [183, "Lithium Amide"],
  [184, "Lithium Carbonate"],
  [185, "Lithium Fluoride"],
  [186, "Lithium Hydride"],
  [187, "Lithium Iodide"],
  [188, "Lithium Oxide"],
  [189, "Lithium Tetraborate"],
  [190, "Lung (ICRP)"],
  [192, "Magnesium Carbonate"],
  [193, "Magnesium Fluoride"],
  [194, "Magnesium Oxide"],
  [195, "Magnesium Tetraborate"],
  [196, "Mercuric Iodide"],
  [200, "MS20 Tissue Substitute"],
  [201, "Muscle, Skeletal"],
  [202, "Muscle, Striated"],
  [203, "Muscle-Equivalent Liquid (with sucrose)"],
  [204, "Muscle-Equivalent Liquid (without sucrose)"],
  [208, "Nylon (DuPont Elvamide 8062)"],
  [209, "Nylon Type 6 and 6/6"],
  [210, "Nylon Type 6-10"],
  [211, "Nylon Type 11 (Rilsan)"],
  [212, "Octane (liquid)"],
  [213, "Paraffin Wax"],
  [214, "N-Pentane"],
  [215, "Photographic Emulsion"],
  [216, "Plastic Scintillator (vinyltoluene-based)"],
  [217, "Plutonium Dioxide"],
  [218, "Polyacrylonitrile"],
  [219, "Polycarbonate (Makrolon/Lexan)"],
  [220, "Polychlorostyrene"],
  [221, "Polyethylene"],
  [222, "Mylar (PET)"],
  [223, "PMMA (Plexiglass)"],
  [224, "Polyoxymethylene"],
  [225, "Polypropylene"],
  [226, "Polystyrene"],
  [227, "Polytetrafluoroethylene (Teflon)"],
  [228, "Polytrifluorochloroethylene"],
  [229, "Polyvinyl Acetate"],
  [230, "Polyvinyl Alcohol"],
  [231, "Polyvinyl Butyral"],
  [232, "Polyvinyl Chloride (PVC)"],
  [233, "Saran"],
  [234, "Polyvinylidene Fluoride"],
  [235, "Polyvinylpyrrolidone"],
  [236, "Potassium Iodide"],
  [237, "Potassium Oxide"],
  [239, "Propane (liquid)"],
  [240, "N-Propyl Alcohol"],
  [242, "Rubber (butyl)"],
  [243, "Rubber (natural)"],
  [244, "Rubber (neoprene)"],
  [245, "Silicon Dioxide"],
  [246, "Silver Bromide"],
  [247, "Silver Chloride"],
  [248, "Silver Halides in Photographic Emulsion"],
  [249, "Silver Iodide"],
  [250, "Skin (ICRP)"],
  [251, "Sodium Carbonate"],
  [252, "Sodium Iodide"],
  [253, "Sodium Monoxide"],
  [254, "Sodium Nitrate"],
  [258, "Testes (ICRP)"],
  [259, "Tetrachloroethylene"],
  [260, "Thallium Chloride"],
  [261, "Tissue, Soft (ICRP)"],
  [262, "Tissue, Soft (ICRU four-component)"],
  [263, "Tissue-Equivalent Gas (methane-based)"],
  [264, "Tissue-Equivalent Gas (propane-based)"],
  [265, "Titanium Dioxide"],
  [267, "Trichloroethylene"],
  [268, "Triethyl Phosphate"],
  [269, "Tungsten Hexafluoride"],
  [270, "Uranium Dicarbide"],
  [271, "Uranium Monocarbide"],
  [272, "Uranium Oxide"],
  [275, "Viton Fluoroelastomer"],
  [276, "Water (liquid)"],
  [277, "Water Vapor"],
  [906, "Graphite"],
]);

/**
 * Returns the human-friendly display name for a material.
 *
 * 1. Checks the override table for material IDs whose raw names are ambiguous
 *    or not readable when title-cased directly.
 * 2. Falls back to formatMaterialName(rawName) for unmapped IDs, including
 *    pure elements and compounds that only need underscore/word formatting.
 *
 * @param id      libdedx material ID
 * @param rawName Raw ALL-CAPS name from dedx_get_material_name()
 */
export function getMaterialFriendlyName(id: number, rawName: string): string {
  return MATERIAL_NAME_OVERRIDES.get(id) ?? formatMaterialName(rawName);
}
