import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { repository, type Db } from './repository';

export type SqliteDb = Db & { $client: DatabaseSync };

const DDL = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "email" text NOT NULL,
    "password_hash" text NOT NULL,
    "email_verified_at" text,
    "created_at" text NOT NULL,
    "updated_at" text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email")`,
  `CREATE TABLE IF NOT EXISTS "sessions" (
    "token_hash" text PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "expires_at" text NOT NULL,
    "created_at" text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id")`,
  `CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "token_hash" text PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "expires_at" text NOT NULL,
    "created_at" text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "verification_user_idx" ON "verification_tokens" ("user_id")`,
  `CREATE TABLE IF NOT EXISTS "items" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" integer,
    "category" text DEFAULT 'phone' NOT NULL,
    "title" text NOT NULL,
    "provider" text DEFAULT '' NOT NULL,
    "amount" real,
    "currency" text DEFAULT 'CNY' NOT NULL,
    "cycle" text DEFAULT '' NOT NULL,
    "start_date" text DEFAULT '' NOT NULL,
    "next_date" text DEFAULT '' NOT NULL,
    "status" text DEFAULT 'active' NOT NULL,
    "detail" text DEFAULT '{}' NOT NULL,
    "note" text DEFAULT '' NOT NULL,
    "created_at" text NOT NULL,
    "updated_at" text NOT NULL
  )`,
];

/* 幂等建表：新库直接建全量表；旧库（无认证表的 items 单用户版本）
   通过 IF NOT EXISTS 跳过已有表，再补 user_id 列。
   items_user_idx 依赖 user_id 列，统一在补列之后创建。 */
function ensureSchema(client: DatabaseSync) {
  client.exec('PRAGMA foreign_keys = ON');
  for (const sqlText of DDL) client.exec(sqlText);
  const columns = client
    .prepare('PRAGMA table_info("items")')
    .all() as Array<{ name: string }>;
  const names = columns.map((c) => c.name);
  if (names.includes('title') && !names.includes('user_id')) {
    client.exec('ALTER TABLE "items" ADD COLUMN "user_id" integer');
  }
  client.exec('CREATE INDEX IF NOT EXISTS "items_user_idx" ON "items" ("user_id")');
  /* 旧认证版本使用 verifications；搬空旧表，防止重启复活已使用/已重发的令牌。 */
  const legacy = client.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'verifications'").get();
  if (legacy) {
    client.exec('BEGIN IMMEDIATE');
    try {
      client.exec(`INSERT OR IGNORE INTO verification_tokens (token_hash, user_id, expires_at, created_at)
        SELECT token_hash, user_id, expires_at, created_at FROM verifications`);
      client.exec('DELETE FROM verifications');
      client.exec('COMMIT');
    } catch (e) {
      client.exec('ROLLBACK');
      throw e;
    }
  }
}

export function createDbAt(file: string): SqliteDb {
  const dir = path.dirname(file);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  const client = new DatabaseSync(file);
  ensureSchema(client);
  const orm = drizzle({ client });
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const execute = async (query: Parameters<typeof orm.all>[0]) => orm.all<Record<string, unknown>>(query);
  const txDb = repository('sqlite', execute, async () => { throw new Error('不支持嵌套事务'); }, async () => {});
  const db = repository('sqlite', (query) => enqueue(() => execute(query)), (task) => enqueue(async () => {
    client.exec('BEGIN IMMEDIATE');
    try {
      const result = await task(txDb);
      client.exec('COMMIT');
      return result;
    } catch (error) {
      client.exec('ROLLBACK');
      throw error;
    }
  }), async () => { await queue; client.close(); });
  return Object.assign(db, { $client: client });
}
