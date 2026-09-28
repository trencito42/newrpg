'use strict';

const crypto = require('crypto');
const KEY_LENGTH = 32;
const OPTIONS = Object.freeze({ N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) return null;
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, OPTIONS);
  return `$scrypt$${OPTIONS.N}$${OPTIONS.r}$${OPTIONS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 7 || parts[1] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(2, 5).map(Number);
  if (N !== OPTIONS.N || r !== OPTIONS.r || p !== OPTIONS.p) return false;
  try {
    const salt = Buffer.from(parts[5], 'base64');
    const expected = Buffer.from(parts[6], 'base64');
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = crypto.scryptSync(password, salt, expected.length, { N, r, p, maxmem: OPTIONS.maxmem });
    return crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

if (typeof exports === 'function') {
  exports('HashPassword', hashPassword);
  exports('VerifyPassword', verifyPassword);
}

if (typeof module !== 'undefined') module.exports = { hashPassword, verifyPassword, OPTIONS };
