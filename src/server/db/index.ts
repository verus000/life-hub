import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle, type NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';

export type Db = NodeSQLiteDatabase & { $client: DatabaseSync };

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
}

function createDb(file: string): Db {
  const dir = path.dirname(file);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  const client = new DatabaseSync(file);
  ensureSchema(client);
  return drizzle({ client });
}

/* 单例：dev 模式下模块可能被多次加载，用 globalThis 兜底 */
export function getDb(): Db {
  const g = globalThis as unknown as { __lifeHubDb?: Db };
  if (g.__lifeHubDb) return g.__lifeHubDb;
  const file = process.env.DB_FILE_NAME ?? path.join('data', 'life-hub.db');
  const db = createDb(file);
  g.__lifeHubDb = db;
  return db;
}

/* 测试与数据迁移脚本用：显式指定文件创建独立实例 */
export function createDbAt(file: string): Db {
  return createDb(file);
}
