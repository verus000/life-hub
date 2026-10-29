'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const N = require('./normalize');

/* SQLite 存储：Node 内置，零额外驱动，单文件，推荐用于长期使用 */
const CREATE_ITEMS = `
CREATE TABLE IF NOT EXISTS items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  category   TEXT NOT NULL DEFAULT 'phone',
  title      TEXT NOT NULL DEFAULT '',
  provider   TEXT NOT NULL DEFAULT '',
  amount     REAL,
  currency   TEXT NOT NULL DEFAULT 'CNY',
  cycle      TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  next_date  TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active',
  detail     TEXT NOT NULL DEFAULT '{}',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
)`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  email_verified_at TEXT,
  created_at        TEXT NOT NULL DEFAULT '',
  updated_at        TEXT NOT NULL DEFAULT ''
)`;

const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
)`;

const CREATE_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS verifications (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ''
)`;

const COLS = N.COLUMNS.join(', ');

module.exports = function (opts) {
  const file = opts && opts.file;
  if (!file) throw new Error('sqlite 适配器缺少 file 配置');
  let db = null;

  function userOf(id) {
    return N.toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)));
  }

  function getById(id, userId) {
    const r = db.prepare('SELECT ' + COLS + ' FROM items WHERE id = ? AND user_id = ?')
      .get(Number(id), Number(userId));
    return r ? N.toItem(r) : null;
  }

  return {
    type: 'sqlite',
    async init() {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      db = new DatabaseSync(file);
      db.exec('PRAGMA journal_mode = WAL');
      db.exec(CREATE_ITEMS);
      db.exec(CREATE_USERS);
      db.exec(CREATE_SESSIONS);
      db.exec(CREATE_VERIFICATIONS);
      /* 旧库迁移：items 增加 user_id（首个完成邮箱验证的用户自动认领历史数据） */
      const cols = db.prepare('PRAGMA table_info(items)').all();
      if (!cols.some(c => c.name === 'user_id')) db.exec('ALTER TABLE items ADD COLUMN user_id INTEGER');
      db.exec('CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id)');
    },

    async list(userId) {
      return db.prepare('SELECT ' + COLS + ' FROM items WHERE user_id = ? ORDER BY id')
        .all(Number(userId)).map(N.toItem);
    },
    async add(item, userId) {
      const row = N.toRow(item);
      row.user_id = userId === undefined || userId === null ? null : Number(userId);
      const keys = Object.keys(row);
      const sql = 'INSERT INTO items (' + keys.join(', ') + ') VALUES (' +
        keys.map(() => '?').join(', ') + ')';
      const r = db.prepare(sql).run(...keys.map(k => (row[k] === undefined ? null : row[k])));
      return getById(Number(r.lastInsertRowid), userId);
    },
    async update(id, patch, userId) {
      const row = N.toPatch(patch);
      const keys = Object.keys(row);
      if (!keys.length) return getById(id, userId);
      const sql = 'UPDATE items SET ' + keys.map(k => k + ' = ?').join(', ') +
        ' WHERE id = ? AND user_id = ?';
      db.prepare(sql).run(...keys.map(k => (row[k] === undefined ? null : row[k])), Number(id), Number(userId));
      return getById(id, userId);
    },
    async remove(id, userId) {
      const gone = getById(id, userId);
      if (!gone) return null;
      db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(Number(id), Number(userId));
      return gone;
    },
    async addMany(items, userId) {
      const out = [];
      for (const it of items) out.push(await this.add(it, userId));
      return out;
    },
    async clear(userId) {
      db.prepare('DELETE FROM items WHERE user_id = ?').run(Number(userId));
    },

    async createUser(u) {
      const ts = N.nowISO();
      db.prepare('INSERT INTO users (email, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)')
        .run(String(u.email), String(u.passwordHash), ts, ts);
      return userOf(db.prepare('SELECT id FROM users WHERE email = ?').get(String(u.email)).id);
    },
    async findUserByEmail(email) {
      return N.toUser(db.prepare('SELECT * FROM users WHERE email = ?').get(String(email)));
    },
    async findUserById(id) { return userOf(id); },
    async verifyUser(id) {
      const ts = N.nowISO();
      db.prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?').run(ts, ts, Number(id));
    },
    async countVerifiedUsers() {
      return Number(db.prepare('SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL').get().n);
    },

    async insertSession(s) {
      db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(s.tokenHash, Number(s.userId), s.expiresAt, s.createdAt || N.nowISO());
    },
    async findSession(tokenHash) {
      return N.toSession(db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash));
    },
    async touchSession(tokenHash, expiresAt) {
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(expiresAt, tokenHash);
    },
    async deleteSession(tokenHash) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },

    async insertVerification(v) {
      db.prepare('INSERT INTO verifications (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(v.tokenHash, Number(v.userId), v.expiresAt, v.createdAt || N.nowISO());
    },
    async findVerification(tokenHash) {
      return N.toSession(db.prepare('SELECT * FROM verifications WHERE token_hash = ?').get(tokenHash));
    },
    async deleteVerification(tokenHash) {
      db.prepare('DELETE FROM verifications WHERE token_hash = ?').run(tokenHash);
    },
    async deleteVerificationsOfUser(userId) {
      db.prepare('DELETE FROM verifications WHERE user_id = ?').run(Number(userId));
    },

    async claimLegacyItems(userId) {
      const r = db.prepare('UPDATE items SET user_id = ? WHERE user_id IS NULL').run(Number(userId));
      return Number(r.changes);
    },

    async close() { if (db) { try { db.close(); } catch (e) { /* 已关闭 */ } db = null; } },
    describe() { return { type: 'sqlite', file: file }; }
  };
};
