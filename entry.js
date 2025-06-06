import "babel-polyfill"  // necessary for await/async to work
import React from "react"
import ReactDOM from "react-dom"
import IndexPage from "./IndexPage"
import $ from "jquery"
import store from "./store"


window.onload = () => {
    /* jshint ignore:start */
    ReactDOM.render(<IndexPage/>, document.getElementById("root"))
    /* jshint ignore:end */
}


window.get = url => {
    return $.ajax({
        type: "GET",
        url
    })
}

window.store = store
