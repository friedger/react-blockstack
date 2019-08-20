import React, { Component } from 'react';
import BlockstackContext from 'react-blockstack'

export default class Signin extends Component {
  render() {
    const { handleSignIn } = this.context
    return (
      <div hidden={!handleSignIn} className="panel-landing" id="section-1">
        <h1 className="landing-heading">Hello, Blockstack!</h1>
        <p className="lead">
          <button
            className="btn btn-primary btn-lg"
            id="signin-button"
            disabled={ !handleSignIn }
            onClick={ handleSignIn }>
            Sign In with Blockstack
          </button>
        </p>
      </div>
    )
  }
}
Signin.contextType = BlockstackContext
