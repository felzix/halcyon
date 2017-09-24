'use strict'

import 'babel-polyfill'  // necessary for await/async to work
import React from 'react'
import ReactDOM from 'react-dom'
import IndexPage from './IndexPage'


window.onload = () => {
    ReactDOM.render(<IndexPage/>, document.getElementById('root'))
}
