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
- 视觉偏好为清新、简洁：清透白底、少量浅蓝或薄荷色、细线导航、明确的字号层次与舒展留白；空状态可使用轻量内联 SVG。调整配色时同时照顾正文和日期的可读性。
- 后端使用 Node.js 原生 HTTP 服务和 CommonJS；前端使用原生 HTML、CSS、JavaScript，无打包和编译步骤。
- 第三方依赖：`bcryptjs`（密码哈希，纯 JS 免原生编译）、`nodemailer`（SMTP 发验证邮件）、`dotenv`（加载 .env）。MySQL 和 PostgreSQL 驱动按需安装。
- 默认配置为 `127.0.0.1:8787` 和 SQLite；实际运行以 `src/config.js` 合并后的配置为准。
- 前端初始化时探测 API：可用时使用服务端数据库（未登录显示登录/注册视图）；未连接过后端时可使用 `localStorage`。曾连接后端但当前不可用时进入断线状态，不会静默展示另一套本地数据；浏览器存储不可写时保留可读取数据并使用内存。

## 文件职责

| 路径 | 职责 |
| --- | --- |
| `server.js` | 加载 .env、加载配置、初始化数据库、装配认证、启动服务、处理退出信号 |
| `src/config.js` | 默认配置、`config.json` 与环境变量合并，解析数据文件路径；认证/邮件配置只来自环境变量 |
| `src/auth.js` | 注册（邮件验证）、登录、会话签发校验、激活令牌、按 IP 限流 |
| `src/http.js` | HTTP 服务、JSON 请求与响应、静态文件服务和路径边界检查 |
| `src/routes.js` | `/api/` 路由及基础输入检查；`/api/items` 全部要求登录并按 user_id 隔离 |
| `src/db/index.js` | 根据数据库类型创建适配器 |
| `src/db/normalize.js` | 应用对象与数据库行的字段映射及类型归一化（含用户/会话行映射） |
| `src/db/*-adapter.js` | JSON、SQLite、MySQL、PostgreSQL 的统一存储接口实现（items 按用户隔离 + 认证存储） |
| `public/index.html` | 页面骨架、登录/注册视图、固定 DOM 标识和脚本加载顺序 |
| `public/assets/js/records.js` | 前后端共用的校验、枚举归一化、CSV / JSON 备份解析和去重规则 |
| `public/assets/js/store.js` | API、本地存储及内存模式的数据访问、重连合并、CSV 编码；API 401 时派发 `lifehub:unauthorized` 事件 |
| `public/assets/js/model.js` | 分类字段定义、日期、金额和周期等领域计算 |
| `public/assets/js/chart.js` | SVG 环形图与资产分组 |
| `public/assets/js/calendar.js` | 带提前一天提醒的 ICS 日历快照、UTF-8 折行与文本转义 |
| `public/assets/js/ui.js` | 界面状态、表单、列表、总览、CSV 字段映射及交互 |
| `public/assets/js/auth.js` | 登录 / 注册 / 重发验证 / 激活链接处理；暴露 `window.Auth` |
| `public/assets/js/app.js` | 启动流程和 DOM 事件绑定（API 模式下先校验登录态） |
| `public/assets/css/style.css` | 全局样式变量、组件样式和响应式布局 |
| `tools/selftest.js` | 前端 DOM 桩、数据库适配器、API 与静态资源自测 |
| `config.example.json` | 各数据库的配置参考及环境变量说明 |
| `config.json`、`data/` | 本地运行配置和实际持久化数据，不能用作测试夹具 |
| `OPTIMIZATION_PLAN.md` | 用户体验优化计划、验收记录和验证范围 |

## 运行与配置

在项目根目录执行：

```powershell
node --version
node -e "require('node:sqlite'); console.log('SQLite 可用')"
npm install
npm start
```

- `package.json` 当前声明 Node.js `>=20`，但默认 SQLite 适配器实际依赖 `node:sqlite` 的 `DatabaseSync`（Node 22+）；不能把版本声明当作该模块可用的保证，应以上面的加载检查为准。Docker 镜像使用 `node:22-alpine`。
- `npm start` 等价于 `node --disable-warning=ExperimentalWarning server.js`；也可直接执行 `node server.js`。目前没有 `dev`、`build` 或 `lint` 脚本。
- 配置优先级为环境变量高于根目录 `config.json`，再高于代码默认值。`server.js` 入口用 dotenv 加载 `.env`（dotenv 不覆盖已存在的环境变量，Docker 注入的环境优先）。
- 服务配置覆盖：`HOST`、`PORT`。数据库覆盖：`DB_TYPE`、`DB_FILE`、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_SSL`（仅 postgres）。
- 认证与邮件只来自环境变量（参考 `.env.example`）：`MAIL_MODE`（`smtp` / `console`）、`SMTP_HOST/PORT/USER/PASS/FROM`、`APP_URL`、`SESSION_TTL_DAYS`、`BCRYPT_ROUNDS`、`COOKIE_NAME`。`MAIL_MODE=smtp` 但缺 `SMTP_HOST` 时启动快速失败；未配置 SMTP 时默认 console 模式（验证链接打印到日志）。
- `DB_TYPE` 可选 `json`、`sqlite`、`mysql`、`postgres`；文件相对路径以项目根目录解析，而非终端当前目录。
- `config.example.json` 是配置参考集合，不能直接整体复制为运行配置；有效配置使用顶层 `server` 和 `database`，数据库选项放在 `database.<type>` 下。
- MySQL 按需执行 `npm i mysql2`，PostgreSQL 按需执行 `npm i pg`，并预先创建目标数据库。适配器初始化会建表（含 users / sessions / verifications），不会创建数据库。
- PowerShell 使用 `$env:PORT = '8788'` 形式设置环境变量。临时调试优先用环境变量，完成后恢复原值，避免修改用户的 `config.json`。
- Docker：`docker build -t life-hub .` 或 `docker compose up -d`；数据卷 `/app/data`；外部数据库在 `.env` 中配置 `DB_TYPE/DB_HOST/...`，compose 附 `postgres` profile 示例。

## 实现约定

- 延续现有 JavaScript 风格：两空格缩进、单引号、分号；后端使用 `require` / `module.exports`，前端使用 IIFE 暴露 `window.Store`、`window.Model`、`window.Charts`、`window.UI`。
- 前端脚本依次加载 `records.js` → `store.js` → `model.js` → `chart.js` → `calendar.js` → `ui.js` → `auth.js` → `app.js`。`records.js` 同时支持 CommonJS，后端直接复用；新增脚本时同步检查 HTML 与自测加载方式。
- UI 通过 `Store` 访问数据；领域计算放在 `model.js`，数据库细节留在适配器，路由不直接操作数据库文件。
- 新增管理类别时，先修改 `Model.CATEGORIES` 与 `Model.ORDER`，再检查 `ui.js` 的操作文案、列表字段、总览及 CSV 映射，更新相应自测。
- 样式优先复用 `style.css` 的颜色变量和已有组件；保持中文界面、窄屏布局、对话框和提示信息可用。
- 各尺寸统一使用顶部分类导航；首页的支出与资产默认折叠。导入、导出、备份、日历提醒收纳在顶部“更多”，记录操作收纳在条目“更多操作”，筛选和表单补充字段按需展开。保留既有按钮 ID、搜索框和 `listResults` 的事件约定；折叠字段仍需参与保存并保留原值。
- UI 图标使用内联 SVG，配色和尺寸由 CSS 变量、组件类统一管理；不引入图标库、远程字体或图片依赖。新增动效需尊重 `prefers-reduced-motion`。
- 将用户内容拼入 HTML 时使用现有 `esc` 转义方式，或通过安全的 DOM 文本接口写入；SQL 值继续使用参数绑定。

## 数据与接口兼容

- 应用对象字段使用 camelCase，包括 `startDate`、`nextDate`、`createdAt`、`updatedAt`；数据库行对应 snake_case。转换集中在 `src/db/normalize.js`，前端 `store.js` 内另有 `normalize` 函数，修改公共字段时需同时检查。
- `detail` 在应用层是对象，在 JSON 文件和 SQLite / MySQL 行中保存为 JSON 字符串；PostgreSQL 使用 JSONB。分类扩展字段优先放在 `detail` 下。
- 金额允许 `null`，空金额不能被无意改成 `0`；业务日期使用 `YYYY-MM-DD` 字符串，创建和更新时间使用 ISO 时间戳。日期计算沿用本地日历语义，避免 UTC 转换造成日期偏移。
- 当前人民币资产总额与分布图只统计 CNY 账户，其他币种单独展示；没有自动汇率换算。
- 周期支出按币种分别汇总，排除暂停、归档、已完成及一次性条目。`status` 可选 `active`、`paused`、`archived`、`completed`；默认列表与待办只展示在用条目。
- `detail.recordKey` 是新记录的稳定标识；导入按标识去重，旧文件没有标识时按完整内容去重。不同标识的同名账户可以并存。
- `detail.reminderCycle` 将保活 / 复核周期与缴费 `cycle` 分开；`detail.reminderAnchor` 保留原始日期，避免 1 月 31 日经 2 月后变为每月 28 日。一次性事项处理后移入已完成并停止提醒。
- `detail.contractDate` 是独立的宽带合约提醒；旧记录的 `nextDate` 保留原值，编辑时提示核对并补充合约日期，不能自动推断或迁移。
- `detail.history` 保存处理和状态记录；`lastCompletedAt` 保存最近处理日期。编辑时合并保留现有扩展字段；撤销仅允许最新一次处理且相关日期、金额和状态未发生后续变更。
- 数据库适配器保持统一接口：`init`、`list`、`add`、`update`、`remove`、`addMany`、`clear`、`close`、`describe`。其中存储操作为异步接口，`describe` 为同步接口。`items` 方法均携带 `userId` 参数实现数据隔离。
- 认证相关方法（各适配器一致）：`createUser`、`findUserByEmail`、`findUserById`、`verifyUser`、`countVerifiedUsers`、`insertSession`、`findSession`、`touchSession`、`deleteSession`、`insertVerification`、`findVerification`、`deleteVerification`、`deleteVerificationsOfUser`、`claimLegacyItems`。
- `items.user_id` 为空的历史数据由首个完成邮箱验证的用户认领（`claimLegacyItems`）；之后的注册用户从空数据开始。旧库升级由各适配器在建表后做 `ADD COLUMN` 迁移（SQLite 用 `PRAGMA table_info` 检查，MySQL 用 `information_schema`，PostgreSQL 用 `ADD COLUMN IF NOT EXISTS`）。
- JSON 存储文件格式为 `{ format: 'life-hub-store', items, users, sessions, verifications }`；旧版纯数组文件载入时自动按 items 迁移。
- `update(id, patch, userId)` 是部分更新：未传入的字段应保留，包括 `detail`；显式传入 `detail` 时整体替换，不是深度合并。更新和删除不存在的记录返回 `null`，列表按 ID 升序返回。
- 涉及表结构变更时检查所有 SQL 适配器及归一化逻辑；现有 `CREATE TABLE IF NOT EXISTS` 不会迁移已存在的表，需要安排兼容既有数据的迁移。

现有 API 约定（`/api/items` 全系接口要求登录会话，未登录返回 401，数据按当前用户隔离）：

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/health` | 返回 `{ ok: true, database }`（公开） |
| POST | `/api/auth/register` | 注册并发送验证邮件，返回 201 |
| GET | `/api/auth/verify?token=` | 激活令牌校验（24h、一次性），成功后签发会话 |
| POST | `/api/auth/login` | 登录签发会话；未激活返回 403 |
| POST | `/api/auth/resend` | 重发验证邮件（限流） |
| POST | `/api/auth/logout` | 注销当前会话 |
| GET | `/api/auth/me` | 当前用户信息，未登录 401 |
| GET | `/api/items` | 返回当前用户条目数组 |
| POST | `/api/items` | 新增条目，必填 `title`，成功返回 201 和条目 |
| PUT | `/api/items/:id` | 部分更新；可传 `expectedUpdatedAt` 防止旧页面覆盖新数据，冲突返回 409，不存在返回 404 |
| DELETE | `/api/items/:id` | 返回被删除条目，不存在返回 404 |
| POST | `/api/items/import` | 接收 `{ items: [...] }`，整批先校验并跳过重复，返回 201 和 `{ created, skipped }` |
| DELETE | `/api/items` | 清空当前用户所有条目，返回 `{ ok: true }` |

- 错误响应使用 `{ error: '中文信息' }`；修改路由需同步检查 `Store` 调用及自测。
- 请求体默认上限 2MB。静态文件仅从 `public/` 提供，保留路径越界检查，不能暴露项目配置、源码或数据文件。
- CSV 导出保留 UTF-8 BOM；解析保留对引号、逗号、换行的支持，并兼容旧手机号应用的中文表头。修改表单标签时检查基于标签的 CSV 映射。
- 分类和全量 CSV 均导出通用字段及“扩展信息” JSON，支持混合分类往返；有分类列时以每行分类为准，没有时优先识别旧表头，再使用当前分类。中文周期、自动续费和状态值需要还原为内部代码。
- 完整 JSON 备份使用 `{ format: 'life-hub-backup', version: 1, exportedAt, items }`，保留扩展信息、历史和时间戳。导入先预览、再合并；发现校验错误时整批不写入，默认不覆盖现有条目。
- 日历文件是今天及未来在用事项的快照，包括独立合约到期日。日期或状态改变后需移除旧日历事项并重新导入；通知取决于日历应用和系统权限，不能承诺网页关闭后由网页自行推送。

## 验证方式

```powershell
npm test
```

- 这是当前唯一的自动化测试入口，无需安装测试框架。业务改动后执行自测；纯文档改动按需核实命令和描述即可。
- 自测使用最小 DOM 桩验证前端本地模式，并在系统临时目录创建 JSON / SQLite 数据文件，通过临时端口验证真实 HTTP 服务。
- 自测不代表真实浏览器布局验证，也没有连接真实 MySQL / PostgreSQL；可选驱动的测试主要检查缺失驱动提示。安装这些驱动后，该提示测试的假设可能不再成立，需区分环境差异与业务故障。
- 前端交互或布局改动需补充浏览器检查；特别注意连续输入和中文输入法期间不重建搜索框。`app.js` 的事件绑定、文件选择和 API 模式下的交互不能只依赖当前 DOM 桩判断。
- 数据或行为修复优先在 `tools/selftest.js` 补充有意义的回归场景；测试必须使用独立临时数据，不连接用户正在使用的数据库。
- 测试未运行、失败或依赖外部数据库时，在交付说明中如实写明范围与原因。

## 本地数据保护

- `data/` 下可能包含真实手机号、住址、账户和资产信息；检查实现时优先读源码，不要为了解项目而读取业务数据。
- 保留现有 `config.json`、数据库、SQLite 的 `-wal` / `-shm` 文件及用户已有改动。不要清空、覆盖或把这些文件当作测试输出。
- 临时服务使用独立的 `DB_FILE` 和空闲端口；不要对现有服务调用清空或删除接口来验证功能。
- 需要新增配置示例时使用虚构值，避免在文档、日志或提交内容中写入真实凭据和个人记录。
