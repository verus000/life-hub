# 生活管理

Next.js 16 / React 19 / TypeScript / Drizzle。包含手机号保活、宽带、停车费和资产管理，支持邮箱激活、用户数据隔离、提醒及备份导入导出。

## 本地运行

需要 Node.js >= 22.5、Docker Desktop。项目标识为 `life_hub`。本地开发、浏览器测试和自动化测试使用 PostgreSQL 17；既有 SQLite 部署继续兼容，`data/` 下的历史数据不会自动搬迁。

数据库复用本机公共基础设施，入口位于 `E:\worksapce\infrastructure\README.md`（换主机后重新发现位置）。业务仓库不管理公共容器、网络和数据卷的启停，也不包含另一份数据库 Compose。

| 环境 | Docker Compose 项目 | 数据库 | 运行账号 | 端点 |
| --- | --- | --- | --- | --- |
| development | local-shared-dev | life_hub_dev | life_hub_dev_app | 127.0.0.1:5432 |
| testing | local-shared-test | life_hub_test | life_hub_test_app | 127.0.0.1:55432 |

首次换机配置：由公共设施管理员按其建库模板建立上述数据库、独立 app / migrator 角色、`app` / `migration_meta` schema 和默认权限。管理员凭据保留在公共设施中。两个实例有独立 named volume、网络及管理员密码，只绑定本机回环地址。

本机已生成下列未跟踪、受 NTFS ACL 限制的本地配置。不要把实际密码复制到示例或提交到 Git。新环境按以下格式自行注入真实 Secret（`<password>` 只是占位符）：

```dotenv
# .env.development.local：只放开发运行凭据
APP_ENV=development
APP_PROJECT=life_hub
DB_BACKEND=postgresql
DATABASE_URL=postgresql://life_hub_dev_app:<password>@127.0.0.1:5432/life_hub_dev
```

```dotenv
# .env.test.local：只放测试运行凭据
APP_ENV=testing
APP_PROJECT=life_hub
DB_BACKEND=postgresql
TEST_DATABASE_URL=postgresql://life_hub_test_app:<password>@127.0.0.1:55432/life_hub_test
```

迁移使用独立文件 `configs/.env.development.migration.local` / `configs/.env.testing.migration.local`，包含匹配的 `APP_ENV`、`APP_PROJECT=life_hub` 和 `MIGRATION_DATABASE_URL`，账号分别为 `life_hub_dev_migrator` / `life_hub_test_migrator`。运行进程和测试进程不加载这些文件。

```powershell
npm install
npm run db:migrate -- development
npm run db:migrate -- testing
npm run dev
```

默认访问 `http://localhost:3000`。邮件默认 console 模式，验证链接显示在开发终端；真实发信另按 `.env.example` 配置 SMTP。`APP_URL` 应与实际浏览器访问地址一致。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

`npm test` 默认运行 PostgreSQL 测试和纯函数／页面测试。测试仅加载 `.env.test.local`、`.env.test`，必须使用 `APP_ENV=testing`、精确的本机测试端点、库名和运行账号；缺失或不匹配直接失败，绝不回退开发库或 SQLite。每个集成用例在独立事务中执行，结束时回滚，不清表、不删除库或数据卷。批量导入通过保存点检查整批回滚。

现有预览占用默认构建目录时，可先设置 `$env:LIFE_HUB_DIST_DIR = '.next-postgres-check'` 再构建。生产模式的本地预览也必须显式注入测试配置（APP_ENV=testing、TEST_DATABASE_URL、DB_BACKEND=postgresql）；`npm start` 缺少配置会停止，不按 NODE_ENV 自动选 SQLite。

`test/legacy/` 保留历史 SQLite 升级回归代码，默认测试明确排除，本次未运行；它们不作为本地开发／测试的数据存储入口。

## 迁移与既有部署

PostgreSQL 结构版本在 `migrations/`，只由显式迁移命令执行。迁移使用独立元数据 schema、事务、互斥锁和文件校验和；应用启动不建表。`npm run db:generate` 只生成 PostgreSQL schema 差异供审查，不自动执行；采纳后需要形成 `migrations/` 中的有序 SQL。

数据库权限、备份恢复、迁移校验和未来切换步骤见 [DATABASE.md](DATABASE.md)。既有 SQLite Docker 部署继续由原 Compose 的 `APP_ENV=production` / `DB_BACKEND=sqlite` 运行，数据卷沿用原配置；升级细节见 [UPGRADING.md](UPGRADING.md)。本次没有修改生产数据库或自动导入历史个人数据。
