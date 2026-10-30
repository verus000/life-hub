import fs from 'node:fs';

// 只加载测试专属配置，禁止加载 .env / .env.local / 开发与迁移凭据。
for (const file of ['.env.test.local', '.env.test']) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
