/* 每个用例连接独立事务，结束时回滚；仅持有测试 DML 账号。 */
import pg from 'pg';
import { afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { repository, singleResultRows, type Db } from '@/server/db/repository';
import { databaseTarget } from '@/server/db/target';
import { resetConfigCache } from '@/server/config';
import { clearOutbox, getOutbox } from '@/server/auth/mailer';

const connections = new Set<Db>();
let savepoint = 0;

export async function freshDb(): Promise<Db> {
  const target = databaseTarget();
  if (target.environment !== 'testing') throw new Error('freshDb 只允许 testing');
  const client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 5000,
    options: '-c search_path=app', application_name: 'life_hub_tests' });
  await client.connect();
  try {
    const identity = (await client.query('SELECT current_database() AS database, current_user AS "user"')).rows[0];
    if (identity.database !== target.database || identity.user !== target.user) throw new Error('测试连接身份不匹配');
    await client.query('BEGIN');
    const orm = drizzle({ client });
    let closed = false;
    const db = repository('postgresql', async (query) => singleResultRows(await orm.execute(query)), async (task) => {
      const name = `test_savepoint_${++savepoint}`;
      await client.query(`SAVEPOINT ${name}`);
      try {
        const result = await task(db);
        await client.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        await client.query(`RELEASE SAVEPOINT ${name}`);
        throw error;
      }
    }, async () => {
      if (closed) return;
      closed = true;
      try { await client.query('ROLLBACK'); } finally { await client.end(); connections.delete(db); }
    });
    connections.add(db);
    return db;
  } catch (error) {
    await client.end();
    throw error;
  }
}

afterEach(async () => {
  await Promise.all([...connections].map((db) => db.close()));
});

export function setupEnv(): void {
  // 不覆盖 APP_ENV 或连接地址：配置错误应由入口拒绝。
  process.env.MAIL_MODE = 'console';
  process.env.APP_URL = 'http://127.0.0.1:3000';
  process.env.SESSION_TTL_DAYS = '7';
  process.env.TRUST_PROXY = 'false';
  delete process.env.SMTP_HOST;
  resetConfigCache();
}

export function outbox() { return getOutbox(); }
export function clearMail() { clearOutbox(); }

export function verifyTokenFromOutbox(): string {
  const mail = getOutbox().at(-1);
  if (!mail) throw new Error('没有发出的验证邮件');
  const match = /token=([a-f0-9]{64})/.exec(mail.text + ' ' + mail.url);
  if (!match) throw new Error('邮件中未找到验证令牌');
  return match[1];
}
