# Next.js 版本升级

SQLite 数据、账号和已有会话沿用原库。启动时自动补齐表结构，并将旧 `verifications` 表中的激活令牌一次性搬入 `verification_tokens`；旧邮件的 `/?verify=...` 地址仍然可用。旧表搬空后保留，不会在重启时恢复已使用或已重发替换的令牌。

本地自定义数据库路径请将旧 `DB_FILE` 环境变量改为 `DB_FILE_NAME`，指向原 SQLite 文件；新版不再读取 `config.json`。默认路径仍是 `data/life-hub.db`。

## Docker 数据卷

Compose 保留原生 Node 版本的 `life-hub-data` 卷名，在同一 Compose 项目中执行升级时会继续使用原库。容器内挂载目录改为 `/data`，不改变卷里的数据库文件名。保持原 Compose 项目名（含原来的 `-p` 参数），升级前备份已有数据库，升级时不要删除数据卷。

入口使用固定 UID/GID 1001 调整数据库目录、数据库和 SQLite 配套文件的所有者，随后降权启动应用，以兼容旧镜像由 root 创建的数据库。

如果已部署过使用 `app-data` 的早期 Next.js 版本，应继续挂载该版本正在使用的卷。先用 `docker volume ls` 核实卷名，再创建 `compose.data.yml`，例如：

```yaml
volumes:
  life-hub-data:
    external: true
    name: example-project_app-data
```

将示例卷名替换为已核实的既有卷名，再用 `docker compose -f docker-compose.yml -f compose.data.yml up -d --build` 启动。不要把空卷覆盖到现有数据库上。

`APP_URL` 应填写实际对外地址；默认 Docker 端口是 8787，例如 `http://127.0.0.1:8787`。

## 代理和认证限流

默认 `TRUST_PROXY=false`，忽略客户端提供的代理头。由于 NextRequest 不暴露连接的 socket 地址，直连模式下认证请求共用限流桶。

只有应用端口禁止外部直连、请求全部经过可信反向代理，且代理覆盖 `X-Forwarded-For` 或在末尾追加实际来源 IP 时，才设置 `TRUST_PROXY=true`。应用取该头最右侧的有效 IP；没有该头时使用代理覆盖的 `X-Real-IP`。反代同时应覆盖 `X-Forwarded-Proto`。

## JSON 历史数据

旧 JSON 存储不会被 SQLite 初始化逻辑自动读取。请在旧版导出完整备份，再在新版登录后通过“导入数据”预览并合并；账号和会话不包含在条目备份中。
