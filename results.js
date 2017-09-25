import React from 'react'


export function text(string, color) {
  string = JSON.stringify(string)
  let style = {}
  if (typeof color !== 'undefined') style.color = color
  return (
    <div style={style}>{string}</div>
  )
}
