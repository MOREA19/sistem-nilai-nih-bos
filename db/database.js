const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
require('dotenv').config();

const databasePath = path.resolve(process.env.DB_PATH || './db/sistem-nilai.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('foreign_keys = ON');

// SQLite membuat tabel hanya saat belum ada, jadi aman dipanggil pada setiap startup.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;