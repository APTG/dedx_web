import { combineReducers } from 'redux';
import formReducer from './components/Form/duck';
import historyReducer from './components/History/duck';

const rootReducer = combineReducers({
    form: formReducer,
    history: historyReducer
});

export default rootReducer;