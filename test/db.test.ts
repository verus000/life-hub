import { describe, expect, it, vi } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { databaseTarget } from '@/server/db/target';
import { createPostgresDb } from '@/server/db/postgres';
import { getDb } from '@/server/db';
import { freshDb } from './helpers';

describe('数据库目标检查', () => {
  const env = {
    APP_ENV: 'testing', APP_PROJECT: 'life_hub',
    TEST_DATABASE_URL: 'postgresql://life_hub_test_app:example@127.0.0.1:55432/life_hub_test',
  };
  it('接受登记的测试目标', () => {
    expect(databaseTarget(env)).toMatchObject({ database: 'life_hub_test', user: 'life_hub_test_app' });
  });
  it('缺失测试连接时不回退开发库，生产模式也必须显式指定环境', async () => {
    try {
      vi.stubEnv('TEST_DATABASE_URL', '');
      vi.stubEnv('DATABASE_URL', env.TEST_DATABASE_URL);
      await expect(getDb()).rejects.toThrow('缺少 TEST_DATABASE_URL');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('APP_ENV', '');
      await expect(getDb()).rejects.toThrow('APP_ENV=development、testing 或 production');
    } finally { vi.unstubAllEnvs(); }
  });
  it('容器入口仅允许对应环境的公共数据库 DNS，不能跨环境使用', () => {
    const url = env.TEST_DATABASE_URL.replace('127.0.0.1:55432', 'local-shared-test-postgres-1:5432');
    expect(databaseTarget({ ...env, TEST_DATABASE_URL: url })).toMatchObject({ database: 'life_hub_test', tls: false });
    expect(() => databaseTarget({ ...env, TEST_DATABASE_URL: url.replace('local-shared-test-', 'local-shared-dev-') })).toThrow('目标不匹配');
  });
  it.each([
    { APP_ENV: 'production' }, { APP_ENV: '' }, { APP_PROJECT: 'other' },
    { TEST_DATABASE_URL: '', DATABASE_URL: env.TEST_DATABASE_URL },
    { TEST_DATABASE_URL: env.TEST_DATABASE_URL.replace('55432', '5432') },
    { TEST_DATABASE_URL: env.TEST_DATABASE_URL.replace('127.0.0.1', 'localhost') },
    { TEST_DATABASE_URL: env.TEST_DATABASE_URL.replace('/life_hub_test', '/other_test') },
    { TEST_DATABASE_URL: env.TEST_DATABASE_URL.replace('life_hub_test_app:', 'life_hub_test_migrator:') },
    { TEST_DATABASE_URL: env.TEST_DATABASE_URL + '?options=-c%20role=admin' },
  ])('拒绝不匹配配置 %j', (patch) => {
    expect(() => databaseTarget({ ...env, ...patch })).toThrow();
  });
});

describe('生产连接配置检查（只检查配置，不连接生产）', () => {
  const production = {
    APP_ENV: 'production', APP_PROJECT: 'life_hub',
    DATABASE_URL: 'postgresql://life_hub_prod_app:example@db.example.invalid:5432/life_hub_prod',
    DATABASE_ALLOWED_HOST: 'db.example.invalid', DATABASE_ALLOWED_PORT: '5432',
  };
  it('显式匹配独立生产目标并强制 TLS', () => {
    expect(databaseTarget(production)).toMatchObject({ environment: 'production',
      database: 'life_hub_prod', user: 'life_hub_prod_app', tls: true });
    expect(() => databaseTarget(production, 'migration')).toThrow('不允许生产环境');
  });
  it.each([
    { DATABASE_ALLOWED_HOST: '' }, { DATABASE_ALLOWED_PORT: '' },
    { DATABASE_ALLOWED_HOST: 'other.example.invalid' },
    { DATABASE_URL: production.DATABASE_URL.replace('life_hub_prod_app:', 'life_hub_prod_migrator:') },
    { DATABASE_URL: production.DATABASE_URL.replace('/life_hub_prod', '/life_hub_dev') },
    { DATABASE_URL: production.DATABASE_URL.replace('db.example.invalid', '127.0.0.1'), DATABASE_ALLOWED_HOST: '127.0.0.1' },
    { DATABASE_URL: production.DATABASE_URL + '?sslmode=disable' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
  ])('拒绝错误生产配置 %j', (patch) => {
    expect(() => databaseTarget({ ...production, ...patch })).toThrow();
  });
});

describe('Docker PostgreSQL', () => {
  it('测试连接使用最小权限账号且结构已迁移', async () => {
    const target = databaseTarget();
    const client = new pg.Client({ connectionString: target.url });
    try {
      await client.connect();
      const [row] = (await client.query(`SELECT current_database() AS database, current_user AS username,
        rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
        has_schema_privilege(current_user, 'app', 'CREATE') AS can_create,
        has_schema_privilege(current_user, 'migration_meta', 'USAGE') AS can_access_migrations,
        has_database_privilege(current_user, current_database(), 'TEMP') AS can_temp,
        has_table_privilege(current_user, 'app.items', 'TRUNCATE') AS can_truncate,
        has_table_privilege(current_user, 'app.items', 'SELECT,INSERT,UPDATE,DELETE') AS can_crud,
        (SELECT count(*)::integer FROM pg_auth_members WHERE member = pg_roles.oid) AS memberships
        FROM pg_roles WHERE rolname = current_user`)).rows;
      expect(row).toEqual({ database: 'life_hub_test', username: 'life_hub_test_app',
        rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false,
        can_create: false, can_access_migrations: false, can_temp: false, can_truncate: false,
        can_crud: true, memberships: 0 });
      const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'app'")).rows.map((r) => r.tablename);
      expect(tables.sort()).toEqual(['items', 'sessions', 'users', 'verification_tokens']);
    } finally { await client.end(); }
  });

  it('每个测试事务回滚，后续连接看不到数据', async () => {
    const db = await freshDb();
    const title = `rollback-${randomUUID()}`;
    await db.insert('items', { title, createdAt: '2026-10-30', updatedAt: '2026-10-30' });
    expect(await db.find('items', { title })).toHaveLength(1);
    await db.close();
    const next = await freshDb();
    expect(await next.find('items', { title })).toEqual([]);
  });

  it('运行时事务异常真实回滚全部写入', async () => {
    const db = await createPostgresDb(databaseTarget());
    const title = `transaction-${randomUUID()}`;
    try {
      await expect(db.transaction(async (tx) => {
        await tx.insert('items', { title, createdAt: '2026-10-30', updatedAt: '2026-10-30' });
        throw new Error('模拟后续写入失败');
      })).rejects.toThrow('模拟后续写入失败');
      expect(await db.find('items', { title })).toEqual([]);
    } finally { await db.close(); }
  });
});
