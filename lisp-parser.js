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

export function evaluate(tree, env) {

}

export default function (string, environment) {
  const tree = parse(string)
  return evaluate(tree, environment)
}
