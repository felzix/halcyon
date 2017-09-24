'use strict';

import React from 'react';
import { connect } from 'react-redux'
import { browserHistory } from 'react-router';
import { Link } from 'react-router'

import { setUser } from '../reducers/reducer'


export class GlobalNav extends React.Component {
  constructor(props) {
    super(props);

    this.logout = this.logout.bind(this)
  }

  render() {
    let auth;

    if (this.props.user !== null) {
      auth = (
        <Link onClick={this.logout}>
          Log out
        </Link>
      )
    } else {
      auth = (
        <Link to={{pathname: "/signup"}}>
          Signup/Login
        </Link>
      )
    }

    return (
      <nav className="navbar navbar-default"
           style={{color: '#ffffff'}}>
        <div className="container-fluid" style={{}}>
          <div className="navbar-header" style={{}}>
              <button type="button"
                      className="navbar-toggle collapsed"
                      aria-expanded="false">
                <span className="sr-only">Toggle navigation</span>
              </button>
              <Link className="navbar-brand" to="/">Ledgie</Link>
          </div>
          <div className="collapse navbar-collapse" id="navbar-buttons">
            <ul className="nav navbar-nav navbar-right">
              <li>{auth}</li>
            </ul>
          </div>
        </div>
      </nav>
    )

  }

  async logout() {
    await logout();
    deleteCookie('session');
    this.props.setUser(null);
    browserHistory.push('/');
  }
}


function deleteCookie(key) {
  let cookieMap = getCookieMap();
  delete cookieMap[key];
  setCookies(cookieMap);
}


function getCookieMap() {
  let cookieMap = {};
  let cookies = document.cookie.split('; ');
  cookies.forEach(function(cookie) {
    let [key, value] = cookie.split('=');
    cookieMap[key] = value
  });
  return cookieMap;
}


function setCookies(cookieMap) {
  let cookies = '';
  for (let key in cookieMap) {
    if (cookieMap.hasOwnProperty(key)) {
      let value = cookieMap[key];
      cookies += key + '=' + value + "; "
    }
  }
}


const mapStateToProps = (state) => {
  let userID = state.userID;
  let user = state.user;

  return {
    userID,
    user
  }
};


const mapDispatchToProps = (dispatch) => {
  return {
    setUser: (user) => {
      dispatch(setUser(user))
    }
  }
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(GlobalNav)
