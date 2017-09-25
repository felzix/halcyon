import React from 'react'
import { connect, Provider } from 'react-redux'

import store from './store'
import { pushHistory, setHistoricalResult } from './reducer'
import { text } from './results'
// import lispyscript from 'lispyscript'  // TODO this doesn't work


// this wrapper is necessary for Provider to work right
export default class IndexPage extends React.Component {
  render() {
    return (
      <Provider store={store}>
        <App/>
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
    const history = this.props.history.map((item, index) => {
      return <li key={index}>{item.command}</li>
    })

    return (
      <div>
        <History history={this.props.history}/>
        <CommandLineInput/>
      </div>)
  }
}

class History extends React.Component {
  componentDidUpdate() {
    this.container.scrollTop = this.container.scrollHeight
  }

  render() {
    return (
      <div style={{ height: window.innerHeight - 100,
                    overflowY: "auto"}}
           ref={div => { this.container = div }}>
        <ol>
          {this.props.history.map((item, index) => {
            return <li key={index}>{item.command} {item.result}</li>
          })}
        </ol>
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
      const historicalIndex = this.props.history.length
      interpretCommand(command).then(result => {
        this.props.setHistoricalResult(historicalIndex, result)
      }).catch(seriousErr => {
        console.error(seriousErr)
        this.props.setHistoricalResult(historicalIndex, text('ERROR see dev console for details', 'red'))
      })
      this.props.pushHistory(command)
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
  state => {
    return {
      history: state.history
    }
  },
  dispatch => {
    return {
      pushHistory: (command, result) => {
        dispatch(pushHistory(command, result))
      },
      setHistoricalResult: (index, result) => {
        dispatch(setHistoricalResult(index, result))
      }
    }
  }
)(App)

History = connect(
  state => {
    return {
      history: state.history
    }
  },
  dispatch => {
    return {}
  }
)(History)

CommandLineInput = connect(
  state => {
    return {
      history: state.history
    }
  },
  dispatch => {
    return {
      pushHistory: (command, result) => {
        dispatch(pushHistory(command, result))
      },
      setHistoricalResult: (index, result) => {
        dispatch(setHistoricalResult(index, result))
      }
    }
  }
)(CommandLineInput)

const globalEval = eval  // this magically moves eval's scope to be global
function interpretCommand(command) {
  return new Promise((resolve) => {
    try {
      resolve(text(globalEval(command)))
    } catch(err) {
      resolve(text(err.stack, 'red'))
    }
  })
}
