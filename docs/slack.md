# Slack → AstrBot → HAPI → Codex

## 创建 Slack App

1. 登录 <https://api.slack.com/apps>，选择 Create New App → From a manifest。
2. 选择自己的 Workspace，将 `config/slack-app-manifest.json` 内容粘贴到 JSON 编辑框。
3. 核对权限后创建，进入 Install App → Install to Workspace，并由你完成授权。
4. OAuth & Permissions 中的 Bot User OAuth Token（`xoxb-`）保存到本机 `.env` 的 `SLACK_BOT_TOKEN`。
5. Basic Information → App-Level Tokens → Generate Token and Scopes，名称随意，添加
   `connections:write`，生成的 `xapp-` 保存到 `SLACK_APP_TOKEN`。
6. 在 Slack 自己的个人资料菜单中复制 Member ID（U… 或 W…），保存到 `SLACK_ADMIN_USER_ID`。

Manifest 订阅私聊与已加入频道的消息，提供回复、用户识别和文件权限；不创建原生 Slack
Slash Command，也不需要公网 Webhook。不要同时订阅 `app_mention` 和 `message.channels`，
避免同一条提及消息重复投递。若以后修改权限，需要重新安装应用并授权。

## 本机配置

启动 OrbStack，完成原有 HAPI 后台启动与 `npm run setup`。AstrBot 首次启动会生成配置文件：

```sh
npm run astrbot:up
```

等 <http://localhost:6185> 可以访问后，停止 AstrBot，执行配置并重启：

```sh
npm run astrbot:down
npm run slack:configure
npm run astrbot:up
```

配置器读取 HAPI 的本地 Token，写入 Connector 配置；不会输出 Token。原配置会在忽略提交的
运行目录中留备份。请只在 AstrBot 停止后执行，避免它覆盖文件。
只配置 Connector 时使用 `npm run slack:configure -- --connector-only`，无需 Slack Token。
自动审批保持关闭。管理员身份使用 Slack Member ID，不是昵称或邮箱。

## 验收

1. AstrBot WebUI 确认 Slack 平台已启用、Connector 加载成功且已连接 HAPI。
2. 在 Slack 私聊 BananaHELPER，发送帮助与会话列表命令。
   注意 `/hapi` 是 AstrBot 的文本命令；如果 Slack 把它当成原生 Slash Command 拦截，
   在频道邀请机器人后发送 `@BananaHELPER /hapi list`。
3. 发送 `@BananaHELPER /hapi create`，按向导选择 Codex、在线 Runner 和允许的项目目录。
4. 发送 `> 读取当前项目 README 并概括用途，不要修改文件`，确认回复返回原窗口。
5. 在创建的会话中验证一次需要审批的操作，确认审批消息能返回并生效。

测试阶段不需要给 AstrBot 配置另一个 LLM，消息经 Connector 直接交给 Codex。
`banana:stop` 停止 Hub 和 Runner，已有会话不会因停止 Runner 自动结束；
先在聊天端结束不再需要的会话，再停服务。
