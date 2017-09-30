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
  t.is(parse(''), '')
})
