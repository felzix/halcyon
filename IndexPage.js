import React from 'react'
import ReactTestUtils from 'react-dom/test-utils'
import { connect, Provider } from 'react-redux'

import store from './store'
import { pushHistory, setHistoricalResult, recordPageHeight, setCliElement } from './reducer'
import { text, uploadConfig } from './results'
import { HELPTEXT } from './constants'
import { makeInterpreter } from './lisp-parser'


const nodes = {
  "foo": "astro"
}
const data = {
  "astro": "god is alive!!!"
}


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
    this.state = {
      value: '',
      cursorStart: 0,
      cursorEnd: 0,
      historyPosition: null
     }

    this.handleSubmit = this.handleSubmit.bind(this);
    this.setInputElement = this.setInputElement.bind(this);
    this.handleKeyboard = this.handleKeyboard.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleUnclick = this.handleUnclick.bind(this);
  }

  componentDidMount() {
    this.inputElement.focus()
  }

  componentDidUpdate() {
    this.inputElement.selectionStart = this.state.cursorStart
    this.inputElement.selectionEnd = this.state.cursorEnd
  }

  // Handles non-repeatable control characters or control sequences.
  handleKeyUp(event) {
    event.stopPropagation()
    const {key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey} = event
    const value = this.state.value
    if (key.length === 1) {  // might just be a printable
      // TODO are these ever brought here?
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
          this.setState({ value: '', cursorStart: 0, cursorEnd: 0, historyPosition: null })
          break
      }
    }
  }

  // Handles repeatable control characters or control sequences.
  handleKeyDown(event) {
    event.stopPropagation()
    const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event
    let { cursorStart, cursorEnd, value } = this.state
    const { selectionLeft, selectionRight } = this.inputElement

    if (key.length === 1 && !(ctrlKey || altKey || metaKey)) {  // shiftKey for capitalization etc
      return  // printable so do nothing
    }

    event.preventDefault()  // here instead of earlier so the event will propagate if it's printable

    // NOTE: Every event here has a match in handleKeyUp so beware duplication
    switch(key) {
      case 'Backspace': {
        event.preventDefault()

        if (cursorStart === cursorEnd) {
          cursorStart -= 1  // if no selection, delete 1 left of cursor
        }

        if (cursorStart < 0) {  // can't delete past the beginning of the line
          return
        }

        this.setState({
          value: value.slice(0, cursorStart) + value.slice(cursorEnd, value.length),
          cursorStart,
          cursorEnd: cursorStart
        })

        return
      }
      case 'Delete': {
        event.preventDefault()

        if (cursorStart === cursorEnd) {
          cursorEnd += 1  // if no selection, delete 1 right of cursor
        }

        if (cursorEnd > value.length) {  // can't delete past the end of the line
          return
        }

        this.setState({
          value: value.slice(0, cursorStart) + value.slice(cursorEnd, value.length),
          cursorStart,
          cursorEnd: cursorStart
        })

        return
      }
      case 'ArrowLeft': {
        if (metaKey && shiftKey) {  // select from here to beginning
          cursorStart = 0
        } else if (metaKey && !shiftKey) {  // go to beginning
          cursorStart = cursorEnd = 0
        } else if (shiftKey && !metaKey) {  // select one more to the left
          cursorStart -= 1
        } else {  // move one to the left
          cursorStart -= 1
          cursorEnd = cursorStart
        }

        let { start, end } = this.inbounds(cursorStart, cursorEnd, value.length)
        this.setState({ cursorStart: start, cursorEnd: end })
        event.preventDefault()
        break
      }
      case 'ArrowRight': {
        const max = value.length

        if (metaKey && shiftKey) {  // select from here to ending
          cursorEnd = max
        } else if (metaKey && !shiftKey) {  // go to ending
          cursorEnd = cursorStart = max
        } else if (shiftKey && !metaKey) {  // select one more to the right
          cursorEnd += 1
        } else {  // move one to the right
          cursorEnd += 1
          cursorStart = cursorEnd
        }
        let { start, end } = this.inbounds(cursorStart, cursorEnd, max)
        this.setState({ cursorStart: start, cursorEnd: end })
        event.preventDefault()
        break
      }
      case 'ArrowUp': {
        let { historyPosition } = this.state
        let { history } = this.props
        historyPosition = historyPosition === null ? history.length - 1 : historyPosition - 1
        if (historyPosition >= 0) {
          const value = history[historyPosition].command
          this.setState({
            historyPosition,
            value,
            cursorStart: value.length,
            cursorEnd: value.length
          })
        }
        break
      }
      case 'ArrowDown': {
        let { historyPosition } = this.state
        let { history } = this.props
        if (historyPosition === null) {  // already past the end
          return
        } else {
          historyPosition += 1
          if (historyPosition >= history.length) {  // go past the end
            this.setState({ value: '', historyPosition: null })
          } else {
            const value = history[historyPosition].command
            this.setState({
              historyPosition: historyPosition,
              value,
              cursorStart: value.length,
              cursorEnd: value.length
            })
          }
        }
      }
      case 'a': {
        if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // select all
          this.setState({ cursorStart: 0, cursorEnd: value.length })
        } else if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // start of line
           this.setState({ cursorStart: 0, cursorEnd: 0})
        }
        break
      }
      case 'c': {
        if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // copy to clipboard
          document.execCommand("copy")
        } else if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // start of line
           this.setState({ cursorStart: 0, cursorEnd: 0})
        }
        break
      }
      case 'e': {
        if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // end of line
          this.setState({ cursorStart: value.length, cursorEnd: value.length})
        }
        break
      }
      case 'r': {
        if (metaKey && !(shiftKey || altKey || ctrlKey)) {  // reload page
         window.location.reload()
       }
       break
      }
      case 'v': {
        if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // copy to clipboard
          document.execCommand("paste")
          // TODO cursors
        }
        break
      }
      case 'x': {
        if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // copy to clipboard
          document.execCommand("cut")
          // TODO cursors
        }
        break
      }
    }
  }

  // Handles printable characters.
  handleKeyboard(event) {
    event.stopPropagation()
    const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event
    let value = this.state.value
    if (key.length > 1) {  // non-printable so let handleKeyUp deal with it
      return
    }
    if (ctrlKey || altKey || metaKey) {  // control sequence so let handleKeyUp deal with it
      return
    }

    this.addText(key)
    event.preventDefault()
  }

  handleClick(event) {
    this.setState({
      cursorStart: this.inputElement.selectionStart,
      cursorEnd: this.inputElement.selectionEnd  // should be identical to selectionStart though
    })
  }

  handleUnclick(event) {
    this.setState({
      cursorStart: this.inputElement.selectionStart,
      cursorEnd: this.inputElement.selectionEnd
    })
  }

  handleSubmit(event) {
    const command = this.state.value
    if (command !== '') {
      this.recordCommand(command)
      this.setState({ value: '' })
    }
    event.preventDefault();
  }

  addText(text) {
    let { cursorStart, cursorEnd, value } = this.state
    const growth = text.length
    value = value.slice(0, cursorStart) + text + value.slice(cursorStart)
    cursorStart += growth
    cursorEnd += growth
    this.setState({ value, cursorStart, cursorEnd })
  }

  inbounds(start, end, max) {
    start = start < 0 ? 0 : start
    end = end < 0 ? 0 : end
    start = start > max ? max : start
    end = end > max ? max : end
    return { start, end }
  }

  recordCommand(command) {
    const historicalIndex = this.props.history.length
    interpretCommand(command, this.props.lispInterpreter).then(result => {
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
                 onMouseDown={this.handleClick}
                 onMouseUp={this.handleUnclick}
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
      history: state.history,
      lispInterpreter: state.lispInterpreter
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
function interpretCommand(command, lispInterpreter) {
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
            case 'lisp': resolve(interpretLisp(command, lispInterpreter)); break
          }
        } catch(err) {
          resolve(text(err.stack, 'red'))
        }
    }
  })
}

function interpretLisp(command, lispInterpreter) {
  const result = lispInterpreter(command)
  // TODO result can be a Promise...
  if (typeof result.$$typeof === 'symbol') {  // probably a React element
    return result
  } else {  // wrap in React element
    return text(result)
  }
}

function interpretJavascript(command) {
  const wrappedCommand = `(function() {return ${command}})()`
  return text(globalEval(wrappedCommand))
}

function node(name) {
  const hash = nodes[name]
  return nodes[hash]
}
