import types from './types';

const add = item => ({
    type: types.ADD_HISTORY_ITEM, item
});

const reset = item => ({
    type: types.RESET_HISTORY, item
});

export default {
    add,
    reset
}