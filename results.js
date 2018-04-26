/* eslint-disable react/prop-types */

import React from "react"
if (typeof window !== "undefined") {  // don't load codemirror addons in nodejs
    require("codemirror/addon/edit/matchbrackets")
    require("codemirror/addon/display/fullscreen")
}
import CodeMirror from "react-codemirror"
import ParinferCodeMirror from "parinfer-codemirror"

import CircularJSON from "circular-json"

import store from "./store"
import { setConfig } from "./reducer"


export class GeneratedElement extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            dom: props.dom
        }
        this.set = this.set.bind(this)
    }

    set(k, v) {  // TODO chaining of keys
        const patch = {}
        patch[k] = v
        this.setState(patch)
    }

    push(k, v) {  // TODO chaining of keys and optional index
        const patch = {}
        patch[k] = this.state[k]
        patch[k].push(v)
        this.setState(patch)
    }

    pop(k) {  // TODO chaining of keys and optional index
        const patch = {}
        patch[k] = this.state[k]
        const v = patch[k].pop()
        this.setState(patch)
        return v
    }

    setDOM(newDOM) {
        this.setState({ dom: newDOM })
    }

    render() {
        if (this.state.dom) {
            return this.state.dom
        } else {
            return React.createElement("div")
        }
    }
}


export function text(thing, color) {
    let style = {}
    if (typeof color !== "undefined") {
        style.color = color
    }

    if (typeof thing === "undefined") {  // no value was returned
        thing = "nil"
    } else if (thing === null) {
        thing = "null"
    } else if (typeof thing === "boolean") {
        thing = JSON.stringify(thing)
    } else if (typeof thing.nodeName !== "undefined") {  // it's a DOM element
        thing = new XMLSerializer().serializeToString(thing)  // TODO something more clever than string
    } else if (thing instanceof Error) {
        thing = thing.toString()
    } else if (typeof thing === "object") {  // some other object
        try {
            thing = CircularJSON.stringify(thing)
        } catch (err) {
            thing = "object cannot be serialized"
            style.color = "red"
            style.fontStyle = "italic"
        }
    } else if (typeof thing === "function") {
        thing = `[Function: ${thing.name}]`
    }

    /* jshint ignore:start */
    const dom = (
        <pre style={style}>
            {thing}

        </pre>)
    /* jshint ignore:end */
    return React.createElement(GeneratedElement, { dom })
}

export function uploadConfig() {
    const onChange = () => {
        // var file = loadConfigFileInput.files[0]
        var reader = new FileReader()
        reader.onload = function() {
            const config = JSON.parse(reader.result)
            store.dispatch(setConfig(config))
            // TODO work around how 'fs' isn't something browsers get to use
            // const nodeMap = readJsonFile(config.nodeFile)
            // const dataMap = readJsonFile(config.dataFile)
            // store.dispatch(setNodeMap(nodeMap))
            // store.dispatch(setNodeMap(dataMap))
        }
        // reader.readAsText(file)
    }
    /* jshint ignore:start */
    const dom = (
        <div>
            Upload JSON config file.
            <input type="file" id="loadConfigFileInput" onChange={onChange}/>
        </div>)
    /* jshint ignore:end */
    return React.createElement(GeneratedElement, { dom })
}

export class Editor extends React.Component {
    constructor(props) {
        super(props)
        this.handleKeyPress = this.handleKeyPress.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.setMode = this.setMode.bind(this)
        this.getText = this.getText.bind(this)
        this.setSize = this.setSize.bind(this)
        this.getOption = this.getOption.bind(this)
        this.setOption = this.setOption.bind(this)
    }

    handleKeyPress(event) {
        event.stopPropagation()
    }

    handleKeyUp(event) {
        event.stopPropagation()
    }

    handleKeyDown(event) {
        event.stopPropagation()
    }

    setMode(newMode) {
        ParinferCodeMirror.setMode(this.codeMirror.codeMirror, newMode)
    }

    getText() {
        return this.codeMirror.codeMirror.doc.getValue()
    }

    setSize(width, height) {
        return this.codeMirror.codeMirror.setSize(width, height)
    }

    getOption(option) {
        return this.codeMirror.codeMirror.getOption(option)
    }

    setOption(option, value) {
        this.codeMirror.codeMirror.setOption(option, value)
    }

    componentDidMount() {
        if (this.codeMirror !== null) {
            ParinferCodeMirror.init(this.codeMirror.codeMirror)
        }
    }

    render() {
        const dom = (
            <div
                onKeyPress={this.handleKeyPress}
                onKeyUp={this.handleKeyUp}
                onKeyDown={this.handleKeyDown}>
                <CodeMirror
                    value={this.props.value}
                    options={this.props.options}
                    ref={cm => { this.codeMirror = cm }}/>
            </div>)
        return React.createElement(GeneratedElement, { dom })
    }
}
