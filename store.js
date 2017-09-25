import { createStore } from 'redux'

import reducer from './reducer'


const defaultState = {
  shellLanguage: 'javascript',
  history: []
}

const store = createStore(reducer, defaultState)

export default store
