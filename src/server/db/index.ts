import { databaseTarget } from './target';
import { createPostgresDb } from './postgres';
import type { Db } from './repository';

export type { Db } from './repository';

/* 检查配置后才复用 PostgreSQL 实例；不提供文件数据库或目标回退。 */
export async function getDb(): Promise<Db> {
  if (process.env.NODE_ENV === 'test' && process.env.APP_ENV !== 'testing') {
    throw new Error('测试进程必须使用 APP_ENV=testing');
  }
  if (process.env.APP_ENV && !['development', 'testing', 'production'].includes(process.env.APP_ENV)) {
    throw new Error('未知 APP_ENV');
  }
  const target = databaseTarget();
  const key = target.url;
  const shared = globalThis as unknown as { __lifeHubDb?: Db; __lifeHubDbPending?: Promise<Db>; __lifeHubDbKey?: string };
  if (shared.__lifeHubDbKey && shared.__lifeHubDbKey !== key) throw new Error('数据库配置已更改，请重启应用');
  if (shared.__lifeHubDb) {
    return shared.__lifeHubDb;
  }
  if (!shared.__lifeHubDbPending) {
    shared.__lifeHubDbKey = key;
    shared.__lifeHubDbPending = (async () => {
      const db = await createPostgresDb(target);
      shared.__lifeHubDb = db;
      return db;
    })().catch((error) => { delete shared.__lifeHubDbPending; delete shared.__lifeHubDbKey; throw error; });
  }
  return shared.__lifeHubDbPending;
}
