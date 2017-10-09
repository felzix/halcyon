/* jshint -W061, -W054, -W086 */

import 'babel-polyfill'  // necessary for await/async to work
import $ from 'jquery'
import { generate } from 'pegjs'
import React from 'react'

import node from './node'


const grammar = `
sexpr
  = _ a:atom _ { return a }
  / _ "'" arg:sexpr _ { return [Symbol.for('quote')].concat([arg]) }
  / _ "(" _ args:sexpr* _ ")"_  { return args === null ? [] : args }

atom
  = float
  / integer
  / boolean
  / string
  / symbol

symbol
  = symbolic+ (symbolic[0-9])* { return Symbol.for(text()) }

float
  = [0-9]+ "." [0-9]+ { return parseFloat(text(), 10) }

integer
  = [0-9]+ { return parseInt(text(), 10) }

boolean
  = "true" { return true }
  / "false" { return false }

string
  = '"' q:quoted* '"' { return q.join('') }

quoted
  = [^"\\\\]
  / '\\\\"' { return '"' }
  / '\\\\'

symbolic = [a-zA-Z.+*/-]
_ = [ \\t\\n]*
`
const parser = generate(grammar)

// Returns a (usually nested) Array of strings
export function parse(string) {
  if (string === '') return
  return parser.parse(string)
}

async function evoke(symbol, context) {
  const parent = context.parent
  const definitions = context.definitions
  const meaning = definitions[description(symbol)]
  if (typeof meaning !== 'undefined') {
    return meaning
  } else if (typeof parent !== 'undefined') {
    return await evoke(symbol, parent)
  } else if (typeof symbol === 'string') {
    return symbol
  } else if (typeof symbol === 'number') {
    return symbol
  } else if (typeof symbol === 'boolean') {
    return symbol
  } else if (typeof symbol === 'symbol') {
    // javascript
    return eval(description(symbol))
  } else {
    throw `symbol "${String(symbol)}" has unhandled type "${typeof symbol}"`
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
  const params = rest[0].map(p => { return description(p) })
  const locals = params.map(p => { return `[Symbol.for('def'), Symbol.for('${p}'), ${p}]` })
  const body = toJavascript(rest.slice(1))
  return `
    (async function(${params.join(', ')}) {
      if (arguments.length !== ${params.length}) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + ${params.length} + ' arg(s)'}
      }
      let body = [
        Symbol.for('block'),
          ${locals}]
      body = body.concat(${body})
      return await evaluate(body, context)
    })`
}

// Necessary because JSON.stringify cannot handle Symbols
function toJavascript(tree) {
  const type = typeof tree
  if (type === 'symbol') {
    return `Symbol.for('${description(tree)}')`
  } else if (type === 'string') {
    return `"${tree}"`
  } else if (Array.isArray(tree)) {
    const elements = tree.map(e => { return toJavascript(e) })
    return `[${elements.join(', ')}]`
  } else {
    return tree
  }
}

function description(symbol) {
  return String(symbol).slice(7, -1) || null
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
      if (args.length < 2) {
        return { error: '`react` requires at least 2 arguments' }
      }
      const tag = args[0]
      const props = null  // TODO args[1]
      const children = args.slice(1)  // TODO args.slice(2)
      return React.createElement(tag, props, children)
    },
    node: async (...args) => {
      if (args.length !== 1) {
        return { error: '`node` requires exactly 1 argument' }
      }
      const urn = args[0]
      const { owner, name, version } = node.decodeNodeURN(urn)
      const datum = await $.ajax({
        type: "GET",
        url: `http://localhost:41814/${owner}/${name}/${version}`
      })
      return datum
    },
    save: async (...args) => {
      if (args.length !== 2) {
        return { error: '`save` requires exactly 2 arguments' }
      }
      const urn = args[0]
      const data = args[1]
      const { owner, name, version } = node.decodeNodeURN(urn)
      const datum = await $.ajax({
        type: "PUT",
        url: `http://localhost:41814/${owner}/${name}/${version}`,
        dataType: "text/plain",
        contentType: "text/plain",
        data
      })
      return datum
    }
  }
}

export async function evaluate(tree, context) {
  if (typeof tree !== 'object') {
    return await evoke(tree, context)
  } else if (tree.length === 0){
    return []
  }

  let first = tree[0]
  let rest = tree.slice(1)
  if (typeof first === 'symbol') {
    switch (description(first)) {
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
          const value = await evaluate(rest[1], context)
          context.definitions[description(symbol)] = value
          return value
        }
        break
      }
      case 'block': {
        const blockContext = { parent: context, definitions: {} }
        let finalValue
        for (let i = 0; i < rest.length; i++) {
          finalValue = await evaluate(rest[i], blockContext)
        }
        return finalValue
      }
      case 'lambda': {
        if (rest.length < 2) {
          return { error: '`lambda` must have an arguments list and at least one statement' }
        } else {
          // context comes from the local scope right here
          return eval(buildLambdaString(rest))
        }
      }
      case 'eval': {
        if (rest.length !== 1) {
          return { error: '`eval` must have exactly 1 argument' }
        } else {
          const arg = await evaluate(rest[0], context)
          const body = `(block ${arg})`
          return await evaluate(parser.parse(body), context)
        }
      }
      default: {
        first = await evoke(first, context)
        // TODO throw error if first isn't something?
      }
    }
  } else if (Array.isArray(first)) {
    first = await evaluate(first, context)  // first arg is a function call
  }

  switch (typeof first) {
    case 'function': {
      for (let i = 0; i < rest.length; i++) {
        rest[i] = await evaluate(rest[i], context)
      }
      let result = first(...rest)
      if (result.constructor === Promise) {
        result = await result
      }
      return result
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
  return async input => {
    return await evaluate(parse(input), globalContext)
  }
}

export default async function (string) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    return await evaluate(tree, Object.assign({}, defaultContext))
  }
}
