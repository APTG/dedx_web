import types from './types';

const INITIAL_STATE = {
    value: ''
};

const resultReducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case types.SET_RESULT:
            return {
                ...state, value: action.item
            };
        case types.RESET_RESULTS:
            return {
                ...state, value: ''
            };
        default:
            return state
    }
};

export default resultReducer;