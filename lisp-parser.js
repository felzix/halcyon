import { generate } from 'pegjs'


const grammar = `
{
  function log(x) {
    console.log(x)
  }
}

start
  = expr

expr
  = sexpr / atom

sexpr
  = "(" _ ")" { return null }
  / "(" _ "+" _ args:list  _ ")" { return args.reduce((x, y) => x + y) }
  / "(" _ fn:symbol _ args:list  _ ")" { return eval(fn)(args[0]) }

list
  = f:expr _ r:list* { return r.length === 0 ? [f] : [f].concat(r[0]) }

atom
  = symbol
  / integer

symbol
  = [a-zA-Z.+]+ [a-zA-Z.+0-9]* { return eval(text()) }

integer "integer"
  = digits:[0-9]+ { return parseInt(digits.join(""), 10) }

_ = [ \\t\\n]*
`
const parser = generate(grammar)


export default function parse(string, environment) {
  if (string === '') return
  return parser.parse(string)
}
