'use strict'

import 'babel-polyfill'  // necessary for await/async to work
import React from 'react'
import ReactDOM from 'react-dom'
import AppRoutes from './components/AppRoutes'


window.onload = () => {
    ReactDOM.render(<AppRoutes/>, document.getElementById('root'))
}
