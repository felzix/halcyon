import "babel-polyfill"  // necessary for await/async to work
import uuid4 from "uuid"
import { unlink } from "fs"

import test from "ava"
import ReactDOMServer from "react-dom/server"

import { parse, evaluate, defaultContext, makeInterpreter } from "./cyonlisp/lisp-parser"
import parseAndEval from "./cyonlisp/lisp-parser"
import { sha256, setNode, getNode, decodeNodeURI, decodeNodeURN, encodeFullNodeURI,
    readJsonFile, writeJsonFile } from "./node"


async function testParse(t, string, expectedTree, expectedResult) {
    const tree = parse(string)
    t.deepEqual(tree, expectedTree)
    t.deepEqual(await evaluate(tree, defaultContext), expectedResult)
}

async function testException(t, string, expectedTree, errorMessage) {
    const tree = parse(string)
    t.deepEqual(tree, expectedTree)
    const error = await t.throws((async () => {
        await evaluate(tree, defaultContext)
    })())
    t.is(error.message, errorMessage)
    // TODO when https://github.com/avajs/ava/pull/1650 is available, use this instead:
    // const err = await t.throws(async () => {
    //     await evaluate(tree, defaultContext)
    // }, {
    //     message: errorMessage
    // })
}


// built-ins
const block = Symbol.for("block")
const quote = Symbol.for("quote")
const def = Symbol.for("def")
const lambda = Symbol.for("lambda")
const lambda_ = Symbol.for("lambda!")
const concat = Symbol.for("concat")
const add = Symbol.for("+")
const subtract = Symbol.for("-")
const multiply = Symbol.for("*")
const divide = Symbol.for("/")
const dot = Symbol.for(".")


// user-defined
const m = Symbol.for("m")
const x = Symbol.for("x")
const y = Symbol.for("y")
const double = Symbol.for("double")
const foo = Symbol.for("foo")

// javascript
const math = Symbol.for("Math")
const sqrt = Symbol.for("sqrt")
const name = Symbol.for("name")


test("lisp-parser :: empty string", async t => {
    const tree = parse("")
    t.deepEqual(tree, undefined)
})

test("lisp-parser :: symbol", async t => {
    await testParse(t, "Math.sqrt", [dot, math, sqrt], Math.sqrt)
})

test("lisp-parser :: atom", async t => {
    await testParse(t, "17", 17, 17)
    await testParse(t, "17.19", 17.19, 17.19)
    await testParse(t, "-9", -9, -9)
    await testParse(t, "true", true, true)
    await testParse(t, "false", false, false)
    await testParse(t, "\"hello\"", "hello", "hello")
    await testParse(t, "\"hi \\\" girl\"", "hi \" girl", "hi \" girl")
    await testParse(t, "\"a \\ b\"", "a \\ b", "a \\ b")
})

test("lisp-parser :: arithmetic", async t => {
    await testException(t, "(+)", [add], "`+` must have at least 1 argument")
    await testParse(t, "(+ 5)", [add, 5], 5)
    await testParse(t, "(+ 3 4 5 6)", [add, 3, 4, 5, 6], 3+4+5+6)

    await testException(t, "(-)", [subtract], "`-` must have at least 1 argument")
    await testParse(t, "(- 5)", [subtract, 5], -5)
    await testParse(t, "(- 3 4 5 6)", [subtract, 3, 4, 5, 6], 3-4-5-6)

    await testException(t, "(*)", [multiply], "`*` must have at least 1 argument")
    await testParse(t, "(* 5)", [multiply, 5], 5)
    await testParse(t, "(* 3 4 5 6)", [multiply, 3, 4, 5, 6], 3*4*5*6)

    await testException(t, "(/)", [divide], "`/` must have at least 1 argument")
    await testParse(t, "(/ 5)", [divide, 5], 1/5)
    await testParse(t, "(/ 3 4 5 6)", [divide, 3, 4, 5, 6], 3/4/5/6)
})

test("lisp-parser :: javascript native", async t => {
    await testParse(t, "(Math.sqrt 4)", [[dot, math, sqrt], 4], Math.sqrt(4))
})

test("lisp-parser :: promise", async t => {
    t.is(
        await parseAndEval(`
        (type (promise 20))`),
        "object")
    t.is(
        await parseAndEval(`
        (promise 20)`),
        20)
    t.is(
        await parseAndEval(`
        (+ 1 (await (promise 20)))`),
        21)
    t.is(
        await parseAndEval(`
      ((. Math sqrt) (await (promise 25)))`),
        5)
})

test("lisp-parser :: very dotty", async t => {
    await testParse(t, "Math.(concat \"sqr\" \"t\")",
        [dot, math, [concat, "sqr", "t"]],
        Math.sqrt)
    await testParse(t,
        "Math.sqrt.name",
        [dot, math, sqrt, name],
        Math.sqrt.name)
    await testParse(t,
        "(. Math sqrt name)",
        [dot, math, sqrt, name],
        Math.sqrt.name)
    await testParse(t,
        "(. Math sqrt \"name\")",
        [dot, math, sqrt, "name"],
        Math.sqrt.name)
    await testParse(t,
        "(. Math sqrt (concat \"na\" \"me\"))",
        [dot, math, sqrt, [concat, "na", "me"]],
        Math.sqrt.name)
    t.is(
        await parseAndEval(`
      ((. Math sqrt) 25)`),
        5)
})

test("lisp-parser :: nested", async t => {
    await testParse(t, "(+ 5 (+ 2 7))", [add, 5, [add, 2, 7]], 5+(2+7))
    await testParse(t, "(+ (+ 2 7) (+ 7 8))", [add, [add, 2, 7], [add, 7, 8]], (2+7)+(7+8))
})

test("lisp-parser :: conditionals", async t => {
    t.is(await parseAndEval("(== 2 2)"), true)
    t.is(await parseAndEval("(== 1 2)"), false)
    t.is(await parseAndEval("(== 2 1)"), false)

    t.is(await parseAndEval("(!= 1 2)"), true)
    t.is(await parseAndEval("(!= 2 1)"), true)
    t.is(await parseAndEval("(!= 2 2)"), false)

    t.is(await parseAndEval("(> 2 1)"), true)
    t.is(await parseAndEval("(> 1 2)"), false)
    t.is(await parseAndEval("(> 2 2)"), false)

    t.is(await parseAndEval("(< 2 1)"), false)
    t.is(await parseAndEval("(< 1 2)"), true)
    t.is(await parseAndEval("(< 2 2)"), false)

    t.is(await parseAndEval("(>= 2 1)"), true)
    t.is(await parseAndEval("(>= 1 2)"), false)
    t.is(await parseAndEval("(>= 2 2)"), true)

    t.is(await parseAndEval("(<= 2 1)"), false)
    t.is(await parseAndEval("(<= 1 2)"), true)
    t.is(await parseAndEval("(<= 2 2)"), true)
})

test("lisp-parser :: if", async t => {
    t.is(
        await parseAndEval(`
      (if true
          14
          15)`),
        14)
    t.is(
        await parseAndEval(`
      (if false
          14
          15)`),
        15)
    t.is(
        await parseAndEval(`
      (if (> 9 4)
          14
          15)`),
        14)
    t.is(
        await parseAndEval(`
      (if (> 9 4)
          90)`),
        90)
    t.is(
        await parseAndEval(`
      (if (> 4 9)
          90)`),
        undefined)
})

test("lisp-parser :: while", async t => {
    t.is(
        await parseAndEval(`
            (block!
                (def x 0)
                (while (< x 3)
                    (def x (+ x 1)))
                x)`),
        3)
    t.is(
        await parseAndEval(`
            (block!
                (def foo (lambda (a b)
                            (< a b)))
                (def q {"x": 0})
                (while (foo q.x 5)
                    (block!
                        (set q "x" (+ q.x 2))))
                q.x)`),
        6)
    t.is(
        await parseAndEval(`
            (block!
                (def foo (lambda (a b)
                            (< a b)))
                (def x 0)
                (while (foo x 5)
                    (block!
                        (def x (+ x 2))))
                x)`),
        6)
})

test("lisp-parser :: each", async t => {
    t.is(
        await parseAndEval(`
            (block!
                (def arr '(1 2 3 4))
                (def foo (lambda (x) (* x x)))
                (each arr foo))`),
        16)
})

test("lisp-parser :: quote", async t => {
    await testException(t, "(quote)", [quote], "`quote` must have exactly 1 argument")
    await testParse(t, "(quote ())", [quote, []], [])
    await testParse(t, "(quote 1)", [quote, 1], 1)
    await testParse(t, "(quote (1))", [quote, [1]], [1])
    await testParse(t, "(quote (1 2 3))", [quote, [1, 2, 3]], [1, 2, 3])
    await testParse(t, "'(4 5 6)", [quote, [4, 5, 6]], [4, 5, 6])
    await testParse(t, "(quote (+ 1 (+ 2 3)))",
        [quote, [add, 1, [add, 2, 3]]],
        [add, 1, [add, 2, 3]]
    )
})

test("lisp-parser :: mapping", async t => {
    t.deepEqual(await parseAndEval(`
    (mapping '(
      ("a" 26)
      ("b" 25)))`),
    {"a": 26, "b": 25})
})

test("lisp-parser :: mapping syntax", async t => {
    t.deepEqual(await parseAndEval(`
    {"a": 26 "b": 25}`),
    {"a": 26, "b": 25})
    t.deepEqual(await parseAndEval(`
    {"a": (concat "ui" "all") "b": 25}`),
    {"a": "uiall", "b": 25})
    t.deepEqual(await parseAndEval(`
    {"a": (concat "ui" "all") (+ 7 8) : 25}`),
    {"a": "uiall", 15: 25})
})

test("lisp-parser :: append", async t => {
    t.deepEqual(
        await parseAndEval("(append '(12 14) '(\"friends\"))"),
        [12, 14, "friends"]
    )
})

test("lisp-parser :: length", async t => {
    t.is(await parseAndEval(
        "(length '(8 16))"),
    2)
})

test("lisp-parser :: set-get", async t => {
    t.is(
        await parseAndEval(`
      (block
        (def x '())
        (set x 0 4)
        (get x 0))`),
        4)
})

test("lisp-parser :: symbolism", async t => {
    await testParse(t, "(block (def foo 12) foo)", [block, [def, foo, 12], foo], 12)
    await testParse(t, `
    (block
      (def foo 12)
      (block
        (def foo 8))
      foo)`,
    [block,
        [def, foo, 12],
        [block,
            [def, foo, 8]],
        foo],
    12)
})

test("lisp-parser :: global", async t => {
    t.truthy(await parseAndEval("global"))
    t.is(await parseAndEval("global.uid"), "default")
    t.falsy(await parseAndEval("global.parent"))

})

test("lisp-parser :: load-unload", async t => {
    t.is(await parseAndEval(`
    (block
      (def foo 12)
      (load {"foo": 19})
      foo)`),
    19)
    t.is(await parseAndEval(`
    (block
      (def foo 12)
      (def callow (load {"foo": 19}))
      (unload callow)
      foo)`),
    12)
})

test("lisp-parser :: load global", async t => {
    const interpreter = makeInterpreter(defaultContext)
    await interpreter.eval(`
    (block
      (load {"p": 20} global)
    )`)
    t.is(await interpreter.eval("p"),
        20)
})

test("lisp-parser :: lambda", async t => {
    await testParse(t, `
    (block
      (def double (lambda (x) (* x 2)))
      (double 8))`,
    [block,
        [def, double, [lambda, [x], [multiply, x, 2]]],
        [double, 8]],
    16)
    await testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8 3))`,
    [block,
        [def, m, [lambda, [x, y], [multiply, x, y]]],
        [m, 8, 3]],
    24)
    await testParse(t, `
    (block
      (def x (lambda (x) (concat x ".")))
      (x "A sentence"))`,
    [block,
        [def, x, [lambda, [x], [concat, x, "."]]],
        [x, "A sentence"]],
    "A sentence.")
    await testParse(t, `
    (block
      (def foo (lambda (x) x))
      (foo '(2 4 8)))`,
    [block,
        [def, foo, [lambda, [x], x]],
        [foo, [quote, [2, 4, 8]]]],
    [2, 4, 8])
})

test("lisp-parser :: lambda!", async t => {
    await testParse(t, `
    (block
      (def foo (lambda! (x)
        (def y 17)))
      (foo 9)
      (+ x y))`,
    [block,
        [def, foo, [lambda_, [x],
            [def, y, 17]]],
        [foo, 9],
        [add, x, y]],
    9 + 17)
})

test("lisp-parser :: lambda wrong args", async t => {
    await testException(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8))`,
    [block,
        [def, m, [lambda, [x, y], [multiply, x, y]]],
        [m, 8]],
    "y is not defined")
})

test("lisp-parser :: closure", async t => {
    const result = await parseAndEval(`
    (block
      (def outer (lambda (x)
        (lambda (y)
          (+ x y))))
      (def jazz (outer 9))
      (jazz 3))`)
    t.is(result, 9+3)
})

test("lisp-parser :: lambda as first argument", async t => {
    const result = await parseAndEval(`
    ((lambda (x) (* x 10)) 8)`)
    t.is(result, 10*8)
})

test("lisp-parser :: interpreter", async t => {
    const interpreter = makeInterpreter(defaultContext)
    t.is(await interpreter.eval("1"), 1)
    t.is(await interpreter.eval("(quote 7)"), 7)
    t.deepEqual(await interpreter.eval("'(6 7)"), [6, 7])
    t.is(await interpreter.eval("(def a 19)"), 19)
    t.is(await interpreter.eval("a"), 19)
})

test("lisp-parser :: eval", async t => {
    const interpreter = makeInterpreter(defaultContext)
    const sourcecode = `
  (def x 7)
  (def foo (lambda (y) (+ x y)))
  foo`
    t.is(await interpreter.eval(`
    ((eval "${sourcecode}") 17)`),
    24)
})

test("lisp-parser :: html", async t => {
    let div = await parseAndEval("(react \"div\" undefined \"stuff and stuff\")")
    t.is(ReactDOMServer.renderToStaticMarkup(div),
        "<div>stuff and stuff</div>")

    div = await parseAndEval("(react \"div\" undefined \"stuff and <br/> stuff\")")
    t.is(ReactDOMServer.renderToStaticMarkup(div),
        "<div>stuff and &lt;br/&gt; stuff</div>")
})

// TODO cannot do ajax in nodejs, where the test runs
test.skip("lisp-parser :: node", async t => {
    const result = await parseAndEval("(node \"robert+todo:latest\")")
    t.is(result, "hi")
})

test("node :: sha256", async t => {
    t.is(sha256("hello"),
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
})

test("node :: set-get", async t => {
    const nodeMap = {}
    const dataMap = {}
    setNode(nodeMap, dataMap, "robert", "todo", "latest", "rock on")
    t.deepEqual(nodeMap, {
        robert: {
            todo: {
                latest: "984d6f2e20e67b94efad985fc76ce3c76404a6e17229ce49ec87f048490002d2"
            }
        }
    })
    t.deepEqual(dataMap, {
        "984d6f2e20e67b94efad985fc76ce3c76404a6e17229ce49ec87f048490002d2": "rock on"
    })

    t.is(getNode(nodeMap, dataMap, "robert", "todo", "latest"), "rock on")
    t.is(setNode(nodeMap, dataMap, "robert", "todo", "latest", "oranges"))
    t.is(getNode(nodeMap, dataMap, "robert", "todo", "latest"), "oranges")
})

test("node :: encode-decode", async t => {
    const owner = "draxxa", name = "todo", version = "so versioned"
    const defaultOwner = "robert", defaultVersion = "unversioned"
    t.is(encodeFullNodeURI(owner, name, version), "node://draxxa+todo:so versioned")
    t.deepEqual(decodeNodeURI("node://draxxa+todo:so versioned", defaultOwner),
        { owner, name, version })
    t.deepEqual(decodeNodeURI("node://draxxa+todo", defaultOwner),
        { owner, name, version: defaultVersion })
    t.deepEqual(decodeNodeURI("node://todo:so versioned", defaultOwner),
        { owner: defaultOwner, name, version })
    t.deepEqual(decodeNodeURI("node://todo", defaultOwner),
        { owner: defaultOwner, name, version: defaultVersion })

    t.deepEqual(decodeNodeURN("draxxa+todo:so versioned", defaultOwner, defaultVersion),
        { owner, name, version })
    t.deepEqual(decodeNodeURN("draxxa+todo", defaultOwner, defaultVersion),
        { owner, name, version: defaultVersion })
    t.deepEqual(decodeNodeURN("todo:so versioned", defaultOwner, defaultVersion),
        { owner: defaultOwner, name, version })
    t.deepEqual(decodeNodeURN("todo", defaultOwner, defaultVersion),
        { owner: defaultOwner, name, version: defaultVersion })
})

test("node :: server-side write-read", async t => {
    const nodeFile = `/tmp/halcyon-node-${uuid4()}`
    const dataFile = `/tmp/halcyon-data-${uuid4()}`
    const nodeMap = {}
    const dataMap = {}
    t.is(setNode(nodeMap, dataMap, "robert", "todo", "latest", "rock on"))
    writeJsonFile(nodeFile, nodeMap)
    writeJsonFile(dataFile, dataMap)
    t.deepEqual(readJsonFile(nodeFile), nodeMap)
    t.deepEqual(readJsonFile(dataFile), dataMap)
    unlink(nodeFile)
    unlink(dataFile)
})
