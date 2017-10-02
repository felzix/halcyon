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
    window.addEventListener("resize", this.handleResize.bind(this))
    this.handleKeyboard = this.handleKeyboard.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
  }

  handleResize() {
    this.props.recordPageHeight(window.innerHeight)
  }

  // Just send everything to the CLI.
  handleKeyboard(event) {
    event.stopPropagation()  // probably breaks tab behavior
    this.props.cliElement.focus()
    const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event
    ReactTestUtils.Simulate.keyPress(this.props.cliElement,
      { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey })
  }

  handleKeyDown(event) {
    event.stopPropagation()
    this.props.cliElement.focus()
    const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event
    ReactTestUtils.Simulate.keyDown(this.props.cliElement,
      { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey })
  }

  handleKeyUp(event) {
    event.stopPropagation()
    this.props.cliElement.focus()
    const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event
    ReactTestUtils.Simulate.keyUp(this.props.cliElement,
      { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey })
  }

  render() {
    return (
      <div tabIndex="1"
           onKeyPress={this.handleKeyboard}
           onKeyDown={this.handleKeyDown}
           onKeyUp={this.handleKeyUp}>
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
    this.state = { value: '', cursorPosition: 0 };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.setInputElement = this.setInputElement.bind(this);
    this.handleKeyboard = this.handleKeyboard.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    this.inputElement.focus()
  }

  componentDidUpdate() {
    this.inputElement.selectionStart = this.state.cursorPosition
    this.inputElement.selectionEnd = this.state.cursorPosition
  }

  // Handles non-repeatable control characters or control sequences.
  handleKeyUp(event) {
    event.stopPropagation()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    const value = this.state.value
    console.log(`up ${key} ${ctrlKey}`)
    if (key.length == 1) {  // might just be a printable
      if (ctrlKey || shiftKey || altKey || metaKey) {  // this is a control sequence!
        // see handleKeyDown for what belongs here, if anything every does
        return
      } else {  // yeah just a printable so let handleKeyboard deal with it
        return
      }
    } else {  // just a control character. note that this happens at the end of sequences too
      // NOTE: Every event here has a match in handleKeyDown so beware duplication
      switch (key) {
        case 'Enter':
          this.handleSubmit(new Event('submit'))
          this.setState({ value: '' })
          break
      }
    }
  }

  // Handles repeatable control characters or control sequences.
  handleKeyDown(event) {
    event.stopPropagation()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    console.log(`down ${key} ${ctrlKey}`)
    const value = this.state.value
    if (key.length == 1) {  // might just be a printable
      if (ctrlKey || shiftKey || altKey || metaKey) {  // this is a control sequence!
        // FUTURE: note that event.preventDefault() prevents ctrl-a and the like
        return
      } else {  // yeah just a printable so let handleKeyboard deal with it
        return
      }
    } else {  // just a control character. note that this happens at the end of sequences too
      // NOTE: Every event here has a match in handleKeyUp so beware duplication
      switch (key) {
        case 'Backspace': {
          let start = this.inputElement.selectionStart
          const end = this.inputElement.selectionEnd
          start = start === end ? start - 1 : start  // if no selection, delete 1 left of cursor
          const value = this.state.value
          this.setState({ value: value.slice(0, start) + value.slice(end, value.length) })
          this.cursorLeft()
          event.preventDefault()
          break
        }
        case 'Delete': {
          const start = this.inputElement.selectionStart
          let end = this.inputElement.selectionEnd
          end = end === start ? end + 1 : end  // if no selection, delete 1 right of cursor
          const value = this.state.value
          this.setState({ value: value.slice(0, start) + value.slice(end, value.length) })
          event.preventDefault()
          break
        }
        case 'ArrowLeft':
          this.cursorLeft()
          event.preventDefault()
          break
        case 'ArrowRight':
          this.cursorRight()
          event.preventDefault()
          break
        case 'ArrowUp':
          // TODO scroll history
          break
        case 'ArrowDown':
          // TODO scroll history
          break
      }
    }
  }

  // Handles printable characters.
  handleKeyboard(event) {
    event.stopPropagation()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    console.log(`press ${key} ${ctrlKey}`)
    const value = this.state.value
    if (key.length > 1) {  // non-printable so let handleKeyUp deal with it
      return
    }
    if (ctrlKey || altKey || metaKey) {  // control sequence so let handleKeyUp deal with it
      return
    }

    // TODO add the key based on the text cursor position
    this.setState({ value: value + key })
    this.cursorRight(true)
  }

  cursorLeft() {
    const pos = this.state.cursorPosition
    if (pos > 0) {
      this.setState({ cursorPosition: pos - 1 })
    }
  }

  cursorRight(offByOne) {
    let max = this.inputElement.value.length
    max = offByOne ? max + 1 : max
    const pos = this.state.cursorPosition
    if (pos < max) {
      this.setState({ cursorPosition: pos + 1 })
    }
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

  setInputElement(element) {
    this.inputElement = element
    this.props.setCliElement(element)
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
                 id="cli-input"
                 style={{width: "90%"}}
                 value={this.state.value}
                 onKeyPress={this.handleKeyboard}
                 onKeyUp={this.handleKeyUp}
                 onKeyDown={this.handleKeyDown}
                 ref={this.setInputElement}/>
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
