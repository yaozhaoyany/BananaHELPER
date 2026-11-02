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

## 日常助手模式

已在频道选择 Codex 会话后，可以一次设置专注模式和项目模板：

```sh
npm run slack:profile -- C你的频道ID
```

从 Slack 频道详情复制频道 ID。此命令会暂时停止 AstrBot，安装补丁，通过 AstrBot
原生 KV 接口保存状态后再启动；HAPI/Codex 会话继续运行。当前会话保持原样，
`BananaHELPER` 模板记住它的机器和工作目录，新建会话时不启用 YOLO，继承模型默认设置。
其他名称的模板保留；本次修改前的状态保存在 Connector KV 的 `banana_profile_backup`。

之后在同一频道发送 `@BananaHELPER 帮我检查 README` 即可，不需要 `>` 前缀。
普通未提及机器人的聊天不会由专注模式转发给 Codex。状态、绑定和专注模式会持久保存，
会话停止后沿用 Connector 的恢复发送机制；无需每次重新创建。

- `/hapi focus off`：关闭当前窗口专注模式。
- `/hapi create BananaHELPER`：用模板创建独立任务，仍使用上游的确认步骤。
- `/hapi sw <序号或ID前缀>`：切换已有任务。
- `/hapi s`、`/hapi list`：保留路径、会话 ID 和状态等详细信息。

`npm run setup` 自动应用 `patches/connector-compact.patch`，仅针对仓库固定的 Connector
提交；重复执行不会叠加补丁，版本或补丁冲突时停止并报错。不要通过插件市场单独更新
这个 Connector，升级时需要一起验证补丁。

默认开启 `banana_compact_output`：日常推送仅保留 agent 正文，不带路径、会话 ID 或
`[Message]:` 包装；成功发送不再单独回执，本轮已发正文时不再额外提示完成。
发送失败、恢复提示、审批请求仍保留；本轮没有正文时保留一条简短完成提示。
可在 AstrBot 插件配置中关闭该选项恢复详细输出。正文里 Codex 自己写出的路径不会被删改。

该补丁修改的 Connector 源码沿用其 AGPL-3.0-only 许可证；原项目及作者：
[LiJinHao999/astrbot_plugin_hapi_connector](https://github.com/LiJinHao999/astrbot_plugin_hapi_connector)。
