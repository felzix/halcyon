import { createStore } from 'redux'

import { makeInterpreter } from './lisp-parser'
import reducer from './reducer'


const defaultState = {
  shellLanguage: 'lisp',
  lispInterpreter: makeInterpreter(),
  cliElement: null,
  history: [],
  pageHeight: 600,  // necessary for redrawing on window resize
  config: {},
  nodeMap: {},
  dataMap: {}
}

const store = createStore(reducer, defaultState)

export default store
