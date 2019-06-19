import types from './types';

const add = item => ({
    type: types.ADD_RESULT, item
});

const reset = item => ({
    type: types.RESET_RESULTS, item
});

export default {
    add,
    reset
}