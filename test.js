import test from 'ava';
import { parse, evaluate } from './lisp-parser'


function testParse(t, string, expectedTree, expectedResult) {
  const tree = parse(string)
  t.deepEqual(tree, expectedTree)
  t.deepEqual(evaluate(tree), expectedResult)
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

test('lisp-parser :: integer', t => {
  testParse(t, '17', '17', 17)
})

test('lisp-parser :: float', t => {
  testParse(t, '17.19', '17.19', 17.19)
})

test('lisp-parser :: addition', t => {
  testParse(t, '(+ 3 4 5 6)', ['+', '3', '4', '5', '6'], 18)
})

test('lisp-parser :: addition, empty', t => {
  testParse(t, '(+)', ['+'], 0)
})

test('lisp-parser :: addition, one', t => {
  testParse(t, '(+ 5)', ['+', '5'], 5)
})

test('lisp-parser :: square root', t => {
  testParse(t, '(Math.sqrt 4)', ['Math.sqrt', '4'], 2)
})

test('lisp-parser :: nested', t => {
  testParse(t, '(+ 5 (+ 2 7))', ['+', '5', ['+', '2', '7']], 14)
})

test('lisp-parser :: quote empty', t => {
  testParse(t, '(quote)', ['quote'], {error: '`quote` must have exactly 1 argument'})
})

test('lisp-parser :: quote of empty', t => {
  testParse(t, '(quote ())', ['quote', []], [])
})

test('lisp-parser :: quote tiny', t => {
  testParse(t, '(quote 1)', ['quote', '1'], '1')
})

test('lisp-parser :: quote small', t => {
  testParse(t, '(quote (1))', ['quote', ['1']], ['1'])
})

test('lisp-parser :: quote fullhand', t => {
  testParse(t, '(quote (1 2 3))', ['quote', ['1', '2', '3']], ['1', '2', '3'])
})

test('lisp-parser :: quote shorthand', t => {
  testParse(t, "'(1 2 3)", ['quote', ['1', '2', '3']], ['1', '2', '3'])
})

test('lisp-parser :: quote nested', t => {
  testParse(t, '(quote (+ 1 (+ 2 3)))',
    ['quote', ['+', '1', ['+', '2', '3']]],
    ['+', '1', ['+', '2', '3']]
  )
})
