'use strict';

import React from 'react'
import { Route, IndexRoute } from 'react-router'
import Layout from './components/Layout';


import IndexPage from './components/IndexPage';

import SignupPage from './components/SignupPage';
import SignupVerificationPage from './components/SignupVerificationPage';
import LoginPage from './components/LoginPage';
import GreetPage from './components/GreetPage';
import SalutPage from './components/SalutPage';
// import EmailVerifiedPage from './components/EmailVerifiedPage'
// import RequestResetPasswordPage from './components/RequestResetPasswordPage';
// import DoResetPasswordPage from './components/DoResetPasswordPage';
// import CheckYourEmailPage from './components/CheckYourEmailPage';
//
// import TermsOfServicePage from './components/TermsOfServicePage';
//
// import NotFoundPage from './components/NotFoundPage';


const routes = (
  <Route path="/" component={Layout}>

    <IndexRoute component={IndexPage}/>

    <Route path="signup" component={SignupPage}/>
    <Route path="signup_verification" component={SignupVerificationPage}/>
    <Route path="login" component={LoginPage}/>
    <Route path="greet" component={GreetPage}/>
    <Route path="salut" component={SalutPage}/>

  </Route>
);

export default routes;
