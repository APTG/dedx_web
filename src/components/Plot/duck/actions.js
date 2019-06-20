import types from './types';

const set = item => ({
    type: types.SET_PLOT, item
});

const add = item => ({
    type: types.ADD_DATA, item
});

export default {
    set,
    add
}