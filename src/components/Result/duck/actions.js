import types from './types';

const set = item => ({
    type: types.SET_RESULT, item
});

const reset = item => ({
    type: types.RESET_RESULTS, item
});

export default {
    set,
    reset
}