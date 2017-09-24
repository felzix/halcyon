'use strict';

import React from 'react';
import { callGreet } from '../api'


export default class GreetPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      greeting: null
    };
  }

  async componentDidMount() {
    let greeting_wrapper = await callGreet();

    this.setState({
      greeting: greeting_wrapper.message
    })
  }

  render() {
    if (this.state.greeting === null) {
      return <div>Loading...</div>
    }

    console.log(this.state.greeting);

    return (
      <div>
        <h1>{this.state.greeting}</h1>
      </div>)
  }
}
