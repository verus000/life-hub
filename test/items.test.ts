/* 条目服务回归：CRUD、用户隔离、导入去重、并发冲突（对应原自测的 items 部分） */

import { beforeAll, describe, expect, it } from 'vitest';
import { addItem, clearItems, importItems, listItems, removeItem, updateItem } from '@/server/items/service';
import { getSessionUser, register, verify } from '@/server/auth/service';
import { clearOutbox } from '@/server/auth/mailer';
import { freshDb, setupEnv, verifyTokenFromOutbox } from './helpers';

beforeAll(() => {
  setupEnv();
});

async function seedUser(db: ReturnType<typeof freshDb>, n: number) {
  clearOutbox();
  await register(db, 'u' + n + '@test.dev', 'pass-word-123', 'ip-u' + n);
  const r = await verify(db, verifyTokenFromOutbox());
  return (await getSessionUser(db, r.session.token))!.id;
}

describe('条目 CRUD', () => {
  it('新增往返 detail 与日期字段', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 1);
    const a = await addItem(db, {
      category: 'phone', title: '13800000000', amount: '19', cycle: 'monthly',
      startDate: '2025-01-01', nextDate: '2026-12-01', detail: { country: '中国' },
    }, uid);
    expect(a.id).toBeGreaterThan(0);
    expect(a.detail.country).toBe('中国');
    expect(a.startDate).toBe('2025-01-01');
    expect(a.amount).toBe(19);
    expect(a.currency).toBe('CNY');
    expect(a.detail.recordKey).toBeTruthy();
  });

  it('部分更新保留未传字段包括 detail', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 2);
    const a = await addItem(db, { category: 'phone', title: 'A', detail: { country: '中国' } }, uid);
    const u = await updateItem(db, a.id, { nextDate: '2027-06-06' }, uid);
    expect(u.nextDate).toBe('2027-06-06');
    expect(u.detail.country).toBe('中国');
  });

  it('更新与删除不存在的记录返回 404', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 3);
    await expect(updateItem(db, 999, { note: 'x' }, uid)).rejects.toMatchObject({ status: 404 });
    await expect(removeItem(db, 999, uid)).rejects.toMatchObject({ status: 404 });
  });

  it('expectedUpdatedAt 不匹配返回 409', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 4);
    const a = await addItem(db, { category: 'phone', title: 'A' }, uid);
    const b = await updateItem(db, a.id, { note: '一' }, uid);
    await expect(updateItem(db, a.id, { note: '旧' }, uid, a.updatedAt)).rejects.toMatchObject({ status: 409 });
    const c = await updateItem(db, a.id, { note: '二' }, uid, b.updatedAt);
    expect(c.note).toBe('二');
  });

  it('清空只影响当前用户', async () => {
    const db = freshDb();
    const u1 = await seedUser(db, 5);
    const u2 = await seedUser(db, 6);
    await addItem(db, { category: 'asset', title: '一号' }, u1);
    await addItem(db, { category: 'asset', title: '二号' }, u2);
    await clearItems(db, u1);
    expect((await listItems(db, u1)).length).toBe(0);
    expect((await listItems(db, u2)).length).toBe(1);
  });
});

describe('用户数据隔离', () => {
  it('A 用户看不到 B 用户的记录，也不能修改或删除', async () => {
    const db = freshDb();
    const u1 = await seedUser(db, 7);
    const u2 = await seedUser(db, 8);
    const a = await addItem(db, { category: 'phone', title: '私有' }, u1);
    expect((await listItems(db, u2)).length).toBe(0);
    await expect(updateItem(db, a.id, { note: '入侵' }, u2)).rejects.toMatchObject({ status: 404 });
    await expect(removeItem(db, a.id, u2)).rejects.toMatchObject({ status: 404 });
    expect((await listItems(db, u1))[0].title).toBe('私有');
  });
});

describe('批量导入', () => {
  it('跳过重复并写入新增', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 9);
    await addItem(db, { category: 'asset', title: 'A', amount: 100 }, uid);
    const r = await importItems(db, [
      { category: 'asset', title: 'A', amount: 100 },
      { category: 'asset', title: 'B', amount: 200 },
    ], uid);
    expect(r.created).toBe(1);
    expect(r.skipped).toBe(1);
    expect((await listItems(db, uid)).length).toBe(2);
  });

  it('整批校验失败不写入前面的有效条目', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 10);
    await expect(
      importItems(db, [
        { category: 'asset', title: '有效行' },
        { category: 'asset', title: '无效行', nextDate: '2027-02-30' },
      ], uid),
    ).rejects.toMatchObject({ status: 400 });
    expect((await listItems(db, uid)).length).toBe(0);
  });

  it('并发导入同一记录只写一次', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 11);
    const entry = { category: 'asset', title: '并发账户', detail: { recordKey: 'concurrent-test' } };
    const results = await Promise.all([
      importItems(db, [entry], uid),
      importItems(db, [entry], uid),
    ]);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
  });
});

describe('校验错误映射', () => {
  it('新增/更新传入非法字段返回 400 而非 500', async () => {
    const db = freshDb();
    const uid = await seedUser(db, 12);
    await expect(
      addItem(db, { category: 'phone', title: '锚点错误', detail: { reminderAnchor: '2026-02-01' } } as never, uid),
    ).rejects.toMatchObject({ status: 400 });
    const a = await addItem(db, { category: 'phone', title: '正常条目' }, uid);
    await expect(
      updateItem(db, a.id, { detail: { reminderAnchor: 99 } } as never, uid),
    ).rejects.toMatchObject({ status: 400 });
    expect((await listItems(db, uid)).length).toBe(1);
  });
});
