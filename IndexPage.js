/* eslint-disable react/prop-types, no-console, no-class-assign */

import "babel-polyfill"  // necessary for await/async to work
import React from "react"
import ReactDOM from "react-dom"
import ReactTestUtils from "react-dom/test-utils"
import { connect, Provider } from "react-redux"

import store from "./store"
import { pushHistory, setHistoricalResult, recordPageHeight, setCliElement } from "./reducer"
import { text } from "./results"
import { HELPTEXT } from "./constants"


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
    async componentDidMount() {
        window.addEventListener("resize", this.handleResize.bind(this))
        this.handleKeyboard = this.handleKeyboard.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)

        // If there is a startup script then execute it now.
        if (typeof this.props.config.startupScript === "string") {
            await this.props.lispInterpreter.eval(
                `(eval (node "${this.props.config.startupScript}"))`
            )
        }
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

    // Just send (most) everything to the CLI.
    handleKeyDown(event) {
        const { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey } = event

        if (key === "c" && metaKey) {  // copy
            return
        } else if (key === "x" && metaKey) {  // cut
            return
        } else if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") {
            return  // give copy etc a chance to be captured here instead of passing through to CLI
        } else {  // pass along to CLI
            event.stopPropagation()
            this.props.cliElement.focus()
            ReactTestUtils.Simulate.keyDown(this.props.cliElement,
                { key, keyCode, charCode, which, ctrlKey, shiftKey, altKey, metaKey })
        }
    }

    // Just send everything to the CLI.
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
    constructor(props) {
        super(props)
        this.state = { history: props.history }
        this.props.lispInterpreter.addToContext("history", this.props.history)
        this.props.lispInterpreter.addToContext("ReactDOM", ReactDOM)
        this.props.lispInterpreter.addToContext("React", React)
    }

    componentDidUpdate() {
        this.container.scrollTop = this.container.scrollHeight
        this.props.lispInterpreter.addToContext("history", this.props.history)
    }

    render() {
        return (
            <div style={{ height: window.innerHeight - 100,
                overflowY: "auto"}}
            ref={div => { this.container = div }}>
                <ol>
                    {this.props.history.map((item, index) => {
                        return <li key={`history-${index}`}><pre>{item.command}</pre> {item.vis}</li>
                    })}
                </ol>
            </div>)
    }
}

class CommandLineInput extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            value: "",
            cursorStart: 0,
            cursorEnd: 0,
            historyPosition: null
        }
        this.props.lispInterpreter.addToContext("help", HELPTEXT)

        this.handleSubmit = this.handleSubmit.bind(this)
        this.setInputElement = this.setInputElement.bind(this)
        this.handleKeyboard = this.handleKeyboard.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleClick = this.handleClick.bind(this)
        this.handleUnclick = this.handleUnclick.bind(this)
        this.handleOnPaste = this.handleOnPaste.bind(this)
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
        const {key, ctrlKey, shiftKey, altKey, metaKey} = event
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
            case "Enter":
                this.handleSubmit(new Event("submit"))
                this.setState({ value: "", cursorStart: 0, cursorEnd: 0, historyPosition: null })
                break
            }
        }
    }

    // Handles repeatable control characters or control sequences.
    handleKeyDown(event) {
        event.stopPropagation()
        const { key, ctrlKey, shiftKey, altKey, metaKey } = event
        let { cursorStart, cursorEnd, value } = this.state

        if (key.length === 1 && !(ctrlKey || altKey || metaKey)) {  // shiftKey for capitalization etc
            return  // printable so do nothing
        }

        let preventDefault = true

        // NOTE: Every event here has a match in handleKeyUp so beware duplication
        switch(key) {
        case "Backspace": {
            if (altKey) {
                cursorStart -= 1
                while (cursorStart >= 0) {
                    const char = value[cursorStart - 1]
                    if (!this.isWordChar(char)) {
                        break
                    }
                    // TODO handle skipping whitespace OR words instead of only ever words
                    cursorStart -= 1
                }
            }
            if (cursorStart === cursorEnd) {
                cursorStart -= 1  // if no selection, delete 1 left of cursor
            }

            if (cursorStart < 0) {  // can't delete past the beginning of the line
                cursorStart = 0
            }

            this.setState({
                value: value.slice(0, cursorStart) + value.slice(cursorEnd, value.length),
                cursorStart,
                cursorEnd: cursorStart
            })

            break
        }
        case "Delete": {
            if (altKey) {  // delete one word
                cursorEnd += 1
                while (cursorEnd < value.length) {
                    const char = value[cursorEnd]
                    if (!this.isWordChar(char)) {
                        break
                    }
                    // TODO handle skipping whitespace OR words instead of only ever words
                    cursorEnd += 1
                }
            }
            if (cursorStart === cursorEnd) {
                cursorEnd += 1  // if no selection, delete 1 right of cursor
            }

            if (cursorEnd > value.length) {  // can't delete past the end of the line
                cursorEnd = value.length
            }

            this.setState({
                value: value.slice(0, cursorStart) + value.slice(cursorEnd, value.length),
                cursorStart,
                cursorEnd: cursorStart
            })

            break
        }
        case "ArrowLeft": {
            if (metaKey && shiftKey) {  // select from here to beginning
                cursorStart = 0
            } else if (metaKey && !shiftKey) {  // go to beginning
                cursorStart = cursorEnd = 0
            } else if (shiftKey && !(metaKey || altKey)) {  // select one more to the left
                cursorStart -= 1
            } else if (altKey) {  // move or select one word to the left
                cursorStart -= 1
                while (cursorStart >= 0) {
                    const char = value[cursorStart - 1]
                    if (!this.isWordChar(char)) {
                        break
                    }
                    // TODO handle skipping whitespace OR words instead of only ever words
                    cursorStart -= 1
                }
                if (!shiftKey) {  // just move, don't select
                    cursorEnd = cursorStart
                }
            } else {  // move one to the left
                cursorStart -= 1
                cursorEnd = cursorStart
            }

            let { start, end } = this.inbounds(cursorStart, cursorEnd, value.length)
            this.setState({ cursorStart: start, cursorEnd: end })
            break
        }
        case "ArrowRight": {
            const max = value.length

            if (metaKey && shiftKey) {  // select from here to ending
                cursorEnd = max
            } else if (metaKey && !shiftKey) {  // go to ending
                cursorEnd = cursorStart = max
            } else if (shiftKey && !(metaKey || altKey)) {  // select one more to the right
                cursorEnd += 1
            } else if (altKey) {
                cursorEnd += 1
                while (cursorEnd < value.length) {
                    const char = value[cursorEnd]
                    if (!this.isWordChar(char)) {
                        break
                    }
                    // TODO handle skipping whitespace OR words instead of only ever words
                    cursorEnd += 1
                }
                if (!shiftKey) {  // just move, don't select
                    cursorStart = cursorEnd
                }
            } else {  // move one to the right
                cursorEnd += 1
                cursorStart = cursorEnd
            }
            let { start, end } = this.inbounds(cursorStart, cursorEnd, max)
            this.setState({ cursorStart: start, cursorEnd: end })
            break
        }
        case "ArrowUp": {
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
        case "ArrowDown": {
            let { historyPosition } = this.state
            let { history } = this.props
            if (historyPosition === null) {  // already past the end
                break
            } else {
                historyPosition += 1
                if (historyPosition >= history.length) {  // go past the end
                    this.setState({ value: "", historyPosition: null })
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
            break
        }
        case "a": {
            if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // select all
                this.setState({ cursorStart: 0, cursorEnd: value.length })
            } else if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // start of line
                this.setState({ cursorStart: 0, cursorEnd: 0})
            }
            break
        }
        case "c": {
            if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // copy to clipboard
                document.execCommand("copy")
            } else if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // start of line
                this.setState({ cursorStart: 0, cursorEnd: 0})
            }
            break
        }
        case "e": {
            if (ctrlKey && !(shiftKey || altKey || metaKey)) {  // end of line
                this.setState({ cursorStart: value.length, cursorEnd: value.length})
            }
            break
        }
        case "i": {
            if (altKey && metaKey && !(ctrlKey || shiftKey)) {  // dev console
                preventDefault = false
            }
            break
        }
        case "r": {
            if (metaKey && !(shiftKey || altKey || ctrlKey)) {  // reload page
                window.location.reload()
            }
            break
        }
        case "v": {
            if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // paste from clipboard
                // Nothing to do here. This is dealt with via the onPaste handler.
                // It's not possible to paste from javascript w/o an extension overriding security.
                preventDefault = false
            }
            break
        }
        case "x": {
            if (metaKey && !(ctrlKey || shiftKey || altKey)) {  // cut to clipboard
                document.execCommand("cut")
                this.setState({
                    value: value.slice(0, cursorStart) + value.slice(cursorEnd, value.length),
                    cursorStart,
                    cursorEnd: cursorStart
                })
            }
            break
        }
        case "1": {  // switch to another tab
            preventDefault = false
            break
        }
        case "2": {  // switch to another tab
            preventDefault = false
            break
        }
        case "3": {  // switch to another tab
            preventDefault = false
            break
        }
        case "4": {  // switch to another tab
            preventDefault = false
            break
        }
        case "5": {  // switch to another tab
            preventDefault = false
            break
        }
        case "6": {  // switch to another tab
            preventDefault = false
            break
        }
        case "7": {  // switch to another tab
            preventDefault = false
            break
        }
        case "8": {  // switch to another tab
            preventDefault = false
            break
        }
        case "9": {  // switch to another tab
            preventDefault = false
            break
        }
        }

        if (preventDefault) {
            event.preventDefault()
        }
    }

    // Handles printable characters.
    handleKeyboard(event) {
        event.stopPropagation()
        const { key, ctrlKey, altKey, metaKey } = event
        if (key.length > 1) {  // non-printable so let handleKeyUp deal with it
            return
        }
        if (ctrlKey || altKey || metaKey) {  // control sequence so let handleKeyUp deal with it
            return
        }

        this.addText(key)
        event.preventDefault()
    }

    handleOnPaste(event) {
        event.stopPropagation()
        event.preventDefault()
        const { clipboardData } = event
        const text = clipboardData.getData("Text")
        this.addText(text)
    }

    handleClick() {
        this.setState({
            cursorStart: this.inputElement.selectionStart,
            cursorEnd: this.inputElement.selectionEnd  // should be identical to selectionStart though
        })
    }

    handleUnclick() {
        this.setState({
            cursorStart: this.inputElement.selectionStart,
            cursorEnd: this.inputElement.selectionEnd
        })
    }

    async handleSubmit(event) {
        const command = this.state.value
        if (command !== "") {
            this.setState({ value: "" })
            await this.recordCommand(command)
        }
        event.preventDefault()
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

    isWordChar(char) {
        return (/\w/).test(char)
    }

    async recordCommand(command) {
        const historicalIndex = this.props.history.length
        interpretCommand(command, this.props.lispInterpreter).then(result => {
            this.props.setHistoricalResult(historicalIndex, result.result, result.vis)
        }).catch(seriousErr => {
            console.error(seriousErr)
            const msg = "ERROR see dev console for details"
            this.props.setHistoricalResult(
                historicalIndex, msg, text(msg, "red"))
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
                    {"> "}
                    <input type="text"
                        id="cli-input"
                        style={{width: "90%"}}
                        value={this.state.value}
                        onKeyPress={this.handleKeyboard}
                        onKeyUp={this.handleKeyUp}
                        onKeyDown={this.handleKeyDown}
                        onMouseDown={this.handleClick}
                        onMouseUp={this.handleUnclick}
                        onPaste={this.handleOnPaste}
                        ref={this.setInputElement}/>
                </label>
            </form>
        )
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
            config: state.config,
            history: state.history,
            cliElement: state.cliElement,
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
            recordPageHeight: height => {
                dispatch(recordPageHeight(height))
            }
        }
    })(App)

History = connect(
    state => {
        return {
            history: state.history,
            pageHeight: state.pageHeight,
            lispInterpreter: state.lispInterpreter
        }
    },
    () => {
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
            pushHistory: (command, result, vis) => {
                dispatch(pushHistory(command, result, vis))
            },
            setHistoricalResult: (index, result, vis) => {
                dispatch(setHistoricalResult(index, result, vis))
            },
            setCliElement: element => {
                dispatch(setCliElement(element))
            }
        }
    })(CommandLineInput)

function interpretCommand(command, lispInterpreter) {
    return new Promise(async resolve => {
        resolve(await interpretLisp(command, lispInterpreter))
    })
}

async function interpretLisp(command, lispInterpreter) {
    const mk = (vis) => {
        return { command, result, vis }  // command and result come from closure
    }
    let result
    try {
        result = await lispInterpreter.eval(command)
    } catch (err) {
        console.error(err)
        return mk(text(err, "red"))
    }

    if (typeof result === "undefined") {  // wrap in React element
        return mk(text(result))
    } else if (result === null) {  // wrap in React element
        return mk(text(result))
    } else if (typeof result.$$typeof === "symbol") {  // probably a React element
        return mk(result)
    } else if (typeof result.error !== "undefined") {  // error
        return mk(text(result.error, "red"))
    } else if (typeof result.vis !== "undefined") {  // use `vis` React element
        return mk(result.vis)
    } else {  // wrap in React element
        return mk(text(result))
    }
}
