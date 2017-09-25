import React from 'react'


export function text(string, color) {
  let style = {}
  if (typeof color !== 'undefined') style.color = color
  return (
    <div style={style}>{string}</div>
  )
}
