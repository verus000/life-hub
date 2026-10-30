import { databaseTarget } from './target';
import { createPostgresDb } from './postgres';
import type { Db } from './repository';

export type { Db } from './repository';

/* 检查配置后才复用实例；本地开发和测试不允许 SQLite 回退。 */
export async function getDb(): Promise<Db> {
  if (process.env.NODE_ENV === 'test' && process.env.APP_ENV !== 'testing') {
    throw new Error('测试进程必须使用 APP_ENV=testing');
  }
  if (process.env.APP_ENV && !['development', 'testing', 'production'].includes(process.env.APP_ENV)) {
    throw new Error('未知 APP_ENV');
  }
  const backend = process.env.DB_BACKEND ?? 'postgresql';
  const local = process.env.APP_ENV === 'development' || process.env.APP_ENV === 'testing'
    || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (backend !== 'postgresql' && backend !== 'sqlite') throw new Error('未知 DB_BACKEND');
  if (backend === 'sqlite' && local) throw new Error('本地开发和测试必须使用 Docker PostgreSQL');
  if (backend === 'sqlite' && (process.env.APP_ENV !== 'production' || process.env.APP_PROJECT !== 'life_hub')) {
    throw new Error('SQLite 兼容部署要求显式配置 APP_ENV=production 和 APP_PROJECT=life_hub');
  }
  const target = backend === 'postgresql' ? databaseTarget() : undefined;
  const key = target?.url ?? process.env.DB_FILE_NAME ?? 'data/life-hub.db';
  const shared = globalThis as unknown as { __lifeHubDb?: Db; __lifeHubDbPending?: Promise<Db>; __lifeHubDbKey?: string };
  if (shared.__lifeHubDbKey && shared.__lifeHubDbKey !== key) throw new Error('数据库配置已更改，请重启应用');
  if (shared.__lifeHubDb) {
    if (shared.__lifeHubDb.dialect !== backend) throw new Error('缓存数据库类型不匹配');
    return shared.__lifeHubDb;
  }
  if (!shared.__lifeHubDbPending) {
    shared.__lifeHubDbKey = key;
    shared.__lifeHubDbPending = (async () => {
      const db = target ? await createPostgresDb(target)
        : (await import('./sqlite')).createDbAt(process.env.DB_FILE_NAME ?? 'data/life-hub.db');
      shared.__lifeHubDb = db;
      return db;
    })().catch((error) => { delete shared.__lifeHubDbPending; delete shared.__lifeHubDbKey; throw error; });
  }
  return shared.__lifeHubDbPending;
}
