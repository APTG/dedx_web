#ifndef DEDX_EXTRA_H
#define DEDX_EXTRA_H

#ifdef __cplusplus
extern "C" {
#endif

int         dedx_get_ion_nucleon_number(int ion);
float       dedx_get_ion_atom_mass(int ion);
float       dedx_get_density(int material, int *err);
int         dedx_target_is_gas(int target);
const char *dedx_get_material_friendly_name(int material);

#ifdef __cplusplus
}
#endif

#endif
