import React from 'react'
import store from './store'
import { setConfig } from './reducer'


export function text(string, color) {
  string = JSON.stringify(string)
  let style = {}
  if (typeof color !== 'undefined') style.color = color
  return (
    <div style={style}>{string}</div>
  )
}

export function uploadConfig() {
  const onChange = event => {
    var file = loadConfigFileInput.files[0]
    var reader = new FileReader()
    reader.onload = function() {
      console.log(reader.result)
      const config = JSON.parse(reader.result)
      console.log(config)
      store.dispatch(setConfig(config))
    }
    reader.readAsText(file);
  }
  return (
    <div>
      Upload JSON config file.
      <input type="file" id="loadConfigFileInput" onChange={onChange}/>
    </div>)
}
