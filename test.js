import test from 'ava';
import { parse, evaluate } from './lisp-parser'


test('bar', async t => {
	const bar = Promise.resolve('bar');
	t.deepEqual(await bar, 'bar');
});

test('lisp-parser :: empty string', t => {
  const tree = parse('')
  t.deepEqual(tree, undefined)
  t.deepEqual(evaluate(tree, {}), undefined)
})

test('lisp-parser :: empty list', t => {
  const tree = parse('()')
  t.deepEqual(tree, [])
  // t.deepEqual(evaluate(tree), [])
})

test('lisp-parser :: symbol', t => {
  const tree = parse('Math.sqrt')
  t.deepEqual(tree, 'Math.sqrt')
  // t.deepEqual(evaluate(Math.sqrt), Math.sqrt)
})

test('lisp-parser :: integer', t => {
  const tree = parse('17')
  t.deepEqual(tree, '17')
})

test('lisp-parser :: float', t => {
  const tree = parse('17.19')
  t.deepEqual(tree, '17.19')
})

test('lisp-parser :: addition', t => {
  const tree = parse('(+ 3 4 5 6)')
  t.deepEqual(tree, ['+', '3', '4', '5', '6'])
})

test('lisp-parser :: addition, empty', t => {
  const tree = parse('(+)')
  t.deepEqual(tree, ['+'])
})

test('lisp-parser :: addition, one', t => {
  const tree = parse('(+ 5)')
  t.deepEqual(tree, ['+', '5'])
})

test('lisp-parser :: square root', t => {
  const tree = parse('(Math.sqrt 4)')
  t.deepEqual(tree, ['Math.sqrt', '4'])
})

test('lisp-parser :: nested', t => {
  const tree = parse('(+ 5 (+ 2 7))')
  t.deepEqual(tree, ['+', '5', ['+', '2', '7']])
})

test('lisp-parser :: quote empty', t => {
  const tree = parse('(quote)')
  t.deepEqual(tree, ['quote'])
})

test('lisp-parser :: quote of empty', t => {
  const tree = parse('(quote ())')
  t.deepEqual(tree, ['quote', []])
})

test('lisp-parser :: quote tiny', t => {
  const tree = parse('(quote 1)')
  t.deepEqual(tree, ['quote', '1'])
})

test('lisp-parser :: quote small', t => {
  const tree = parse('(quote (1))')
  t.deepEqual(tree, ['quote', ['1']])
})

test('lisp-parser :: quote fullhand', t => {
  const tree = parse('(quote (1 2 3))')
  t.deepEqual(tree, ['quote', ['1', '2', '3']])
})

test('lisp-parser :: quote shorthand', t => {
  const tree = parse("'(1 2 3)")
  t.deepEqual(tree, ['quote', ['1', '2', '3']])
})

test('lisp-parser :: quote nested', t => {
  const tree = parse('(quote (+ 1 (+ 2 3)))')
  t.deepEqual(tree, ['quote', ['+', '1', ['+', '2', '3']]])
})
