import React from 'react'
import CodeMirror from 'react-codemirror'
import CircularJSON from 'circular-json'

import store from './store'
import { setConfig, setNodeMap, setDataMap } from './reducer'
import { readJsonFile } from './node'


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

  pop(key) {  // TODO chaining of keys and optional index
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
  if (typeof color !== 'undefined') style.color = color

  if (typeof thing === 'undefined') {  // no value was returned
    thing = `[UNDEFINED]`  // TODO add a `nil` to lisp?
  } else if (typeof thing.nodeName !== 'undefined') {  // it's a DOM element
    thing = new XMLSerializer().serializeToString(thing)  // TODO something more clever than string
  } else if (typeof thing === 'object') {  // some other object
    try {
      thing = CircularJSON.stringify(thing)
    } catch (err) {
      thing = 'ERROR: object cannot be serialized'
      style.color = 'red'
    }
  } else if (typeof thing === 'function') {
    thing = `[Function: ${thing.name}]`
  }

  const dom = (
    <pre style={style}>
      {thing}
    </pre>)
  return React.createElement(GeneratedElement, { dom })
}

export function uploadConfig() {
  const onChange = event => {
    var file = loadConfigFileInput.files[0]
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
    reader.readAsText(file);
  }
  const dom = (
    <div>
      Upload JSON config file.
      <input type="file" id="loadConfigFileInput" onChange={onChange}/>
    </div>)
  return React.createElement(GeneratedElement, { dom })
}

export class Editor extends React.Component {
  constructor(props) {
    super(props)
    this.handleKeyPress = this.handleKeyPress.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
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

  render() {
    const dom = (
      <div onKeyPress={this.handleKeyPress}
           onKeyUp={this.handleKeyUp}
           onKeyDown={this.handleKeyDown}>
        <CodeMirror value={this.props.value}
                    options={this.props.options}/>
      </div>)
    return React.createElement(GeneratedElement, { dom })
  }
}
