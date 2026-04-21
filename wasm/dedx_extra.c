#include "dedx_extra.h"
#include <stddef.h>

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
