'use strict';

import React from 'react';
import { Link } from 'react-router';


export default class IndexPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <div>
        <p>
          <Link to={{pathname: "/signup"}}>
            Signup
          </Link>
        </p>
        <p>
          <Link to={{pathname: "/signup_verification"}}>
            Verify Signup
          </Link>
        </p>
        <p>
          <Link to={{pathname: "/login"}}>
            Login
          </Link>
        </p>
        <p>
          <Link to={{pathname: "/greet"}}>
            Via API Key
          </Link>
        </p>
        <p>
          <Link to={{pathname: "/salut"}}>
            Via Auth Key
          </Link>
        </p>
      </div>)
  }
}
