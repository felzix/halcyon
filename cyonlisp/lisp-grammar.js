import { generate } from "pegjs"


const grammar = `
{
  function log(thing) {
    console.log(thing)
  }
}


sexpr
  = _ comment _ { return Symbol.for("__lisp_comment") }
  / _ d:dotty _ { return d }
  / _ a:atom _ { return a }
  / _ s:shorthandQuote _ { return s }
  / _ l:list _  { return l }
  / _ m:mapping _ { return m }

comment
  = "/*" commented* "*/"

commented
  = [^*]
  / "\\\\*"
  / "*" [^/]
  / "*\\\\/"
  / "*" [^/]

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
  = symbolic latterSymbolic* { return Symbol.for(text()) }

float
  = "-"?[0-9]+ "." [0-9]+ { return parseFloat(text(), 10) }

integer
  = "-"?[0-9]+ { return parseInt(text(), 10) }

boolean
  = "true" { return true }
  / "false" { return false }

string
  = '"' q:quoted* '"' { return q.join('') }

quoted
  = [^"\\\\]
  / '\\\\"' { return '"' }
  / '\\\\'

symbolic = [a-zA-Z:;_$!?><=+*/-]
latterSymbolic = [0-9a-zA-Z:;_$!?><=+*/-]
_ = [ \\t\\n,]*
`

module.exports = generate(grammar)
