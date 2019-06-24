import types from './types';

const INITIAL_STATE = {
    val: '5'
};

const formReducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case types.SET_FORM:
            return {
                val: action.item
            };
        default:
            return state
    }
};

export default formReducer;