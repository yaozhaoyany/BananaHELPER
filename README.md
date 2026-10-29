# BananaHELPER

通过 Slack、QQ 和微信远程管理 Codex CLI 会话的开源机器人工作台。

当前版本先把最小链路搭好：

```text
Slack / QQ / 微信
        ↕
AstrBot + HAPI Connector
        ↕
HAPI Hub + Runner
        ↕
Codex CLI
```

HAPI 与 Codex 运行在宿主机，能使用本机的 Codex 登录状态并访问代码目录；
AstrBot 运行在 Docker 中，只负责聊天平台适配和消息路由。

## 组件

| 组件 | 作用 | 运行位置 |
| --- | --- | --- |
| HAPI Hub | 保存会话、消息和审批状态 | 宿主机 |
| HAPI Runner | 从聊天端远程创建和恢复 Codex 会话 | 宿主机 |
| Codex CLI | 修改代码、执行命令和测试 | 宿主机 |
| AstrBot | 接入 Slack、QQ、微信等平台 | Docker |
| HAPI Connector | 在 AstrBot 和 HAPI 之间转发消息、通知和审批 | AstrBot 插件 |
| PostgreSQL | BananaHELPER 的项目和任务数据 | Docker |
| Drizzle | TypeScript 表定义、查询与 SQL 迁移 | 宿主机工具 |

## 准备环境

- Node.js 22 或更高版本
- npm
- Git
- 已登录的 Codex CLI：`codex login status`
- Docker 与 Docker Compose（运行 AstrBot、PostgreSQL 时需要）

## 第一次启动

```sh
git clone https://github.com/yaozhaoyany/BananaHELPER.git
cd BananaHELPER
cp .env.example .env
npm ci
npm run setup
```

`setup` 会把经过固定版本校验的 HAPI Connector 安装到 AstrBot 数据目录，
不会复制 Codex 凭据，也不会提交任何 Token。

先用一条命令启动 HAPI Hub 和后台 Runner，并限制允许操作的项目目录：

```sh
npm run banana:start -- --workspace-root /absolute/path/to/projects
```

命令执行后会直接返回终端。之后从 HAPI Web 或机器人创建 Codex 会话时，Runner
才会在后台启动对应的 Codex app-server，不会弹出 Codex 终端。可以随时查看或停止：

```sh
npm run banana:status
npm run banana:stop
```

Hub 日志保存在 `data/hapi/banana-hub.log`。如果 3006 端口上已经有手动启动的
Hub，脚本会继续使用它，但不会在 `banana:stop` 时结束不归自己管理的进程。

确认 HAPI 与 Codex 工作正常后，再启动 AstrBot：

```sh
npm run astrbot:up
```

Hub 首次启动会在 `data/hapi/settings.json` 生成 Access Token。完成 `banana:start` 后
直接读取 Token，无需再次启动 Hub 或 Runner：

```sh
npm run hapi:token
```

打开 <http://localhost:6185>，完成 AstrBot 的首次初始化。进入 HAPI Connector
配置页，填写：

- `hapi_endpoint`: `http://host.docker.internal:3006`
- `access_token`: `npm run hapi:token` 输出的 Token

然后配置一个聊天平台，在对应聊天窗口发送 `/hapi list` 检查链路。

Slack 的可导入 Manifest、Token 保存位置与验收步骤见 [Slack 接入指南](docs/slack.md)。

`HAPI_LISTEN_HOST=0.0.0.0` 是为了让 Docker 容器访问 Hub。不要把 3006 端口
直接暴露到公网；跨公网访问请使用 `npm run hapi:hub:relay` 或受保护的 HTTPS
反向代理，并保管好 Access Token。

## 可选：从终端创建 Codex 会话

正常使用时，由 HAPI Connector 的 `/hapi create` 让 Runner 在后台创建会话。
只有本地调试时才需要在项目目录手动启动：

```sh
npm run hapi:codex -- --cd /absolute/path/to/project
```

Codex 使用当前用户的登录状态和权限配置。不要把 `~/.codex`、Access Token、
聊天平台密钥或 AstrBot 的运行数据提交到仓库。

## 常用命令

```sh
npm start                    # 本地启动 HAPI Hub
npm run banana:start -- --workspace-root /path/to/projects # 后台启动 Hub 和 Runner
npm run banana:status        # 查看 Hub 和 Runner 状态
npm run banana:stop          # 停止后台 Runner 和脚本启动的 Hub
npm run hapi:hub:relay       # 通过 HAPI 公共中继启动 Hub
npm run hapi:runner:start    # 启动后台 Runner
npm run hapi:runner:status   # 查看 Runner 状态
npm run hapi:runner:stop     # 停止 Runner
npm run hapi:doctor          # HAPI 诊断
npm run astrbot:up           # 启动 AstrBot
npm run astrbot:logs         # 查看 AstrBot 日志
npm run astrbot:down         # 停止 AstrBot
npm run db:up                # 后台启动 PostgreSQL，等待健康检查
npm run db:migrate           # 执行已提交的数据库迁移
npm run db:check             # 检查数据库及业务表
npm run db:backup            # 备份本地 Compose 数据库
npm run db:stop              # 停止 PostgreSQL，保留数据卷
npm run typecheck            # 检查 TypeScript
npm test                     # 检查仓库配置与启动器
```

## PostgreSQL 与 Drizzle

现有用户先 `git pull` 和 `npm ci`，再把 `.env.example` 中的 PostgreSQL 字段补到自己的
`.env`，保留原有 HAPI 配置。运行 `openssl rand -hex 24` 生成本地密码，填写
`POSTGRES_PASSWORD`；不要把密码发送到聊天或提交到 Git。

```sh
npm run db:up
npm run db:migrate
npm run db:check
```

数据库默认只监听 `127.0.0.1:5432`。数据保存在 Compose 的 `postgres-data` 命名卷中，
停止容器不会删除数据；`docker compose down -v` 会删除该卷，不要用于日常停机。
`POSTGRES_PASSWORD` 只在空卷初始化时创建密码，后续改 `.env` 不会改变已有数据库密码。

也可以填写 `DATABASE_URL` 连接现有 PostgreSQL，此时跳过 `db:up`，直接迁移和检查。
数据库迁移使用有建表权限的管理账号；它不应作为未来网站、MCP 的运行账号。
等接入对应服务时，为每个服务单独配置账号和权限。

本期只创建 `core.projects`、`core.tasks`。任务保存来源、状态以及可选的 HAPI 会话 ID；
这些表目前是存储基础，还未自动订阅 HAPI 事件或同步任务状态。
不会读取、修改 HAPI 内部 SQLite，也不会预先创建网站和股票看板的业务表。

表定义在 `src/db/schema.ts`，连接代码在 `src/db/client.ts`。更改表结构后运行：

```sh
npm run db:generate
# 检查 drizzle/ 下生成的 SQL，提交表定义和迁移文件
npm run db:migrate
```

迁移只管理 `core` Schema，迁移记录在 Drizzle 自己的 Schema 中。网站和股票看板可
共用 PostgreSQL 实例，但各自维护 Schema、迁移和账号；先通过 API 接入 Banana MCP。
详细边界见 [架构说明](docs/architecture.md)。

### 备份与恢复

`npm run db:backup` 使用容器内的 `pg_dump` 生成完整的自定义格式备份，保存到忽略提交的
`data/backups/`。命令失败会清除不完整文件，不需要本机安装 PostgreSQL 客户端。
它仅备份本地 Compose 数据库；配置 `DATABASE_URL` 时需自行使用对应服务的备份方案。

恢复时先另建一个空数据库进行验证，替换命令中的备份文件名：

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" banana_restore'
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d banana_restore --no-owner --no-privileges --exit-on-error' < data/backups/banana-时间戳.dump
```

数据库备份不包含 HAPI、AstrBot 或 Codex 文件，需另行备份对应私密目录。当前提供手动备份；
自动备份周期和异机存储应在选定服务器后配置。

## 数据边界

- `data/hapi/`：HAPI 数据库、Access Token、Runner 状态和日志。
- `data/astrbot/`：AstrBot 配置、平台密钥、插件与聊天数据。
- `~/.codex/`：Codex 认证和会话，由官方 Codex CLI 管理。

这些目录都不会进入 Git。备份或迁移部署时，应把它们作为私密运行数据单独处理。

## 当前范围

仓库已经包含 HAPI、Runner、AstrBot 和 HAPI Connector 的部署骨架。Slack、QQ、
微信的机器人凭据与平台审核无法预置，需要在 AstrBot WebUI 中分别配置。
生产服务器的 HTTPS、域名、进程守护与防火墙策略取决于部署环境，后续按实际
服务器补充。

## License

BananaHELPER 原创代码使用 [MIT](LICENSE)。HAPI 与 HAPI Connector 使用
AGPL-3.0-only；AstrBot 及其他依赖保留各自许可证。
