import types from './types';

const INITIAL_STATE = {
    list: []
};

const historyReducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case types.ADD_HISTORY_ITEM:
            return {
                ...state, list: [...state.list, action.item]
            };
        case types.RESET_HISTORY:
            return {
                ...state, list: []
            };
        default:
            return state
    }
};

export default historyReducer;