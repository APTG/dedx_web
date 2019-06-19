import types from './types';

const set = item => ({
    type: types.SET_FORM, item
});

export default {
    set
}