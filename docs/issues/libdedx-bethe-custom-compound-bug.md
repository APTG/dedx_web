# Bug: `dedx_calculate_custom_forward_flat` with Bethe (Program 100/101) does not initialize `temp_i_value` for elements

## Description
When calculating Bethe stopping powers for a custom compound (target = 0), `libdedx` evaluates each constituent element independently and combines them. However, for custom compounds, `dedx_internal_setup_custom_compound` correctly sets `config->elements_i_value = NULL`.
Inside `load_compound` (`dedx.c`), it evaluates each element by assigning `config->_temp_i_value`. Currently, this only happens if `config->elements_i_value != NULL`, meaning for regular elements it is uninitialized when calculating custom compounds!

This causes `dedx_get_i_value` not to be called, leading to incorrect calculations and potential uninitialized memory usage in `load_bethe_2` which relies on `config->_temp_i_value` (the default I-value for each element).

## Location
File: `libdedx/src/dedx.c`
Function: `load_compound`

## The Bug in the Code
In `src/dedx.c`, around line 640:
```c
        if (config->elements_i_value != NULL) {
            config->_temp_i_value = config->elements_i_value[i];
            // ...
        } else {
            // FIX NEEDED HERE: Currently missing initialization for _temp_i_value
            // It should be initialized via dedx_get_i_value(targets[i], err);
        }
```

## Recommended Fix
```c
        if (config->elements_i_value != NULL) {
            config->_temp_i_value = config->elements_i_value[i];
            if (config->elements_i_value[i] == 0.0) {
                config->_temp_i_value = dedx_get_i_value(targets[i], err);
                if (*err != 0) {
                    free(compound_data);
                    return -1;
                }
            }
        } else {
            // Fix: Add this branch to properly set the temporary I-value for the element
            config->_temp_i_value = dedx_get_i_value(targets[i], err);
            if (*err != 0) {
                free(compound_data);
                return -1;
            }
        }
```

By applying this fix in `libdedx`, Bethe and Bethe ext programs will accurately compute stopping power for custom compounds because they will properly lookup the default I-values for Hydrogen, Carbon, Oxygen, etc.
