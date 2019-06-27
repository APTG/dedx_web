#include "utils.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>


float _dedx_get_i_value(int target,int state, int * err) {
    // printf("mocked _dedx_get_i_value used\n");
    return 1.0;
}

int _dedx_validate_config(dedx_config * config,int *err) {
    // printf("mocked _dedx_validate_config used\n");
    return 0;
}

int _dedx_set_names(dedx_config * config, int *err) {
    // printf("mocked _dedx_set_names used\n");
    return 0;
}

void _dedx_read_energy_data(float * energy, int prog,int *err) {
    // printf("mocked _dedx_read_energy_data used\n");
    int i;
    for (i = 0; i < _DEDX_MAXELEMENTS; i++) energy[i] = i * 8;
    return;
}

void _dedx_read_binary_data(stopping_data * data, int prog, int ion, int target,int *err) {
    // printf("mocked _dedx_read_binary_data used\n");
    data->target = target;
    data->ion = ion;
    data->length = _DEDX_MAXELEMENTS;
    int i = 0;
    for (i = 0; i < _DEDX_MAXELEMENTS; i++) data->data[i] = i * 10 + i * i * (ion + 1) - i * (target + 1); // some function depending on both ion, and target
    return;
}

void _dedx_convert_energy_to_mstar(stopping_data * in, stopping_data * out,char state,dedx_config * config, float * energy) {
    // printf("mocked _dedx_convert_energy_to_mstar used\n");
    memcpy(out, in, sizeof(stopping_data));
    return;
}

float _dedx_calculate_bethe_energy(_dedx_bethe_coll_struct * ws, float energy, float PZ, float PA, float TZ, float TA, float rho, float Io_Pot) {
    // printf("mocked _dedx_calculate_bethe_energy used\n");
    return energy + PZ + PA + TZ + TA + rho + Io_Pot;
}

int _dedx_evaluate_compound(dedx_config * config,int *err) {	
	// printf("mocked _dedx_evaluate_compound used\n");
    return 0;
}

// not mocked
int _dedx_binary_search(_dedx_spline_base * coef, float value, int n) {
    int head = n-1;
    int tail = 0;
    int guess = n/2;
    while(head != tail+1)
    {
        if(coef[guess].x <= value)
        {
            tail = guess;
        }
        else
        {
            head = guess;
        }
        guess = (head - tail)/2 + tail;
    }
    return guess;
}

// not mocked
float _dedx_evaluate_spline(_dedx_spline_base * coef, float x, _dedx_lookup_accelerator * acc, int n) {
    int i;
    int lookup = 1;
    if(acc != NULL)
    {
      if((coef[acc->cache].x <= x) && (x < coef[acc->cache+1].x))
        {
            lookup = 0;
            i = acc->cache;
        }
    }
    if(lookup)
    {
        i = _dedx_binary_search(coef,x,n);
        if(acc != NULL)
            acc->cache = i;
    }
    float energy = coef[i].a+coef[i].b*(x-coef[i].x)+coef[i].c*pow(x-coef[i].x,2)+coef[i].d*pow(x-coef[i].x,3);
    return energy;
}

void _dedx_calculate_coefficients(_dedx_spline_base * coef, float * energy, float * stopping, int n) {
    int i;
    float h[_DEDX_MAXELEMENTS];
    float alpha[_DEDX_MAXELEMENTS];
    float l[_DEDX_MAXELEMENTS];
    float my[_DEDX_MAXELEMENTS];
    float z[_DEDX_MAXELEMENTS];

    l[0]=1;
    my[0]=0;
    z[0]=0;

    l[n-1] = 1;
    z[n-1]=0;
    coef[n-1].c = 0;

    for(i = 0; i < n; i++)
    {
        coef[i].a = stopping[i];
        coef[i].x = energy[i];
    }
    for(i = 0; i < n-1; i++)
    {
        h[i] = energy[i+1]-energy[i];
    }
    for(i = 1; i < n -1; i++)
    {
        alpha[i] = 3/h[i]*(stopping[i+1]-stopping[i])-3/h[i-1]*(stopping[i]-stopping[i-1]);
    }
    for(i=1; i < n-1; i++)
    {
        l[i]=2*(energy[i+1]-energy[i-1])-h[i-1]*my[i-1];
        my[i]=h[i]/l[i];
        z[i]=(alpha[i]-h[i-1]*z[i-1])/l[i];

    }
    for(i = n-2; i >= 0; i--)
    {
        coef[i].c = z[i] -my[i]*coef[i+1].c;
        coef[i].b = (coef[i+1].a-coef[i].a)/h[i]-h[i]*(coef[i+1].c+2*coef[i].c)/3;
        coef[i].d = (coef[i+1].c-coef[i].c)/(3*h[i]);
    }
}
