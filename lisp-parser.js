/* jshint -W061, -W054, -W086 */

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

function evoke(context, symbol) {
  const parent = context.parent
  const definitions = context.definitions
  const meaning = definitions[symbol]
  if (typeof meaning !== 'undefined') {
    return meaning
  } else if (typeof parent !== 'undefined') {
    return evoke(parent, symbol)
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
    (${params.join(', ')}) => {
      body = [
        'block',
          ${locals}]
      body = body.concat(${JSON.stringify(rest.slice(1))})
      return evaluate(body, context)
    }`
}

const defaultContext = {
  parent: undefined,  // written here for clarity
  definitions: {
    list: (...args) => { return args },
    '+': makeArithmetic('+', args => { return args.reduce((x, y) => { return x + y }) }),
    '-': makeArithmetic('-', args => { return -args[0] },
                             args => { return args.reduce((x, y) => { return x - y }) }),
    '*': makeArithmetic('*', args => { return args.reduce((x, y) => { return x * y }) }),
    '/': makeArithmetic('/', args => { return 1 / args[0] },
                             args => { return args.reduce((x, y) => { return x / y }) }),
  }
}

export function evaluate(tree, context) {
  context = typeof context === 'undefined' ? Object.assign({}, defaultContext) : context

  if (typeof tree !== 'object') {
    return evoke(context, tree)
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
      first = evoke(context, first)
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

export default function (string) {
  const tree = parse(string)
  if (typeof tree !== 'undefined') {
    return evaluate(tree)
  }
}
