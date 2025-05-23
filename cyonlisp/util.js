export function makeArithmetic(symbol, one, many) {
    many = typeof many === "undefined" ? one : many
    return function(...args) {
        if (args.length === 0) {
            throw Error(`\`${symbol}\` must have at least 1 argument`)
        }

        for (let i = 0; i < args.length; i++) {
            const arg = args[i]
            if (typeof arg !== "number") {
                throw Error(`\`${symbol}\` only operates on numbers not ${typeof arg}s`)
            }
        }

        if (args.length === 1) {
            return one(args)
        } else {
            return many(args)
        }
    }
}

export function description(symbol) {
    return String(symbol).slice(7, -1) || null
}

export function isPromise(thing) {
    return (thing !== null &&
            typeof thing === "object" &&
            thing.constructor === Promise &&
            !thing.__lisp_promise)  // allows intentional promises (those using the builtin "promise")
}

export function containsAPromise(arr) {
    for (let i = 0; i < arr.length; i++) {
        if (isPromise(arr[i])) {
            return true
        }
    }
    return false
}

export function isComment(statement) {
    return typeof statement === "symbol" && description(statement) === "__lisp_comment"
}

export function validJavascriptSymbol(string) {
    const lispButNotJavascript = ":;!?><=+*/-"
    for (let i = 0; i < lispButNotJavascript.length; i++) {
        const char = lispButNotJavascript[i]
        if (string.includes(char)) {
            return false
        }
    }
    return true
}
