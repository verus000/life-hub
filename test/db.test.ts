/* 数据库层回归：新库建表、旧库自动迁移、数据认领 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDbAt } from '@/server/db';
import { claimLegacyItems } from '@/server/items/service';
import { createLegacyDb } from './helpers';

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
});
