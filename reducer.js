const objectAssign = require('object-assign')


export const PUSH_HISTORY = 'PUSH_HISTORY'


export const pushHistory = (command, result) => {
  return {
    type: PUSH_HISTORY,
    command,
    result
  }
}


// remove when ticket resolves: https://github.com/jshint/jshint/issues/2991
// jshint ignore:start
export default (state, action) => {
  switch (action.type) {
    case PUSH_HISTORY: return {
      ...state,
      history: [
        ...state.history,
        { command: action.command, result: action.result }
      ]
    }
    default: return state
  }
}
// jshint: ignore:end
