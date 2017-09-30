import { generate } from 'pegjs'


const grammar = `
{
  function makeInteger(o) {
    return parseInt(o.join(""), 10);
  }

  function flatten(list) {
    const helper = list => {
      let final = []
      for (let i = 0; i < list.length; i++) {
        const element = list[i]
        if (element instanceof Array) {
          final = final.concat(helper(element))
        } else {
          final.push(element)
        }
      }
      return final
    }
    return helper(list)
  }

  function removeSpaces(list) {
    return list.filter(e => { return e !== ' ' })
  }

}

start
  = atom
  / sexpr

sexpr
  = "(" _ ")" { return null }
  / "(" _ "+" _ args:list  _ ")" { args = removeSpaces(flatten(args)); return flatten(args).reduce((x, y) => x + y) }
  / "(" _ fn:symbol _ args:list  _ ")" { return eval(fn)(args[0]) }

list
  = f:expr _ r:list* { return [f, r] }

expr
  = sexpr / atom

atom
  = symbol
  / integer

symbol
  = [a-zA-Z.+]+ [a-zA-Z.+0-9]* { return eval(text()) }

integer "integer"
  = digits:[0-9]+ { return makeInteger(digits) }

_ = [ \\t\\n]*
`
const parser = generate(grammar)


export default function parse(string, environment) {
  if (string === '') return
  return parser.parse(string)
}
