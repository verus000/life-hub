/* 条目服务：校验、去重导入、并发编辑保护、按用户隔离。
   行映射与原 src/db/normalize.js 逐行对应；并发串行化与原 src/routes.js 的 mutate 队列一致。 */

import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { items } from '../db/schema';
import type { Db } from '../db';
import type { ItemRow } from '../db/schema';
import { badRequest, conflict, notFound } from '../errors';
import { knownCode, normalizeDetail, partition, validate, CYCLES, STATUSES, CATEGORIES } from '@/lib/records';
import type { Item, ItemInput, ValidatedFields } from '@/lib/types';

/* updatedAt 单调递增：并发编辑检测依赖时间戳不回退 */
let lastTimestamp = 0;
function nowISO(): string {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
  return new Date(lastTimestamp).toISOString();
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseDetail(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined || v === '') return {};
  if (typeof v === 'object') return v as Record<string, unknown>;
  try {
    const o = JSON.parse(String(v));
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* 数据库行 → 应用对象 */
export function rowToItem(row: ItemRow): Item {
  return {
    id: Number(row.id),
    userId: row.userId === null || row.userId === undefined ? null : Number(row.userId),
    category: row.category || 'phone',
    title: row.title || '',
    provider: row.provider || '',
    amount: toNumber(row.amount),
    currency: row.currency || 'CNY',
    cycle: knownCode(row.cycle, CYCLES),
    startDate: row.startDate || '',
    nextDate: row.nextDate || '',
    status: knownCode(row.status, STATUSES) || 'active',
    detail: normalizeDetail(parseDetail(row.detail)),
    note: row.note || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
}

function toInsertValues(v: ValidatedFields, userId: number) {
  const detail = { ...((v.detail && typeof v.detail === 'object' ? v.detail : {}) as Record<string, unknown>) };
  if (!detail.recordKey) detail.recordKey = randomUUID();
  const ts = nowISO();
  return {
    userId,
    category: v.category || 'phone',
    title: v.title || '',
    provider: v.provider || '',
    amount: toNumber(v.amount),
    currency: v.currency || 'CNY',
    cycle: v.cycle || '',
    startDate: v.startDate || '',
    nextDate: v.nextDate || '',
    status: v.status || 'active',
    detail: JSON.stringify(detail),
    note: v.note || '',
    createdAt: v.createdAt || ts,
    updatedAt: v.updatedAt || ts,
  };
}

type ItemPatch = Partial<typeof items.$inferInsert>;

function toPatchValues(v: ValidatedFields): ItemPatch {
  const set: ItemPatch = {};
  (['category', 'title', 'provider', 'currency', 'cycle', 'status', 'note'] as const).forEach((k) => {
    if (v[k] !== undefined) (set as Record<string, unknown>)[k] = v[k];
  });
  if (v.startDate !== undefined) set.startDate = v.startDate || '';
  if (v.nextDate !== undefined) set.nextDate = v.nextDate || '';
  if (v.amount !== undefined) set.amount = toNumber(v.amount);
  if (v.detail !== undefined) {
    set.detail = JSON.stringify(v.detail && typeof v.detail === 'object' ? v.detail : {});
  }
  set.updatedAt = nowISO();
  return set;
}

/* 多步写串行化：避免导入去重的读-判-写窗口被并发请求穿插 */
let mutationQueue: Promise<unknown> = Promise.resolve();
function mutate<T>(task: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(task);
  mutationQueue = result.catch(() => {});
  return result;
}

export async function listItems(db: Db, userId: number): Promise<Item[]> {
  const rows = await db.select().from(items).where(eq(items.userId, userId)).orderBy(asc(items.id));
  return rows.map(rowToItem);
}

/* validate 抛出的是普通 Error（面向用户的中文校验信息），统一转成 400 */
function validateOr400(input: ItemInput, patch?: boolean): ValidatedFields {
  try {
    return validate(input, patch);
  } catch (e) {
    throw badRequest((e as Error).message);
  }
}

export async function addItem(db: Db, input: ItemInput, userId: number): Promise<Item> {
  const v = validateOr400(input);
  const inserted = await mutate(async () => {
    const rows = await db.insert(items).values(toInsertValues(v, userId)).returning();
    return rows[0];
  });
  return rowToItem(inserted);
}

export async function updateItem(
  db: Db,
  id: number,
  input: ItemInput,
  userId: number,
  expectedUpdatedAt?: string,
): Promise<Item> {
  const v = validateOr400(input, true);
  return mutate(async () => {
    const current = (await db.select().from(items).where(and(eq(items.id, id), eq(items.userId, userId))).limit(1))[0];
    if (!current) throw notFound('记录不存在');
    if (expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
      throw conflict('记录已在其他页面变更，请刷新后重试');
    }
    const rows = await db
      .update(items)
      .set(toPatchValues(v))
      .where(and(eq(items.id, id), eq(items.userId, userId)))
      .returning();
    return rowToItem(rows[0]);
  });
}

export async function removeItem(db: Db, id: number, userId: number): Promise<Item> {
  const rows = await db.delete(items).where(and(eq(items.id, id), eq(items.userId, userId))).returning();
  if (!rows[0]) throw notFound('记录不存在');
  return rowToItem(rows[0]);
}

export async function importItems(
  db: Db,
  inputs: ItemInput[],
  userId: number,
): Promise<{ created: number; skipped: number }> {
  const batch = inputs.map((x, i) => {
    try {
      return validate(x);
    } catch (e) {
      throw badRequest('第 ' + (i + 1) + ' 条：' + (e as Error).message);
    }
  });
  return mutate(async () => {
    const existing = await listItems(db, userId);
    const part = partition(batch as ItemInput[], existing);
    if (part.items.length > 0) {
      /* 单批保守限制参数数量；同步事务中不能使用 async 回调。 */
      db.transaction((tx) => {
        for (let offset = 0; offset < part.items.length; offset += 50) {
          tx.insert(items)
            .values(part.items.slice(offset, offset + 50).map((x) => toInsertValues(x as ValidatedFields, userId)))
            .run();
        }
      });
    }
    return { created: part.items.length, skipped: part.skipped };
  });
}

export async function clearItems(db: Db, userId: number): Promise<void> {
  await db.delete(items).where(eq(items.userId, userId));
}

/* 旧版单用户数据认领（userId 为 NULL 的行） */
export async function claimLegacyItems(db: Db, userId: number): Promise<number> {
  const rows = await db.update(items).set({ userId }).where(isNull(items.userId)).returning({ id: items.id });
  return rows.length;
}
