import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { repository, singleResultRows, type Db } from './repository';
import type { DatabaseTarget } from './target';

/* 不自动建表；应用仅持有 DML 账号，结构由独立迁移入口管理。 */
export async function createPostgresDb(target: DatabaseTarget): Promise<Db> {
  const pool = new pg.Pool({ connectionString: target.url, max: 5, connectionTimeoutMillis: 5000,
    options: '-c search_path=app', application_name: 'life_hub' });
  try {
    const identity = (await pool.query('SELECT current_database() AS database, current_user AS "user"')).rows[0];
    if (identity.database !== target.database || identity.user !== target.user) throw new Error('数据库连接身份不匹配');
    const orm = drizzle({ client: pool });
    await orm.execute(sql`SELECT id FROM app.items LIMIT 0`);
    return repository('postgresql', async (query) => singleResultRows(await orm.execute(query)),
      async (task) => orm.transaction(async (tx) => task(repository('postgresql',
        async (query) => singleResultRows(await tx.execute(query)),
        async () => { throw new Error('不支持嵌套事务'); }, async () => {}))),
      async () => { await pool.end(); });
  } catch (error) {
    await pool.end();
    throw error;
  }
}
