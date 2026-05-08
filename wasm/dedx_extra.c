#include "dedx_extra.h"
#include "dedx_tools.h"
#include <math.h>
#include <stddef.h>
#include <string.h>

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
 * Currently internal-only (not exported from WASM build). The TypeScript-side
 * getMaterialFriendlyName() serves the same purpose at runtime.
 */
static const char *dedx_get_material_friendly_name(int material) {
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

/* -------------------------------------------------------------------------
 * Flat inverse-lookup wrappers
 * Each function allocates a fresh workspace, loads the configuration (which
 * populates ion_a and other derived fields required by the core functions),
 * calls the core routine, then frees all resources before returning.
 * -------------------------------------------------------------------------*/

double dedx_get_inverse_csda_flat(int program, int ion, int target,
                                  double range, int *err) {
    int local_err = 0;
    dedx_workspace *ws = dedx_allocate_workspace(1, &local_err);
    if (!ws || local_err != 0) {
        *err = local_err ? local_err : -1;
        return -1.0;
    }

    dedx_config cfg;
    memset(&cfg, 0, sizeof(cfg));
    cfg.program = program;
    cfg.ion     = ion;
    cfg.target  = target;

    /* ion_a (nucleon number) must be set before dedx_load_config and the
     * inverse functions — dedx_get_inverse_csda checks ion_a <= 0 on entry. */
    cfg.ion_a = dedx_internal_get_nucleon(ion, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    dedx_load_config(ws, &cfg, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    /* Zero *err before the bisection loop — dedx_get_csda checks *err != 0 on entry. */
    *err = 0;
    double result = dedx_get_inverse_csda(ws, &cfg, (float)range, err);

    int fe = 0;
    dedx_free_config(&cfg, &fe);
    dedx_free_workspace(ws, &fe);
    return result;
}

double dedx_get_inverse_stp_flat(int program, int ion, int target,
                                 double stp, int side, int *err) {
    int local_err = 0;
    dedx_workspace *ws = dedx_allocate_workspace(1, &local_err);
    if (!ws || local_err != 0) {
        *err = local_err ? local_err : -1;
        return -1.0;
    }

    dedx_config cfg;
    memset(&cfg, 0, sizeof(cfg));
    cfg.program = program;
    cfg.ion     = ion;
    cfg.target  = target;

    cfg.ion_a = dedx_internal_get_nucleon(ion, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    dedx_load_config(ws, &cfg, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    /* Robust bisection over the physically correct branch.
     *
     * dedx_get_inverse_stp() in dedx_tools.c uses find_min() to locate the
     * Bragg-peak energy.  For monotonically decreasing STP curves (e.g.
     * proton/water ICRU 49) find_min() returns -1, which becomes x2=-1 in
     * the bisection, eventually producing negative intermediate energies and
     * a spurious dedx_get_stp() error.
     *
     * Strategy: sample STP at N log-spaced energies to locate the peak.
     *   - If peak is at the leftmost sample (monotone curve): bisect the full
     *     range [emin, emax] on the single descending branch.
     *   - If peak is interior (curve has a Bragg peak within the range):
     *       side == 0  → low (ascending)  branch [emin,  e_peak]
     *       side == 1  → high (descending) branch [e_peak, emax]
     *     If the requested STP is below STP(emin) on the ascending branch
     *     there is no low-branch solution; the descending branch is used.
     *
     * TypeScript passes side=0 for E_low and side=1 for E_high.  The C
     * function dedx_get_inverse_stp() maps side<0 → low branch, which never
     * matches side∈{0,1} — so both TS sides would return the descending
     * result.  This wrapper fixes that by treating side==0 as "low branch".
     */
    double emin = (double)dedx_get_min_energy(program, ion);
    double emax = (double)dedx_get_max_energy(program, ion);

    /* Sample the curve to find the Bragg-peak energy. */
#define INV_STP_N 40
    double log_emin = log(emin);
    double log_emax = log(emax);
    double log_step = (log_emax - log_emin) / (INV_STP_N - 1);

    int    stp_err   = 0;
    double max_stp   = 0.0;
    double e_peak    = emin;
    double stp_emin  = 0.0;  /* STP at the first (leftmost) sample */

    for (int i = 0; i < INV_STP_N; i++) {
        double e = exp(log_emin + i * log_step);
        stp_err = 0;
        double s = dedx_get_stp(ws, &cfg, (float)e, &stp_err);
        if (stp_err != 0) continue;
        if (i == 0) stp_emin = s;
        if (s > max_stp) { max_stp = s; e_peak = e; }
    }
#undef INV_STP_N

    /* STP at emax (lower bound of the achievable range). */
    stp_err = 0;
    double stp_at_emax = dedx_get_stp(ws, &cfg, (float)emax, &stp_err);
    if (stp_err != 0 || max_stp == 0.0 || stp > max_stp || stp < stp_at_emax) {
        int fe = 0;
        dedx_free_config(&cfg, &fe);
        dedx_free_workspace(ws, &fe);
        *err = (stp_err != 0) ? stp_err : -1;
        return -1.0;
    }

    /* Determine which branch to bisect. */
    int has_peak = (e_peak > emin * exp(log_step));  /* peak not at first sample */
    double x_lo, x_hi;
    int ascending;  /* 1 → STP increases in [x_lo, x_hi] */

    if (!has_peak) {
        /* Monotone descending: single branch over full range. */
        x_lo = emin; x_hi = emax; ascending = 0;
    } else if (side == 0 && stp >= stp_emin) {
        /* Low (ascending) branch: STP rises from stp_emin to max_stp. */
        x_lo = emin; x_hi = e_peak; ascending = 1;
    } else {
        /* High (descending) branch, or stp < stp_emin (no ascending solution). */
        x_lo = e_peak; x_hi = emax; ascending = 0;
    }

    double acc = 1e-5;
    while ((x_hi - x_lo) > acc) {
        double x_mid = (x_lo + x_hi) / 2.0;
        stp_err = 0;
        double stp_mid = dedx_get_stp(ws, &cfg, (float)x_mid, &stp_err);
        if (stp_err != 0) {
            int fe = 0;
            dedx_free_config(&cfg, &fe);
            dedx_free_workspace(ws, &fe);
            *err = stp_err;
            return -1.0;
        }
        if (ascending) {
            if (stp_mid <= stp) x_lo = x_mid;
            else                x_hi = x_mid;
        } else {
            if (stp_mid >= stp) x_lo = x_mid;
            else                x_hi = x_mid;
        }
    }

    double result = (x_lo + x_hi) / 2.0;

    int fe = 0;
    dedx_free_config(&cfg, &fe);
    dedx_free_workspace(ws, &fe);
    *err = 0;
    return result;
}

double dedx_get_bragg_peak_stp(int program, int ion, int target, int *err) {
    int local_err = 0;
    dedx_workspace *ws = dedx_allocate_workspace(1, &local_err);
    if (!ws || local_err != 0) {
        *err = local_err ? local_err : -1;
        return -1.0;
    }

    dedx_config cfg;
    memset(&cfg, 0, sizeof(cfg));
    cfg.program = program;
    cfg.ion     = ion;
    cfg.target  = target;

    cfg.ion_a = dedx_internal_get_nucleon(ion, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    dedx_load_config(ws, &cfg, &local_err);
    if (local_err != 0) {
        int fe = 0;
        dedx_free_workspace(ws, &fe);
        *err = local_err;
        return -1.0;
    }

    /* Sample 300 log-spaced energies to find the Bragg-peak STP. */
    float emin = dedx_get_min_energy(program, ion);
    float emax = dedx_get_max_energy(program, ion);
    double log_emin = log((double)emin);
    double log_emax = log((double)emax);
    int n = 300;
    double peak_stp = -1.0;

    for (int i = 0; i < n; i++) {
        float energy = (float)exp(log_emin + (log_emax - log_emin) * i / (n - 1));
        int stp_err = 0;
        float stp = (float)dedx_get_stp(ws, &cfg, energy, &stp_err);
        if (stp_err == 0 && (double)stp > peak_stp) {
            peak_stp = (double)stp;
        }
    }

    int fe = 0;
    dedx_free_config(&cfg, &fe);
    dedx_free_workspace(ws, &fe);

    if (peak_stp < 0.0) {
        *err = -1;
        return -1.0;
    }
    *err = 0;
    return peak_stp;
}
