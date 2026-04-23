#include "dedx_extra.h"
#include <stddef.h>

/* Forward-declare the public material-name function from dedx.c */
extern const char *dedx_get_material_name(int material);

extern int   dedx_internal_get_nucleon(int id, int *err);
extern float dedx_internal_get_atom_mass(int id, int *err);
extern float dedx_internal_read_density(int material, int *err);
extern size_t dedx_internal_target_is_gas(int target, int *err);

int dedx_get_ion_nucleon_number(int ion) {
    int err = 0;
    return dedx_internal_get_nucleon(ion, &err);
}

float dedx_get_ion_atom_mass(int ion) {
    int err = 0;
    return dedx_internal_get_atom_mass(ion, &err);
}

float dedx_get_density(int material, int *err) {
    return dedx_internal_read_density(material, err);
}

int dedx_target_is_gas(int target) {
    int err = 0;
    return (int)dedx_internal_target_is_gas(target, &err);
}

/*
 * Returns a human-friendly display name for a material.
 *
 * The raw C names from dedx_get_material_name() are ALL-CAPS with no spaces
 * (e.g., "WATER", "CARBONDIOXIDE", "TISSUE_EQUIVALENTGAS_METHANEBASED").
 * This function returns properly capitalised, space-separated names with
 * disambiguation qualifiers where needed (e.g., "(liquid)" for water).
 *
 * Override table covers:
 *  - Critical disambiguation (water vs. water vapor)
 *  - Run-on compound words that become unreadable with simple title-case
 *  - ICRP/ICRU suffixed tissue names
 *
 * Falls back to dedx_get_material_name() for unmapped IDs; the TypeScript
 * wrapper applies additional title-case formatting to the fallback.
 *
 * Intended for future inclusion in libdedx as a public API function.
 */
const char *dedx_get_material_friendly_name(int material) {
    switch (material) {
        /* === Elements (1-98): simple title-case handled in TypeScript; no overrides needed === */

        /* === Compounds: critical disambiguation and run-on names === */
        case  99: return "A-150 Tissue-Equivalent Plastic";
        case 103: return "Adipose Tissue (ICRP)";
        case 104: return "Air (dry, near sea level)";
        case 106: return "Aluminum Oxide";
        case 113: return "Barium Fluoride";
        case 114: return "Barium Sulfate";
        case 116: return "Beryllium Oxide";
        case 117: return "Bismuth Germanium Oxide";
        case 118: return "Blood (ICRP)";
        case 119: return "Bone, Compact (ICRU)";
        case 120: return "Bone, Cortical (ICRP)";
        case 121: return "Boron Carbide";
        case 122: return "Boron Oxide";
        case 123: return "Brain (ICRP)";
        case 125: return "N-Butyl Alcohol";
        case 127: return "Cadmium Telluride";
        case 128: return "Cadmium Tungstate";
        case 129: return "Calcium Carbonate";
        case 130: return "Calcium Fluoride";
        case 131: return "Calcium Oxide";
        case 132: return "Calcium Sulfate";
        case 133: return "Calcium Tungstate";
        case 134: return "Carbon Dioxide";
        case 135: return "Carbon Tetrachloride";
        case 136: return "Cellulose Acetate (Cellophane)";
        case 137: return "Cellulose Acetate Butyrate";
        case 138: return "Cellulose Nitrate";
        case 139: return "Ceric Sulfate Dosimeter Solution";
        case 140: return "Cesium Fluoride";
        case 141: return "Cesium Iodide";
        case 142: return "Chlorobenzene";
        case 143: return "Chloroform";
        case 144: return "Concrete (Portland)";
        case 145: return "Cyclohexane";
        case 146: return "Dichlorobenzene";
        case 147: return "Dichlorodiethyl Ether";
        case 148: return "Dichloroethane";
        case 149: return "Diethyl Ether";
        case 150: return "N,N-Dimethylformamide";
        case 151: return "Dimethyl Sulfoxide";
        case 152: return "Ethane";
        case 153: return "Ethyl Alcohol";
        case 154: return "Ethyl Cellulose";
        case 155: return "Ethylene";
        case 156: return "Eye Lens (ICRP)";
        case 157: return "Ferric Oxide";
        case 159: return "Ferrous Oxide";
        case 160: return "Ferrous Sulfate Dosimeter Solution";
        case 161: return "Freon-12";
        case 162: return "Freon-12B2";
        case 163: return "Freon-13";
        case 164: return "Freon-13B1";
        case 165: return "Freon-13I1";
        case 166: return "Gadolinium Oxysulfide";
        case 167: return "Gallium Arsenide";
        case 168: return "Gel in Photographic Emulsion";
        case 169: return "Glass (Pyrex)";
        case 170: return "Glass (Lead)";
        case 171: return "Glass (Plate)";
        case 172: return "Glucose";
        case 174: return "Glycerol";
        case 176: return "Gypsum (Plaster of Paris)";
        case 177: return "N-Heptane";
        case 178: return "N-Hexane";
        case 179: return "Kapton Polyimide Film";
        case 180: return "Lanthanum Oxybromide";
        case 181: return "Lanthanum Oxysulfide";
        case 182: return "Lead Oxide";
        case 183: return "Lithium Amide";
        case 184: return "Lithium Carbonate";
        case 185: return "Lithium Fluoride";
        case 186: return "Lithium Hydride";
        case 187: return "Lithium Iodide";
        case 188: return "Lithium Oxide";
        case 189: return "Lithium Tetraborate";
        case 190: return "Lung (ICRP)";
        case 192: return "Magnesium Carbonate";
        case 193: return "Magnesium Fluoride";
        case 194: return "Magnesium Oxide";
        case 195: return "Magnesium Tetraborate";
        case 196: return "Mercuric Iodide";
        case 200: return "MS20 Tissue Substitute";
        case 201: return "Muscle, Skeletal";
        case 202: return "Muscle, Striated";
        case 203: return "Muscle-Equivalent Liquid (with sucrose)";
        case 204: return "Muscle-Equivalent Liquid (without sucrose)";
        case 208: return "Nylon (DuPont Elvamide 8062)";
        case 209: return "Nylon Type 6 and 6/6";
        case 210: return "Nylon Type 6-10";
        case 211: return "Nylon Type 11 (Rilsan)";
        case 212: return "Octane (liquid)";
        case 213: return "Paraffin Wax";
        case 214: return "N-Pentane";
        case 215: return "Photographic Emulsion";
        case 216: return "Plastic Scintillator (vinyltoluene-based)";
        case 217: return "Plutonium Dioxide";
        case 218: return "Polyacrylonitrile";
        case 219: return "Polycarbonate (Makrolon/Lexan)";
        case 220: return "Polychlorostyrene";
        case 221: return "Polyethylene";
        case 222: return "Mylar (PET)";
        case 223: return "PMMA (Plexiglass)";
        case 224: return "Polyoxymethylene";
        case 225: return "Polypropylene";
        case 226: return "Polystyrene";
        case 227: return "Polytetrafluoroethylene (Teflon)";
        case 228: return "Polytrifluorochloroethylene";
        case 229: return "Polyvinyl Acetate";
        case 230: return "Polyvinyl Alcohol";
        case 231: return "Polyvinyl Butyral";
        case 232: return "Polyvinyl Chloride (PVC)";
        case 233: return "Saran";
        case 234: return "Polyvinylidene Fluoride";
        case 235: return "Polyvinylpyrrolidone";
        case 236: return "Potassium Iodide";
        case 237: return "Potassium Oxide";
        case 239: return "Propane (liquid)";
        case 240: return "N-Propyl Alcohol";
        case 242: return "Rubber (butyl)";
        case 243: return "Rubber (natural)";
        case 244: return "Rubber (neoprene)";
        case 245: return "Silicon Dioxide";
        case 246: return "Silver Bromide";
        case 247: return "Silver Chloride";
        case 248: return "Silver Halides in Photographic Emulsion";
        case 249: return "Silver Iodide";
        case 250: return "Skin (ICRP)";
        case 251: return "Sodium Carbonate";
        case 252: return "Sodium Iodide";
        case 253: return "Sodium Monoxide";
        case 254: return "Sodium Nitrate";
        case 258: return "Testes (ICRP)";
        case 259: return "Tetrachloroethylene";
        case 260: return "Thallium Chloride";
        case 261: return "Tissue, Soft (ICRP)";
        case 262: return "Tissue, Soft (ICRU four-component)";
        case 263: return "Tissue-Equivalent Gas (methane-based)";
        case 264: return "Tissue-Equivalent Gas (propane-based)";
        case 265: return "Titanium Dioxide";
        case 267: return "Trichloroethylene";
        case 268: return "Triethyl Phosphate";
        case 269: return "Tungsten Hexafluoride";
        case 270: return "Uranium Dicarbide";
        case 271: return "Uranium Monocarbide";
        case 272: return "Uranium Oxide";
        case 275: return "Viton Fluoroelastomer";
        case 276: return "Water (liquid)";   /* most important: distinguish from vapor */
        case 277: return "Water Vapor";
        case 906: return "Graphite";

        default: return dedx_get_material_name(material);
    }
}
