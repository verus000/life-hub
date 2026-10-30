# PostgreSQL 单数据库版本

当前版本只支持 PostgreSQL 17。旧文件数据库适配器、旧库自动建表／补列、文件数据卷和修复文件权限的容器入口均已移除。应用不读取 data/、config.json 或 DB_FILE 类配置，也不会自动转换旧账号和记录。

## 本地开发与测试

开发连接 life_hub_dev / life_hub_dev_app，测试连接独立实例的 life_hub_test / life_hub_test_app。凭据分别放在忽略的 .env.development.local、.env.test.local；配置、角色和端点校验详见 README.md。

结构版本由 migrations/ 管理。使用各环境独立 migrator 凭据显式执行迁移，应用账号不建表、不改结构、不写迁移历史。新的分类与 eSIM 字段继续使用现有通用结构，无需重置数据库或导入旧文件。

## Docker

镜像使用固定非 root 身份启动 node server.js，不挂载应用数据库文件。运行时单独提供环境变量与 PostgreSQL URL。Compose 必须指定环境和对应外部数据库网络；开发和测试使用各自公共网络，生产接入独立网络。

镜像构建上下文排除所有 .env*、configs/ 和本地数据。不要把运行凭据写进 Dockerfile、构建参数或 Git。public/ 与 .next/static 均打包到 standalone 镜像中。

## 生产与回退

本次代码更新不创建、迁移或清理生产数据库。上线前按 DATABASE.md 确认独立目标、最小权限、TLS、迁移顺序、备份恢复演练及切换／回退方案。本地 db:migrate 命令拒绝 production；不把应用启动或代码推送当作生产数据库操作授权。

回退应用代码前确认数据库版本兼容；不要将 down/reset/覆盖恢复作为默认回退。数据恢复默认写入新空库并核验后再决定是否切换。

## 代理与邮件

APP_URL 填写实际访问地址，激活链接与会话 Cookie 的 Secure 属性由此确定。TRUST_PROXY 默认 false；仅在应用禁止外部直连且可信反代正确处理来源头时开启。真实 SMTP 另行配置，未配置时使用 console 邮件模式。
