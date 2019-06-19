import { combineReducers } from 'redux';
import formReducer from './components/Form/duck';
import historyReducer from './components/History/duck';
import plotReducer from "./components/Plot/duck/reducers";

const rootReducer = combineReducers({
    form: formReducer,
    history: historyReducer,
    plot: plotReducer
});

export default rootReducer;