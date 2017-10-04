/* jshint -W061, -W086 */

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

function makeHelper(definitions, evoke) {
  const helper = tree => {
    if (typeof tree !== 'object') {
      return evoke(tree)
    } else if (tree.length === 0){
      return []
    }

    let first = tree[0]
    let rest = tree.slice(1)
    // if first is built-in then pass off to that
    // if first is in definitions then pass off to that
    //     if that's a macro then do macro-y things
    //     if that's a function then evaluate
    //     otherwise error
    switch (first) {
      case "quote": {
        if (rest.length !== 1) {
          return { error: '`quote` must have exactly 1 argument' }
        } else {
          return rest[0]  // don't interpret the rest
        }
      }
      case "+": {
        first = add
        break
      }
      default: {
        first = evoke(first)
      }
    }

    switch (typeof first) {
      case 'function': {
        rest = rest.map(helper)
        return first(...rest)
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

  return helper
}

function add(...args) {
  if (args.length === 0) {
    return 0
  } else {
    return args.reduce((x, y) => { return x + y })
  }
}

export function evaluate(root, env) {
  const definitions = [ {} ]

  const evoke = makeEvoke(definitions)
  const helper = makeHelper(definitions, evoke)

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
