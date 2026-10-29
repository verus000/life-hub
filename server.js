'use strict';

/* 生活管理 · 服务入口
   启动：npm start   或   node server.js
   环境变量可写在 .env（Docker / compose 直接注入环境变量，优先级更高）
   切换数据库：DB_TYPE 环境变量或 config.json 的 database.type */

try { require('dotenv').config(); } catch (e) { /* 缺少 dotenv 或 .env 时忽略 */ }

const { load } = require('./src/config');
const { create: createDb } = require('./src/db');
const { createServer } = require('./src/http');
const { createAuth } = require('./src/auth');
const makeRoutes = require('./src/routes');

async function main() {
  const cfg = load();
  if (!cfg.auth.appUrl) {
    const shown = cfg.server.host === '0.0.0.0' ? 'localhost' : cfg.server.host;
    cfg.auth.appUrl = 'http://' + shown + ':' + cfg.server.port;
  }
  const db = createDb(cfg.database);
  await db.init();

  const auth = createAuth(db, cfg.auth);
  const server = createServer(cfg, db, makeRoutes(db, auth));

  server.listen(cfg.server.port, cfg.server.host, () => {
    const d = db.describe();
    let where = d.type;
    if (d.file) where += ' → ' + d.file;
    if (d.database) where += ' → ' + d.database + '@' + d.host;
    console.log('生活管理已启动：http://' + cfg.server.host + ':' + cfg.server.port);
    console.log('当前数据库：' + where);
    console.log('邮件发送：' + (auth.mailMode === 'smtp'
      ? 'SMTP ' + cfg.auth.smtp.host + '（发件人 ' + (cfg.auth.smtp.from || cfg.auth.smtp.user || '未设置') + '）'
      : '控制台模式（验证链接打印到日志，配置 SMTP_* 并设 MAIL_MODE=smtp 可启用真实邮件）'));
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error('端口 ' + cfg.server.port + ' 已被占用，可修改 config.json 的 server.port 或用 PORT=xxxx npm start 指定');
    } else {
      console.error('服务异常：', err);
    }
    process.exit(1);
  });

  let closing = false;
  async function shutdown(sig) {
    if (closing) return;
    closing = true;
    console.log('\n收到 ' + sig + '，正在关闭…');
    server.close();
    try { await db.close(); } catch (e) { /* 忽略关闭异常 */ }
    process.exit(0);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => {
  console.error('启动失败：' + (err && err.message ? err.message : err));
  process.exit(1);
});
