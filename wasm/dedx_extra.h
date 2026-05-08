#ifndef DEDX_EXTRA_H
#define DEDX_EXTRA_H

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

#ifdef __cplusplus
}
#endif

#endif
