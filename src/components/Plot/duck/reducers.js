import types from './types';

const INITIAL_STATE = {
    data: [
            {
                type: 'scatter',
                x: [0, 1, 2, 3, 4, 5],
                y: [2, 2, 6, 3, 2.8, 3],
                mode: 'lines',
                marker: {color: 'red'},
            },
            {
                type: 'scatter',
                x: [1, 2, 3, 4],
                y: [4, 1, 2.5, 6],
                mode: 'lines',
                marker: {color: 'blue'},
            },
    ]
};

const plotReducer = (state = INITIAL_STATE, action) => {
    switch (action.type) {
        case types.SET_PLOT:
            return {
                val: action.item
            };
        default:
            return state
    }
};

export default plotReducer;