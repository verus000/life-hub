'use strict';

/* 认证模块：邮箱注册（邮件验证）、登录会话、限流。
   配置全部来自环境变量（经 src/config.js 归并）；数据库细节留在适配器。 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendJson } = require('./http');
const { nowISO } = require('./db/normalize');

const VERIFY_TTL_HOURS = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;
const RATE_WINDOWS = { register: 15 * 60000, login: 15 * 60000, resend: 15 * 60000 };
const RATE_LIMITS = { register: 10, login: 20, resend: 5 };

function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function newToken() { return crypto.randomBytes(32).toString('hex'); }
function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function clientIp(req) { return (req.socket && req.socket.remoteAddress) || 'unknown'; }

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i <= 0) return;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
    catch (e) { out[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  });
  return out;
}

function createAuth(db, options) {
  const o = options || {};
  const ttlDays = Number(o.sessionTtlDays) || 7;
  const ttlMs = ttlDays * 86400000;
  const cookieName = o.cookieName || 'life_hub_session';
  const rounds = Number(o.bcryptRounds) || 10;
  const appUrl = String(o.appUrl || '').replace(/\/+$/, '');
  const secureCookie = /^https:/i.test(appUrl);
  const mailMode = o.mailMode === 'smtp' ? 'smtp' : 'console';
  const smtp = o.smtp || {};
  const outbox = [];

  if (mailMode === 'smtp' && !smtp.host) {
    throw new Error('邮件模式为 smtp 但未配置 SMTP_HOST，请设置 SMTP 环境变量或将 MAIL_MODE 设为 console');
  }

  let transporter = null;
  function getTransporter() {
    if (transporter) return transporter;
    if (mailMode === 'console') {
      transporter = {
        async sendMail(mail) {
          outbox.push(mail);
          console.log('[邮件·控制台模式] 收件人 ' + mail.to + ' 主题：' + mail.subject + '\n' + mail.text);
          return { messageId: 'console-' + Date.now() };
        }
      };
      return transporter;
    }
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined
    });
    return transporter;
  }

  async function sendVerificationMail(email, url) {
    const mail = {
      to: email,
      subject: '生活管理 · 邮箱验证',
      text: '你好！请在 ' + VERIFY_TTL_HOURS + ' 小时内点击以下链接完成注册：\n\n' + url +
        '\n\n如果这不是你本人的操作，请忽略本邮件。',
      url: url
    };
    try { await getTransporter().sendMail(mail); }
    catch (e) { throw new Error('验证邮件发送失败：' + (e && e.message ? e.message : 'SMTP 异常')); }
  }

  const buckets = new Map();
  function allow(action, key) {
    const now = Date.now();
    const k = action + ':' + key;
    let times = buckets.get(k) || [];
    times = times.filter(t => now - t < RATE_WINDOWS[action]);
    if (times.length >= RATE_LIMITS[action]) { buckets.set(k, times); return false; }
    times.push(now);
    buckets.set(k, times);
    if (buckets.size > 2000) {
      buckets.forEach((v, kk) => { if (!v.some(t => now - t < 15 * 60000)) buckets.delete(kk); });
    }
    return true;
  }

  function setCookie(res, value, maxAgeSeconds) {
    const parts = [cookieName + '=' + value, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=' + maxAgeSeconds];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }
  function clearCookie(res) {
    const parts = [cookieName + '=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  async function createSession(res, userId) {
    const token = newToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await db.insertSession({ tokenHash: tokenHash, userId: Number(userId), expiresAt: expiresAt, createdAt: nowISO() });
    setCookie(res, token, Math.floor(ttlMs / 1000));
    return token;
  }

  async function userFromRequest(req) {
    const token = parseCookies(req)[cookieName];
    if (!token || !TOKEN_RE.test(token)) return null;
    const tokenHash = sha256(token);
    const session = await db.findSession(tokenHash);
    if (!session) return null;
    const expiresAt = Date.parse(session.expiresAt || '');
    if (!expiresAt || expiresAt < Date.now()) {
      await db.deleteSession(tokenHash);
      return null;
    }
    if (expiresAt - Date.now() < ttlMs / 2) {
      await db.touchSession(tokenHash, new Date(Date.now() + ttlMs).toISOString());
    }
    const user = await db.findUserById(session.userId);
    return user && user.emailVerifiedAt ? user : null;
  }

  async function requireUser(req, res) {
    const user = await userFromRequest(req);
    if (!user) { sendJson(res, 401, { error: '请先登录' }); return null; }
    return user;
  }

  let dummyHash = '';
  async function dummyCompare(password) {
    if (!dummyHash) dummyHash = await bcrypt.hash('life-hub-dummy-password', rounds);
    await bcrypt.compare(password, dummyHash);
  }

  async function issueVerification(user) {
    await db.deleteVerificationsOfUser(user.id);
    const token = newToken();
    await db.insertVerification({
      tokenHash: sha256(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3600000).toISOString(),
      createdAt: nowISO()
    });
    const url = appUrl + '/?verify=' + token;
    await sendVerificationMail(user.email, url);
  }

  const auth = {
    outbox: outbox,
    mailMode: mailMode,

    async register(req, res, body) {
      if (!allow('register', clientIp(req))) {
        return sendJson(res, 429, { error: '注册请求过于频繁，请稍后再试' });
      }
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      if (!EMAIL_RE.test(email)) return sendJson(res, 400, { error: '邮箱格式不正确' });
      if (password.length < 8) return sendJson(res, 400, { error: '密码至少需要 8 位' });

      const existing = await db.findUserByEmail(email);
      if (existing && existing.emailVerifiedAt) {
        return sendJson(res, 400, { error: '该邮箱已注册，请直接登录' });
      }
      const user = existing || await db.createUser({ email: email, passwordHash: await bcrypt.hash(password, rounds) });
      await issueVerification(user);
      return sendJson(res, 201, { ok: true, message: '注册成功，请查收验证邮件完成激活' });
    },

    async verify(req, res, url) {
      const token = url.searchParams.get('token') || '';
      if (!TOKEN_RE.test(token)) return sendJson(res, 400, { error: '激活链接无效' });
      const tokenHash = sha256(token);
      const record = await db.findVerification(tokenHash);
      const expiresAt = Date.parse(record && record.expiresAt || '');
      if (!record || !expiresAt || expiresAt < Date.now()) {
        if (record) await db.deleteVerification(tokenHash);
        return sendJson(res, 400, { error: '激活链接无效或已过期，请重新发送验证邮件' });
      }
      const firstVerified = (await db.countVerifiedUsers()) === 0;
      await db.verifyUser(record.userId);
      await db.deleteVerification(tokenHash);
      let claimed = 0;
      if (firstVerified) claimed = await db.claimLegacyItems(record.userId);
      await createSession(res, record.userId);
      const user = await db.findUserById(record.userId);
      return sendJson(res, 200, { ok: true, email: user ? user.email : '', claimed: claimed });
    },

    async login(req, res, body) {
      if (!allow('login', clientIp(req))) {
        return sendJson(res, 429, { error: '登录尝试过于频繁，请稍后再试' });
      }
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const user = email && await db.findUserByEmail(email);
      if (!user) { await dummyCompare(password); return sendJson(res, 401, { error: '邮箱或密码错误' }); }
      const ok = await bcrypt.compare(password, user.passwordHash || '');
      if (!ok) return sendJson(res, 401, { error: '邮箱或密码错误' });
      if (!user.emailVerifiedAt) {
        return sendJson(res, 403, { error: '邮箱尚未验证，请先查收验证邮件', needVerify: true });
      }
      await createSession(res, user.id);
      return sendJson(res, 200, { ok: true, id: user.id, email: user.email });
    },

    async resend(req, res, body) {
      const email = normalizeEmail(body.email);
      if (!allow('resend', clientIp(req) + '|' + email)) {
        return sendJson(res, 429, { error: '发送过于频繁，请稍后再试' });
      }
      const user = email && await db.findUserByEmail(email);
      if (user && !user.emailVerifiedAt) await issueVerification(user);
      return sendJson(res, 200, { ok: true, message: '若该邮箱已注册且尚未验证，将收到新的验证邮件' });
    },

    async logout(req, res) {
      const token = parseCookies(req)[cookieName];
      if (token && TOKEN_RE.test(token)) await db.deleteSession(sha256(token));
      clearCookie(res);
      return sendJson(res, 200, { ok: true });
    },

    async me(req, res) {
      const user = await userFromRequest(req);
      if (!user) return sendJson(res, 401, { error: '请先登录' });
      return sendJson(res, 200, { id: user.id, email: user.email, createdAt: user.createdAt });
    },

    requireUser: requireUser,
    userFromRequest: userFromRequest
  };

  return auth;
}

module.exports = { createAuth };
