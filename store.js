import { createStore } from "redux"

import { makeInterpreter, defaultContext } from "./lisp-parser"
import reducer from "./reducer"


const defaultState = {
    shellLanguage: "lisp",
    lispInterpreter: makeInterpreter(defaultContext),
    cliElement: null,
    history: [],
    pageHeight: 600,  // necessary for redrawing on window resize
    config: {
        startupScript: "robert+startup-script:unversioned"  // TODO do not hardcode
    },
    nodeMap: {},
    dataMap: {}
}

const store = createStore(reducer, defaultState)

export default store
