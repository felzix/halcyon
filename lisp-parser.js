/* jshint -W061, -W054, -W086 */

import 'babel-polyfill'  // necessary for await/async to work
import $ from 'jquery'
import { generate } from 'pegjs'
import React from 'react'
import uuid4 from 'uuid'
import CodeMirror from 'react-codemirror'  // TODO refactor away

import { GeneratedElement, Editor, uploadConfig } from './results'
import node from './node'


// TODO ignore commas in mappings
// TODO mapping value (and maybe key?) cannot have a number in a symbol but should be allowed to
//      ex: {"Cmd-S": save2}
const grammar = `
{
  function log(thing) {
    f(thing)
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
  / nil
  / null
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
  = symbolic latterSymbolic* { return Symbol.for(text()) }

float
  = "-"?[0-9]+ "." [0-9]+ { return parseFloat(text(), 10) }

integer
  = "-"?[0-9]+ { return parseInt(text(), 10) }

boolean
  = "true" { return true }
  / "false" { return false }

nil
  = "nil" { return undefined }

null
  = "null" { return null }

string
  = '"' q:quoted* '"' { return q.join('') }

quoted
  = [^"\\\\]
  / '\\\\"' { return '"' }
  / '\\\\'

symbolic = [a-zA-Z:;_$!?><=+*/-]
latterSymbolic = [0-9a-zA-Z:;_$!?><=+*/-]
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
  const meaning = definitions[description(symbol)]
  if (typeof meaning !== 'undefined') {
    return meaning
  } else if (typeof parent !== 'undefined') {
    return evoke(symbol, parent)
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

export function buildLambda(rest, blockType, context) {
    const params = rest[0].map(p => { return description(p) })
    const justBody = rest.slice(1)

    return async function() {
        let body = [
            Symbol.for(blockType),
            [
                Symbol.for('def'),
                Symbol.for('arguments'),
                [
                    Symbol.for('quote'),
                    arguments
                ]
            ]
        ]

        for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const arg = arguments[i]
            body.push([
                Symbol.for('def'),
                Symbol.for(param),
                [
                    Symbol.for('quote'),
                    arg
                ]
            ])
        }

        body = body.concat(justBody)
        return await evaluate(body, context)
    }

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
  'if': async (context, rest) => {
    if (rest.length < 2 || rest.length > 3) {
      return { error: '`if` must have 2 or 3 arguments'}
    }
    let condition = rest[0]
    let then = rest[1]
    let else_ = rest[2]
    condition = await evaluate(condition, context)
    if (condition) {
      return await evaluate(then, context)
    } else if (typeof else_ !== 'undefined') {
      return await evaluate(else_, context)
    }
  },
  'or': async (context, rest) => {
    // TODO enable support for [0, inf) arguments
    if (rest.length !== 2) {
        return { error: '`or` must have exactly 2 argumenst'}
    }
    const first = await evaluate(rest[0], context)
    if (first) {
        return first
    }
    const second = await evaluate(rest[1], context)
    return second
  },
  'and': async (context, rest) => {
    // TODO enable support for [0, inf) arguments
    if (rest.length !== 2) {
        return { error: '`and` must have exactly 2 argumenst'}
    }
    const first = await evaluate(rest[0], context)
    if (!first) {
        return false
    }
    const second = await evaluate(rest[1], context)
    return Boolean(second)
  },
  'while': async (context, rest) => {
    if (rest.length !== 2) {
        throw Error("`while` must have exactly 2 arguments")
    }
    const condition = rest[0]
    const statement = rest[1]
    let value
    while (await evaluate(condition, context)) {
        value = await evaluate(statement, context)
    }
    return value
},
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
  define: async (context, rest) => {
    if (rest.length !== 2) {
      return { error: '`def` must have exactly 2 arguments' }
    } else {
      const symbol_string = await evaluate(rest[0], context)
      const value = await evaluate(rest[1], context)
      context.definitions[symbol_string] = value
      return value
    }
  },
  block: async (context, rest) => {
    const blockContext = {
      uid: `block-${uuid4()}`,
      parent: context,
      definitions: {}
    }
    blockContext.definitions.this = blockContext

    // probably not useful *here* but is consistent with `load`
    const originalChild = context.child
    context.child = blockContext

    let finalValue
    for (let i = 0; i < rest.length; i++) {
      finalValue = await evaluate(rest[i], blockContext)
    }
    context.child = originalChild
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
      return buildLambda(rest, 'block', context)
    }
  },
  'lambda!': (context, rest) => {
    if (rest.length < 2) {
      return { error: '`lambda` must have an arguments list and at least one statement' }
    } else {
      return buildLambda(rest, 'block!', context)  // note the `!`
    }
  },
  eval: async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`eval` must have exactly 1 argument' }
    } else {
      const arg = await evaluate(rest[0], context)
      const body = `(block! ${arg})`
      return await evaluate(parser.parse(body), context)
    }
  },
  '.': async (context, rest) => {
    if (rest.length < 2) {
      return { error: '`.` takes at least 2 arguments' }
    } else {
      let container = await evaluate(rest[0], context)
      let self = container
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
      if (typeof container === 'function') {
          container.__lisp_bind = self
      }
      return container
    }
  },
  load: async (context, rest) => {
    if (rest.length !== 1 && rest.length !== 2) {
      return { error: '`load` takes 1 or 2 arguments' }
    } else {
      const defMapping = rest[0]
      const targetContext = typeof rest[1] === 'undefined'
        ? context : await evaluate(rest[1], context)
      const definitions = await evaluate(defMapping, context)
      const newOlderSister = {
        uid: `sister-${uuid4()}`,
        child: targetContext,
        definitions: targetContext.definitions
      }
      if (typeof targetContext.parent !== 'undefined') {
        newOlderSister.parent = targetContext.parent
        newOlderSister.parent.child = newOlderSister
      }
      targetContext.parent = newOlderSister
      targetContext.definitions = definitions

      return targetContext  // yes, actually returns context to user; TODO read-only
    }
  },
  unload: async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`unload` takes exactly 1 argument' }
    } else {
      const contextToUnload = await evaluate(rest[0], context)
      console.log("unload", contextToUnload)
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
  },
  'throw': async (context, rest) => {
    if (rest.length !== 1) {
      return { error: '`throw` must have exactly 1 argument' }
    }
    throw rest[0]
  },
  'try': async (context, rest) => {
      if (rest.length !== 2) {
        return { error: '`try` must have exactly 2 arguments' }
      }

      try {
          return await evaluate(rest[0], context)
      } catch (err) {
          const tryContext = {
            uid: `try-${uuid4()}`,
            parent: context,
            definitions: { err }
          }
          tryContext.definitions.this = tryContext
          // probably not useful *here* but is consistent with `load`
          const originalChild = context.child
          context.child = tryContext

          const value = await evaluate(rest[1], tryContext)
          context.child = originalChild
          return value
      }
  }
}

export const defaultContext = {
  uid: "default",
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
    type: (...args) => {
      if (args.length !== 1) {
        return { error: '`type` takes exactly 1 argument'}
      }
      return typeof args[0]
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
    length: (...args) => { return args[0].length },
    '+': makeArithmetic('+', args => { return args.reduce((x, y) => { return x + y }) }),
    '-': makeArithmetic('-', args => { return -args[0] },
                             args => { return args.reduce((x, y) => { return x - y }) }),
    '*': makeArithmetic('*', args => { return args.reduce((x, y) => { return x * y }) }),
    '/': makeArithmetic('/', args => { return 1 / args[0] },
                             args => { return args.reduce((x, y) => { return x / y }) }),
    'not': (...args) => { return ! args[0] },
    // TODO make comparisons accept many inputs. true if chaining is 100% correct
    // ex: (> 5 3 1) -> true ; (> 5 1 3) -> false
    '>': (...args) => {
      if (args.length !== 2) {
        return { error: '`>` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left > right
    },
    '<': (...args) => {
      if (args.length !== 2) {
        return { error: '`<` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left < right
    },
    '>=': (...args) => {
      if (args.length !== 2) {
        return { error: '`>=` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left >= right
    },
    '<=': (...args) => {
      if (args.length !== 2) {
        return { error: '`<=` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left <= right
    },
    '==': (...args) => {
      if (args.length !== 2) {
        return { error: '`==` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left === right
    },
    '!=': (...args) => {
      if (args.length !== 2) {
        return { error: '`!=` must have exactly 2 arguments'}
      }
      const left = args[0]
      const right = args[1]
      return left !== right
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
    keys: (...args) => {
     if (args.length !== 1) {
       return { error: '`keys` takes exactly 1 argument' }
     }
     return Object.keys(args[0])
    },
    values: (...args) => {
     if (args.length !== 1) {
       return { error: '`values` takes exactly 1 argument' }
     }
     return Object.values(args[0])
    },
    'new': (...args) => {
      if (args.length === 0) {
        return { error: '`new` takes at least 1 argument' }
      }
      return new args[0](...args.slice(1))
    },
    // awesome stuff
    react: (...args) => {
      if (args.length === 0) {
        return { error: '`react` requires at least 1 argument' }
      }
      const tag = args[0]
      const props = args[1]
      // const children = args[2]

      let children
      if (Array.isArray(args[2])) {
          children = args[2]
      } else {
          children = args.slice(2)
      }
      return React.createElement(tag, props, ...children)
    },
    'vis': (...args) => {
      if (args.length !== 1) {
        return { error: '`vis` requires at exactly 1 argument' }
      }
      const dom = args[0]
      return React.createElement(GeneratedElement, { dom })
    },
    serialize: (...args) => {
      if (args.length !== 1) {
        return { error: '`serialize` requires exactly 1 argument' }
      }
      const thing = args[0]
      return JSON.stringify(thing)
    },
    unserialize: (...args) => {
      if (args.length !== 1) {
        return { error: '`unserialize` requires exactly 1 argument' }
      }
      const string = args[0]
      return JSON.parse(string)
    },
    id: (...args) => {
      if (args.length !== 1) {
        return { error: '`id` requires exactly 1 argument' }
      }
      return args[0]
    },
    config: (...args) => { return uploadConfig() },
    node: async (...args) => {
      if (args.length !== 1) {
        return { error: '`node` requires exactly 1 argument' }
      }
      const urn = args[0]
      // TODO get defaults from config
      let { owner, name, version } = node.decodeNodeURN(urn, 'robert', 'unversioned')
      owner = encodeURIComponent(owner)
      name = encodeURIComponent(name)
      version = encodeURIComponent(version)
      try {
        const datum = await $.ajax({
          type: "GET",
          url: `http://localhost:41814/${owner}/${name}/${version}`
        })
        return datum
      } catch (err) {
        console.log(err)  // TODO handle 404s correctly and escalate the rest
      }
    },
    nodes: async (...args) => {
      if (args.length > 2) {
        return { error: '`nodes` requires 0 to 2 arguments' }
      }

      const unwrap = wrapper => {
        return wrapper.nodes
      }

      switch(args.length) {
        case 0: {  // list owners
          return unwrap(await $.ajax({
            type: "GET",
            url: `http://localhost:41814/`
          }))
        }
        case 1: {  // list names
          return unwrap(await $.ajax({
            type: "GET",
            url: `http://localhost:41814/${args[0]}`
          }))
        }
        case 2: {  // list versions
          return unwrap(await $.ajax({
            type: "GET",
            url: `http://localhost:41814/${args[0]}/${args[1]}`
          }))
        }
      }
    },
    save: async (...args) => {
      if (args.length !== 2) {
        return { error: '`save` requires exactly 2 arguments' }
      }
      const urn = args[0]
      const data = args[1]
      // TODO get defaults from config
      let { owner, name, version } = node.decodeNodeURN(urn, 'robert', 'unversioned')
      owner = encodeURIComponent(owner)
      name = encodeURIComponent(name)
      version = encodeURIComponent(version)
      try {
        const datum = await $.ajax({
          type: "PUT",
          url: `http://localhost:41814/${owner}/${name}/${version}`,
          dataType: "text/plain",
          contentType: "text/plain",
          data
        })
        return datum
      } catch (err) {
        console.error(err)  // TODO should escalate instead
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
    log: (...args) => {
      console.log(...args)
    },
    Editor: Editor,  // TODO this feels wrong,
    CodeMirror: CodeMirror  // TODO should not be!
  }
}

export async function evaluate(tree, context) {
  if (typeof context === 'undefined') {
    throw 'Function `evaluate` must be called with a context.'
  }

  if (typeof tree === 'undefined') {
      return tree  // nil
  } else if (tree === null) {
      return tree  // null
  } else if (typeof tree !== 'object') {
    return evoke(tree, context)
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
      first = evoke(first, context)
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

      // __lisp_bind allow methods to work at all. note that undefined is the default for apply
      let result = first.apply(first.__lisp_bind, rest)
      if (typeof result !== 'undefined' && result.constructor === Promise) {
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

export function makeInterpreter(globalContext) {
  globalContext = copyContext(globalContext)
  const interpreter = function() {
    this.globalContext = globalContext
  }

  interpreter.prototype = {
    addToContext: function(nameOfThing, thing) {
      this.globalContext.definitions[nameOfThing] = thing
    },
    eval: async function(input) {
      return await evaluate(parse(input), this.globalContext)
    }
  }
  const inst = new interpreter()
  inst.addToContext('global', globalContext)
  return inst
}

export default async function(string) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    const context = copyContext(defaultContext)
    context.definitions['global'] = context
    return await evaluate(tree, context)
  }
}

function copyContext(context) {
  const newContext = Object.assign({ definitions: {} }, context)
  newContext.definitions = Object.assign({}, newContext.definitions)
  return newContext
}
