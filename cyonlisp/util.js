export function makeArithmetic(symbol, one, many) {
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
