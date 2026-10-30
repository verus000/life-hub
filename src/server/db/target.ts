export type DatabaseTarget = {
  url: string;
  environment: 'development' | 'testing' | 'production';
  database: string;
  user: string;
  tls: boolean;
  caFile?: string;
};

/* 环境、精确库名、角色与端点一起校验；测试绝不回退 DATABASE_URL。 */
export function databaseTarget(
  env: Record<string, string | undefined> = process.env,
  purpose: 'app' | 'migration' = 'app',
): DatabaseTarget {
  const environment = env.APP_ENV;
  if (!['development', 'testing', 'production'].includes(environment || '')) {
    throw new Error('PostgreSQL 入口要求 APP_ENV=development、testing 或 production');
  }
  if (purpose === 'migration' && environment === 'production') throw new Error('本地迁移入口不允许生产环境');
  if (env.APP_PROJECT !== 'life_hub') throw new Error('APP_PROJECT 必须为 life_hub');
  const suffix = environment === 'testing' ? 'test' : environment === 'production' ? 'prod' : 'dev';
  const key = purpose === 'migration' ? 'MIGRATION_DATABASE_URL'
    : environment === 'testing' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  const raw = env[key];
  if (!raw) throw new Error(`缺少 ${key}，禁止回退其他数据库`);
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${key} 格式无效`); }
  const database = `life_hub_${suffix}`;
  const user = `${database}_${purpose === 'migration' ? 'migrator' : 'app'}`;
  const port = url.port || '5432';
  const localPort = environment === 'testing' ? '55432' : '5432';
  const containerHost = environment === 'testing' ? 'local-shared-test-postgres-1' : 'local-shared-dev-postgres-1';
  let allowedEndpoint = (url.hostname === '127.0.0.1' && port === localPort)
    || (url.hostname === containerHost && port === '5432');
  if (environment === 'production') {
    if (!env.DATABASE_ALLOWED_HOST || !env.DATABASE_ALLOWED_PORT) throw new Error('生产连接必须显式配置 DATABASE_ALLOWED_HOST / DATABASE_ALLOWED_PORT');
    if (['localhost', '::1', '[::1]', 'host.docker.internal'].includes(url.hostname)
      || /^127\./.test(url.hostname) || url.hostname.startsWith('local-shared-')) {
      throw new Error('生产环境不能使用本地开发或测试数据库端点');
    }
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('生产连接禁止禁用 TLS 证书验证');
    allowedEndpoint = url.hostname === env.DATABASE_ALLOWED_HOST && port === env.DATABASE_ALLOWED_PORT;
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !allowedEndpoint
    || url.pathname !== `/${database}` || decodeURIComponent(url.username) !== user
    || !url.password || url.search || url.hash) {
    throw new Error(`${key} 目标不匹配：要求登记的端点、${database} / ${user}`);
  }
  return { url: raw, environment: environment as DatabaseTarget['environment'], database, user,
    tls: environment === 'production', caFile: environment === 'production' ? env.DATABASE_SSL_CA_FILE || undefined : undefined };
}
