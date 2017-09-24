'use strict';

import React from 'react';
import { Grid } from 'react-bootstrap'

import GlobalNav from './GlobalNav'


export default class Layout extends React.Component {
  render() {
    return (
      <div className="app-container">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/latest/css/bootstrap.min.css"/>

        <link rel="stylesheet" href="https://unpkg.com/react-select/dist/react-select.css"/>
        <div className="app-content">
          <Grid style={{width: "100%"}}>
            {/*<GlobalNav/>*/}
            {this.props.children}
          </Grid>
        </div>
      </div>
    );
  }
}
