import { createStore } from 'redux'

import reducer from './reducers/reducer'


const defaultState = {
  user: null,
  cognito: {
    userPoolId: "us-west-2_muUY6fFpx",
    clientId: "7jtchrrlba9ot3q3hq65579bbv"
  }
};

const store = createStore(reducer, defaultState);

export default store
