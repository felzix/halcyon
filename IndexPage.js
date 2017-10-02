import React from 'react'
import ReactTestUtils from 'react-dom/test-utils'
import { connect, Provider } from 'react-redux'

import store from './store'
import { pushHistory, setHistoricalResult, recordPageHeight, setCliElement } from './reducer'
import { text, uploadConfig } from './results'
import { HELPTEXT } from './constants'
import lispParser from './lisp-parser'


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
    this.handleKeyboard = this.handleKeyboard.bind(this);
    this.handleRepeatableKeyboard = this.handleRepeatableKeyboard.bind(this);
  }

  handleResize() {
    this.props.recordPageHeight(window.innerHeight)
  }

  // Just send everything to the CLI.
  handleKeyboard(event) {
    // this.props.cliElement.focus()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    ReactTestUtils.Simulate.keyPress(this.props.cliElement,
      {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey})
  }

  handleRepeatableKeyboard(event) {
    if (event.key === 'Backspace') {
      const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
      ReactTestUtils.Simulate.keyPress(this.props.cliElement,
        {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey})
    }
  }

  render() {
    return (
      <div tabIndex="1"
           onKeyDown={this.handleRepeatableKeyboard}
           onKeyPress={this.handleKeyboard}>
        <Topbar/>
        <History/>
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
            return <li key={`history-${index}`}><pre>{item.command}</pre> {item.result}</li>
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
    this.handleKeyboard = this.handleKeyboard.bind(this);
  }

  componentDidMount() {
    this.inputElement.focus()
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleKeyboard(event) {
    event.stopPropagation()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    let value = this.state.value
    if (event.key.length > 1) {  // non-printable
      switch (event.key) {
        case 'Backspace':
          value = value.slice(0, value.length - 1)
          break
        case 'Control':
          break  // nothing to do
        case 'Meta':
          break  // nothing to do
        case 'Shift':
          break  // nothing to do
        case 'Enter':
          this.handleSubmit(new Event('submit'))
          value = ''
          break
        case 'Escape':
          break  // will probably do something eventually
        default:
          console.error(`Unhandled key ""${event.key}""`)
      }
    } else {  // printable character
      if (ctrlKey || altKey || metaKey) {  // control sequence
        // TODO text-editing commands and user-defined commands
      } else {  // just the key
        value += event.key
      }
    }
    this.setState({ value })
  }

  handleSubmit(event) {
    const command = this.state.value
    if (command !== '') {
      this.recordCommand(command)
      this.setState({ value: '' })
    }
    event.preventDefault();
  }

  recordCommand(command) {
    const historicalIndex = this.props.history.length
    interpretCommand(command).then(result => {
      this.props.setHistoricalResult(historicalIndex, result)
    }).catch(seriousErr => {
      console.error(seriousErr)
      this.props.setHistoricalResult(
        historicalIndex, text('ERROR see dev console for details', 'red'))
    })
    this.props.pushHistory(command)
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
                 onKeyPress={this.handleKeyboard}
                 ref={input => { this.inputElement = input; this.props.setCliElement(input) }}/>
        </label>
      </form>
    );
  }
}

class Topbar extends React.Component {
  render() {
    return (
      <span>
        <div/>
      </span>
    )
  }
}


App = connect(
  state => {
    return {
      history: state.history,
      cliElement: state.cliElement
    }
  },
  dispatch => {
    return {
      pushHistory: (command, result) => {
        dispatch(pushHistory(command, result))
      },
      setHistoricalResult: (index, result) => {
        dispatch(setHistoricalResult(index, result))
      },
      recordPageHeight: height => {
        dispatch(recordPageHeight(height))
      }
    }
  })(App)

History = connect(
  state => {
    return {
      history: state.history,
      pageHeight: state.pageHeight
    }
  },
  dispatch => {
    return {}
  })(History)

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
      },
      setCliElement: element => {
        dispatch(setCliElement(element))
      }
    }
  })(CommandLineInput)

const globalEval = eval  // this magically makes eval's scope global
function interpretCommand(command) {
  return new Promise(resolve => {
    switch(command) {
      case "help":
        resolve(text(HELPTEXT))
        break
      case "config":
        resolve(uploadConfig())
        break
      default:
        try {
          const language = store.getState().shellLanguage
          switch(language) {
            case 'javascript': resolve(interpretJavascript(command)); break
            case 'lisp': resolve(interpretLisp(command)); break
          }
        } catch(err) {
          resolve(text(err.stack, 'red'))
        }
    }
  })
}

function interpretLisp(command) {
  return text(lispParser(command))
}


function interpretJavascript(command) {
  const wrappedCommand = `(function() {return ${command}})()`
  return text(globalEval(wrappedCommand))
}
