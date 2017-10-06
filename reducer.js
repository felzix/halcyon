const objectAssign = require('object-assign')


export const PUSH_HISTORY = 'PUSH_HISTORY'
export const SET_HISTORICAL_RESULT = 'SET_HISTORICAL_RESULT'
export const RECORD_PAGE_HEIGHT = 'RECORD_PAGE_HEIGHT'
export const SET_CONFIG = 'SET_CONFIG'
export const SET_CLI_ELEMENT = 'SET_CLI_ELEMENT'
export const SET_NODE_MAP = 'SET_NODE_MAP'
export const SET_DATA_MAP = 'SET_DATA_MAP'


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

export const setCliElement = (element) => {
  return {
    type: SET_CLI_ELEMENT,
    element
  }
}

export const setNodeMap = (map) => {
  return {
    type: SET_NODE_MAP,
    map
  }
}

export const setDataMap = (map) => {
  return {
    type: SET_DATA_MAP,
    map
  }
}


// remove jshint when ticket resolves: https://github.com/jshint/jshint/issues/2991
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
    case SET_CLI_ELEMENT:
      return {
        ...state,
        cliElement: action.element
      }
    case SET_NODE_MAP:
      return {
        ...state,
        nodeMap: action.map
      }
    case SET_DATA_MAP:
      return {
        ...state,
        dataMap: action.map
      }
    default: return state
  }
}
// jshint: ignore:end
