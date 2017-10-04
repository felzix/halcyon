/* jshint -W061, -W086 */

import { generate } from 'pegjs'


const grammar = `
sexpr
  = _ a:atom _ { return a }
  / _ "'" args:sexpr+ _ { return ['quote'].concat(args) }
  / _ "(" _ args:sexpr* _ ")"_  { return args === null ? [] : args }

atom
  = float
  / integer
  / boolean
  / symbol

symbol
  = symbolic+ (symbolic[0-9])* { return text() }

symbolic = [a-zA-Z.+*/-]

float
  = [0-9]+ "." [0-9]+ { return text() }

integer
  = [0-9]+ { return text() }

boolean
  = "true" { return text() }
  / "false" { return text() }

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
    for (let i = definitions.length - 1; i >= 0; i--) {
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
      case "-": {
        first = subtract
        break
      }
      case "*": {
        first = multiply
        break
      }
      case "/": {
        first = divide
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
    return { error: '`+` must have at least 1 argument' }
  } else {
    return args.reduce((x, y) => { return x + y })
  }
}

function subtract(...args) {
  if (args.length === 0) {
    return { error: '`-` must have at least 1 argument' }
  } else if (args.length === 1){
    return -args[0]
  } else {
    return args.reduce((x, y) => { return x - y })
  }
}

function multiply(...args) {
  if (args.length === 0) {
    return { error: '`*` must have at least 1 argument' }
  } else {
    return args.reduce((x, y) => { return x * y })
  }
}

function divide(...args) {
  if (args.length === 0) {
    return { error: '`/` must have at least 1 argument' }
  } else if (args.length === 1) {
    return 1 / args[0]
  } else {
    return args.reduce((x, y) => { return x / y })
  }
}

export function evaluate(root, env) {
  const definitions = [{
    list: (...args) => { return args }
  }]

  const evoke = makeEvoke(definitions)
  const helper = makeHelper(definitions, evoke)

  return helper(root)
}

export default function (string, environment) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    return evaluate(tree, environment)
  }
}
