const objectAssign = require('object-assign')


export const PUSH_HISTORY = 'PUSH_HISTORY'
export const SET_HISTORICAL_RESULT = 'SET_HISTORICAL_RESULT'
export const RECORD_PAGE_HEIGHT = 'RECORD_PAGE_HEIGHT'
export const SET_CONFIG = 'SET_CONFIG'


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

export const recordPageHeight = (height) => {
  return {
    type: RECORD_PAGE_HEIGHT,
    height
  }
}

export const setConfig = (config) => {
  return {
    type: SET_CONFIG,
    config
  }
}


// remove jshint when ticket resolves: https://github.com/jshint/jshint/issues/2991
// jshint ignore:start
export default (state, action) => {
  console.log(state)
  switch (action.type) {
    case PUSH_HISTORY: return {
      ...state,
      history: [
        ...state.history,
        { command: action.command, result: action.result }
      ]
    }
    case SET_HISTORICAL_RESULT:
      const history = [...state.history]
      history[action.index].result = action.result
      return {
        ...state,
        history: history
      }
    case RECORD_PAGE_HEIGHT:
      return {
        ...state,
        pageHeight: action.height
      }
    case SET_CONFIG:
      return {
        ...state,
        config: action.config
      }
    default: return state
  }
}
// jshint: ignore:end
