#ifndef DEDX_EXTRA_H
#define DEDX_EXTRA_H

#include "dedx.h"

#ifdef __cplusplus
extern "C" {
#endif

int         dedx_get_ion_nucleon_number(int ion);
float       dedx_get_ion_atom_mass(int ion);
float       dedx_get_density(int material, int *err);
int         dedx_target_is_gas(int target);

/* Flat wrappers — handle workspace/config lifecycle internally.
 * These are the WASM-exported entry points for inverse lookups.
 * The core dedx_get_inverse_* functions in dedx_tools.h require a
 * pre-allocated dedx_workspace* and dedx_config*, which cannot be
 * managed safely from JavaScript.  These wrappers allocate, load,
 * call, and free everything in one shot. */

/** Find the energy (MeV/nucl) for a given CSDA range (g/cm²).
 *  @return energy in MeV/nucl, or -1.0 on error (check *err). */
double dedx_get_inverse_csda_flat(int program, int ion, int target,
                                  double range, int *err);

/** Find the energy (MeV/nucl) for a given mass stopping power (MeV cm²/g).
 *  @param side  0 = low-energy (pre-Bragg) branch,
 *               1 = high-energy (post-Bragg) branch.
 *  @return energy in MeV/nucl, or -1.0 on error (check *err). */
double dedx_get_inverse_stp_flat(int program, int ion, int target,
                                 double stp, int side, int *err);

/** Return the peak (Bragg-peak) mass stopping power (MeV cm²/g)
 *  by sampling the STP curve on a log-spaced energy grid.
 *  @return peak STP in MeV cm²/g, or -1.0 on error (check *err). */
double dedx_get_bragg_peak_stp(int program, int ion, int target, int *err);

/* -------------------------------------------------------------------------
 * Custom compound wrappers — stateful dedx_config path for user-defined
 * materials. These follow the same pattern as the flat inverse wrappers:
 * allocate workspace, load config with compound elements, evaluate, free.
 *
 * The compound is specified by parallel arrays:
 *   - elements_id:   atomic numbers Z (int32_t)
 *   - elements_atoms: atom counts per formula unit (double)
 *   - n_elements:    length of both arrays
 *
 * Density is always required. iValue is optional — pass 0.0 to use
 * Bragg additivity for I_eff calculation.
 * -------------------------------------------------------------------------*/

/** Forward calculation for a custom compound.
 *  Evaluates STP and CSDA at the provided energies.
 *  @param energies  input array of energies (MeV/nucl), length n_energies
 *  @param stp_out   output array for stopping powers (MeV cm²/g)
 *  @param csda_out  output array for CSDA ranges (g/cm²)
 *  @return 0 on success, error code on failure (check *err). */
int dedx_calculate_custom_forward_flat(
    int program, int ion,
    const int *elements_id, const double *elements_atoms, int n_elements,
    double density, double iValue,
    const double *energies, double *stp_out, double *csda_out, int n_energies,
    int *err);

/** Inverse STP lookup for a custom compound.
 *  Finds the energy (MeV/nucl) corresponding to a given stopping power.
 *  @param side  0 = low-energy (ascending) branch, 1 = high-energy (descending)
 *  @return energy in MeV/nucl, or -1.0 on error (check *err). */
double dedx_get_inverse_stp_custom_compound_flat(
    int program, int ion,
    const int *elements_id, const double *elements_atoms, int n_elements,
    double density, double iValue,
    double stp, int side, int *err);

/** Inverse CSDA range lookup for a custom compound.
 *  Finds the energy (MeV/nucl) corresponding to a given CSDA range.
 *  @return energy in MeV/nucl, or -1.0 on error (check *err). */
double dedx_get_inverse_csda_custom_compound_flat(
    int program, int ion,
    const int *elements_id, const double *elements_atoms, int n_elements,
    double density, double iValue,
    double range, int *err);

/** Bragg-peak STP for a custom compound.
 *  Samples the STP curve to find the maximum stopping power.
 *  @return peak STP in MeV cm²/g, or -1.0 on error (check *err). */
double dedx_get_bragg_peak_stp_custom_compound(
    int program, int ion,
    const int *elements_id, const double *elements_atoms, int n_elements,
    double density, double iValue,
    int *err);

/* Internal helpers — exported for WASM but not part of public TS API */
int  dedx_internal_setup_custom_compound(
    dedx_config *cfg,
    int program, int ion,
    const int *elements_id, const double *elements_atoms, int n_elements,
    double density, double iValue,
    int *err);
void dedx_internal_cleanup_custom_compound(dedx_config *cfg, int *err);

#ifdef __cplusplus
}
#endif

#endif
