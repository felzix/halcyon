import { createStore } from 'redux'

import reducer from './reducer'


const defaultState = {
  shellLanguage: 'lisp',
  history: [],
  pageHeight: 600,  // necessary for redrawing on window resize
  config: {}
}

const store = createStore(reducer, defaultState)

export default store
