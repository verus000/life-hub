import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { databaseTarget } from '../src/server/db/target';

async function main() {
  const environment = process.argv[2];
  if (environment !== 'development' && environment !== 'testing') {
    throw new Error('用法：npm run db:migrate -- development|testing');
  }
  // 单独进程只加载迁移凭据，应用和测试不加载这些文件。
  const config = path.resolve(`configs/.env.${environment}.migration.local`);
  process.loadEnvFile(config);
  if (process.env.APP_ENV !== environment) throw new Error('迁移环境与配置不匹配');
  const target = databaseTarget(process.env, 'migration');
  const client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const identity = (await client.query('SELECT current_database() AS database, current_user AS "user"')).rows[0];
    if (identity.database !== target.database || identity.user !== target.user) throw new Error('迁移连接身份不匹配');
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('life_hub_migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS migration_meta.versions (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = fs.readdirSync('migrations').filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const source = fs.readFileSync(path.join('migrations', file), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const applied = (await client.query('SELECT checksum FROM migration_meta.versions WHERE version = $1', [file])).rows[0];
      if (applied) {
        if (applied.checksum !== checksum) throw new Error(`已执行迁移被修改：${file}`);
        continue;
      }
      await client.query(source);
      await client.query('INSERT INTO migration_meta.versions (version, checksum) VALUES ($1, $2)', [file, checksum]);
      console.log(`已迁移：${file}`);
    }
    await client.query('COMMIT');
    console.log(`迁移完成：${target.database}（${target.user}）`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // 不输出可能包含连接配置的驱动错误对象。
    throw new Error(error instanceof Error ? error.message : '迁移失败');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '迁移失败');
  process.exitCode = 1;
});
