/* 数据库层回归：新库建表、旧库自动迁移、数据认领 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createDbAt } from '@/server/db';
import { claimLegacyItems } from '@/server/items/service';
import { getSessionUser, resend, verify } from '@/server/auth/service';
import { clearMail, createLegacyDb, setupEnv, verifyTokenFromOutbox } from './helpers';

function legacyVerificationDb(expiresAt = new Date(Date.now() + 3600000).toISOString()) {
  setupEnv();
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-verification-')), 'legacy.db');
  const db = createDbAt(file);
  const now = new Date().toISOString();
  const token = 'c'.repeat(64);
  db.$client.prepare('INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run('legacy@example.test', 'unused', now, now);
  db.$client.exec(`DROP TABLE verification_tokens;
    CREATE TABLE verifications (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`);
  db.$client.prepare('INSERT INTO verifications VALUES (?, 1, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), expiresAt, now);
  db.$client.close();
  return { file, token };
}

describe('数据库初始化', () => {
  it('新库自动创建全部表与索引', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-db-'));
    const file = path.join(dir, 'new.db');
    const db = createDbAt(file);
    const tables = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toContain('users');
    expect(tables).toContain('sessions');
    expect(tables).toContain('verification_tokens');
    expect(tables).toContain('items');
    db.$client.close();
  });

  it('旧版单用户库自动补 user_id 列并保留数据', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-legacy-'));
    const file = path.join(dir, 'legacy.db');
    createLegacyDb(file, [
      { category: 'phone', title: '旧手机号', amount: 19 },
      { category: 'asset', title: '旧账户', amount: 1000 },
    ]);
    const db = createDbAt(file);
    const cols = db.$client
      .prepare('PRAGMA table_info("items")')
      .all()
      .map((r) => (r as { name: string }).name);
    expect(cols).toContain('user_id');
    const count = db.$client.prepare('SELECT COUNT(*) c FROM items').get() as { c: number };
    expect(count.c).toBe(2);

    /* 认领后归属首个用户 */
    const claimed = await claimLegacyItems(db, 7);
    expect(claimed).toBe(2);
    const owners = db.$client.prepare('SELECT DISTINCT user_id FROM items').all();
    expect(owners).toEqual([{ user_id: 7 }]);
    db.$client.close();
  });

  it('重复初始化保持幂等', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-idem-'));
    const file = path.join(dir, 'idem.db');
    const a = createDbAt(file);
    a.$client.close();
    const b = createDbAt(file);
    const count = b.$client.prepare('SELECT COUNT(*) c FROM items').get() as { c: number };
    expect(count.c).toBe(0);
    b.$client.close();
  });

  it('迁移旧认证令牌，激活后重启不会恢复一次性令牌', async () => {
    const { file, token } = legacyVerificationDb();
    const db = createDbAt(file);
    expect(db.$client.prepare('SELECT count(*) AS n FROM verifications').get()).toMatchObject({ n: 0 });
    expect(db.$client.prepare('SELECT count(*) AS n FROM verification_tokens').get()).toMatchObject({ n: 1 });
    const activated = await verify(db, token);
    expect((await getSessionUser(db, activated.session.token))?.email).toBe('legacy@example.test');
    db.$client.close();
    const reopened = createDbAt(file);
    await expect(verify(reopened, token)).rejects.toMatchObject({ status: 400 });
    expect((await getSessionUser(reopened, activated.session.token))?.email).toBe('legacy@example.test');
    reopened.$client.close();
  });

  it('迁移后重发邮件使旧令牌失效，重启后仍仅接受新令牌', async () => {
    const { file, token } = legacyVerificationDb();
    const db = createDbAt(file);
    clearMail();
    await resend(db, 'legacy@example.test', 'legacy-resend');
    const replacement = verifyTokenFromOutbox();
    db.$client.close();
    const reopened = createDbAt(file);
    await expect(verify(reopened, token)).rejects.toMatchObject({ status: 400 });
    expect((await verify(reopened, replacement)).email).toBe('legacy@example.test');
    reopened.$client.close();
  });

  it('迁移保留旧令牌的有效期，过期令牌不可激活', async () => {
    const { file, token } = legacyVerificationDb('2000-01-01T00:00:00.000Z');
    const reopened = createDbAt(file);
    await expect(verify(reopened, token)).rejects.toMatchObject({ status: 400 });
    expect(reopened.$client.prepare('SELECT email_verified_at FROM users').get()).toMatchObject({ email_verified_at: null });
    reopened.$client.close();
  });
});
