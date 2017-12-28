import 'babel-polyfill'  // necessary for await/async to work
import uuid4 from 'uuid'
import { unlink } from 'fs'

import test from 'ava';
import ReactDOMServer from 'react-dom/server';

import { parse, evaluate, buildLambdaString, defaultContext, makeInterpreter } from './lisp-parser'
import parseAndEval from './lisp-parser'
import { sha256, setNode, getNode, decodeNodeURI, decodeNodeURN, encodeFullNodeURI,
         readJsonFile, writeJsonFile } from './node'


async function testParse(t, string, expectedTree, expectedResult) {
  const tree = parse(string)
  t.deepEqual(tree, expectedTree)
  t.deepEqual(await evaluate(tree, defaultContext), expectedResult)
}

// built-ins
const block = Symbol.for('block')
const block_ = Symbol.for('block_')
const list = Symbol.for('list')
const quote = Symbol.for('quote')
const def = Symbol.for('def')
const lambda = Symbol.for('lambda')
const lambda_ = Symbol.for('lambda!')
const concat = Symbol.for('concat')
const add = Symbol.for('+')
const subtract = Symbol.for('-')
const multiply = Symbol.for('*')
const divide = Symbol.for('/')
const dot = Symbol.for('.')


// user-defined
const m = Symbol.for('m')
const x = Symbol.for('x')
const y = Symbol.for('y')
const double = Symbol.for('double')
const foo = Symbol.for('foo')

// javascript
const math = Symbol.for('Math')
const sqrt = Symbol.for('sqrt')
const name = Symbol.for('name')


test('lisp-parser :: empty string', async t => {
  const tree = parse('')
  t.deepEqual(tree, undefined)
})

test('lisp-parser :: empty list', async t => {
  await testParse(t, '()', [], [])
})

test('lisp-parser :: symbol', async t => {
  await testParse(t, 'Math.sqrt', [dot, math, sqrt], Math.sqrt)
})

test('lisp-parser :: atom', async t => {
  await testParse(t, '17', 17, 17)
  await testParse(t, '17.19', 17.19, 17.19)
  await testParse(t, '-9', -9, -9)
  await testParse(t, 'true', true, true)
  await testParse(t, 'false', false, false)
  await testParse(t, '"hello"', 'hello', 'hello')
  await testParse(t, `"hi \\" girl"`, 'hi " girl', 'hi " girl')
  await testParse(t, `"a \\ b"`, 'a \\ b', 'a \\ b')
})

test('lisp-parser :: arithmetic', async t => {
  await testParse(t, '(+)', [add], { error: '`+` must have at least 1 argument' })
  await testParse(t, '(+ 5)', [add, 5], 5)
  await testParse(t, '(+ 3 4 5 6)', [add, 3, 4, 5, 6], 3+4+5+6)

  await testParse(t, '(-)', [subtract], { error: '`-` must have at least 1 argument' })
  await testParse(t, '(- 5)', [subtract, 5], -5)
  await testParse(t, '(- 3 4 5 6)', [subtract, 3, 4, 5, 6], 3-4-5-6)

  await testParse(t, '(*)', [multiply], { error: '`*` must have at least 1 argument' })
  await testParse(t, '(* 5)', [multiply, 5], 5)
  await testParse(t, '(* 3 4 5 6)', [multiply, 3, 4, 5, 6], 3*4*5*6)

  await testParse(t, '(/)', [divide], { error: '`/` must have at least 1 argument' })
  await testParse(t, '(/ 5)', [divide, 5], 1/5)
  await testParse(t, '(/ 3 4 5 6)', [divide, 3, 4, 5, 6], 3/4/5/6)
})

test('lisp-parser :: javascript native', async t => {
  await testParse(t, '(Math.sqrt 4)', [[dot, math, sqrt], 4], Math.sqrt(4))
})

test('lisp-parser :: very dotty', async t => {
  await testParse(t, `Math.(concat "sqr" "t")`,
    [dot, math, [concat, "sqr", "t"]],
    Math.sqrt)
  await testParse(t,
    `Math.sqrt.name`,
    [dot, math, sqrt, name],
    Math.sqrt.name)
  await testParse(t,
    `(. Math sqrt name)`,
    [dot, math, sqrt, name],
    Math.sqrt.name)
  await testParse(t,
    `(. Math sqrt "name")`,
    [dot, math, sqrt, "name"],
    Math.sqrt.name)
  await testParse(t,
    `(. Math sqrt (concat "na" "me"))`,
    [dot, math, sqrt, [concat, "na", "me"]],
    Math.sqrt.name)
})

test('lisp-parser :: nested', async t => {
  await testParse(t, '(+ 5 (+ 2 7))', [add, 5, [add, 2, 7]], 5+(2+7))
  await testParse(t, '(+ (+ 2 7) (+ 7 8))', [add, [add, 2, 7], [add, 7, 8]], (2+7)+(7+8))
})

test('lisp-parser :: conditionals', async t => {
  t.is(await parseAndEval(`(== 2 2)`), true)
  t.is(await parseAndEval(`(== 1 2)`), false)
  t.is(await parseAndEval(`(== 2 1)`), false)

  t.is(await parseAndEval(`(!= 1 2)`), true)
  t.is(await parseAndEval(`(!= 2 1)`), true)
  t.is(await parseAndEval(`(!= 2 2)`), false)

  t.is(await parseAndEval(`(> 2 1)`), true)
  t.is(await parseAndEval(`(> 1 2)`), false)
  t.is(await parseAndEval(`(> 2 2)`), false)

  t.is(await parseAndEval(`(< 2 1)`), false)
  t.is(await parseAndEval(`(< 1 2)`), true)
  t.is(await parseAndEval(`(< 2 2)`), false)

  t.is(await parseAndEval(`(>= 2 1)`), true)
  t.is(await parseAndEval(`(>= 1 2)`), false)
  t.is(await parseAndEval(`(>= 2 2)`), true)

  t.is(await parseAndEval(`(<= 2 1)`), false)
  t.is(await parseAndEval(`(<= 1 2)`), true)
  t.is(await parseAndEval(`(<= 2 2)`), true)
})

test('lisp-parser :: if', async t => {
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

test('lisp-parser :: quote', async t => {
  await testParse(t, '(quote)', [quote], {error: '`quote` must have exactly 1 argument'})
  await testParse(t, '(quote ())', [quote, []], [])
  await testParse(t, '(quote 1)', [quote, 1], 1)
  await testParse(t, '(quote (1))', [quote, [1]], [1])
  await testParse(t, '(quote (1 2 3))', [quote, [1, 2, 3]], [1, 2, 3])
  await testParse(t, "'(4 5 6)", [quote, [4, 5, 6]], [4, 5, 6])
  await testParse(t, "(list '(7 8) '(9 10))",
    [list, [quote, [7, 8]], [quote, [9, 10]]],
    [[7, 8], [9, 10]])
  await testParse(t, '(quote (+ 1 (+ 2 3)))',
    [quote, [add, 1, [add, 2, 3]]],
    [add, 1, [add, 2, 3]]
  )
})

test('lisp-parser :: list', async t => {
  await testParse(t, '(list)', [list], [])
  await testParse(t, '(list ())', [list, []], [[]])
  await testParse(t, '(list 1 2 3)', [list, 1, 2, 3], [1, 2, 3])
  await testParse(t, '(list (list 1 2) (list 3) (list))',
    [list, [list, 1, 2], [list, 3], [list]],
    [[1, 2], [3], []]
  )
})

test('lisp-parser :: mapping', async t => {
  t.deepEqual(await parseAndEval(`
    (mapping '(
      ("a" 26)
      ("b" 25)))`),
    {"a": 26, "b": 25})
})

test('lisp-parser :: mapping syntax', async t => {
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

test('lisp-parser :: append', async t => {
  t.deepEqual(
    await parseAndEval(`(append '(12 14) '("friends"))`),
    [12, 14, `friends`]
  )
})

test('lisp-parser :: length', async t => {
  t.is(await parseAndEval(
    `(length (list 8 16))`),
    2)
})

test('lisp-parser :: headrest', async t => {
  t.deepEqual(
    await parseAndEval("(head)"),
    { error: '`head` takes exactly 1 argument' })
  t.deepEqual(
    await parseAndEval("(head '())"),
    { error: 'argument to `head` must be a list of at least 1 element' })
  t.deepEqual(
    await parseAndEval("(head '(1))"),
    1)
  t.deepEqual(
    await parseAndEval("(head '(1 2 3))"),
    1)

  t.deepEqual(
    await parseAndEval("(rest)"),
    { error: '`rest` takes exactly 1 argument' })
  t.deepEqual(
    await parseAndEval("(rest '())"),
    { error: 'argument to `rest` must be a list of at least 1 element' })
  t.deepEqual(
    await parseAndEval("(rest '(1))"),
    [])
    t.deepEqual(
      await parseAndEval("(rest '(1 2 3))"),
      [2, 3])
})

test('lisp-parser :: set-get', async t => {
  t.is(
    await parseAndEval(`
      (block
        (def x (list))
        (set x 0 4)
        (get x 0))`),
    4)
})

test('lisp-parser :: symbolism', async t => {
  await testParse(t, '(list (def foo 12) foo)', [list, [def, foo, 12], foo], [12, 12])
  testParse(t, '(block (def foo 12) foo)', [block, [def, foo, 12], foo], 12)
  testParse(t, `
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

test('lisp-parser :: util :: buildLambdaString', async t => {
  const params = [x, y]
  const body = [multiply, x, y]
  const rest = [params, body]
  const context = {'parent': 'fake', 'definitions': {'foo': 'bar'}}

  const string = buildLambdaString(rest, 'block')
  t.is(string, `
    (async function(x, y) {
      if (arguments.length !== 2) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + 2 + ' arg(s)'}
      }
      let body = [
        Symbol.for('block'),
          [Symbol.for('def'), Symbol.for('x'), [Symbol.for('quote'), x]],[Symbol.for('def'), Symbol.for('y'), [Symbol.for('quote'), y]]]
      body = body.concat([[Symbol.for('*'), Symbol.for('x'), Symbol.for('y')]])
      return await evaluate(body, context)
    })`)
})

test('lisp-parser :: load-unload', async t => {
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

test('lisp-parser :: lambda', async t => {
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
      [def, x, [lambda, [x], [concat, x, '.']]],
      [x, 'A sentence']],
    'A sentence.')
  await testParse(t, `
    (block
      (def foo (lambda (x) x))
      (foo (list 2 4 8)))`,
    [block,
      [def, foo, [lambda, [x], x]],
      [foo, [list, 2, 4, 8]]],
    [2, 4, 8])
})

test('lisp-parser :: lambda!', async t => {
  await testParse(t, `
    (block
      (def foo (lambda! (x)
        (def y 17)))
      (foo 9)
      (list x y))`,
    [block,
      [def, foo, [lambda_, [x],
        [def, y, 17]]],
      [foo, 9],
      [list, x, y]],
    [9, 17])
})

test('lisp-parser :: lambda wrong args', async t => {
  await testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8))`,
    [block,
      [def, m, [lambda, [x, y], [multiply, x, y]]],
      [m, 8]],
    { error: 'has 1 arg(s) should have 2 arg(s)' })
  await testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8 9 10))`,
    [block,
      [def, m, [lambda, [x, y], [multiply, x, y]]],
      [m, 8, 9, 10]],
    { error: 'has 3 arg(s) should have 2 arg(s)' })
})

test('lisp-parser :: closure', async t => {
  const result = await parseAndEval(`
    (block
      (def outer (lambda (x)
        (lambda (y)
          (+ x y))))
      (def jazz (outer 9))
      (jazz 3))`)
  t.is(result, 9+3)
})

test('lisp-parser :: lambda as first argument', async t => {
  const result = await parseAndEval(`
    ((lambda (x) (* x 10)) 8)`)
  t.is(result, 10*8)
})

test('lisp-parser :: interpreter', async t => {
  const interpreter = makeInterpreter(defaultContext)
  t.is(await interpreter.eval('1'), 1)
  t.is(await interpreter.eval('(quote 7)'), 7)
  t.deepEqual(await interpreter.eval('(list 6 7)'), [6, 7])
  t.is(await interpreter.eval('(def a 19)'), 19)
  t.is(await interpreter.eval('a'), 19)
})

test('lisp-parser :: eval', async t => {
  const interpreter = makeInterpreter(defaultContext)
  const toImport = `
  (def x 7)
  (def foo (lambda (y) (+ x y)))
  foo`
  t.is(await interpreter.eval(`
    ((eval "${toImport}") 17)`),
    24)
})

test('lisp-parser :: html', async t => {
  let div = await parseAndEval(`(react "div" "stuff and stuff")`)
  t.is(ReactDOMServer.renderToStaticMarkup(div),
    '<div>stuff and stuff</div>')

  div = await parseAndEval(`(react "div" "stuff and <br/> stuff")`)
  t.is(ReactDOMServer.renderToStaticMarkup(div),
    '<div>stuff and &lt;br/&gt; stuff</div>')
})

// TODO cannot do ajax in nodejs, where the test runs
test.skip('lisp-parser :: node', async t => {
  const result = await parseAndEval(`(node "robert+todo:latest")`)
  t.is(result, 'hi')
})

test('node :: sha256', async t => {
  t.is(sha256('hello'),
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
})

test('node :: set-get', async t => {
  const nodeMap = {}
  const dataMap = {}
  setNode(nodeMap, dataMap, 'robert', 'todo', 'latest', 'rock on')
  t.deepEqual(nodeMap, {
    robert: {
      todo: {
        latest: '984d6f2e20e67b94efad985fc76ce3c76404a6e17229ce49ec87f048490002d2'
      }
    }
  })
  t.deepEqual(dataMap, {
    '984d6f2e20e67b94efad985fc76ce3c76404a6e17229ce49ec87f048490002d2': 'rock on'
  })

  t.is(getNode(nodeMap, dataMap, 'robert', 'todo', 'latest'), 'rock on')
  t.is(setNode(nodeMap, dataMap, 'robert', 'todo', 'latest', 'oranges'))
  t.is(getNode(nodeMap, dataMap, 'robert', 'todo', 'latest'), 'oranges')
})

test('node :: encode-decode', async t => {
  const owner = 'draxxa', name = 'todo', version = 'so versioned'
  const defaultOwner = 'robert', defaultVersion = 'unversioned'
  t.is(encodeFullNodeURI(owner, name, version), 'node://draxxa+todo:so versioned')
  t.deepEqual(decodeNodeURI('node://draxxa+todo:so versioned', defaultOwner),
    { owner, name, version })
  t.deepEqual(decodeNodeURI('node://draxxa+todo', defaultOwner),
    { owner, name, version: defaultVersion })
  t.deepEqual(decodeNodeURI('node://todo:so versioned', defaultOwner),
    { owner: defaultOwner, name, version })
  t.deepEqual(decodeNodeURI('node://todo', defaultOwner),
    { owner: defaultOwner, name, version: defaultVersion })

  t.deepEqual(decodeNodeURN('draxxa+todo:so versioned', defaultOwner, defaultVersion),
    { owner, name, version })
  t.deepEqual(decodeNodeURN('draxxa+todo', defaultOwner, defaultVersion),
    { owner, name, version: defaultVersion })
  t.deepEqual(decodeNodeURN('todo:so versioned', defaultOwner, defaultVersion),
    { owner: defaultOwner, name, version })
  t.deepEqual(decodeNodeURN('todo', defaultOwner, defaultVersion),
    { owner: defaultOwner, name, version: defaultVersion })
})

test('node :: server-side write-read', async t => {
  const nodeFile = `/tmp/halcyon-node-${uuid4()}`
  const dataFile = `/tmp/halcyon-data-${uuid4()}`
  const nodeMap = {}
  const dataMap = {}
  t.is(setNode(nodeMap, dataMap, 'robert', 'todo', 'latest', 'rock on'))
  writeJsonFile(nodeFile, nodeMap)
  writeJsonFile(dataFile, dataMap)
  t.deepEqual(readJsonFile(nodeFile), nodeMap)
  t.deepEqual(readJsonFile(dataFile), dataMap)
  unlink(nodeFile)
  unlink(dataFile)
})
