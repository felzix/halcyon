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

test('lisp-parser :: atom', t => {
  testParse(t, '17', '17', 17)
  testParse(t, '17.19', '17.19', 17.19)
  testParse(t, 'true', 'true', true)
  testParse(t, 'false', 'false', false)
})

test('lisp-parser :: arithmetic', t => {
  testParse(t, '(+)', ['+'], { error: '`+` must have at least 1 argument' })
  testParse(t, '(+ 5)', ['+', '5'], 5)
  testParse(t, '(+ 3 4 5 6)', ['+', '3', '4', '5', '6'], 3+4+5+6)

  testParse(t, '(-)', ['-'], { error: '`-` must have at least 1 argument' })
  testParse(t, '(- 5)', ['-', '5'], -5)
  testParse(t, '(- 3 4 5 6)', ['-', '3', '4', '5', '6'], 3-4-5-6)

  testParse(t, '(*)', ['*'], { error: '`*` must have at least 1 argument' })
  testParse(t, '(* 5)', ['*', '5'], 5)
  testParse(t, '(* 3 4 5 6)', ['*', '3', '4', '5', '6'], 3*4*5*6)

  testParse(t, '(/)', ['/'], { error: '`/` must have at least 1 argument' })
  testParse(t, '(/ 5)', ['/', '5'], 1/5)
  testParse(t, '(/ 3 4 5 6)', ['/', '3', '4', '5', '6'], 3/4/5/6)
})

test('lisp-parser :: javascript native', t => {
  testParse(t, '(Math.sqrt 4)', ['Math.sqrt', '4'], Math.sqrt(4))
})

test('lisp-parser :: nested', t => {
  testParse(t, '(+ 5 (+ 2 7))', ['+', '5', ['+', '2', '7']], 5+(2+7))
  testParse(t, '(+ (+ 2 7) (+ 7 8))', ['+', ['+', '2', '7'], ['+', '7', '8']], (2+7)+(7+8))
})

test('lisp-parser :: quote', t => {
  testParse(t, '(quote)', ['quote'], {error: '`quote` must have exactly 1 argument'})
  testParse(t, '(quote ())', ['quote', []], [])
  testParse(t, '(quote 1)', ['quote', '1'], '1')
  testParse(t, '(quote (1))', ['quote', ['1']], ['1'])
  testParse(t, '(quote (1 2 3))', ['quote', ['1', '2', '3']], ['1', '2', '3'])
  testParse(t, "'(1 2 3)", ['quote', ['1', '2', '3']], ['1', '2', '3'])
  testParse(t, '(quote (+ 1 (+ 2 3)))',
    ['quote', ['+', '1', ['+', '2', '3']]],
    ['+', '1', ['+', '2', '3']]
  )
})

test('lisp-parser :: list', t => {
  testParse(t, '(list)', ['list'], [])
  testParse(t, '(list ())', ['list', []], [[]])
  testParse(t, '(list 1 2 3)', ['list', '1', '2', '3'], [1, 2, 3])
  testParse(t, '(list (list 1 2) (list 3) (list))',
    ['list', ['list', '1', '2'], ['list', '3'], ['list']],
    [[1, 2], [3], []]
  )
})


test('lisp-parser :: global def', t => {
  t.pass()
})
