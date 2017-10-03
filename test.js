import test from 'ava';
import parse from './lisp-parser'


test('foo', t => {
	t.pass();
});

test('bar', async t => {
	const bar = Promise.resolve('bar');

	t.is(await bar, 'bar');
});

test('lisp-parser :: empty string', t => {
  t.is(parse(''), undefined)
})

test('lisp-parser :: empty list', t => {
  t.deepEqual(parse('()'), [])
})

test('lisp-parser :: symbol', t => {
  t.is(parse('Math.sqrt'), Math.sqrt)
})

test('lisp-parser :: integer', t => {
  t.is(parse('17'), 17)
})

test('lisp-parser :: float', t => {
  t.is(parse('17.19'), 17.19)
})

test('lisp-parser :: addition', t => {
  const result = parse('(+ 3 4 5 6)')
  t.is(result, 18)
})

test('lisp-parser :: addition, empty', t => {
  const result = parse('(+)')
  t.is(result, 0)
})

test('lisp-parser :: addition, one', t => {
  const result = parse('(+ 5)')
  t.is(result, 5)
})

test('lisp-parser :: square root', t => {
  const result = parse('(Math.sqrt 4)')
  t.is(result, 2)
})

test('lisp-parser :: nested', t => {
  const result = parse('(+ 5 (+ 2 7))')
  t.is(result, 14)
})

test('lisp-parser :: quote empty', t => {
  const result = parse('(quote)')
  t.deepEqual(result, null)
})

test('lisp-parser :: quote of empty', t => {
  const result = parse('(quote ())')
  t.deepEqual(result, [])
})

test('lisp-parser :: quote tiny', t => {
  const result = parse('(quote 1)')
  t.is(result, 1)
})

test('lisp-parser :: quote small', t => {
  const result = parse('(quote (1))')
  t.deepEqual(result, [1])
})

test('lisp-parser :: quote fullhand', t => {
  const result = parse('(quote (1 2 3))')
  t.deepEqual(result, [1, 2, 3])
})

test('lisp-parser :: quote shorthand', t => {
  const result = parse("'(1 2 3)")
  t.deepEqual(result, [1, 2, 3])
})

test('lisp-parser :: quote nested', t => {
  const result = parse('(quote (+ 1 (+ 2 3)))')
  t.deepEqual(result, ['+', 1, ['+', 2, 3]])
})

test('lisp-parser :: global', t => {
  const state = parse('T(def x 12)')
  t.deepEqual(state, {
    definitions: [ { x: 12 } ],
    result: undefined
  })
})
