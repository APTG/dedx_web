import types from './types';

const INITIAL_STATE = {
    list: []
};

const historyReducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case types.ADD_RESULT:
            return {
                ...state, list: [...state.list, action.item]
            };
        case types.RESET_RESULTS:
            return {
                ...state, list: []
            };
        default:
            return state
    }
};

export default historyReducer;