import React from 'react'
import store from './store'
import { setConfig, setNodeMap, setDataMap } from './reducer'
import { readJsonFile } from './node'


export function text(string, color) {
  if (typeof string === 'object') {
    string = JSON.stringify(string)
  }
  let style = {}
  if (typeof color !== 'undefined') style.color = color
  return (
    <pre style={style}>{string}</pre>
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
