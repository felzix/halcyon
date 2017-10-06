/* jshint -W061, -W054, -W086 */

import { generate } from 'pegjs'
import React from 'react'


const grammar = `
sexpr
  = _ a:atom _ { return a }
  / _ "'" arg:sexpr _ { return ['quote'].concat([arg]) }
  / _ "(" _ args:sexpr* _ ")"_  { return args === null ? [] : args }

atom
  = float
  / integer
  / boolean
  / string
  / symbol

symbol
  = symbolic+ (symbolic[0-9])* { return text() }

float
  = [0-9]+ "." [0-9]+ { return parseFloat(text(), 10) }

integer
  = [0-9]+ { return parseInt(text(), 10) }

boolean
  = "true" { return true }
  / "false" { return false }

string
  = '"' q:quoted* '"' { return '"' + q.join('') + '"' }

quoted
  = [^"\\\\]
  / '\\\\"'
  / '\\\\' { return '\\\\\\\\' }

symbolic = [a-zA-Z.+*/-]
_ = [ \\t\\n]*
`
const parser = generate(grammar)


// Returns a (usually nested) Array of strings
export function parse(string) {
  if (string === '') return
  return parser.parse(string)
}

function evoke(symbol, context) {
  const parent = context.parent
  const definitions = context.definitions
  const meaning = definitions[symbol]
  if (typeof meaning !== 'undefined') {
    return meaning
  } else if (typeof parent !== 'undefined') {
    return evoke(symbol, parent)
  } else {
    // javascript
    return eval(symbol)
  }
}

function makeArithmetic(symbol, one, many) {
  many = typeof many === 'undefined' ? one : many
  return function(...args) {
    if (args.length === 0) {
      return { error: '`' + symbol + '` must have at least 1 argument' }
    } else if (args.length === 1) {
      return one(args)
    } else {
      return many(args)
    }
  }
}

export function buildLambdaString(rest) {
  const params = rest[0]
  const locals = params.map(p => { return `['def', '${p}', ${p}]` })
  const body = rest.slice(1)
  return `
    (function(${params.join(', ')}) {
      if (arguments.length !== ${params.length}) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + ${params.length} + ' arg(s)'}
      }
      body = [
        'block',
          ${locals}]
      body = body.concat(${JSON.stringify(rest.slice(1))})
      return evaluate(body, context)
    })`
}

export const defaultContext = {
  parent: undefined,  // written here for clarity
  definitions: {
    // important language stuff
    list: (...args) => { return args },
    head: (...args) => {
      if (args.length !== 1) {
        return { error: '`head` takes exactly 1 argument' }
      } else if (!Array.isArray(args[0]) || args[0].length === 0) {
        return { error: 'argument to `head` must be a list of at least 1 element' }
      } else {
        return args[0][0]
      }
    },
    rest: (...args) => {
      if (args.length !== 1) {
        return { error: '`rest` takes exactly 1 argument' }
      } else if (!Array.isArray(args[0]) || args[0].length === 0) {
        return { error: 'argument to `rest` must be a list of at least 1 element' }
      } else {
        return args[0].slice(1)
      }
    },
    get: (...args) => {
      if (args.length !== 2 && args.length !== 3) {
        return { error: '`get` requires 2 or 3 arguments' }
      }
      const container = args[0]
      const index = args[1]
      const defaultValue = args[2]
      const value = container[index]
      if (typeof value === 'undefined') {
        if (typeof defaultValue === 'undefined') {
          return { error: 'failed to `get` index ' + index}
        } else {
          return defaultValue
        }
      } else {
        return value
      }
    },
    set: (...args) => {
      if (args.length !== 3) {
        return { error: '`set` requires 3 arguments' }
      }
      const container = args[0]
      const index = args[1]
      const value = args[2]
      container[index] = value
      return value
    },
    append: (...args) => { return [].concat(...args) },
    concat: (...args) => { return ''.concat(...args) },
    '+': makeArithmetic('+', args => { return args.reduce((x, y) => { return x + y }) }),
    '-': makeArithmetic('-', args => { return -args[0] },
                             args => { return args.reduce((x, y) => { return x - y }) }),
    '*': makeArithmetic('*', args => { return args.reduce((x, y) => { return x * y }) }),
    '/': makeArithmetic('/', args => { return 1 / args[0] },
                             args => { return args.reduce((x, y) => { return x / y }) }),
    // awesome stuff
    react: (...args) => {
      const tag = args[0]
      const props = null  // TODO args[1]
      const children = args.slice(1)  // TODO args.slice(2)
      return React.createElement(tag, props, children)
    }
  }
}

export function evaluate(tree, context) {
  if (typeof tree !== 'object') {
    return evoke(tree, context)
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
    case 'def': {
      if (rest.length !== 2) {
        return { error: '`def` must have exactly 2 arguments' }
      } else {
        const symbol = rest[0]
        const value = evaluate(rest[1], context)
        context.definitions[symbol] = value
        return value
      }
      break
    }
    case 'block': {
      const blockContext = { parent: context, definitions: {} }
      let finalValue
      for (let i = 0; i < rest.length; i++) {
        finalValue = evaluate(rest[i], blockContext)
      }
      return finalValue
    }
    case 'lambda': {
      if (rest.length < 2) {
        return { error: '`lambda` must have an arguments list and at least one statement' }
      } else {
        const params = rest[0]
        let body = rest[1]
        // context comes from the local scope right here
        return eval(buildLambdaString(rest))
      }
    }
    default: {
      if (Array.isArray(first)) {
        first = evaluate(first, context)
      } else {
        first = evoke(first, context)
      }
    }
  }

  switch (typeof first) {
    case 'function': {
      rest = rest.map(s => { return evaluate(s, context) })
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
}

export function makeInterpreter() {
  const globalContext = Object.assign({}, defaultContext)
  return input => {
    return evaluate(parse(input), globalContext)
  }
}

export default function (string) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    return evaluate(tree, Object.assign({}, defaultContext))
  }
}
