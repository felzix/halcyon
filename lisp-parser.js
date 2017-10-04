/* jshint -W061 */

import { generate } from 'pegjs'


const grammar = `
{
  function log(x) {
    console.log(x)
  }

  const definitions = [{}]
  let scope = 0

  function evoke(symbol) {
    // lisp
    for (let i = definitions.length; i > 0; i--) {
      const meaning = definitions[scope][symbol]
      if (typeof meaning !== 'undefined') {
        return meaning
      }
    }
    // javascript
    return eval(symbol)
  }

  function def(symbol, meaning) {
    definitions[scope][symbol] = meaning
  }

  function moreScope() {
    definitions.push({})
    scope += 1
  }

  function lessScope() {
    definitions.pop()
    scope -= 1
  }
}

start
  = sexpr

sexpr
  = _ a:atom _ { return a }
  / "'" args:sexpr+ { return ['quote'].concat(args) }
  / "(" _ args:sexpr* _ ")" { return args === null ? [] : args }

atom
  = float
  / integer
  / symbol

symbol
  = [a-zA-Z.+]+ [a-zA-Z.+0-9]* { return text() }

float
  = [0-9]+ "." [0-9]+ { return text() }

integer
  = [0-9]+ { return text() }

_ = [ \\t\\n]*
`
const parser = generate(grammar)


// Returns a (usually nested) Array of strings
export function parse(string) {
  if (string === '') return
  return parser.parse(string)
}

function makeEvoke(definitions) {
  return symbol => {
    // lisp
    for (let i = definitions.length - 1; i > 0; i--) {
      const meaning = definitions[i][symbol]
      if (typeof meaning !== 'undefined') {
        return meaning
      }
    }
    // javascript
    return eval(symbol)
  }
}

function makeHelper(definitions) {
  return tree => {
    if (tree.length === 0) return []

    let first = tree[0]
    // if first is built-in then pass off to that
    // if first is in definitions then pass off to that
    //     if that's a macro then do macro-y things
    //     if that's a function then evaluate
    //     otherwise error
    switch (first) {
      case "quote": {
        return tree.slice(1)  // return the rest without interpretation
      }
    }

    first = evoke(first)
    switch (typeof first) {
      case 'function': {
        // TODO evaluate arguments first then return first(*args)
        return first
        break
      }
      case 'macro': {
        // TODO this is theoretical right now
        break
      }
      default: {
        // TODO throw an error
      }
    }

    for (let i = 0; i < tree.length; i++) {
      const element = tree[i]
      switch(element) {
        case "+":
      }
    }
  }
}

export function evaluate(root, env) {
  const definitions = [ {} ]

  const evoke = makeEvoke(definitions)
  const helper = makeHelper(definitions)

  switch (typeof root) {
    case "string": {
      return evoke(root)
    }
    case "object": {
      return helper(root)
    }
  }
}

export default function (string, environment) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    return evaluate(tree, environment)
  }
}
