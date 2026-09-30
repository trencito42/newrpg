const crypto = require('crypto');
const fs = require('fs');
const { spawnSync } = require('child_process');

const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const password = 'Glbnu123456!';
const salt = crypto.randomBytes(16);
const derived = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
const hash = `$scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;

console.log('Hash:', hash);

const sql = `
INSERT INTO accounts (username, email, password_hash, password_salt)
VALUES ('glbnu', 'glbnu@sunsetmp.local', '${hash}', '')
ON DUPLICATE KEY UPDATE password_hash = '${hash}', password_salt = '';
`;

const res = spawnSync('mariadb', [
    '-h', '127.0.0.1',
    '-u', 'rpgblipmade',
    '-pEEpGpEeWQ5ml5pNb9gZ2',
    'rpgblipmade'
], {
    input: sql,
    encoding: 'utf-8'
});

if (res.error) {
    console.error('Error:', res.error);
} else if (res.status !== 0) {
    console.error('Failed (status ' + res.status + '):', res.stderr);
} else {
    console.log('SUCCESS: glbnu password updated to Glbnu123456!');
}
