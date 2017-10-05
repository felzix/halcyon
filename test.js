import test from 'ava';
import { parse, evaluate, buildLambdaString, defaultContext, makeInterpreter } from './lisp-parser'
import parseAndEval from './lisp-parser'


function testParse(t, string, expectedTree, expectedResult) {
  const tree = parse(string)
  t.deepEqual(tree, expectedTree)
  t.deepEqual(evaluate(tree, defaultContext), expectedResult)
}


test('bar', async t => {
	const bar = Promise.resolve('bar');
	t.deepEqual(await bar, 'bar');
});

test('lisp-parser :: empty string', t => {
  const tree = parse('')
  t.deepEqual(tree, undefined)
})

test('lisp-parser :: empty list', t => {
  testParse(t, '()', [], [])
})

test('lisp-parser :: symbol', t => {
  testParse(t, 'Math.sqrt', 'Math.sqrt', Math.sqrt)
})

test('lisp-parser :: atom', t => {
  testParse(t, '17', 17, 17)
  testParse(t, '17.19', 17.19, 17.19)
  testParse(t, 'true', true, true)
  testParse(t, 'false', false, false)
  testParse(t, '"hello"', '"hello"', 'hello')
  testParse(t, `"hi \\" girl"`, '"hi \\" girl"', 'hi " girl')
  testParse(t, `"a \\ b"`, '"a \\\\ b"', 'a \\ b')
})

test('lisp-parser :: arithmetic', t => {
  testParse(t, '(+)', ['+'], { error: '`+` must have at least 1 argument' })
  testParse(t, '(+ 5)', ['+', 5], 5)
  testParse(t, '(+ 3 4 5 6)', ['+', 3, 4, 5, 6], 3+4+5+6)

  testParse(t, '(-)', ['-'], { error: '`-` must have at least 1 argument' })
  testParse(t, '(- 5)', ['-', 5], -5)
  testParse(t, '(- 3 4 5 6)', ['-', 3, 4, 5, 6], 3-4-5-6)

  testParse(t, '(*)', ['*'], { error: '`*` must have at least 1 argument' })
  testParse(t, '(* 5)', ['*', 5], 5)
  testParse(t, '(* 3 4 5 6)', ['*', 3, 4, 5, 6], 3*4*5*6)

  testParse(t, '(/)', ['/'], { error: '`/` must have at least 1 argument' })
  testParse(t, '(/ 5)', ['/', 5], 1/5)
  testParse(t, '(/ 3 4 5 6)', ['/', 3, 4, 5, 6], 3/4/5/6)
})

test('lisp-parser :: javascript native', t => {
  testParse(t, '(Math.sqrt 4)', ['Math.sqrt', 4], Math.sqrt(4))
})

test('lisp-parser :: nested', t => {
  testParse(t, '(+ 5 (+ 2 7))', ['+', 5, ['+', 2, 7]], 5+(2+7))
  testParse(t, '(+ (+ 2 7) (+ 7 8))', ['+', ['+', 2, 7], ['+', 7, 8]], (2+7)+(7+8))
})

test('lisp-parser :: quote', t => {
  testParse(t, '(quote)', ['quote'], {error: '`quote` must have exactly 1 argument'})
  testParse(t, '(quote ())', ['quote', []], [])
  testParse(t, '(quote 1)', ['quote', 1], 1)
  testParse(t, '(quote (1))', ['quote', [1]], [1])
  testParse(t, '(quote (1 2 3))', ['quote', [1, 2, 3]], [1, 2, 3])
  testParse(t, "'(4 5 6)", ['quote', [4, 5, 6]], [4, 5, 6])
  testParse(t, "(list '(7 8) '(9 10))",
    ['list', ['quote', [7, 8]], ['quote', [9, 10]]],
    [[7, 8], [9, 10]])
  testParse(t, '(quote (+ 1 (+ 2 3)))',
    ['quote', ['+', 1, ['+', 2, 3]]],
    ['+', 1, ['+', 2, 3]]
  )
})

test('lisp-parser :: list', t => {
  testParse(t, '(list)', ['list'], [])
  testParse(t, '(list ())', ['list', []], [[]])
  testParse(t, '(list 1 2 3)', ['list', 1, 2, 3], [1, 2, 3])
  testParse(t, '(list (list 1 2) (list 3) (list))',
    ['list', ['list', 1, 2], ['list', 3], ['list']],
    [[1, 2], [3], []]
  )
})

// TODO need to separate out strings and symbols so strings are strings in JS before eval
test.skip('lisp-parser :: append', t => {
  t.deepEqual(
    parseAndEval(`(append '(12 14) '("friends"))`),
    // [12, 14, `"friends"`]  // NOTE this should fail but it succeeds
    [12, 14, `friends`]  // NOTE this should succeed but it fails
  )
})

test('lisp-parser :: headrest', t => {
  t.deepEqual(
    parseAndEval("(head)"),
    { error: '`head` takes exactly 1 argument' })
  t.deepEqual(
    parseAndEval("(head '())"),
    { error: 'argument to `head` must be a list of at least 1 element' })
  t.deepEqual(
    parseAndEval("(head '(1))"),
    1)
  t.deepEqual(
    parseAndEval("(head '(1 2 3))"),
    1)

  t.deepEqual(
    parseAndEval("(rest)"),
    { error: '`rest` takes exactly 1 argument' })
  t.deepEqual(
    parseAndEval("(rest '())"),
    { error: 'argument to `rest` must be a list of at least 1 element' })
  t.deepEqual(
    parseAndEval("(rest '(1))"),
    [])
    t.deepEqual(
      parseAndEval("(rest '(1 2 3))"),
      [2, 3])
})

test('lisp-parser :: symbolism', t => {
  testParse(t, '(list (def foo 12) foo)', ['list', ['def', 'foo', 12], 'foo'], [12, 12])
  testParse(t, '(block (def foo 12) foo)', ['block', ['def', 'foo', 12], 'foo'], 12)
  testParse(t, `
    (block
      (def foo 12)
      (block
        (def foo 8))
      foo)`,
    ['block',
      ['def', 'foo', 12],
      ['block',
        ['def', 'foo', 8]],
      'foo'],
    12)
})

test('lisp-parser :: util :: buildLambdaString', t => {
  const params = ['x', 'y']
  const body = ['*', 'x', 'y']
  const rest = [params, body]
  const context = {'parent': 'fake', 'definitions': {'foo': 'bar'}}

  const string = buildLambdaString(rest, context)
  t.is(string,`
    (function(x, y) {
      if (arguments.length !== 2) {
        return { error: 'has ' + arguments.length + ' arg(s) should have ' + 2 + ' arg(s)'}
      }
      body = [
        'block',
          ['def', 'x', x],['def', 'y', y]]
      body = body.concat([["*","x","y"]])
      return evaluate(body, context)
    })`)
})

test('lisp-parser :: lambda', t => {
  testParse(t, `
    (block
      (def double (lambda (x) (* x 2)))
      (double 8))`,
    ['block',
      ['def', 'double', ['lambda', ['x'], ['*', 'x', 2]]],
      ['double', 8]],
    16)
})

test('lisp-parser :: lambda multiparam', t => {
  testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8 3))`,
    ['block',
      ['def', 'm', ['lambda', ['x', 'y'], ['*', 'x', 'y']]],
      ['m', 8, 3]],
    24)
})

test('lisp-parser :: lambda wrong args', t => {
  testParse(t, `
    (block
      (def m (lambda (x y) (* x y)))
      (m 8))`,
    ['block',
      ['def', 'm', ['lambda', ['x', 'y'], ['*', 'x', 'y']]],
      ['m', 8]],
    { error: 'has 1 arg(s) should have 2 arg(s)' })
    testParse(t, `
      (block
        (def m (lambda (x y) (* x y)))
        (m 8 9 10))`,
      ['block',
        ['def', 'm', ['lambda', ['x', 'y'], ['*', 'x', 'y']]],
        ['m', 8, 9, 10]],
      { error: 'has 3 arg(s) should have 2 arg(s)' })
})

test('lisp-parser :: closure', t => {
  const result = parseAndEval(`
    (block
      (def outer (lambda (x)
        (lambda (y)
          (+ x y))))
      (def jazz (outer 9))
      (jazz 3))`)
  t.is(result, 9+3)
})

test('lisp-parser :: lambda as first argument', t => {
  const result = parseAndEval(`
    ((lambda (x) (* x 10)) 8)`)
  t.is(result, 10*8)
})

test('lisp-parser :: interpreter', t => {
  const interpreter = makeInterpreter()
  t.is(interpreter('1'), 1)
  t.is(interpreter('(quote 7)'), 7)
  t.deepEqual(interpreter('(list 6 7)'), [6, 7])
  t.is(interpreter('(def a 19)'), 19)
  t.is(interpreter('a'), 19)
})
