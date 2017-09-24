import React from 'react'
import { Route, IndexRoute } from 'react-router'
import Layout from './components/Layout'


import IndexPage from './components/IndexPage'
import GreetPage from './components/GreetPage'


const routes = (
  <Route path="/" component={Layout}>

    <IndexRoute component={IndexPage}/>
    <Route path="greet" component={GreetPage}/>

  </Route>
)

export default routes
