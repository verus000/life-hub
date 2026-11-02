# 生活管理

Next.js 16 / React 19 / TypeScript / Drizzle。包含手机号保活、宽带、停车费和资产管理，支持可选邮箱验证、用户数据隔离、提醒及备份导入导出。

手机卡主要支持海外 eSIM：可用别名记录长期保号卡或旅行流量套餐，号码选填；号码／账号可直接填脱敏值，也可一键仅保留末四位。字段、表单、列表与新业务接入方式见 [EXTENDING.md](EXTENDING.md)。

## 本地运行

需要 Node.js >= 22、Docker Desktop。项目标识为 `life_hub`。所有环境只使用 PostgreSQL 17，不再提供文件数据库适配器。

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
DATABASE_URL=postgresql://life_hub_dev_app:<password>@127.0.0.1:5432/life_hub_dev
```

```dotenv
# .env.test.local：只放测试运行凭据
APP_ENV=testing
APP_PROJECT=life_hub
TEST_DATABASE_URL=postgresql://life_hub_test_app:<password>@127.0.0.1:55432/life_hub_test
```

迁移使用独立文件 `configs/.env.development.migration.local` / `configs/.env.testing.migration.local`，包含匹配的 `APP_ENV`、`APP_PROJECT=life_hub` 和 `MIGRATION_DATABASE_URL`，账号分别为 `life_hub_dev_migrator` / `life_hub_test_migrator`。运行进程和测试进程不加载这些文件。

```powershell
npm install
npm run db:migrate -- development
npm run db:migrate -- testing
npm run dev
```

默认访问 `http://localhost:3000`。邮箱验证默认关闭（`EMAIL_VERIFICATION_REQUIRED=false`），注册后直接使用邮箱和密码登录，无需配置 SMTP，也不发送验证邮件。已有未验证账号仍使用原密码登录，重复注册不会覆盖账号或密码。

以后设为 `EMAIL_VERIFICATION_REQUIRED=true` 并重启应用，即恢复邮件验证；关闭期间注册的账号也需要补验证，可在登录页重发邮件。未验证账号不会被标记为已验证。启用后邮件默认 console 模式，验证链接显示在开发终端；真实发信另按 `.env.example` 配置 SMTP。`APP_URL` 应与实际浏览器访问地址一致。

历史无归属记录：关闭验证时由最早注册的账号在登录后认领；启用验证时沿用首个完成邮箱验证的账号认领。后续账号的数据保持隔离。

## 基础路径与 Nginx

`NEXT_PUBLIC_BASE_PATH` 默认留空，应用部署在域名根路径。要部署到 `https://life.example.com/life-hub`，在构建前设置：

```dotenv
NEXT_PUBLIC_BASE_PATH=/life-hub
APP_URL=https://life.example.com/life-hub
EMAIL_VERIFICATION_REQUIRED=false
```

前缀可以是 `/tools/life-hub` 这样的多层路径，不含域名或查询参数。Next.js 页面、API、静态资源、登录／登出跳转和会话 Cookie 均使用该前缀。基础路径在构建时固定，修改后必须重新构建；已有会话切换路径后需重新登录。开发时修改配置后重启 `npm run dev`。

单独构建 Docker 镜像时传入公开路径参数（不得传入数据库凭据）：

```powershell
docker build --build-arg NEXT_PUBLIC_BASE_PATH=/life-hub -t life-hub .
```

Compose 从项目 `.env` 或 shell 读取 `NEXT_PUBLIC_BASE_PATH` 并传入构建。只填写 `APP_ENV_FILE` 指向的运行配置不会提供构建参数；请同时在 Compose 插值环境中设置前缀，再执行 `docker compose up -d --build`。`APP_URL` 在运行时注入，须包含相同前缀。

将 [Nginx 示例](deploy/nginx.conf.example) 合并到已有站点的 `server` 块中，按实际前缀、应用端口和 TLS 配置调整。`proxy_pass http://127.0.0.1:8787` **末尾不要加 `/`**，让 Nginx 保留 `/life-hub` 前缀；无需单独重写 `/api` 或 `/_next`。示例适用于 Nginx 在宿主机、应用仅监听回环端口的部署；容器内 Nginx 需改为同网络的应用地址。应用端口禁止外部直连且来源头由可信 Nginx 覆盖后，才启用 `TRUST_PROXY=true`。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

`npm test` 默认运行 PostgreSQL 测试和纯函数／页面测试。测试仅加载 `.env.test.local`、`.env.test`，必须使用 `APP_ENV=testing`、精确的本机测试端点、库名和运行账号；缺失或不匹配直接失败，绝不回退开发库或其他存储。每个集成用例在独立事务中执行，结束时回滚，不清表、不删除库或数据卷。批量导入通过保存点检查整批回滚。

现有预览占用默认构建目录时，可先设置 `$env:LIFE_HUB_DIST_DIR = '.next-postgres-check'` 再构建。生产模式的本地预览也必须显式注入测试配置（APP_ENV=testing、TEST_DATABASE_URL）；`npm start` 缺少配置会停止，不会根据 NODE_ENV 自动选择数据库或环境。

测试包含注册验证开关、部署前缀、PostgreSQL 权限隔离、事务回滚和生产连接配置拒绝测试。生产配置测试不访问真实生产实例。

## 迁移与 Docker 运行

PostgreSQL 结构版本在 `migrations/`，只由显式迁移命令执行。迁移使用独立元数据 schema、事务、互斥锁和文件校验和；应用启动不建表。`npm run db:generate` 只生成 PostgreSQL schema 差异供审查，不自动执行；采纳后需要形成 `migrations/` 中的有序 SQL。

Docker 镜像直接以非 root 用户运行 standalone 服务，包含 public 和 static 资源；应用不挂载数据库文件卷。构建上下文排除所有 .env*、configs/ 和本地产物，真实凭据只能在运行时注入。

Compose 只创建应用容器，通过显式指定的外部 DATABASE_NETWORK 访问对应数据库。容器内的开发端点为 local-shared-dev-postgres-1:5432，测试端点为 local-shared-test-postgres-1:5432；Windows 程序仍使用上表回环端点。两种端点都接受精确的环境／库／角色校验，不接入另一环境的网络。按 .env.example 准备忽略的 .env，填入容器运行账号 URL、APP_ENV 和 DATABASE_NETWORK 后，可运行 docker compose config --quiet、docker compose up -d --build；业务项目不会创建、停止或删除公共数据库。

生产使用独立 life_hub_prod / life_hub_prod_app，必须提供 DATABASE_ALLOWED_HOST、DATABASE_ALLOWED_PORT 和匹配的 DATABASE_URL，强制 TLS 证书校验；自签 CA 可用 DATABASE_SSL_CA_FILE 指定挂载路径。生产不得连接本地公共实例。本地迁移命令明确拒绝 production，生产迁移需要独立审查和授权。

数据库权限、备份恢复、迁移校验和以后切换步骤见 [DATABASE.md](DATABASE.md)，版本变化见 [UPGRADING.md](UPGRADING.md)。
