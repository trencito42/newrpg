'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../../resources/[framework]/rpg_core/server/password.js');

test('scrypt hashes are salted and verify safely', () => {
  const password = 'correct horse battery staple';
  const first = hashPassword(password);
  const second = hashPassword(password);
  assert.match(first, /^\$scrypt\$32768\$8\$1\$/);
  assert.notEqual(first, second);
  assert.equal(verifyPassword(password, first), true);
  assert.equal(verifyPassword('wrong password', first), false);
  assert.equal(verifyPassword(password, first.replace('$32768$', '$2$')), false);
});

test('password length policy is enforced by hashing boundary', () => {
  assert.equal(hashPassword('short'), null);
  assert.equal(hashPassword('x'.repeat(129)), null);
});

