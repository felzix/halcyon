import 'babel-polyfill'  // necessary for await/async to work
import React from 'react'
import ReactDOM from 'react-dom'
import IndexPage from './IndexPage'
import $ from 'jquery'


window.onload = () => {
    ReactDOM.render(<IndexPage/>, document.getElementById('root'))
}


window.get = url => {
  return $.ajax({
    type: "GET",
    url
  })
}
