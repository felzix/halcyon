/* eslint-disable react/display-name, no-console, no-constant-condition */

import "babel-polyfill"  // necessary for await/async to work
import $ from "jquery"

import React from "react"
import uuid4 from "uuid"
import CodeMirror from "react-codemirror"  // TODO refactor away

import { GeneratedElement, Editor, uploadConfig } from "./results"
import node from "./node"

import parser from "./lisp-grammar"


// Returns a (usually nested) Array of strings
export function parse(string) {
    if (string === "") return
    return parser.parse(string)
}

function evoke(symbol, context) {
    const parent = context.parent
    const definitions = context.definitions
    const meaning = definitions[description(symbol)]
    if (typeof meaning !== "undefined") {
        return meaning
    } else if (typeof parent !== "undefined") {
        return evoke(symbol, parent)
    } else if (typeof symbol === "string") {
        return symbol
    } else if (typeof symbol === "number") {
        return symbol
    } else if (typeof symbol === "boolean") {
        return symbol
    } else if (typeof symbol === "symbol") {
    // javascript
        return eval(description(symbol))
    } else {
        throw `symbol "${String(symbol)}" has unhandled type "${typeof symbol}"`
    }
}

function makeArithmetic(symbol, one, many) {
    many = typeof many === "undefined" ? one : many
    return function(...args) {
        if (args.length === 0) {
            throw new Error("`" + symbol + "` must have at least 1 argument")
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
            ]
        ]

        for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const arg = arguments[i]
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

function description(symbol) {
    return String(symbol).slice(7, -1) || null
}

function oathJudge(thing, context, fn) {
    thing = evaluate(thing, context)

    if (typeof thing === "object" && thing.constructor === Promise) {
        return thing.then(fn)
    } else {
        return fn(thing)
    }
}

const builtins = {
    "if": (context, rest) => {
        if (rest.length < 2 || rest.length > 3) {
            throw new Error("`if` must have 2 or 3 arguments")
        }
        let condition = rest[0]
        let then = rest[1]
        let else_ = rest[2]

        return oathJudge(condition, context, condition => {
            if (condition) {
                return evaluate(then, context)
            } else if (typeof else_ !== "undefined") {
                return evaluate(else_, context)
            }
        })
    },
    "or": (context, rest) => {
        // TODO enable support for [0, inf) arguments
        if (rest.length !== 2) {
            throw new Error("`or` must have exactly 2 argumenst")
        }
        const left = rest[0]
        const right = rest[1]

        return oathJudge(left, context, left => {
            if (left) {
                return left
            } else {
                return evaluate(right, context)
            }
        })
    },
    "and": (context, rest) => {
        // TODO enable support for [0, inf) arguments
        if (rest.length !== 2) {
            throw new Error("`and` must have exactly 2 argumenst")
        }
        const left = rest[0]
        const right = rest[1]

        return oathJudge(left, context, left => {
            if (!left) {
                return left
            } else {
                return oathJudge(right, context, right => {
                    return Boolean(right)
                })
            }
        })
    },
    "while": (context, rest) => {
        if (rest.length !== 2) {
            throw new Error("`while` must have exactly 2 arguments")
        }
        const condition = rest[0]
        const statement = rest[1]

        const whilst = lastValue => {
            return oathJudge(condition, context, condition => {
                if (condition) {
                    return oathJudge(statement, context, value => {
                        return whilst(value)
                    })
                } else {
                    return lastValue
                }
            })
        }

        return whilst()
    },
    "each": async (context, rest) => {
        if (rest.length !== 2) {
            throw new Error("`each` must have exactly 2 arguments")
        }
        const list = await evaluate(rest[0], context)
        const fn = await evaluate(rest[1], context)
        let value
        for (let i = 0; i < list.length; i++) {
            value = await fn(list[i])
        }
        return value
    },
    quote: (context, rest) => {
        if (rest.length !== 1) {
            throw new Error("`quote` must have exactly 1 argument")
        } else {
            return rest[0]  // don't interpret the rest
        }
    },
    def: (context, rest) => {
        if (rest.length !== 2) {
            throw new Error("`def` must have exactly 2 arguments")
        } else {
            const symbol = rest[0]
            const value = rest[1]

            return oathJudge(value, context, value => {
                context.definitions[description(symbol)] = value
                return value
            })
        }
    },
    define: (context, rest) => {
        if (rest.length !== 2) {
            throw new Error("`def` must have exactly 2 arguments")
        } else {
            const symbol = rest[0]
            const value = rest[1]

            return oathJudge(symbol, context, symbol_string => {
                return oathJudge(value, context, value => {
                    context.definitions[symbol_string] = value
                    return value
                })
            })
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
    "block!": async (context, rest) => {  // syntactic necessity
        let finalValue
        for (let i = 0; i < rest.length; i++) {
            finalValue = await evaluate(rest[i], context)
        }
        return finalValue
    },
    lambda: (context, rest) => {
        if (rest.length < 2) {
            throw new Error("`lambda` must have an arguments list and at least one statement")
        } else {
            return buildLambda(rest, "block", context)
        }
    },
    "lambda!": (context, rest) => {
        if (rest.length < 2) {
            throw new Error("`lambda` must have an arguments list and at least one statement")
        } else {
            return buildLambda(rest, "block!", context)  // note the `!`
        }
    },
    eval: (context, rest) => {
        if (rest.length !== 1) {
            throw new Error("`eval` must have exactly 1 argument")
        } else {
            const arg = rest[0]

            return oathJudge(arg, context, arg => {
                const body = `(block! ${arg})`
                return evaluate(parser.parse(body), context)
            })
        }
    },
    ".": async (context, rest) => {
        if (rest.length < 2) {
            throw new Error("`.` takes at least 2 arguments")
        } else {
            let container = await evaluate(rest[0], context)
            let self = container
            const elements = rest.slice(1)
            for (let i = 0; i < elements.length; i++) {
                let element = elements[i]
                if (typeof element === "symbol") {
                    element = description(element)
                } else {
                    element = await evaluate(element, context)
                }
                container = container[element]
            }
            if (typeof container === "function") {
                container.__lisp_bind = self
            }
            return container
        }
    },
    load: async (context, rest) => {
        if (rest.length !== 1 && rest.length !== 2) {
            throw new Error("`load` takes 1 or 2 arguments")
        } else {
            const defMapping = rest[0]
            const targetContext = typeof rest[1] === "undefined"
                ? context : await evaluate(rest[1], context)
            const definitions = await evaluate(defMapping, context)
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
        }
    },
    unload: async (context, rest) => {
        if (rest.length !== 1) {
            throw new Error("`unload` takes exactly 1 argument")
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
    },
    "throw": (context, rest) => {
        if (rest.length !== 1) {
            throw new Error("`throw` must have exactly 1 argument")
        }
        throw rest[0]
    },
    "try": async (context, rest) => {
        if (rest.length !== 2) {
            throw new Error("`try` must have exactly 2 arguments")
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
        list: (...args) => { return args },  // could be done in lisp but it's too useful in tests etc
        "type": (...args) => {  // typeof is an operator so it has to be defined here
            if (args.length !== 1) {
                throw new Error("`typeof` takes exactly 1 argument")
            }
            return typeof args[0]
        },
        get: (...args) => {
            if (args.length !== 2 && args.length !== 3) {
                throw new Error("`get` requires 2 or 3 arguments")
            }
            const container = args[0]
            const index = args[1]
            const defaultValue = args[2]
            const value = container[index]
            if (typeof value === "undefined") {
                if (typeof defaultValue === "undefined") {
                    throw new Error("failed to `get` index " + index)
                } else {
                    return defaultValue
                }
            } else {
                return value
            }
        },
        set: (...args) => {
            if (args.length !== 3) {
                throw new Error("`set` requires 3 arguments")
            }
            const container = args[0]
            const index = args[1]
            const value = args[2]
            container[index] = value
            return value
        },
        append: (...args) => { return [].concat(...args) },
        concat: (...args) => { return "".concat(...args) },
        length: (...args) => { return args[0].length },
        "+": makeArithmetic("+", args => { return args.reduce((x, y) => { return x + y }) }),
        "-": makeArithmetic("-", args => { return -args[0] },
            args => { return args.reduce((x, y) => { return x - y }) }),
        "*": makeArithmetic("*", args => { return args.reduce((x, y) => { return x * y }) }),
        "/": makeArithmetic("/", args => { return 1 / args[0] },
            args => { return args.reduce((x, y) => { return x / y }) }),
        "not": (...args) => { return ! args[0] },
        // TODO make comparisons accept many inputs. true if chaining is 100% correct
        // ex: (> 5 3 1) -> true ; (> 5 1 3) -> false
        ">": (...args) => {
            if (args.length !== 2) {
                throw new Error("`>` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left > right
        },
        "<": (...args) => {
            if (args.length !== 2) {
                throw new Error("`<` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left < right
        },
        ">=": (...args) => {
            if (args.length !== 2) {
                throw new Error("`>=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left >= right
        },
        "<=": (...args) => {
            if (args.length !== 2) {
                throw new Error("`<=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left <= right
        },
        "==": (...args) => {
            if (args.length !== 2) {
                throw new Error("`==` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left === right
        },
        "!=": (...args) => {
            if (args.length !== 2) {
                throw new Error("`!=` must have exactly 2 arguments")
            }
            const left = args[0]
            const right = args[1]
            return left !== right
        },
        mapping: (...args) => {
            if (args.length !== 1) {
                throw new Error("`mapping` takes exactly 1 argument")
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
                throw new Error("`keys` takes exactly 1 argument")
            }
            return Object.keys(args[0])
        },
        values: (...args) => {
            if (args.length !== 1) {
                throw new Error("`values` takes exactly 1 argument")
            }
            return Object.values(args[0])
        },
        "new": (...args) => {
            if (args.length === 0) {
                throw new Error("`new` takes at least 1 argument")
            }
            return new args[0](...args.slice(1))
        },
        // awesome stuff
        react: (...args) => {
            if (args.length === 0) {
                throw new Error("`react` requires at least 1 argument")
            }
            const tag = args[0]
            const props = args[1]

            let children
            if (Array.isArray(args[2])) {
                children = args[2]
            } else {
                children = args.slice(2)
            }
            return React.createElement(tag, props, ...children)
        },
        "vis": (...args) => {
            if (args.length !== 1) {
                throw new Error("`vis` requires at exactly 1 argument")
            }
            const dom = args[0]
            return React.createElement(GeneratedElement, { dom })
        },
        serialize: (...args) => {
            if (args.length !== 1) {
                throw new Error("`serialize` requires exactly 1 argument")
            }
            const thing = args[0]
            return JSON.stringify(thing)
        },
        unserialize: (...args) => {
            if (args.length !== 1) {
                throw new Error("`unserialize` requires exactly 1 argument")
            }
            const string = args[0]
            return JSON.parse(string)
        },
        id: (...args) => {
            if (args.length !== 1) {
                throw new Error("`id` requires exactly 1 argument")
            }
            return args[0]
        },
        uuid: (...args) => {
            if (args.length !== 0) {
                throw new Error("`uuid` requires exactly zero arguments")
            }
            return uuid4()
        },
        config: () => { return uploadConfig() },
        node: async (...args) => {
            if (args.length !== 1) {
                throw new Error("`node` requires exactly 1 argument")
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
        nodes: async (...args) => {
            if (args.length > 2) {
                throw new Error("`nodes` requires 0 to 2 arguments")
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
        save: async (...args) => {
            if (args.length !== 2) {
                throw new Error("`save` requires exactly 2 arguments")
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
        http: {
            get: async (url, params) => {
                return await $.ajax({
                    type: "GET",
                    url: `http://localhost:41815/${url}`,
                    params  // TODO untested
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

export function evaluate(tree, context) {
    if (typeof context === "undefined") {
        throw "Function `evaluate` must be called with a context."
    }

    if (typeof tree === "undefined") {
        return tree  // nil
    } else if (tree === null) {
        return tree  // null
    } else if (typeof tree !== "object") {
        return evoke(tree, context)
    } else if (tree.length === 0){
        return []
    }

    let first = tree[0]  // a thing that accepts arguments (function, promise, or macro)
    let rest = tree.slice(1)  // arguments to first
    if (typeof first === "symbol") {  // defined in context or builtin
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

    if (typeof first === "object" && first.constructor === Promise) {
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

function containsAPromise(arr) {
    for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "object" && arr[i].constructor === Promise) {
            return true
        }
    }
    return false
}

function hexagon(rest, context) {
    rest = rest.map(x => evaluate(x, context))
    if (containsAPromise(rest)) {
        return Promise.all(rest)
    } else {
        return rest
    }
}

function lispApply(first, rest, context) {
    rest = hexagon(rest, context)

    if (typeof rest === "object" && rest.constructor === Promise) {
        return rest.then(rest => {
            // __lisp_bind allow methods to work at all. note that undefined is the default for apply
            return first.apply(first.__lisp_bind, rest)
        })
    } else {
        return first.apply(first.__lisp_bind, rest)
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
    inst.addToContext("global", globalContext)
    return inst
}

export default async function(string) {
    const tree = parse(string)
    if (typeof tree !== "undefined") {
        const context = copyContext(defaultContext)
        context.definitions["global"] = context
        return await evaluate(tree, context)
    }
}

function copyContext(context) {
    const newContext = Object.assign({ definitions: {} }, context)
    newContext.definitions = Object.assign({}, newContext.definitions)
    return newContext
}
