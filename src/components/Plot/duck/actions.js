import types from './types';

const set = item => ({
    type: types.SET_PLOT, item
});

export default {
    set
}