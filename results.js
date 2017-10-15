import React from 'react'
import CodeMirror from 'react-codemirror'

import store from './store'
import { setConfig, setNodeMap, setDataMap } from './reducer'
import { readJsonFile } from './node'


export function text(thing, color) {
  let style = {}
  if (typeof color !== 'undefined') style.color = color

  if (typeof thing === 'object') {
    try {
      thing = JSON.stringify(thing)
    } catch (err) {
      thing = 'ERROR: object cannot be serialized'
      style.color = 'red'
    }
  } else if (typeof thing === 'function') {
    thing = `[Function: ${thing.name}]`
  }

  return (
    <pre style={style}>
      {thing}
    </pre>
  )
}

export function uploadConfig() {
  const onChange = event => {
    var file = loadConfigFileInput.files[0]
    var reader = new FileReader()
    reader.onload = function() {
      console.log(reader.result)
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
  return (
    <div>
      Upload JSON config file.
      <input type="file" id="loadConfigFileInput" onChange={onChange}/>
    </div>)
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
    return (
      <div onKeyPress={this.handleKeyPress}
           onKeyUp={this.handleKeyUp}
           onKeyDown={this.handleKeyDown}>
        <CodeMirror value={this.props.value}
                    options={this.props.options}/>
      </div>)
  }
}
