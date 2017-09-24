'use strict';

import React from 'react';
import { Provider } from 'react-redux'
import { Router, hashHistory } from 'react-router';

import routes from '../routes';
import store from '../store'


export default class AppRoutes extends React.Component {
  render() {
    return (
      <Provider store={store}>
        {/*<Router history={browserHistory} routes={routes}/>*/}
        <Router history={hashHistory} routes={routes}/>
      </Provider>
    );
  }
}
