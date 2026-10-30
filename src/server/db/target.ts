export type DatabaseTarget = {
  url: string;
  environment: 'development' | 'testing';
  database: string;
  user: string;
};

/* 本地入口只接受登记过的精确目标；测试绝不回退 DATABASE_URL。 */
export function databaseTarget(
  env: Record<string, string | undefined> = process.env,
  purpose: 'app' | 'migration' = 'app',
): DatabaseTarget {
  const environment = env.APP_ENV;
  if (environment !== 'development' && environment !== 'testing') {
    throw new Error('PostgreSQL 本地入口要求 APP_ENV=development 或 testing');
  }
  if (env.APP_PROJECT !== 'life_hub') throw new Error('APP_PROJECT 必须为 life_hub');
  const suffix = environment === 'testing' ? 'test' : 'dev';
  const key = purpose === 'migration' ? 'MIGRATION_DATABASE_URL'
    : environment === 'testing' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  const raw = env[key];
  if (!raw) throw new Error(`缺少 ${key}，禁止回退其他数据库`);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${key} 格式无效`); }
  const database = `life_hub_${suffix}`;
  const user = `${database}_${purpose === 'migration' ? 'migrator' : 'app'}`;
  const port = environment === 'testing' ? '55432' : '5432';
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1' || (url.port || '5432') !== port
    || url.pathname !== `/${database}` || decodeURIComponent(url.username) !== user
    || !url.password || url.search || url.hash) {
    throw new Error(`${key} 目标不匹配：仅允许本地登记的 ${database} / ${user} / ${port}`);
  }
  return { url: raw, environment, database, user };
}
