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
  = "T" result:sexpr {
    return {
      result,
      definitions
    }
  }
  / sexpr

sexpr
  = _ a:atom _ { return eval(a) }
  / "(" _ ")" { return [] }
  / "(" _ "+" _ args:sexpr*  _ ")" {
    if (args.length === 0) {
      return 0
    } else {
      return args.reduce((x, y) => x + y) }
    }
  / "(" _ "quote" _ args:quoted? _ ")" { return args }
  / "'" args:quoted { return args }
  / "(" _ "def" _ s:symbol _ m:sexpr _ ")" { def(s, m) }
  / "(" _ fn:symbol _ args:sexpr*  _ ")" { return evoke(fn)(args[0]) }

quoted
  = _ "(" _ r:quoted*  _ ")" _ { return r === null ? [] : r }
  / _ a:atom _ { return a }

atom
  = symbol
  / float
  / integer

symbol
  = [a-zA-Z.+]+ [a-zA-Z.+0-9]* { return text() }

float "float"
  = [0-9]+ "." [0-9]+ { return parseFloat(text(), 10) }

integer "integer"
  = [0-9]+ { return parseInt(text(), 10) }

_ = [ \\t\\n]*
`
const parser = generate(grammar)


export default function parse(string, environment) {
  if (string === '') return
  return parser.parse(string)
}
