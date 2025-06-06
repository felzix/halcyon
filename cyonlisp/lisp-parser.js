/* eslint-disable react/display-name, no-console, no-constant-condition */

import "babel-polyfill"  // necessary for await/async to work
import $ from "jquery"
import promiseSequential from "promise-sequential"
import uuid4 from "uuid"
import React from "react"
import createReactClass from "create-react-class"
import CodeMirror from "react-codemirror"  // TODO refactor away

import { Editor, uploadConfig } from "./../results"
import node from "./../node"

import parser from "./lisp-grammar"
import { description, makeArithmetic, isPromise, containsAPromise, isComment, validJavascriptSymbol } from "./util"


export default async function(string) {
    const interpreter = makeInterpreter(defaultContext)
    return interpreter.eval(string)
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
            const result = await evaluate(parse(input), this.globalContext)
            if (!isComment(result)) {
                return result
            }
        }
    }
    const inst = new interpreter()
    inst.addToContext("global", globalContext)
    return inst
}

export function parse(string) {
    if (string === "") return
    return parser.parse(string)
}

export function evaluate(tree, context) {
    if (typeof context === "undefined") {
        throw "Function `evaluate` must be called with a context."
    }

    if (typeof tree === "undefined") {
        return tree  // nil
    } else if (tree === null) {
        return tree  // null
    } else if (isComment(tree)) {
        return tree  // don't evaluate comments
    } else if (typeof tree !== "object") {
        return evoke(tree, context)
    } else if (tree.length === 0){
        return []
    }

    let first = tree[0]  // a thing that accepts arguments (function, promise, or macro)
    let rest = tree.slice(1)  // arguments to first
    if (isComment(first)) {
        return evaluate(rest, context)  // ignore comments
    } else if (typeof first === "symbol") {  // defined in context or builtin
        const builtin = builtins[description(first)]
        if (typeof builtin !== "undefined") {  // first is a builtin
            return builtin(context, rest)
        } else {  // first is a function
            first = evoke(first, context)
            // TODO throw error if first isn't something?
        }
    } else if (Array.isArray(first)) {  // first is a list; evaluate it before moving on
        first = evaluate(first, context)
    }

    if (isPromise(first)) {
        return first.then(fn => {
            return lispApply(fn, rest, context)
        })
    } else if (typeof first === "function") {
        return lispApply(first, rest, context)
    } else if (typeof first === "object" && first.__isMacro) {  // TODO not implemented
        throw Error("Macros not yet supported")
    } else {
        throw Error(`First argument in list must be function, Promise, or macro not ${first}`)
    }
}

function evoke(symbol, context) {
    const parent = context.parent
    const definitions = context.definitions
    const described = description(symbol)
    const contextualMeaning = definitions[described]
    const builtinMeaning = builtins[described]
    if (typeof contextualMeaning !== "undefined") {
        return contextualMeaning
    } else if (typeof builtinMeaning !== "undefined") {
        return builtinMeaning
    } else if (described === "nil" || described === "undefined") {
        return undefined
    } else if (described === "null") {
        return null
    } else if (typeof parent !== "undefined") {
        return evoke(symbol, parent)
    } else if (typeof symbol === "string") {
        return symbol
    } else if (typeof symbol === "number") {
        return symbol
    } else if (typeof symbol === "boolean") {
        return symbol
    } else if (typeof symbol === "symbol" && !validJavascriptSymbol(described)) {
        throw ReferenceError(`${described} is not defined`)
    } else if (typeof symbol === "symbol") {
        // javascript
        return eval(described)
    } else {
        throw `symbol "${String(symbol)}" has unhandled type "${typeof symbol}"`
    }
}

function lispApply(first, rest, context) {
    // NOTE: Parameters are evaluated IN PARALLEL!
    //       The workaround is to evaluate the parameters in the enclosing block.
    //       A macro can be written that wraps functions that need sequential parameters evaluation.
    rest = rest.map(x => evaluate(x, context))

    // __lisp_bind allow methods to work at all. note that undefined is the default for apply
    if (containsAPromise(rest)) {
        return Promise.all(rest).then(rest => {
            rest = rest.filter(x => !isComment(x))
            return first.apply(first.__lisp_bind, rest)
        })
    } else {
        rest = rest.filter(x => !isComment(x))
        return first.apply(first.__lisp_bind, rest)
    }
}

export function buildLambda(rest, blockType, context) {
    const params = rest[0].map(p => { return description(p) })
    const justBody = rest.slice(1)

    return function() {
        let body = [
            Symbol.for(blockType),
            [
                Symbol.for("def"),
                Symbol.for("arguments"),
                [
                    Symbol.for("quote"),
                    arguments
                ]
            ],
            [
                Symbol.for("def"),
                Symbol.for("this"),
                [
                    Symbol.for("quote"),
                    this
                ]
            ]
        ]

        for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const arg = typeof arguments[i] === "undefined" ? null : arguments[i]  // default=null

            body.push([
                Symbol.for("def"),
                Symbol.for(param),
                [
                    Symbol.for("quote"),
                    arg
                ]
            ])
        }

        body = body.concat(justBody)
        return evaluate(body, context)
    }
}

function maybePromise(thing, context, fn) {
    thing = evaluate(thing, context)

    if (isPromise(thing)) {
        return thing.then(fn)
    } else {
        return fn(thing)
    }
}

function copyContext(context) {
    const newContext = Object.assign({ definitions: {} }, context)
    newContext.definitions = Object.assign({}, newContext.definitions)
    return newContext
}

const builtins = {
    "if": (context, rest) => {
        if (rest.length < 2 || rest.length > 3) {
            throw Error("`if` must have 2 or 3 arguments")
        }
        let condition = rest[0]
        let then = rest[1]
        let else_ = rest[2]

        return maybePromise(condition, context, condition => {
            return condition ? evaluate(then, context) : evaluate(else_, context)
        })
    },
    "or": (context, rest) => {
        // TODO enable support for [0, inf) arguments
        if (rest.length !== 2) {
            throw Error("`or` must have exactly 2 argumenst")
        }
        const left = rest[0]
        const right = rest[1]

        return maybePromise(left, context, left => {
            return left ? left : evaluate(right, context)
        })
    },
    "and": (context, rest) => {
        // TODO enable support for [0, inf) arguments
        if (rest.length !== 2) {
            throw Error("`and` must have exactly 2 argumenst")
        }
        const left = rest[0]
        const right = rest[1]

        return maybePromise(left, context, left => {
            if (!left) {
                return left
            } else {
                return maybePromise(right, context, right => {
                    return Boolean(right)
                })
            }
        })
    },
    "while": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`while` must have exactly 2 arguments")
        }
        const condition = rest[0]
        const statement = rest[1]

        const whilst = lastValue => {
            return maybePromise(condition, context, condition => {
                if (condition) {
                    return maybePromise(statement, context, value => {
                        return whilst(value)
                    })
                } else {
                    return lastValue
                }
            })
        }

        return whilst()
    },
    // TODO decide if this should be kept or modified - it's weird as a builtin
    "each": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`each` must have exactly 2 arguments")
        }
        const list = rest[0]
        const fn = rest[1]

        return maybePromise(list, context, list => {
            return maybePromise(fn, context, fn => {
                let value
                for (let i = 0; i < list.length; i++) {
                    value = fn(list[i])
                }
                return value
            })
        })
    },
    "map": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`map` must have exactly 2 arguments")
        }
        const list = rest[0]
        const fn = rest[1]

        return maybePromise(list, context, list => {
            return maybePromise(fn, context, fn => {
                return list.map(fn)
            })
        })
    },
    "quote": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`quote` must have exactly 1 argument")
        }
        return rest[0]  // don't interpret the rest
    },
    "def": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`def` must have exactly 2 arguments")
        }
        const symbol = rest[0]
        const value = rest[1]

        return maybePromise(value, context, value => {
            context.definitions[description(symbol)] = value
            return value
        })
    },
    "define": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`define` must have exactly 2 arguments")
        }
        const symbol = rest[0]
        const value = rest[1]

        return maybePromise(symbol, context, symbol_string => {
            return maybePromise(value, context, value => {
                context.definitions[symbol_string] = value
                return value
            })
        })
    },
    "block": (context, rest) => {
        const blockContext = {
            uid: `block-${uuid4()}`,
            parent: context,
            definitions: {}
        }
        blockContext.definitions.context = blockContext

        // probably not useful *here* but is consistent with `load`
        const originalChild = context.child
        context.child = blockContext

        let finalValue, i
        for (i = 0; i < rest.length; i++) {
            finalValue = evaluate(rest[i], blockContext)
            if (isPromise(finalValue)) {
                break
            }
        }

        if (i < rest.length) {  // the rest are promises so wrap everything in a promise
            // promiseSequential operates over functions not Promises
            const fns = [() => finalValue]
                .concat(rest.slice(i + 1).map(n => () => evaluate(n, blockContext)))
            return promiseSequential(fns).then(values => {
                context.child = originalChild
                return values[values.length - 1]
            })
        } else {
            context.child = originalChild
            return finalValue
        }
    },
    "block!": (context, rest) => {  // syntactic necessity
        let finalValue
        for (var i = 0; i < rest.length; i++) {
            finalValue = evaluate(rest[i], context)
            if (isPromise(finalValue)) {
                break
            }
        }

        if (i < rest.length) {  // the rest are promises so wrap everything in a promise
            // promiseSequential operates over functions not Promises
            const fns = [() => finalValue]
                .concat(rest.slice(i + 1).map(n => () => evaluate(n, context)))
            return promiseSequential(fns).then(values => {
                return values[values.length - 1]
            })
        } else {
            return finalValue
        }
    },
    "lambda": (context, rest) => {
        if (rest.length < 2) {
            throw Error("`lambda` must have an arguments list and at least one statement")
        }

        return buildLambda(rest, "block", context)
    },
    "lambda!": (context, rest) => {
        if (rest.length < 2) {
            throw Error("`lambda` must have an arguments list and at least one statement")
        }

        return buildLambda(rest, "block!", context)  // note the `!`
    },
    "eval": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`eval` must have exactly 1 argument")
        }
        const arg = rest[0]

        return maybePromise(arg, context, arg => {
            const body = `(block! ${arg})`
            return evaluate(parser.parse(body), context)
        })
    },
    ".": (context, rest) => {
        if (rest.length < 2) {
            throw Error("`.` takes at least 2 arguments")
        }
        const self = rest[0]
        const elements = rest.slice(1)

        function reducer(container, element) {
            if (isPromise(container)) {
                return container.then(async () => {
                    element = typeof element === "symbol"
                        ? description(element)
                        : await evaluate(element, context)
                    return container[element]
                })
            } else {
                element = typeof element === "symbol"
                    ? description(element)
                    : evaluate(element, context)
                return container[element]
            }
        }

        return maybePromise(self, context, self => {
            const container = elements.reduce(reducer, self)
            if (typeof container === "function") {
                container.__lisp_bind = self
            }
            return container
        })
    },
    "promise": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`promise` requires exactly 1 argument")
        }
        const thing = rest[0]

        const p = Promise.resolve(evaluate(thing, context))
        p.__lisp_promise = true
        return p
    },
    "await": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`await` requires exactly 1 argument")
        }
        const thing = rest[0]

        const maybePromise = evaluate(thing, context)
        if (typeof maybePromise === "object" && maybePromise.constructor === Promise) {
            delete maybePromise.__lisp_promise
        }
        return maybePromise
    },
    "load": (context, rest) => {
        if (rest.length !== 1 && rest.length !== 2) {
            throw Error("`load` takes 1 or 2 arguments")
        }
        const defMapping = rest[0]
        const targetContext = rest[1]

        return maybePromise(targetContext, context, targetContext => {
            targetContext = targetContext || context

            return maybePromise(defMapping, context, definitions => {
                if (typeof definitions !== "object") {
                    throw Error(`The first argument to \`load\` must be a mapping not ${typeof definitions}`)
                }
                const newOlderSister = {
                    uid: `sister-${uuid4()}`,
                    child: targetContext,
                    definitions: targetContext.definitions
                }
                if (typeof targetContext.parent !== "undefined") {
                    newOlderSister.parent = targetContext.parent
                    newOlderSister.parent.child = newOlderSister
                }
                targetContext.parent = newOlderSister
                targetContext.definitions = definitions

                return targetContext  // yes, actually returns context to user; TODO read-only
            })
        })
    },
    "unload": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`unload` takes exactly 1 argument")
        }
        const contextToUnload = rest[0]

        return maybePromise(contextToUnload, context, contextToUnload => {
            if (contextToUnload.parent) {
                contextToUnload.parent.child = contextToUnload.child
            }
            if (contextToUnload.child) {
                contextToUnload.child.parent = contextToUnload.parent
            }

            if (contextToUnload === context) {  // must have some context so use parent
                Object.assign(context, contextToUnload.parent)
            }
        })
    },
    "throw": (context, rest) => {
        if (rest.length !== 1) {
            throw Error("`throw` must have exactly 1 argument")
        }

        throw rest[0]
    },
    "try": (context, rest) => {
        if (rest.length !== 2) {
            throw Error("`try` must have exactly 2 arguments")
        }

        const toExecute = rest[0]
        const catchExecute = rest[1]

        try {
            return evaluate(toExecute, context)
        } catch (err) {
            const tryContext = {
                uid: `try-${uuid4()}`,
                parent: context,
                definitions: { err }
            }
            // probably not useful *here* but is consistent with `load`
            const originalChild = context.child
            context.child = tryContext

            const value = evaluate(catchExecute, tryContext)
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
        "list": (...args) => { return args },
        "type": (...args) => {  // typeof is an operator so it has to be defined here
            if (args.length !== 1) {
                throw Error("`typeof` takes exactly 1 argument")
            }

            return typeof args[0]
        },
        "get": (...args) => {
            if (args.length !== 2 && args.length !== 3) {
                throw Error("`get` requires 2 or 3 arguments")
            }
            const container = args[0]
            const index = args[1]
            const defaultValue = args[2]

            const value = container[index]
            if (typeof value === "undefined") {
                if (typeof defaultValue === "undefined") {
                    throw Error("failed to `get` index " + index)
                } else {
                    return defaultValue
                }
            } else {
                return value
            }
        },
        "set": (...args) => {
            if (args.length !== 3) {
                throw Error("`set` requires 3 arguments")
            }
            const container = args[0]
            const index = args[1]
            const value = args[2]

            container[index] = value
            return value
        },
        "append": (...args) => { return [].concat(...args) },
        "concat": (...args) => { return "".concat(...args) },
        "length": (...args) => { return args[0].length },
        "+": makeArithmetic("+",
            args => { return args.reduce((x, y) => { return x + y }) }),
        "-": makeArithmetic("-",
            args => { return -args[0] },
            args => { return args.reduce((x, y) => { return x - y }) }),
        "*": makeArithmetic("*",
            args => { return args.reduce((x, y) => { return x * y }) }),
        "/": makeArithmetic("/",
            args => { return 1 / args[0] },
            args => { return args.reduce((x, y) => { return x / y }) }),
        "not": (...args) => { return ! args[0] },
        // TODO make comparisons accept many inputs. true if chaining is 100% correct
        // ex: (> 5 3 1) -> true ; (> 5 1 3) -> false
        ">": (...args) => {
            if (args.length !== 2) {
                throw Error("`>` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left > right
        },
        "<": (...args) => {
            if (args.length !== 2) {
                throw Error("`<` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left < right
        },
        ">=": (...args) => {
            if (args.length !== 2) {
                throw Error("`>=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left >= right
        },
        "<=": (...args) => {
            if (args.length !== 2) {
                throw Error("`<=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left <= right
        },
        "==": (...args) => {
            if (args.length !== 2) {
                throw Error("`==` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left === right
        },
        "!=": (...args) => {
            if (args.length !== 2) {
                throw Error("`!=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]

            return left !== right
        },
        "mapping": (...args) => {
            if (args.length !== 1) {
                throw Error("`mapping` takes exactly 1 argument")
            }
            const pairs = args[0]

            const mapping = {}
            for (let i = 0; i < pairs.length; i++) {
                const [key, value] = pairs[i]
                mapping[key] = value
            }
            return mapping
        },
        "keys": (...args) => {
            if (args.length !== 1) {
                throw Error("`keys` takes exactly 1 argument")
            }

            return Object.keys(args[0])
        },
        "values": (...args) => {
            if (args.length !== 1) {
                throw Error("`values` takes exactly 1 argument")
            }

            return Object.values(args[0])
        },
        "new": (...args) => {
            if (args.length === 0) {
                throw Error("`new` takes at least 1 argument")
            }

            return new args[0](...args.slice(1))
        },
        // awesome stuff
        "react": (...args) => {
            if (args.length === 0) {
                throw Error("`react` requires at least 1 argument")
            }
            const tag = args[0]
            const props = args[1]
            const children = Array.isArray(args[2]) ? args[2] : args.slice(2)

            return React.createElement(tag, props, ...children)
        },
        "react-class": createReactClass,
        "serialize": (...args) => {
            if (args.length !== 1) {
                throw Error("`serialize` requires exactly 1 argument")
            }
            const thing = args[0]

            return JSON.stringify(thing)
        },
        "unserialize": (...args) => {
            if (args.length !== 1) {
                throw Error("`unserialize` requires exactly 1 argument")
            }
            const string = args[0]

            return JSON.parse(string)
        },
        "id": (...args) => {
            if (args.length !== 1) {
                throw Error("`id` requires exactly 1 argument")
            }

            return args[0]
        },
        "uuid": (...args) => {
            if (args.length !== 0) {
                throw Error("`uuid` requires exactly zero arguments")
            }

            return uuid4()
        },
        "config": () => { return uploadConfig() },
        "node": async (...args) => {
            if (args.length !== 1) {
                throw Error("`node` requires exactly 1 argument")
            }
            const urn = args[0]

            // TODO get defaults from config
            let { owner, name, version } = node.decodeNodeURN(urn, "robert", "unversioned")
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
        "nodes": async (...args) => {
            if (args.length > 2) {
                throw Error("`nodes` requires 0 to 2 arguments")
            }

            const unwrap = wrapper => {
                return wrapper.nodes
            }

            switch(args.length) {
            case 0: {  // list owners
                return unwrap(await $.ajax({
                    type: "GET",
                    url: "http://localhost:41814/"
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
        "save": async (...args) => {
            if (args.length !== 2) {
                throw Error("`save` requires exactly 2 arguments")
            }
            const urn = args[0]
            const data = args[1]

            // TODO get defaults from config
            let { owner, name, version } = node.decodeNodeURN(urn, "robert", "unversioned")
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
        "http": {
            get: async (url, params) => {
                return $.ajax({
                    type: "GET",
                    url: `http://localhost:41815/${url}`,
                    params  // TODO untested
                })
            }
        },
        "log": (...args) => {
            console.log(...args)
        },
        Editor,  // TODO this feels wrong,
        CodeMirror  // TODO should not be!
    }
}
