import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* 用户：邮箱注册，email_verified_at 为空表示尚未激活 */
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: text('email_verified_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

/* 登录会话：只存令牌哈希，HttpOnly Cookie 持原始令牌 */
export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/* 邮箱验证令牌：一次性，24 小时有效，使用后删除 */
export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('verification_user_idx').on(t.userId)],
);

/* 生活条目：user_id 为空的行属于旧版单用户数据，等首个激活用户认领 */
export const items = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id'),
    category: text('category').notNull().default('phone'),
    title: text('title').notNull(),
    provider: text('provider').notNull().default(''),
    amount: real('amount'),
    currency: text('currency').notNull().default('CNY'),
    cycle: text('cycle').notNull().default(''),
    startDate: text('start_date').notNull().default(''),
    nextDate: text('next_date').notNull().default(''),
    status: text('status').notNull().default('active'),
    detail: text('detail').notNull().default('{}'),
    note: text('note').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('items_user_idx').on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type VerificationRow = typeof verificationTokens.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type NewItemRow = typeof items.$inferInsert;
