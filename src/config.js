'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const DB_DEFAULTS = {
  json: { file: './data/items.json' },
  sqlite: { file: './data/life-hub.db' },
  mysql: { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'life_hub' },
  postgres: { host: '127.0.0.1', port: 5432, user: 'postgres', password: '', database: 'life_hub', ssl: false }
};

const TYPES = Object.keys(DB_DEFAULTS);

function boolEnv(v) { return v !== undefined && /^(1|true|yes)$/i.test(String(v)); }

/* 认证与邮件配置：只来自环境变量（server.js 入口先用 dotenv 加载 .env） */
function loadAuth() {
  const modeEnv = process.env.MAIL_MODE;
  const mailMode = modeEnv === 'console' ? 'console'
    : (modeEnv === 'smtp' || (!modeEnv && process.env.SMTP_HOST)) ? 'smtp' : 'console';
  return {
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS) || 7,
    cookieName: process.env.COOKIE_NAME || 'life_hub_session',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
    appUrl: process.env.APP_URL || '',
    mailMode: mailMode,
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || ''
    }
  };
}

function load() {
  let file = {};
  const cfgPath = path.join(ROOT, 'config.json');
  if (fs.existsSync(cfgPath)) {
    try { file = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
    catch (e) { throw new Error('config.json 解析失败：' + e.message); }
  }

  const server = {
    host: process.env.HOST || (file.server && file.server.host) || '127.0.0.1',
    port: Number(process.env.PORT || (file.server && file.server.port) || 8787)
  };

  const dbIn = file.database || {};
  const type = String(process.env.DB_TYPE || dbIn.type || 'sqlite').toLowerCase();
  if (TYPES.indexOf(type) < 0) {
    throw new Error('不支持的数据库类型 "' + type + '"，可选：' + TYPES.join(' / '));
  }

  const database = { type: type };
  TYPES.forEach(k => {
    database[k] = Object.assign({}, DB_DEFAULTS[k], dbIn[k] || {});
  });

  const cur = database[type];
  if (process.env.DB_FILE) cur.file = process.env.DB_FILE;
  const pairs = { DB_HOST: 'host', DB_PORT: 'port', DB_USER: 'user', DB_PASSWORD: 'password', DB_NAME: 'database' };
  Object.keys(pairs).forEach(env => {
    if (process.env[env] === undefined) return;
    const key = pairs[env];
    cur[key] = (key === 'port') ? Number(process.env[env]) : process.env[env];
  });
  if (process.env.DB_SSL !== undefined && type === 'postgres') cur.ssl = boolEnv(process.env.DB_SSL);

  if (database.json.file) database.json.file = path.resolve(ROOT, database.json.file);
  if (database.sqlite.file) database.sqlite.file = path.resolve(ROOT, database.sqlite.file);

  return { root: ROOT, server: server, database: database, auth: loadAuth() };
}

module.exports = { load, ROOT, TYPES };
