'use strict';

const N = require('./normalize');

/* MySQL 存储：需先安装驱动 npm i mysql2（外部数据库经 DB_HOST 等环境变量配置）
   日期与时间戳统一按字符串存储，避免驱动时区转换导致日期偏移 */
const COLS = N.COLUMNS.join(', ');

const CREATE_ITEMS = `
CREATE TABLE IF NOT EXISTS items (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT NULL,
  category   VARCHAR(32) NOT NULL DEFAULT 'phone',
  title      VARCHAR(255) NOT NULL DEFAULT '',
  provider   VARCHAR(255) NOT NULL DEFAULT '',
  amount     DECIMAL(18,2) NULL,
  currency   VARCHAR(8) NOT NULL DEFAULT 'CNY',
  cycle      VARCHAR(16) NOT NULL DEFAULT '',
  start_date VARCHAR(10) NOT NULL DEFAULT '',
  next_date  VARCHAR(10) NOT NULL DEFAULT '',
  status     VARCHAR(16) NOT NULL DEFAULT 'active',
  detail     TEXT,
  note       TEXT,
  created_at VARCHAR(32) NOT NULL DEFAULT '',
  updated_at VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(255) NOT NULL,
  password_hash     VARCHAR(100) NOT NULL,
  email_verified_at VARCHAR(32) NULL,
  created_at        VARCHAR(32) NOT NULL DEFAULT '',
  updated_at        VARCHAR(32) NOT NULL DEFAULT '',
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL DEFAULT '',
  KEY idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const CREATE_VERIFICATIONS = `
CREATE TABLE IF NOT EXISTS verifications (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  created_at VARCHAR(32) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

module.exports = function (opts) {
  const o = opts || {};
  let pool = null;

  function driver() {
    try { return require('mysql2/promise'); }
    catch (e) { throw new Error('未安装 MySQL 驱动，请执行：npm i mysql2'); }
  }

  async function ensureItemsUserColumn() {
    const [cols] = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'items' AND column_name = 'user_id'");
    if (!Number(cols[0].n)) {
      await pool.query('ALTER TABLE items ADD COLUMN user_id BIGINT NULL, ADD INDEX idx_items_user (user_id)');
    }
  }

  async function getById(id, userId) {
    const [rows] = await pool.query('SELECT ' + COLS + ' FROM items WHERE id = ? AND user_id = ?', [Number(id), Number(userId)]);
    return rows[0] ? N.toItem(rows[0]) : null;
  }

  async function getOne(sql, args) {
    const [rows] = await pool.query(sql, args);
    return rows[0] || null;
  }

  return {
    type: 'mysql',
    async init() {
      const mysql = driver();
      pool = mysql.createPool({
        host: o.host, port: Number(o.port) || 3306,
        user: o.user, password: o.password || '', database: o.database,
        waitForConnections: true, connectionLimit: 5, charset: 'utf8mb4'
      });
      await pool.query(CREATE_ITEMS);
      await pool.query(CREATE_USERS);
      await pool.query(CREATE_SESSIONS);
      await pool.query(CREATE_VERIFICATIONS);
      await ensureItemsUserColumn();
    },

    async list(userId) {
      const [rows] = await pool.query('SELECT ' + COLS + ' FROM items WHERE user_id = ? ORDER BY id', [Number(userId)]);
      return rows.map(N.toItem);
    },
    async add(item, userId) {
      const row = N.toRow(item);
      row.user_id = userId === undefined || userId === null ? null : Number(userId);
      const keys = Object.keys(row);
      const [r] = await pool.query(
        'INSERT INTO items (' + keys.join(', ') + ') VALUES (' + keys.map(() => '?').join(', ') + ')',
        keys.map(k => row[k]));
      return getById(r.insertId, userId);
    },
    async update(id, patch, userId) {
      const row = N.toPatch(patch);
      const keys = Object.keys(row);
      if (!keys.length) return getById(id, userId);
      await pool.query(
        'UPDATE items SET ' + keys.map(k => k + ' = ?').join(', ') + ' WHERE id = ? AND user_id = ?',
        keys.map(k => row[k]).concat([Number(id), Number(userId)]));
      return getById(id, userId);
    },
    async remove(id, userId) {
      const gone = await getById(id, userId);
      if (!gone) return null;
      await pool.query('DELETE FROM items WHERE id = ? AND user_id = ?', [Number(id), Number(userId)]);
      return gone;
    },
    async addMany(items, userId) {
      const out = [];
      for (const it of items) out.push(await this.add(it, userId));
      return out;
    },
    async clear(userId) {
      await pool.query('DELETE FROM items WHERE user_id = ?', [Number(userId)]);
    },

    async createUser(u) {
      const ts = N.nowISO();
      await pool.query(
        'INSERT INTO users (email, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)',
        [String(u.email), String(u.passwordHash), ts, ts]);
      return N.toUser(await getOne('SELECT * FROM users WHERE email = ?', [String(u.email)]));
    },
    async findUserByEmail(email) {
      return N.toUser(await getOne('SELECT * FROM users WHERE email = ?', [String(email)]));
    },
    async findUserById(id) {
      return N.toUser(await getOne('SELECT * FROM users WHERE id = ?', [Number(id)]));
    },
    async verifyUser(id) {
      const ts = N.nowISO();
      await pool.query('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?', [ts, ts, Number(id)]);
    },
    async countVerifiedUsers() {
      const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL');
      return Number(rows[0].n);
    },

    async insertSession(s) {
      await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [s.tokenHash, Number(s.userId), s.expiresAt, s.createdAt || N.nowISO()]);
    },
    async findSession(tokenHash) {
      return N.toSession(await getOne('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]));
    },
    async touchSession(tokenHash, expiresAt) {
      await pool.query('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [expiresAt, tokenHash]);
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    },

    async insertVerification(v) {
      await pool.query('INSERT INTO verifications (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [v.tokenHash, Number(v.userId), v.expiresAt, v.createdAt || N.nowISO()]);
    },
    async findVerification(tokenHash) {
      return N.toSession(await getOne('SELECT * FROM verifications WHERE token_hash = ?', [tokenHash]));
    },
    async deleteVerification(tokenHash) {
      await pool.query('DELETE FROM verifications WHERE token_hash = ?', [tokenHash]);
    },
    async deleteVerificationsOfUser(userId) {
      await pool.query('DELETE FROM verifications WHERE user_id = ?', [Number(userId)]);
    },

    async claimLegacyItems(userId) {
      const [r] = await pool.query('UPDATE items SET user_id = ? WHERE user_id IS NULL', [Number(userId)]);
      return Number(r.affectedRows || 0);
    },

    async close() { if (pool) { await pool.end(); pool = null; } },
    describe() { return { type: 'mysql', host: o.host, database: o.database }; }
  };
};
