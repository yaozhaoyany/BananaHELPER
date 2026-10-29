# BananaBOT

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

## 准备环境

- Node.js 22 或更高版本
- npm
- Git
- 已登录的 Codex CLI：`codex login status`
- Docker 与 Docker Compose（运行 AstrBot 时需要）

## 第一次启动

```sh
git clone https://github.com/yaozhaoyany/BananaBOT.git
cd BananaBOT
cp .env.example .env
npm ci
npm run setup
```

`setup` 会把经过固定版本校验的 HAPI Connector 安装到 AstrBot 数据目录，
不会复制 Codex 凭据，也不会提交任何 Token。

启动 AstrBot：

```sh
npm run astrbot:up
```

启动 HAPI Hub：

```sh
npm start
```

Hub 首次启动会在 `data/hapi/settings.json` 生成 Access Token。保持 Hub 运行，
在另一个终端启动 Runner：

```sh
npm run hapi:runner:start
npm run hapi:token
```

打开 <http://localhost:6185>，完成 AstrBot 的首次初始化。进入 HAPI Connector
配置页，填写：

- `hapi_endpoint`: `http://host.docker.internal:3006`
- `access_token`: `npm run hapi:token` 输出的 Token

然后配置一个聊天平台，在对应聊天窗口发送 `/hapi list` 检查链路。

`HAPI_LISTEN_HOST=0.0.0.0` 是为了让 Docker 容器访问 Hub。不要把 3006 端口
直接暴露到公网；跨公网访问请使用 `npm run hapi:hub:relay` 或受保护的 HTTPS
反向代理，并保管好 Access Token。

## 创建 Codex 会话

可以从 HAPI Connector 使用 `/hapi create` 远程创建，也可以在项目目录手动启动：

```sh
npm run hapi:codex -- --cd /absolute/path/to/project
```

Codex 使用当前用户的登录状态和权限配置。不要把 `~/.codex`、Access Token、
聊天平台密钥或 AstrBot 的运行数据提交到仓库。

## 常用命令

```sh
npm start                    # 本地启动 HAPI Hub
npm run hapi:hub:relay       # 通过 HAPI 公共中继启动 Hub
npm run hapi:runner:start    # 启动后台 Runner
npm run hapi:runner:status   # 查看 Runner 状态
npm run hapi:runner:stop     # 停止 Runner
npm run hapi:doctor          # HAPI 诊断
npm run astrbot:up           # 启动 AstrBot
npm run astrbot:logs         # 查看 AstrBot 日志
npm run astrbot:down         # 停止 AstrBot
npm test                     # 检查仓库配置与启动器
```

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

BananaBOT 原创代码使用 [MIT](LICENSE)。HAPI 与 HAPI Connector 使用
AGPL-3.0-only；AstrBot 及其他依赖保留各自许可证。
