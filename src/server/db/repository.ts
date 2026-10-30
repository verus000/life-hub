import { getTableColumns, getTableName, sql, type SQL } from 'drizzle-orm';
import { items, sessions, users, verificationTokens } from './pg-schema';

const tables = { items, sessions, users, verificationTokens };
type Tables = typeof tables;
type Name = keyof Tables;
type Row<K extends Name> = Tables[K]['$inferSelect'];
type Insert<K extends Name> = Tables[K]['$inferInsert'];
type Options<K extends Name> = { orderBy?: keyof Row<K>; limit?: number; notNull?: Array<keyof Row<K>> };

export type Db = {
  dialect: 'sqlite' | 'postgresql';
  find<K extends Name>(table: K, where?: Partial<Row<K>>, options?: Options<K>): Promise<Row<K>[]>;
  insert<K extends Name>(table: K, values: Insert<K> | Insert<K>[]): Promise<Row<K>[]>;
  update<K extends Name>(table: K, values: Partial<Insert<K>>, where: Partial<Row<K>>): Promise<Row<K>[]>;
  delete<K extends Name>(table: K, where: Partial<Row<K>>): Promise<Row<K>[]>;
  transaction<T>(task: (tx: Db) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
};

type Execute = (query: SQL) => Promise<Record<string, unknown>[]>;

export function singleResultRows(result: { rows: Record<string, unknown>[] } | { rows: Record<string, unknown>[] }[]): Record<string, unknown>[] {
  if (Array.isArray(result)) throw new Error('应用数据库入口不接受多语句结果');
  return result.rows;
}

/* 两种驱动共享字段映射与参数绑定；方言负责占位符及事务。 */
export function repository(
  dialect: Db['dialect'],
  execute: Execute,
  transaction: Db['transaction'],
  close: Db['close'],
): Db {
  const rawExecute = execute;
  execute = async (query) => {
    try { return await rawExecute(query); } catch {
      // Drizzle 的原始异常含 SQL 参数，可能带邮箱、密码哈希和个人条目。
      throw new Error('数据库读写失败，请检查数据库状态和迁移版本');
    }
  };
  function metadata<K extends Name>(name: K) {
    const table = tables[name];
    const columns = getTableColumns(table) as Record<string, { name: string }>;
    function column(key: string) {
      if (!columns[key]) throw new Error('未知数据库字段');
      return sql.identifier(columns[key].name);
    }
    const fields = sql.join(Object.keys(columns).map((key) => sql`${column(key)} AS ${sql.identifier(key)}`), sql`, `);
    const conditions = (where: Partial<Row<K>>, notNull: Array<keyof Row<K>> = []) => {
      const parts = Object.entries(where).filter(([, value]) => value !== undefined)
        .map(([key, value]) => value === null ? sql`${column(key)} IS NULL` : sql`${column(key)} = ${value}`);
      parts.push(...notNull.map((key) => sql`${column(String(key))} IS NOT NULL`));
      return parts.length ? sql` WHERE ${sql.join(parts, sql` AND `)}` : sql``;
    };
    return { table: sql.identifier(getTableName(table)), column, fields, conditions };
  }
  return {
    dialect,
    async find(name, where = {}, options = {}) {
      const m = metadata(name);
      const order = options.orderBy ? sql` ORDER BY ${m.column(String(options.orderBy))} ASC` : sql``;
      const limit = options.limit === undefined ? sql`` : sql` LIMIT ${options.limit}`;
      return await execute(sql`SELECT ${m.fields} FROM ${m.table}${m.conditions(where, options.notNull)}${order}${limit}`) as Row<typeof name>[];
    },
    async insert(name, values) {
      const m = metadata(name);
      const rows = Array.isArray(values) ? values : [values];
      if (!rows.length) return [];
      const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const data = rows.map((row) => sql`(${sql.join(keys.map((key) => {
        const value = (row as Record<string, unknown>)[key];
        // 缺省字段从列列表中省略；同一批次必须具有相同字段。
        if (value === undefined) throw new Error('批量写入字段不一致');
        return sql`${value}`;
      }), sql`, `)})`);
      return await execute(sql`INSERT INTO ${m.table} (${sql.join(keys.map(m.column), sql`, `)}) VALUES ${sql.join(data, sql`, `)} RETURNING ${m.fields}`) as Row<typeof name>[];
    },
    async update(name, values, where) {
      const m = metadata(name);
      const sets = Object.entries(values).filter(([, value]) => value !== undefined)
        .map(([key, value]) => sql`${m.column(key)} = ${value}`);
      return await execute(sql`UPDATE ${m.table} SET ${sql.join(sets, sql`, `)}${m.conditions(where)} RETURNING ${m.fields}`) as Row<typeof name>[];
    },
    async delete(name, where) {
      const m = metadata(name);
      return await execute(sql`DELETE FROM ${m.table}${m.conditions(where)} RETURNING ${m.fields}`) as Row<typeof name>[];
    },
    transaction,
    async ping() { await execute(sql`SELECT 1`); },
    close,
  };
}
