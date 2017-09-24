const objectAssign = require('object-assign');


export const SET_USER = 'SET_USER';
export const SET_COGNITO = 'SET_COGNITO';


export const setUser = (user) => {
  return {
    type: SET_USER,
    user
  }
};

export const setCognito = (cognito) => {
  return {
    type: SET_COGNITO,
    cognito
  }
};


export default (state={}, action) => {
  return objectAssign({}, state, function(action){
    switch(action.type) {
      case SET_USER: return {user: action.user};
      case SET_COGNITO: return {cognito: action.cognito};
      default: return {}
    }}(action))
};
