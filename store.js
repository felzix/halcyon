import { createStore } from 'redux'

import reducer from './reducer'


const defaultState = {
  shellLanguage: 'lisp',
  cliElement: null,
  history: [],
  pageHeight: 600,  // necessary for redrawing on window resize
  config: {}
}

const store = createStore(reducer, defaultState)

export default store
