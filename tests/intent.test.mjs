import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDishWord } from '../lib/intent.ts';

test('reads a plain dish word, singular or plural', () => {
  assert.equal(parseDishWord('burger'), 'burger');
  assert.equal(parseDishWord('healthy burgers under 20'), 'burger');
  assert.equal(parseDishWord('chicken wings'), 'wing');
  assert.equal(parseDishWord('a good pizza tonight'), 'pizza');
});

test('prefers the longer dish name over the cuisine inside it', () => {
  assert.equal(parseDishWord('pad thai please'), 'pad thai');
  assert.equal(parseDishWord('fish and chips'), 'fish and chips');
});

test('still falls back to cuisine words and returns null otherwise', () => {
  assert.equal(parseDishWord('something mexican'), 'mexican');
  assert.equal(parseDishWord('jerk chicken'), 'jerk chicken');
  assert.equal(parseDishWord('fish & chips'), 'fish and chips');
  assert.equal(parseDishWord('a double cheeseburger'), 'burger');
  assert.equal(parseDishWord('something light for lunch'), null);
});
