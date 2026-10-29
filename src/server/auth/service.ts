/* 认证服务：邮箱注册（邮件验证）、登录会话、限流。
   逻辑与原 src/auth.js 逐行对应；HTTP 细节（Cookie）由 Route Handler 负责。 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { sessions, users, verificationTokens } from '../db/schema';
import type { Db } from '../db';
import { loadConfig } from '../config';
import { badRequest, forbidden, tooManyRequests, unauthorized } from '../errors';
import { sendVerificationMail } from './mailer';
import { claimLegacyItems } from '../items/service';

const VERIFY_TTL_HOURS = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;

const RATE_WINDOWS: Record<string, number> = { register: 15 * 60000, login: 15 * 60000, resend: 15 * 60000 };
const RATE_LIMITS: Record<string, number> = { register: 10, login: 20, resend: 5 };

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeEmail(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

/* 进程内限流：与原实现一致（内存 Map + 滑动窗口） */
const buckets = new Map<string, number[]>();

function allow(action: string, key: string): boolean {
  const now = Date.now();
  const k = action + ':' + key;
  let times = buckets.get(k) || [];
  times = times.filter((t) => now - t < RATE_WINDOWS[action]);
  if (times.length >= RATE_LIMITS[action]) {
    buckets.set(k, times);
    return false;
  }
  times.push(now);
  buckets.set(k, times);
  if (buckets.size > 2000) {
    buckets.forEach((v, kk) => {
      if (!v.some((t) => now - t < 15 * 60000)) buckets.delete(kk);
    });
  }
  return true;
}

export interface PublicUser {
  id: number;
  email: string;
  createdAt: string;
}

export interface SessionInfo {
  token: string;
  maxAgeSeconds: number;
}

function nowISO(): string {
  return new Date().toISOString();
}

/* ---------- 会话 ---------- */

export async function createSession(db: Db, userId: number): Promise<SessionInfo> {
  const cfg = loadConfig();
  const ttlMs = cfg.SESSION_TTL_DAYS * 86400000;
  const token = newToken();
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    createdAt: nowISO(),
  });
  return { token, maxAgeSeconds: Math.floor(ttlMs / 1000) };
}

/* 从 Cookie 令牌解析当前用户：过期即删，剩余不足一半时滑动续期 */
export async function getSessionUser(db: Db, token: string | undefined): Promise<PublicUser | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const cfg = loadConfig();
  const ttlMs = cfg.SESSION_TTL_DAYS * 86400000;
  const tokenHash = sha256(token);
  const rows = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  const session = rows[0];
  if (!session) return null;
  const expiresAt = Date.parse(session.expiresAt || '');
  if (!expiresAt || expiresAt < Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }
  if (expiresAt - Date.now() < ttlMs / 2) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + ttlMs).toISOString() })
      .where(eq(sessions.tokenHash, tokenHash));
  }
  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = userRows[0];
  return user && user.emailVerifiedAt ? { id: user.id, email: user.email, createdAt: user.createdAt } : null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token && TOKEN_RE.test(token)) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
}

/* ---------- 注册 / 验证 / 登录 ---------- */

async function issueVerification(db: Db, userId: number, email: string): Promise<void> {
  await db.delete(verificationTokens).where(eq(verificationTokens.userId, userId));
  const token = newToken();
  await db.insert(verificationTokens).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3600000).toISOString(),
    createdAt: nowISO(),
  });
  await sendVerificationMail(email, token);
}

/* 防时序探测：用户不存在时也执行一次哈希比对 */
let dummyHash = '';
async function dummyCompare(password: string): Promise<void> {
  const cfg = loadConfig();
  if (!dummyHash) dummyHash = await bcrypt.hash('life-hub-dummy-password', cfg.BCRYPT_ROUNDS);
  await bcrypt.compare(password, dummyHash);
}

export async function register(
  db: Db,
  email: unknown,
  password: unknown,
  ip: string,
): Promise<{ message: string }> {
  if (!allow('register', ip)) throw tooManyRequests('注册请求过于频繁，请稍后再试');
  const mail = normalizeEmail(email);
  const pass = String(password || '');
  if (!EMAIL_RE.test(mail)) throw badRequest('邮箱格式不正确');
  if (pass.length < 8) throw badRequest('密码至少需要 8 位');

  const existing = (await db.select().from(users).where(eq(users.email, mail)).limit(1))[0];
  if (existing && existing.emailVerifiedAt) throw badRequest('该邮箱已注册，请直接登录');

  const cfg = loadConfig();
  let userId: number;
  if (existing) {
    userId = existing.id;
  } else {
    const inserted = await db
      .insert(users)
      .values({ email: mail, passwordHash: await bcrypt.hash(pass, cfg.BCRYPT_ROUNDS), createdAt: nowISO(), updatedAt: nowISO() })
      .returning({ id: users.id });
    userId = inserted[0].id;
  }
  await issueVerification(db, userId, mail);
  return { message: '注册成功，请查收验证邮件完成激活' };
}

export async function verify(
  db: Db,
  token: string,
): Promise<{ email: string; claimed: number; session: SessionInfo }> {
  if (!TOKEN_RE.test(token)) throw badRequest('激活链接无效');
  const tokenHash = sha256(token);
  const record = (await db.select().from(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash)).limit(1))[0];
  const expiresAt = Date.parse(record?.expiresAt || '');
  if (!record || !expiresAt || expiresAt < Date.now()) {
    if (record) await db.delete(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash));
    throw badRequest('激活链接无效或已过期，请重新发送验证邮件');
  }

  /* 第一个完成激活的用户认领旧版单用户数据 */
  const firstVerified = (await db.select({ n: sql<number>`count(*)` }).from(users).where(sql`${users.emailVerifiedAt} is not null`))[0].n === 0;

  await db.update(users).set({ emailVerifiedAt: nowISO(), updatedAt: nowISO() }).where(eq(users.id, record.userId));
  await db.delete(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash));

  let claimed = 0;
  if (firstVerified) claimed = await claimLegacyItems(db, record.userId);

  const session = await createSession(db, record.userId);
  const user = (await db.select().from(users).where(eq(users.id, record.userId)).limit(1))[0];
  return { email: user ? user.email : '', claimed, session };
}

export async function login(
  db: Db,
  email: unknown,
  password: unknown,
  ip: string,
): Promise<{ user: PublicUser; session: SessionInfo }> {
  if (!allow('login', ip)) throw tooManyRequests('登录尝试过于频繁，请稍后再试');
  const mail = normalizeEmail(email);
  const pass = String(password || '');
  const user = mail ? (await db.select().from(users).where(eq(users.email, mail)).limit(1))[0] : undefined;
  if (!user) {
    await dummyCompare(pass);
    throw unauthorized('邮箱或密码错误');
  }
  const ok = await bcrypt.compare(pass, user.passwordHash || '');
  if (!ok) throw unauthorized('邮箱或密码错误');
  if (!user.emailVerifiedAt) {
    throw forbidden('邮箱尚未验证，请先查收验证邮件');
  }
  const session = await createSession(db, user.id);
  return { user: { id: user.id, email: user.email, createdAt: user.createdAt }, session };
}

export async function resend(db: Db, email: unknown, ip: string): Promise<{ message: string }> {
  const mail = normalizeEmail(email);
  if (!allow('resend', ip + '|' + mail)) throw tooManyRequests('发送过于频繁，请稍后再试');
  const user = mail ? (await db.select().from(users).where(eq(users.email, mail)).limit(1))[0] : undefined;
  if (user && !user.emailVerifiedAt) await issueVerification(db, user.id, user.email);
  return { message: '若该邮箱已注册且尚未验证，将收到新的验证邮件' };
}

