import 'babel-polyfill'  // necessary for await/async to work
import uuid4 from 'uuid'
import { unlink } from 'fs'

import test from 'ava';
import ReactDOMServer from 'react-dom/server';

import { parse, evaluate, buildLambdaString, defaultContext, makeInterpreter } from './lisp-parser'
import parseAndEval from './lisp-parser'
import { sha256, setNode, getNode, decodeNodeURI, encodeFullNodeURI,
         readJsonFile, writeJsonFile } from './node'


async function testParse(t, string, expectedTree, expectedResult) {
  const tree = parse(string)
  t.deepEqual(tree, expectedTree)
  t.deepEqual(await evaluate(tree, defaultContext), expectedResult)
}

// built-ins
const block = Symbol.for('block')
const list = Symbol.for('list')
const quote = Symbol.for('quote')
const def = Symbol.for('def')
const lambda = Symbol.for('lambda')
const concat = Symbol.for('concat')
const add = Symbol.for('+')
const subtract = Symbol.for('-')
const multiply = Symbol.for('*')
const divide = Symbol.for('/')


// user-defined
const m = Symbol.for('m')
const x = Symbol.for('x')
const y = Symbol.for('y')
const double = Symbol.for('double')
const foo = Symbol.for('foo')

// javascript
const math_sqrt = Symbol.for('Math.sqrt')


test('lisp-parser :: empty string', t => {
  const tree = parse('')
  t.deepEqual(tree, undefined)
})

test('lisp-parser :: empty list', t => {
  testParse(t, '()', [], [])
})

test('lisp-parser :: symbol', t => {
  testParse(t, 'Math.sqrt', math_sqrt, Math.sqrt)
})

test('lisp-parser :: atom', t => {
  testParse(t, '17', 17, 17)
  testParse(t, '17.19', 17.19, 17.19)
  testParse(t, 'true', true, true)
  testParse(t, 'false', false, false)
  testParse(t, '"hello"', 'hello', 'hello')
  testParse(t, `"hi \\" girl"`, 'hi " girl', 'hi " girl')
  testParse(t, `"a \\ b"`, 'a \\ b', 'a \\ b')
})

test('lisp-parser :: arithmetic', t => {
  testParse(t, '(+)', [add], { error: '`+` must have at least 1 argument' })
  testParse(t, '(+ 5)', [add, 5], 5)
  testParse(t, '(+ 3 4 5 6)', [add, 3, 4, 5, 6], 3+4+5+6)

  testParse(t, '(-)', [subtract], { error: '`-` must have at least 1 argument' })
  testParse(t, '(- 5)', [subtract, 5], -5)
  testParse(t, '(- 3 4 5 6)', [subtract, 3, 4, 5, 6], 3-4-5-6)

  testParse(t, '(*)', [multiply], { error: '`*` must have at least 1 argument' })
  testParse(t, '(* 5)', [multiply, 5], 5)
  testParse(t, '(* 3 4 5 6)', [multiply, 3, 4, 5, 6], 3*4*5*6)

  testParse(t, '(/)', [divide], { error: '`/` must have at least 1 argument' })
  testParse(t, '(/ 5)', [divide, 5], 1/5)
  testParse(t, '(/ 3 4 5 6)', [divide, 3, 4, 5, 6], 3/4/5/6)
})

test('lisp-parser :: javascript native', t => {
  testParse(t, '(Math.sqrt 4)', [math_sqrt, 4], Math.sqrt(4))
})

test('lisp-parser :: nested', t => {
  testParse(t, '(+ 5 (+ 2 7))', [add, 5, [add, 2, 7]], 5+(2+7))
  testParse(t, '(+ (+ 2 7) (+ 7 8))', [add, [add, 2, 7], [add, 7, 8]], (2+7)+(7+8))
})

test('lisp-parser :: quote', t => {
  testParse(t, '(quote)', [quote], {error: '`quote` must have exactly 1 argument'})
  testParse(t, '(quote ())', [quote, []], [])
  testParse(t, '(quote 1)', [quote, 1], 1)
  testParse(t, '(quote (1))', [quote, [1]], [1])
  testParse(t, '(quote (1 2 3))', [quote, [1, 2, 3]], [1, 2, 3])
  testParse(t, "'(4 5 6)", [quote, [4, 5, 6]], [4, 5, 6])
  testParse(t, "(list '(7 8) '(9 10))",
    [list, [quote, [7, 8]], [quote, [9, 10]]],
    [[7, 8], [9, 10]])
  testParse(t, '(quote (+ 1 (+ 2 3)))',
    [quote, [add, 1, [add, 2, 3]]],
    [add, 1, [add, 2, 3]]
  )
})

test('lisp-parser :: list', t => {
  testParse(t, '(list)', [list], [])
  testParse(t, '(list ())', [list, []], [[]])
  testParse(t, '(list 1 2 3)', [list, 1, 2, 3], [1, 2, 3])
  testParse(t, '(list (list 1 2) (list 3) (list))',
    [list, [list, 1, 2], [list, 3], [list]],
    [[1, 2], [3], []]
  )
})

test('lisp-parser :: append', async t => {
  t.deepEqual(
    await parseAndEval(`(append '(12 14) '("friends"))`),
    [12, 14, `friends`]
  )
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

test('lisp-parser :: symbolism', t => {
  testParse(t, '(list (def foo 12) foo)', [list, [def, foo, 12], foo], [12, 12])
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

test('lisp-parser :: util :: buildLambdaString', t => {
  const params = [x, y]
  const body = [multiply, x, y]
  const rest = [params, body]
  const context = {'parent': 'fake', 'definitions': {'foo': 'bar'}}

  const string = buildLambdaString(rest, context)
  t.is(string, `
    (async function(x, y) {
      if (arguments.length !== 2) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + 2 + ' arg(s)'}
      }
      body = [
        Symbol.for('block'),
          [Symbol.for('def'), Symbol.for('x'), x],[Symbol.for('def'), Symbol.for('y'), y]]
      body = body.concat([[Symbol.for('*'), Symbol.for('x'), Symbol.for('y')]])
      return await evaluate(body, context)
    })`)
})

test('lisp-parser :: lambda', t => {
  testParse(t, `
    (block
      (def double (lambda (x) (* x 2)))
      (double 8))`,
    [block,
      [def, double, [lambda, [x], [multiply, x, 2]]],
      [double, 8]],
    16)
})

test('lisp-parser :: lambda multiparam', t => {
  testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8 3))`,
    [block,
      [def, m, [lambda, [x, y], [multiply, x, y]]],
      [m, 8, 3]],
    24)
})

test('lisp-parser :: lambda w/ string', t => {
  testParse(t, `
    (block
      (def x (lambda (x) (concat x ".")))
      (x "A sentence"))`,
    [block,
      [def, x, [lambda, [x], [concat, x, '.']]],
      [x, 'A sentence']],
    'A sentence.')
})

test('lisp-parser :: lambda wrong args', t => {
  testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8))`,
    [block,
      [def, m, [lambda, [x, y], [multiply, x, y]]],
      [m, 8]],
    { error: 'has 1 arg(s) should have 2 arg(s)' })
    testParse(t, `
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
  const interpreter = makeInterpreter()
  t.is(await interpreter('1'), 1)
  t.is(await interpreter('(quote 7)'), 7)
  t.deepEqual(await interpreter('(list 6 7)'), [6, 7])
  t.is(await interpreter('(def a 19)'), 19)
  t.is(await interpreter('a'), 19)
})

test('lisp-parser :: html', async t => {
  let div = await parseAndEval(`(react "div" "stuff and stuff")`)
  t.is(ReactDOMServer.renderToStaticMarkup(div),
    '<div>stuff and stuff</div>')

  div = await parseAndEval(`(react "div" "stuff and <br/> stuff")`)
  t.is(ReactDOMServer.renderToStaticMarkup(div),
    '<div>stuff and &lt;br/&gt; stuff</div>')
})

// TODO cannot do ajax in node, where the test runs
test.skip('lisp-parser :: node', async t => {
  const result = await parseAndEval(`(node "robert+todo:latest")`)
  t.is(result, 'hi')
})

test('node :: sha256', t => {
  t.is(sha256('hello'),
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
})

test('node :: set-get', t => {
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

test('node :: encode-decode', t => {
  const owner = 'robert', name = 'todo', version = 'latest'
  t.is(encodeFullNodeURI(owner, name, version), 'node://robert+todo:latest')
  t.deepEqual(decodeNodeURI('node://robert+todo:latest'),
    { owner, name, version })
  t.deepEqual(decodeNodeURI('node://robert+todo'),
    { owner, name, version: 'unversioned' })
  t.deepEqual(decodeNodeURI('node://todo:latest', owner),
    { owner, name, version })
  t.deepEqual(decodeNodeURI('node://todo', owner),
    { owner, name, version: 'unversioned' })
})

test('node :: server-side write-read', t => {
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
