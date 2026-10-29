# BananaHELPER 架构与实施阶段

定位：个人 Agent 助手，通过网页、Slack、QQ、微信管理开发、项目和数据查询。

```text
网页（先用 HAPI Web） ──────────────────┐
Slack / QQ / 微信 → AstrBot → Connector ├→ HAPI Hub → Runner → Codex app-server
                                      │                        ↓
                                      └────────────── Skills + Banana MCP
                                                              ↓
                                                   网站 / 股票看板 API
```

## 模块边界

- AstrBot 处理平台登录、消息和附件；HAPI Connector 转发会话、通知及审批。
- HAPI 管理会话；Runner 按需创建后台 Codex app-server，无需终端界面。
- Skills 规定操作流程；MCP 暴露真实查询和业务操作。
- BananaHELPER 的业务数据库记录项目与任务，不复制整套 HAPI 消息历史。

## 数据所有权

| 模块 | 存储 | 管理方式 |
| --- | --- | --- |
| HAPI | `data/hapi/`，包括 SQLite | 只通过 HAPI API 访问 |
| AstrBot | `data/astrbot/` | 通过平台和插件配置管理 |
| Codex | 用户自己的 Codex 数据目录 | 官方工具管理 |
| BananaHELPER | PostgreSQL `core` | Drizzle 迁移 |
| 股票看板 | 尚未搭建；规划使用 PostgreSQL `stocks` | 接入时由该应用管理迁移 |
| 个人网站 | 尚未搭建；规划使用 PostgreSQL `website` | 接入时由该应用管理迁移 |

可以复用同一个 PostgreSQL 实例，不要求已有应用立即迁移。每个应用使用独立账号，
MCP 优先调用业务 API；确有直接查询需求时才增加只读视图和只读账号。
业务 API 负责身份与业务校验，写工具的审批不能只靠 Skills 中的文字约定。

## 暂缓接入的业务模块

网站和股票看板暂不接入，仓库和 API 地址使用以下占位符：

| 模块 | 仓库地址 | API 地址 | 状态 |
| --- | --- | --- | --- |
| 个人网站 | `<PERSONAL_WEBSITE_REPOSITORY_URL>` | `<PERSONAL_WEBSITE_API_URL>` | 待接入，数据库尚未搭建 |
| 股票看板 | `<STOCK_DASHBOARD_REPOSITORY_URL>` | `<STOCK_DASHBOARD_API_URL>` | 待接入，数据库尚未搭建 |

`.env.example` 中对应字段仅为注释形式的规划占位，当前程序不会读取、克隆或请求这些地址。
这两个模块不影响 Hub、Runner、AstrBot 和 `core` 数据库运行。
`website`、`stocks` Schema 及业务表等数据模型明确后再创建；当前迁移只创建 `core`。

## 当前实现

- Hub、Runner 后台启动、状态检查和停止。
- AstrBot Compose 与固定提交的 HAPI Connector 安装器。
- 可选 PostgreSQL 容器、持久化卷、本机端口和健康检查。
- `core.projects` 与 `core.tasks` 的 Drizzle 定义和版本化迁移。
- 数据库检查、备份命令和 PostgreSQL 集成测试。

数据库容器通过 `database` Profile 隔离；显式执行 `db:up` 时启动。
`banana:start` 只负责 Hub 与 Runner，`banana:stop` 不停止数据库或 AstrBot。

## 后续顺序

1. 配置 Slack，验证创建会话、消息、审批和结果返回，再增加 QQ、微信。
2. 网站、股票看板保留占位；准备好后替换地址，核对 API 和数据模型，再增加 Banana MCP 的只读工具。
3. 增加 Skills，并将任务创建和 HAPI 事件接入 `core.tasks`；届时定义状态同步与幂等策略。
4. 为写操作增加业务端授权和审批，为网站增加 Agent Center。
5. 出现真实定时任务需求后增加 schedules 和 task_runs；不提前建立空表。

开发阶段宿主机运行 HAPI、Runner 和 Codex，Docker 运行 PostgreSQL、AstrBot。
选定长期运行的 Mac 或 Linux 服务器后，再提供 launchd 或 systemd 配置及自动备份。
当前后台脚本不提供开机自启或崩溃自动重启。
