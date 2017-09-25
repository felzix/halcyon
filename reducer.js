const objectAssign = require('object-assign')


export const PUSH_HISTORY = 'PUSH_HISTORY'
export const SET_HISTORICAL_RESULT = 'SET_HISTORICAL_RESULT'


export const pushHistory = (command, result) => {
  return {
    type: PUSH_HISTORY,
    command,
    result
  }
}

export const setHistoricalResult = (index, result) => {
  return {
    type: SET_HISTORICAL_RESULT,
    index,
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
    case: SET_HISTORICAL_RESULT:
      const history = [...state.history]
      history[action.index].result = action.result
      return {
        ...state,
        history: history
      }
    default: return state
  }
}
// jshint: ignore:end
