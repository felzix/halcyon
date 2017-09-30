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

test('lisp-parser :: null', t => {
  t.is(parse('()'), null)
})

test('lisp-parser :: symbol', t => {
  t.is(parse('Math.sqrt'), Math.sqrt)
})

test('lisp-parser :: addition', t => {
  const result = parse('(+ 3 4 5)')
  console.log(result)
  t.is(result, 12)
})

test('lisp-parser :: square root', t => {
  const result = parse('(Math.sqrt 4)')
  console.log(result)
  t.is(result, 2)
})

test('lisp-parser :: nested', t => {
  const result = parse('(+ 5 (+ 2 7))')
  console.log(result)
  t.is(result, 14)
})
