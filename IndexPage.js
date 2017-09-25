import React from 'react'
import { connect, Provider } from 'react-redux'

import store from './store'
import { pushHistory } from './reducer'


// this wrapper is necessary for Provider to work right
export default class IndexPage extends React.Component {
  render() {
    return (
      <Provider store={store}>
        <App></App>
      </Provider>
    )
  }
}

class App extends React.Component {
  componentDidMount() {
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  handleResize() {
    this.forceUpdate()
  }

  render() {
    console.log(this.props.history)

    const history = this.props.history.map((item, index) => {
      return <li key={index}>{item.command}</li>
    })

    return (
      <div>
        <History history={this.props.history}/>
        <CommandLineInput pushHistory={this.props.pushHistory}
                          history={this.props.history}/>
      </div>)
  }
}

class History extends React.Component {
  componentDidUpdate() {
    this.container.scrollTop = this.container.scrollHeight
  }

  render() {
    const history = this.props.history.map((item, index) => {
      const command = typeof item.command === 'object' ? JSON.stringify(item.command) : item.command
      const result =  typeof item.result === 'object' ? JSON.stringify(item.result) : item.result
      return <li key={index}>{command} -> {result}</li>
    })

    return (
      <div style={{ height: window.innerHeight - 100,
                    overflowY: "auto"}}
           ref={div => { this.container = div }}>
        <ol>{history}</ol>
      </div>)
  }
}

class CommandLineInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: '' };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  componentDidMount() {
    this.inputElement.focus()
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    const command = this.state.value
    if (command !== '') {
      const result = interpretCommand(command)
      this.props.pushHistory(command, result)
      this.setState({ value: '' });
      event.preventDefault();
    }
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}
            style={{ bottom: "0px",
                     width: "100%",
                     padding: "15px",
                     display: "block"}}>
        <label>
          > {' '}
          <input type="text"
                 style={{width: "90%"}}
                 value={this.state.value}
                 onChange={this.handleChange}
                 ref={input => { this.inputElement = input }}/>
        </label>
      </form>
    );
  }
}

App = connect(
  (state) => {
    return {
      history: state.history
    }
  },
  (dispatch) => {
    return {
      pushHistory: (command, result) => {
        dispatch(pushHistory(command, result))
      }
    }
  }
)(App)


function interpretCommand(text) {
  try {
    return eval(text)
  } catch(err) {
    return err.stack
  }

}
