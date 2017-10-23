/* jshint -W061, -W054, -W086 */

import 'babel-polyfill'  // necessary for await/async to work
import $ from 'jquery'
import { generate } from 'pegjs'
import React from 'react'

import { Editor, uploadConfig } from './results'
import node from './node'


const grammar = `
{
  function log(thing) {
    console.log(thing)
  }
}

sexpr
  = _ d:dotty _ { return d }
  / _ a:atom _ { return a }
  / _ s:shorthandQuote _ { return s }
  / _ l:list _  { return l }
  / _ m:mapping _ { return m }

atom
  = float
  / integer
  / boolean
  / string
  / symbol
  / "." { return Symbol.for(".") }

list
  = "(" _ args:sexpr* _ ")" { return args === null ? [] : args }

mapping
  = "{" p:pair* "}" { return [Symbol.for('mapping'), [Symbol.for('list')].concat(p)] }

pair
  = _ k:sexpr _ ":" _ v:sexpr _ { return [Symbol.for('list'), k, v] }

dotty
  = f:symbol r:innerDotty+ { return [Symbol.for("."), f].concat(r) }

innerDotty
  = "." a:symbol { return a }
  / "." a:atom { return a }
  / "." a:shorthandQuote { return a }
  / "." a:list { return a }

shorthandQuote
  = "'" arg:sexpr { return [Symbol.for('quote')].concat([arg]) }

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

symbolic = [a-zA-Z!+*/-]
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

export function buildLambdaString(rest, block) {
  const params = rest[0].map(p => { return description(p) })
  const locals = params.map(p => { return `[Symbol.for('def'), Symbol.for('${p}'), ${p}]` })
  const body = toJavascript(rest.slice(1))
  return `
    (async function(${params.join(', ')}) {
      if (arguments.length !== ${params.length}) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + ${params.length} + ' arg(s)'}
      }
      let body = [
        Symbol.for('${block}'),
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

const builtins = {
  quote: (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`quote` must have exactly 1 argument' }
    } else {
      return rest[0]  // don't interpret the rest
    }
  },
  def: async (context, rest) => {
    if (rest.length !== 2) {
      return { error: '`def` must have exactly 2 arguments' }
    } else {
      const symbol = rest[0]
      const value = await evaluate(rest[1], context)
      context.definitions[description(symbol)] = value
      return value
    }
  },
  block: async (context, rest) => {
    const blockContext = { parent: context, definitions: {} }
    context.child = blockContext  // probably not useful *here* but is consistent with `load`
    let finalValue
    for (let i = 0; i < rest.length; i++) {
      finalValue = await evaluate(rest[i], blockContext)
    }
    return finalValue
  },
  'block!': async (context, rest) => {  // syntactic necessity
    let finalValue
    for (let i = 0; i < rest.length; i++) {
      finalValue = await evaluate(rest[i], context)
    }
    return finalValue
  },
  lambda: (context, rest) => {
    if (rest.length < 2) {
      return { error: '`lambda` must have an arguments list and at least one statement' }
    } else {
      // context comes from the local scope right here
      return eval(buildLambdaString(rest, 'block'))
    }
  },
  'lambda!': (context, rest) => {
    if (rest.length < 2) {
      return { error: '`lambda` must have an arguments list and at least one statement' }
    } else {
      // context comes from the local scope right here
      return eval(buildLambdaString(rest, 'block!'))  // note the `!`
    }
  },
  eval: async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`eval` must have exactly 1 argument' }
    } else {
      const arg = await evaluate(rest[0], context)
      const body = `(block ${arg})`
      return await evaluate(parser.parse(body), context)
    }
  },
  '.': async (context, rest) => {
    if (rest.length < 2) {
      return { error: '`.` takes at least 2 arguments' }
    } else {
      let container = await evaluate(rest[0], context)
      const elements = rest.slice(1)
      for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        if (typeof element === 'symbol') {
          element = description(element)
        } else {
          element = await evaluate(element, context)
        }
        container = container[element]
      }
      return container
    }
  },
  load: async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`load` takes exactly 1 argument' }
    } else {
      const definitions = await evaluate(rest[0], context)
      const newOlderSister = Object.assign({}, context)
      newOlderSister.child = context
      context.parent = newOlderSister
      if (typeof newOlderSister.parent !== 'undefined') {
        newOlderSister.parent.child = newOlderSister
      }
      context.definitions = definitions
      return context  // yes, actually returns context to user; TODO read-only
    }
  },
  unload: async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`unload` takes exactly 1 argument' }
    } else {
      const contextToUnload = await evaluate(rest[0], context)
      if (contextToUnload.parent) {
        contextToUnload.parent.child = contextToUnload.child
      }
      if (contextToUnload.child) {
        contextToUnload.child.parent = contextToUnload.parent
      }

      if (contextToUnload === context) {  // must have some context so use parent
        Object.assign(context, contextToUnload.parent)
      }
    }
  }
}

export const defaultContext = {
  parent: undefined,  // written here for later clarity
  child: undefined,  // written here for later clarity
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
    config: (...args) => {
      return uploadConfig()
    },
    node: async (...args) => {
      if (args.length !== 1) {
        return { error: '`node` requires exactly 1 argument' }
      }
      const urn = args[0]
      // TODO get defaults from config
      const { owner, name, version } = node.decodeNodeURN(urn, 'robert', 'unversioned')
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
      const { owner, name, version } = node.decodeNodeURN(urn, 'robert', 'unversioned')
      const datum = await $.ajax({
        type: "PUT",
        url: `http://localhost:41814/${owner}/${name}/${version}`,
        dataType: "text/plain",
        contentType: "text/plain",
        data
      })
      return datum
    },
    mapping: (...args) => {
      if (args.length !== 1) {
        return { error: '`mapping` takes exactly 1 argument' }
      } else {
        const pairs = args[0]
        const mapping = {}
        for (let i = 0; i < pairs.length; i++) {
          const [key, value] = pairs[i]
          mapping[key] = value
        }
        return mapping
      }
    },
    http: {
      get: async (url, params) => {
        return await $.ajax({
          type: "GET",
          url: `http://localhost:41815/${url}`
        })
      }
    },
    edit: (...args) => {
      const initialText = args.length === 0 ? '' : args[0]
      return React.createElement(Editor,
        { value: initialText, options: { lineNumbers: true } })
    }
  }
}

export async function evaluate(tree, context) {
  if (typeof context === 'undefined') {
    throw 'Function `evaluate` must be called with a context.'
  } else if (typeof tree !== 'object') {
    return await evoke(tree, context)
  } else if (tree.length === 0){
    return []
  }

  let first = tree[0]
  let rest = tree.slice(1)
  if (typeof first === 'symbol') {
    const builtin = builtins[description(first)]
    if (typeof builtin !== 'undefined') {  // first is a builtin
      return builtin(context, rest)
    } else {  // first is a function
      first = await evoke(first, context)
      // TODO throw error if first isn't something?
    }
  } else if (Array.isArray(first)) {  // first is a list; evaluate it before moving on
    first = await evaluate(first, context)
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
