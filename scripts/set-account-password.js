const crypto = require('crypto');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return `$scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

async function main() {
    const username = process.argv[2] || 'glbnu';
    const password = process.argv[3] || 'Glbnu123456!';

    console.log(`Updating password for account: ${username}`);

    const conn = await mysql.createConnection({
        host: process.env.MARIADB_HOST || '127.0.0.1',
        user: process.env.MARIADB_USER || 'rpgblipmade',
        password: process.env.MARIADB_PASSWORD || 'EEpGpEeWQ5ml5pNb9gZ2',
        database: process.env.MARIADB_DATABASE || 'rpgblipmade',
        port: 3306
    });

    const hash = hashPassword(password);
    const salt = '';

    // Check if account exists
    const [rows] = await conn.execute('SELECT id, username, email FROM accounts WHERE LOWER(username) = LOWER(?)', [username]);

    if (rows.length > 0) {
        const account = rows[0];
        console.log(`Found existing account ID ${account.id} (${account.username})`);
        await conn.execute('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE id = ?', [hash, salt, account.id]);
        console.log(`SUCCESS: Password updated for account ${account.username} (ID: ${account.id})`);
    } else {
        console.log(`Account ${username} not found. Creating new account...`);
        const [res] = await conn.execute('INSERT INTO accounts (username, email, password_hash, password_salt) VALUES (?, ?, ?, ?)', [
            username, `${username}@sunsetmp.local`, hash, salt
        ]);
        console.log(`SUCCESS: Created account ${username} with ID ${res.insertId}`);
    }

    await conn.end();
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
