'use strict';

const N = require('./normalize');

/* PostgreSQL 存储：需先安装驱动 npm i pg（外部数据库经 DB_HOST 等环境变量配置，DB_SSL=true 开启 SSL）
   detail 用 JSONB，驱动会自动解析为对象；金额用 NUMERIC，读取时转数字 */
const COLS = N.COLUMNS.join(', ');

const CREATE_ITEMS = `
CREATE TABLE IF NOT EXISTS items (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT,
  category   VARCHAR(32) NOT NULL DEFAULT 'phone',
  title      VARCHAR(255) NOT NULL DEFAULT '',
  provider   VARCHAR(255) NOT NULL DEFAULT '',
  amount     NUMERIC(18,2),
  currency   VARCHAR(8) NOT NULL DEFAULT 'CNY',
  cycle      VARCHAR(16) NOT NULL DEFAULT '',
  start_date VARCHAR(10) NOT NULL DEFAULT '',
  next_date  VARCHAR(10) NOT NULL DEFAULT '',
  status     VARCHAR(16) NOT NULL DEFAULT 'active',
  detail     JSONB NOT NULL DEFAULT '{}'::jsonb,
  note       TEXT NOT NULL DEFAULT '',
  created_at VARCHAR(32) NOT NULL DEFAULT '',
  updated_at VARCHAR(32) NOT NULL DEFAULT ''
)`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(100) NOT NULL,
  email_verified_at VARCHAR(32),
  created_at        VARCHAR(32) NOT NULL DEFAULT '',
  updated_at        VARCHAR(32) NOT NULL DEFAULT ''
)`;

const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL DEFAULT ''
)`;

const CREATE_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS verifications (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL DEFAULT ''
)`;

module.exports = function (opts) {
  const o = opts || {};
  let pool = null;

  function driver() {
    try { return require('pg'); }
    catch (e) { throw new Error('未安装 PostgreSQL 驱动，请执行：npm i pg'); }
  }

  async function getById(id, userId) {
    const r = await pool.query('SELECT ' + COLS + ' FROM items WHERE id = $1 AND user_id = $2', [Number(id), Number(userId)]);
    return r.rows[0] ? N.toItem(r.rows[0]) : null;
  }

  async function getOne(sql, args) {
    const r = await pool.query(sql, args);
    return r.rows[0] || null;
  }

  return {
    type: 'postgres',
    async init() {
      const pg = driver();
      pool = new pg.Pool({
        host: o.host, port: Number(o.port) || 5432,
        user: o.user, password: o.password || '', database: o.database,
        ssl: o.ssl ? { rejectUnauthorized: false } : undefined,
        max: 5
      });
      await pool.query(CREATE_ITEMS);
      await pool.query(CREATE_USERS);
      await pool.query(CREATE_SESSIONS);
      await pool.query(CREATE_VERIFICATIONS);
      await pool.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id BIGINT');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id)');
    },

    async list(userId) {
      const r = await pool.query('SELECT ' + COLS + ' FROM items WHERE user_id = $1 ORDER BY id', [Number(userId)]);
      return r.rows.map(N.toItem);
    },
    async add(item, userId) {
      const row = N.toRow(item);
      row.user_id = userId === undefined || userId === null ? null : Number(userId);
      const keys = Object.keys(row);
      const r = await pool.query(
        'INSERT INTO items (' + keys.join(', ') + ') VALUES (' +
        keys.map((_, i) => '$' + (i + 1)).join(', ') + ') RETURNING id',
        keys.map(k => row[k]));
      return getById(r.rows[0].id, userId);
    },
    async update(id, patch, userId) {
      const row = N.toPatch(patch);
      const keys = Object.keys(row);
      if (!keys.length) return getById(id, userId);
      await pool.query(
        'UPDATE items SET ' + keys.map((k, i) => k + ' = $' + (i + 1)).join(', ') +
        ' WHERE id = $' + (keys.length + 1) + ' AND user_id = $' + (keys.length + 2),
        keys.map(k => row[k]).concat([Number(id), Number(userId)]));
      return getById(id, userId);
    },
    async remove(id, userId) {
      const gone = await getById(id, userId);
      if (!gone) return null;
      await pool.query('DELETE FROM items WHERE id = $1 AND user_id = $2', [Number(id), Number(userId)]);
      return gone;
    },
    async addMany(items, userId) {
      const out = [];
      for (const it of items) out.push(await this.add(it, userId));
      return out;
    },
    async clear(userId) {
      await pool.query('DELETE FROM items WHERE user_id = $1', [Number(userId)]);
    },

    async createUser(u) {
      const ts = N.nowISO();
      const r = await pool.query(
        'INSERT INTO users (email, password_hash, email_verified_at, created_at, updated_at) VALUES ($1, $2, NULL, $3, $4) RETURNING *',
        [String(u.email), String(u.passwordHash), ts, ts]);
      return N.toUser(r.rows[0]);
    },
    async findUserByEmail(email) {
      return N.toUser(await getOne('SELECT * FROM users WHERE email = $1', [String(email)]));
    },
    async findUserById(id) {
      return N.toUser(await getOne('SELECT * FROM users WHERE id = $1', [Number(id)]));
    },
    async verifyUser(id) {
      const ts = N.nowISO();
      await pool.query('UPDATE users SET email_verified_at = $1, updated_at = $2 WHERE id = $3', [ts, ts, Number(id)]);
    },
    async countVerifiedUsers() {
      const r = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE email_verified_at IS NOT NULL');
      return Number(r.rows[0].n);
    },

    async insertSession(s) {
      await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
        [s.tokenHash, Number(s.userId), s.expiresAt, s.createdAt || N.nowISO()]);
    },
    async findSession(tokenHash) {
      return N.toSession(await getOne('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]));
    },
    async touchSession(tokenHash, expiresAt) {
      await pool.query('UPDATE sessions SET expires_at = $1 WHERE token_hash = $2', [expiresAt, tokenHash]);
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    },

    async insertVerification(v) {
      await pool.query('INSERT INTO verifications (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
        [v.tokenHash, Number(v.userId), v.expiresAt, v.createdAt || N.nowISO()]);
    },
    async findVerification(tokenHash) {
      return N.toSession(await getOne('SELECT * FROM verifications WHERE token_hash = $1', [tokenHash]));
    },
    async deleteVerification(tokenHash) {
      await pool.query('DELETE FROM verifications WHERE token_hash = $1', [tokenHash]);
    },
    async deleteVerificationsOfUser(userId) {
      await pool.query('DELETE FROM verifications WHERE user_id = $1', [Number(userId)]);
    },

    async claimLegacyItems(userId) {
      const r = await pool.query('UPDATE items SET user_id = $1 WHERE user_id IS NULL', [Number(userId)]);
      return Number(r.rowCount || 0);
    },

    async close() { if (pool) { await pool.end(); pool = null; } },
    describe() { return { type: 'postgres', host: o.host, database: o.database }; }
  };
};
