#ifndef UTILS_H
#define UTILS_H 

#include "dedx.h"

// from dedx_config.h
// the configured options and settings for DEDX
#define DEDX_VERSION_MAJOR 1
#define DEDX_VERSION_MINOR 2
#define DEDX_VERSION_PATCH 1
#define DEDX_VERSION_SVN   0
#define DEDX_DATA_PATH "/usr/local/share/libdedx/"
#define DEDX_DATA_PATH_LOCAL "data/"

typedef struct {
    int target;
    int ion;
    unsigned int length;
    float data[_DEDX_MAXELEMENTS];
} stopping_data;

typedef struct {
    double TZ0;
    double TA0;
    double potentiale;
    double rho;
    double PZ0;
    double PA0;
} _dedx_bethe_struct;

typedef struct {
    double e_min;
    double e_max;
    double epsilon;
    double h;
    double e_zero;
    double e_extr;
    double f_extr;
    double e_sewn;
    double f_sewn;
} _dedx_gold_struct;

typedef struct {
	_dedx_bethe_struct * bet;
	_dedx_gold_struct * gold;
} _dedx_bethe_coll_struct;


// mocki
float _dedx_get_i_value(int target,int state, int * err);
int _dedx_validate_config(dedx_config * config,int *err);
int _dedx_set_names(dedx_config * config, int *err);
void _dedx_read_energy_data(float * energy, int prog,int *err);
void _dedx_read_binary_data(stopping_data * data, int prog, int ion, int target,int *err);
void _dedx_convert_energy_to_mstar(stopping_data * in, stopping_data * out,char state,dedx_config * config, float * energy);
float _dedx_calculate_bethe_energy(_dedx_bethe_coll_struct * ws, float energy, float PZ, float PA, float TZ, float TA, float rho, float Io_Pot);
int _dedx_binary_search(_dedx_spline_base * coef, float value, int n);
float _dedx_evaluate_spline(_dedx_spline_base * coef, float x, _dedx_lookup_accelerator * acc, int n);
int _dedx_evaluate_compound(dedx_config * config,int *err);
void _dedx_calculate_coefficients(_dedx_spline_base * coef, float * energy, float * stopping, int n);

#endif // UTILS_H
