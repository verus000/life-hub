/* 共享测试助手：临时数据库、环境变量、测试用户 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDbAt } from '@/server/db';
import type { Db } from '@/server/db';
import { resetConfigCache } from '@/server/config';
import { clearOutbox, getOutbox } from '@/server/auth/mailer';

let seq = 0;

export function freshDb(): Db {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifehub-test-'));
  const file = path.join(dir, 'test-' + ++seq + '.db');
  return createDbAt(file);
}

export function setupEnv(): void {
  process.env.MAIL_MODE = 'console';
  process.env.DB_FILE_NAME = path.join(os.tmpdir(), 'lifehub-test-env.db');
  process.env.APP_URL = 'http://127.0.0.1:3000';
  process.env.SESSION_TTL_DAYS = '7';
  process.env.TRUST_PROXY = 'false';
  delete process.env.SMTP_HOST;
  resetConfigCache();
}

export function outbox() {
  return getOutbox();
}

export function clearMail() {
  clearOutbox();
}

/* 从控制台邮件里提取验证令牌 */
export function verifyTokenFromOutbox(): string {
  const mail = getOutbox()[getOutbox().length - 1];
  if (!mail) throw new Error('没有发出的验证邮件');
  const m = /token=([a-f0-9]{64})/.exec(mail.text + ' ' + mail.url);
  if (!m) throw new Error('邮件中未找到验证令牌');
  return m[1];
}

/* 构造旧版（无认证表）SQLite 库，用于迁移测试 */
export function createLegacyDb(file: string, rows: Array<{ category: string; title: string; amount: number | null }>): void {
  const client = new DatabaseSync(file);
  client.exec(`CREATE TABLE items (
    id integer PRIMARY KEY AUTOINCREMENT,
    category text DEFAULT 'phone' NOT NULL,
    title text NOT NULL,
    provider text DEFAULT '' NOT NULL,
    amount real,
    currency text DEFAULT 'CNY' NOT NULL,
    cycle text DEFAULT '' NOT NULL,
    start_date text DEFAULT '' NOT NULL,
    next_date text DEFAULT '' NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    detail text DEFAULT '{}' NOT NULL,
    note text DEFAULT '' NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`);
  const stmt = client.prepare(
    'INSERT INTO items (category, title, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  const ts = new Date().toISOString();
  rows.forEach((r) => stmt.run(r.category, r.title, r.amount, ts, ts));
  client.close();
}
