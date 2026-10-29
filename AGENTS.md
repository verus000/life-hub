# 项目协作说明

本文件适用于整个 `life-hub` 项目。修改前先阅读相关模块，保持现有功能、数据格式和运行方式兼容。

## 沟通约定

- 使用中文回复，说明具体改动、验证结果及尚未验证的部分。
- 当用户提供图片且当前模型无法直接查看时，交给 `vision` 子代理识别和处理，并用中文转述结果。
- 优先完成当前任务所需的最小改动，避免顺带重构、重新格式化无关文件或引入构建工具。

## 项目概况

- 个人生活管理应用，包含手机号保活、宽带、停车费和资产分布，支持到期提醒、周期顺延、搜索筛选及 CSV 导入导出。
- 多用户：邮箱注册（邮件验证激活）、登录会话（HttpOnly Cookie），数据按 `user_id` 隔离；首个完成激活的用户自动认领历史无归属数据。
- 产品面向个人日常使用，界面以简单、直接、少干扰为优先：顶部分类导航，首页先展示最近安排，统计、筛选及补充字段按需展开。后续改版沿用这一定位。
- 视觉采用已选定的“晴空朋友”：明亮浅蓝底、白色圆角卡片、晴空蓝主按钮、柠檬黄笑脸小太阳，辅以薄荷绿和浅紫色分类图标；使用轻量内联 SVG，不引入远程图片或字体。保持顶部分类导航、最近安排优先和统计按需展开，正文、日期及移动端操作保持清晰易读。
- 技术栈：Next.js 16（App Router、Route Handlers、standalone 输出）+ TypeScript 严格模式 + Drizzle ORM（`node-sqlite` 驱动，基于 Node 22 内置 `node:sqlite`，零原生编译）+ Tailwind CSS v4（CSS-first 配置）+ React 19。
- 认证为自管会话（SHA-256 哈希令牌 + HttpOnly Cookie），未使用 Auth.js；密码哈希 `bcryptjs`，验证邮件 `nodemailer`。
- 数据库只保留 SQLite 单库；旧版 JSON / MySQL / PostgreSQL 适配器已在 Next.js 迁移中移除。旧 SQLite 库自动补列并迁移认证令牌；旧 JSON 需先从旧版导出备份，再在新版登录后导入条目，详见 `UPGRADING.md`。
- git 分支约定：`main` 为原生 Node 历史基线；`next-migration` 为 Next.js 重写主线，二者不合并，回退时以基线分支为准。

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `src/app/layout.tsx` | 根布局、全局字体与 `<html>` 骨架 |
| `src/app/page.tsx` | 首页 server component：校验会话，未登录跳 `/login`，已登录渲染 `Dashboard` 并注入初始条目 |
| `src/app/login\|register\|verify/page.tsx` | 登录 / 注册（含重发验证）/ 邮件激活页 |
| `src/app/globals.css` | Tailwind v4 `@theme` 配色 token（`--color-bg/surface/ink/brand/...`）与基础样式；新增颜色必须先定义 token 再用 utility |
| `src/app/api/**/route.ts` | 全部 10 个 Route Handler：auth（register/login/logout/resend/me/verify）、health、items（GET/POST/DELETE）、items/[id]（PUT/DELETE）、items/import |
| `src/middleware.ts` | 页面级快速闸门：只按 Cookie 存在性重定向，真正会话校验在页面与 API 层；运行在 Edge 运行时，**禁止导入 server 侧模块**（常量请放 `auth/constants.ts`） |
| `src/server/db/schema.ts` | Drizzle 表定义：`users`、`sessions`、`verificationTokens`、`items`（`userId` 可空 + 索引）及行类型导出 |
| `src/server/db/index.ts` | `getDb()` 单例、`ensureSchema()` 幂等建表与旧库迁移（`PRAGMA table_info` 检测补 `user_id` 列）、`createDbAt()` 供测试 |
| `src/server/auth/service.ts` | 注册、激活、登录、会话签发校验、按 IP 限流、dummyCompare 防时序探测；首个激活用户认领 legacy 数据 |
| `src/server/auth/mailer.ts` | console 模式（outbox 数组）/ smtp 模式（动态 `await import('nodemailer')`） |
| `src/server/auth/constants.ts` | `SESSION_COOKIE` 等 Edge 可安全导入的纯常量 |
| `src/server/items/service.ts` | items CRUD、行映射、`mutate` Promise 队列串行化写操作、整批校验导入去重、`claimLegacyItems` |
| `src/server/config.ts` | zod 校验环境变量；`MAIL_MODE=smtp` 且缺 `SMTP_HOST` 时快速失败 |
| `src/server/errors.ts` / `src/server/api-helpers.ts` | `AppError` 工厂族；统一 JSON 错误映射、会话 Cookie 读写、`requireUser`、`readJson` |
| `src/lib/types.ts` | 全部领域类型（一律 type alias，不用 interface——需要隐式 index signature） |
| `src/lib/records.ts` | 校验、去重、CSV / JSON 备份解析（前后端共用，纯函数无 server 依赖） |
| `src/lib/model.ts` | 分类字段定义、日期与周期计算、历史快照、待办与统计 |
| `src/lib/calendar.ts` / `src/lib/chart.ts` | ICS 生成（折行 / UID / 提醒）、环形图几何与配色 |
| `src/lib/api.ts` | 客户端 fetch 封装（`ApiError`，401 跳登录）、CSV / 文件下载 |
| `src/components/Dashboard.tsx` | 主容器：顶栏、tabs、弹窗状态、导入导出备份日历、登出 |
| `src/components/ItemForm.tsx` | schema 驱动表单：国家联想、日期快捷键、presets、字段折叠 |
| `src/components/Overview.tsx` / `CategoryList.tsx` | 统计卡 + 环形图、搜索（含 isComposing）/筛选/条目操作 |
| `src/components/ActionModals.tsx` / `auth/AuthCard.tsx` / `ui.tsx` / `icons.tsx` | 处理与历史撤销弹窗、登录注册三视图、通用 UI 件、内联 SVG |
| `src/components/ui/` / `src/lib/utils.ts` / `components.json` | shadcn/ui 源码组件、Radix 交互、中文日期与国家选择器、Sonner 通知；`cn` 合并 Tailwind 样式 |
| `test/` | Vitest：records / model / db（建表与旧令牌迁移）/ auth / items / API 助手与路由 / 认证页面（含 StrictMode 激活请求）/ Docker 入口，共 75 项；`helpers.ts` 提供临时库与 outbox 令牌提取 |
| `vitest.config.mts` | node 环境、`@` 别名（**必须是 .mts**，.ts 会被按 CJS 加载） |
| `drizzle.config.ts` / `next.config.ts` / `tsconfig.json` / `postcss.config.mjs` | 工具链配置；`next.config.ts` 设 `output: 'standalone'`、`serverExternalPackages: ['nodemailer']` |
| `Dockerfile` / `docker-compose.yml` / `.env.example` | 三阶段构建（standalone 运行时）、8787:3000 映射、`/data` 卷、环境变量参考 |
| `docker-entrypoint.cjs` / `UPGRADING.md` | 兼容旧卷权限后降权启动；数据卷、激活链接和代理配置的升级说明 |
| `data/` | 本地持久化数据（SQLite 库等），不能用作测试夹具 |

## 运行与配置

```powershell
node --version          # 需要 >= 22.5（node:sqlite）
npm install
npm run dev             # 开发（http://localhost:3000）
npm run build && npm start   # 生产（standalone）
npm test                # Vitest 75 项
npm run typecheck       # tsc --noEmit
```

- 环境变量由 Next.js 内置 `.env` 机制加载（无 dotenv）；以 `.env.example` 为参考：`DB_FILE_NAME`、`APP_URL`、`MAIL_MODE`（`console`/`smtp`）、`SMTP_HOST/PORT/USER/PASS/FROM`、`SESSION_TTL_DAYS`、`BCRYPT_ROUNDS`。开发期未配置 SMTP 时默认 console 模式（验证链接打印到终端）。
- 数据库文件路径相对于项目根目录；Docker 中为 `/data/life-hub.db`。Compose 保留旧 `life-hub-data` 卷名，升级时保持原项目名；已使用 `app-data` 的部署按 `UPGRADING.md` 指向既有卷。
- `TRUST_PROXY=false` 为默认值：忽略客户端代理头，直连认证请求共用限流桶。仅在禁止直连且可信反代覆盖/追加真实 IP 时设为 `true`，取 `X-Forwarded-For` 最右侧有效 IP，否则取代理覆盖的 `X-Real-IP`。
- PowerShell 使用 `$env:MAIL_MODE = 'console'` 形式设置环境变量；临时调试优先用环境变量，不要改用户的 `.env`。
- Docker：`docker build -t life-hub .` 或 `docker compose up -d`。
- `node:sqlite` 是实验性 API，构建与测试日志中的 `ExperimentalWarning` 属预期，不是故障。

## 实现约定

- TypeScript 严格模式，两空格缩进、单引号、分号；类型一律 type alias（interface 缺隐式 index signature 会破坏 `Item[] → ItemInput[]` 一类赋值）。
- 动态路由参数是异步的：`{ params }: { params: Promise<{ id: string }> }`，需 `await params`；`cookies()` 同样 `await`。
- server 侧代码只在 Route Handler / server component 中执行；`src/middleware.ts`（Edge 运行时）**不得**导入 `node:crypto`、bcryptjs、nodemailer、db 等模块——需要的共享常量拆到 `src/server/auth/constants.ts` 这类零依赖文件。
- Drizzle 使用 1.0.0-rc 系列：`drizzle()` 配置**没有 `schema` 字段**（rc 移除），只用核心查询 API（select/insert/update/delete）；表结构用 `drizzle-kit`（`npm run db:generate` / `db:migrate`），运行时建表走 `ensureSchema()` 幂等 DDL。
- 前端数据全部来自服务端（首页 server component 注入 `initialItems`），没有 localStorage 数据模式；客户端改动经 `src/lib/api.ts` 提交后本地更新状态。
- 领域计算留在 `src/lib/`（纯函数，前后端共用，不得导入 server 模块）；数据库细节留在 `src/server/items/service.ts`；Route Handler 只做参数解析、鉴权与响应。
- 新增管理类别时，先改 `src/lib/model.ts` 的 `CATEGORIES` 与顺序，再检查 `ItemForm` 字段渲染、`CategoryList` 展示、`Overview` 统计及 `records.ts` 的 CSV 映射，并补自测。
- 样式优先复用 `globals.css` 的 `@theme` token 生成的 utility（`bg-surface`、`text-ink-2`、`border-line` 等）；不引入图标库、远程字体或图片依赖。新增动效需尊重 `prefers-reduced-motion`。
- 交互组件优先复用 `src/components/ui/` 的 shadcn/ui + Radix 源码，语义色通过 `globals.css` 映射到“晴空朋友”的蓝黄主题。避免重新引入原生下拉、日期框与 `window.confirm`；日期仍按本地日历输出 `YYYY-MM-DD`，国家支持自定义输入，旧的未知下拉值需保留。
- React 组件中用户内容经 JSX 文本节点输出（自动转义）；不要用 `dangerouslySetInnerHTML`。SQL 一律走 Drizzle 参数绑定。

## 数据与接口兼容

- 应用对象字段使用 camelCase（`startDate`、`nextDate`、`createdAt`、`updatedAt`）；数据库行对应 snake_case，转换集中在 `src/server/items/service.ts` 的 `rowToItem` / `toInsertValues` / `toPatchValues`。
- `detail` 在应用层是对象，在 SQLite 行中保存为 JSON 字符串；分类扩展字段优先放在 `detail` 下。
- 金额允许 `null`，空金额不能被无意改成 `0`；业务日期使用 `YYYY-MM-DD` 字符串，创建和更新时间使用 ISO 时间戳。日期计算沿用本地日历语义，避免 UTC 转换造成日期偏移。
- 人民币资产总额与分布图只统计 CNY 账户，其他币种单独展示；没有自动汇率换算。
- 周期支出按币种分别汇总，排除暂停、归档、已完成及一次性条目。`status` 可选 `active`、`paused`、`archived`、`completed`；默认列表与待办只展示在用条目。
- `detail.recordKey` 是新记录的稳定标识；导入按标识去重，旧文件没有标识时按完整内容去重。`detail.reminderCycle` 将保活 / 复核周期与缴费 `cycle` 分开；`detail.reminderAnchor` 保留原始日期；`detail.contractDate` 是独立的宽带合约提醒，旧记录的 `nextDate` 保留原值，编辑时提示核对，不自动推断。`detail.history` 保存处理和状态记录；撤销仅允许最新一次处理且相关字段未发生后续变更。
- `items.userId` 为空的历史数据由首个完成邮箱验证的用户认领（`claimLegacyItems`）；之后的注册用户从空数据开始。旧库升级由 `ensureSchema()` 做补列迁移（注意：`items_user_idx` 索引必须在补列**之后**创建）。
- 旧 `verifications` 令牌在事务内搬入 `verification_tokens` 并搬空旧表，避免重启复活已消费令牌。旧 `/?verify=...` 链接由 middleware 在登录闸门之前转到 `/verify?token=...`；登录和注册页的跳转须校验真实会话，不能仅凭 Cookie 存在性。
- `update` 是部分更新：未传入的字段保留，包括 `detail`；显式传 `detail` 时整体替换。更新和删除不存在的记录返回 404，列表按 ID 升序返回。
- 涉及表结构变更时同步更新 `schema.ts`、`ensureSchema()` 的迁移逻辑与 `test/db.test.ts`；`CREATE TABLE IF NOT EXISTS` 不会迁移已存在的表。

现有 API 约定（`/api/items` 全系要求登录会话，未登录返回 401，数据按当前用户隔离）：

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（公开） |
| POST | `/api/auth/register` | 注册并发送验证邮件，返回 201 |
| GET | `/api/auth/verify?token=` | 激活令牌校验（24h、一次性），成功后签发会话 |
| POST | `/api/auth/login` | 登录签发会话；未激活返回 403 |
| POST | `/api/auth/resend` | 重发验证邮件（限流） |
| POST | `/api/auth/logout` | 注销当前会话 |
| GET | `/api/auth/me` | 当前用户信息，未登录 401 |
| GET | `/api/items` | 返回当前用户条目数组 |
| POST | `/api/items` | 新增条目，必填 `title`，成功返回 201 和条目 |
| PUT | `/api/items/:id` | 部分更新；可传 `expectedUpdatedAt` 防旧页面覆盖，冲突 409，不存在 404 |
| DELETE | `/api/items/:id` | 返回被删除条目，不存在返回 404 |
| POST | `/api/items/import` | 接收 `{ items: [...] }`，整批校验并跳过重复，返回 201 和 `{ created, skipped }` |
| DELETE | `/api/items` | 清空当前用户所有条目，返回 `{ ok: true }` |

- 错误响应统一 `{ error: '中文信息' }`；修改路由需同步检查 `src/lib/api.ts` 调用及测试。
- 请求体默认上限 2MB（`readJson` 按流累计 UTF-8 字节，超限返回 413）。批量导入在单个同步事务内分批写入，任一批次失败需整批回滚。
- CSV 导出保留 UTF-8 BOM；解析保留对引号、逗号、换行的支持，并兼容旧手机号应用的中文表头。完整 JSON 备份使用 `{ format: 'life-hub-backup', version: 1, exportedAt, items }`；导入先预览、再合并，校验错误整批不写入。
- 日历文件是今天及未来在用事项的快照；日期或状态改变后需移除旧日历事项并重新导入。

## 验证方式

```powershell
npm run typecheck   # tsc --noEmit
npm test            # Vitest（75 项）
npm run build       # 生产构建，15 个路由
```

- 业务改动后三件套全跑；纯文档改动按需核实命令和描述即可。
- 测试使用系统临时目录的独立 SQLite 文件和内存 outbox，不连接用户在用的数据库；console 邮件模式的验证令牌经 `getOutbox()` 提取。
- 自测不代表真实浏览器交互验证；前端交互或布局改动需补充浏览器检查（特别注意中文输入法期间搜索框不重建）。
- 数据或行为修复优先在 `test/` 补充有意义的回归场景。
- 真实 SMTP 发信、Docker 镜像构建、生产 `npm start` 冒烟如未执行，需在交付说明中如实写明范围与原因。

## 本地数据保护

- `data/` 下可能包含真实手机号、住址、账户和资产信息；检查实现时优先读源码，不要为了解项目而读取业务数据。
- 保留现有数据库、SQLite 的 `-wal` / `-shm` 文件及用户已有改动。不要清空、覆盖或把这些文件当作测试输出。
- 临时服务使用独立的 `DB_FILE_NAME` 环境变量和空闲端口；不要对现有服务调用清空或删除接口来验证功能。
- 需要新增配置示例时使用虚构值，避免在文档、日志或提交内容中写入真实凭据和个人记录。
