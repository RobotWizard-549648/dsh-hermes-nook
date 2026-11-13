# Hermes Nook

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里给 **Hermes Agent** 加一个独立聊天面板（包名 `dsh-hermes-nook`）。面板直接连 Hermes gateway 的 HTTP API，不经过 Harness 的模型、工具或系统提示。

> 非官方社区插件。Hermes Agent 是 Nous Research 的项目。

## 功能

- **独立面板**：左侧栏 Hermes 图标打开，不是 Harness 会话，没有 DSH 模型/工具/工作区提示的干扰。
- **真正的 Hermes 会话**：每个对话是 Hermes 自己的 session（`session_id` 形如 `api_…`），历史不限条数，支持搜索、刷新、加载更多、改名、删除、复制 `session_id`。
- **Runs + SSE**：`POST /v1/runs` + `/events`，逐字流式输出、停止、审批。
- **文件附件**：文件复制到 Hermes 所在目录，把路径告诉 Hermes，由它用自己的文件/终端工具读取。
- **工具/思考展示**：详细 / 简洁 / 隐藏三档可配。
- **快捷问题**：新会话页最多 8 条，可在设置里自定义。
- **后台运行**：切换会话、关闭面板都不会中断正在跑的 turn；只有「停止」或 Esc 会取消。重新打开面板会接上仍在运行的那一轮。
- **仅本机传输**：API Key 只留在 Host 进程；浏览器只访问三个 loopback 接口。

## 前置条件

- DeepSeek Harness Desktop，`desktop` profile（插件 API `0.2.x`）。
- Hermes Agent `0.21+`，并启用 gateway API server：
  - `platforms.api_server.enabled: true`
  - 设置 `API_SERVER_KEY`（至少 16 字符）
  - 默认地址 `http://127.0.0.1:8642`
- Hermes 可以在以下任一环境：
  - **WSL2**（Windows 上最常见）中的某个发行版；
  - **本机原生 Hermes**（Windows / macOS / Linux）；
  - **远程 gateway**（见限制）。

## 安装

**从 npm 安装（发布后）：**

```bash
dsh plugin --profile web add dsh-hermes-nook
# 或你使用的 profile，例如 --profile tui / --profile desktop
```

插件管理器会识别包里的 `dsh.bundle` 字段并自动加入 profile 的 bundle 列表，重启 profile 后刷新页面即可。

**从本地目录安装：**

克隆/下载本仓库，然后把目录作为本地 bundle 安装：

```powershell
# Windows PowerShell（dsh 不在 PATH 时用 Harness 安装目录下的 dsh.cmd）
dsh.cmd plugin --profile desktop add C:\path\to\dsh-hermes-nook
```

```bash
# macOS / Linux
dsh plugin --profile desktop add /absolute/path/to/dsh-hermes-nook
```

安装后重启 DeepSeek Harness（或禁用/启用插件一次），再刷新页面。

> 也支持 GitHub 地址：`dsh plugin --profile web add github:<your-user>/dsh-hermes-nook`。

## 配置

设置 →「Hermes Nook」：

| 配置项 | 说明 |
| --- | --- |
| Hermes 地址 | 默认 `http://127.0.0.1:8642`。 |
| Hermes 运行环境 | `自动` / `WSL 内` / `本机原生` / `远程 gateway`。自动模式优先 WSL，其次本机 `~/.hermes`；同时装了两套时建议显式指定。 |
| API Key | 只写不回显；可点「使用本机/WSL 的 .env」自动读取 `API_SERVER_KEY`。 |
| WSL 发行版 / 用户 / home | **留空自动探测**：Host 用 `wsl.exe -l -q` 找发行版，再找含 `~/.hermes` 的 home。 |
| 超时 | 单次请求超时。 |
| 模型 | 可选；留空用 Hermes 默认。 |
| 自动批准工具调用 | 默认开；关闭后由面板弹出批准按钮。 |
| 工具/思考展示 | 详细 / 简洁 / 隐藏。 |
| 快捷问题 | 每行一条，最多 8 条；留空隐藏。 |

设置页会显示自动探测结果（WSL 发行版/home、本机 `~/.hermes`、或远程模式）以及附件目录位置。

### 常见环境

- **WSL2**：Hermes 在发行版内，gateway 监听 `127.0.0.1:8642`，Windows 可直接访问；WSL 三项留空即可。附件复制到该发行版的 `~/.hermes/attachments`，Hermes 收到 POSIX 路径。
- **本机原生 Hermes**：无需 WSL 配置；读取 `%USERPROFILE%\.hermes\.env`（或 `$HOME/.hermes/.env`），附件放在本机 `~/.hermes/attachments`，Hermes 收到本机路径。
- **远程 gateway**：填 Hermes 地址，手动填 Key（或在 Harness 进程环境里设 `HERMES_API_KEY`）。远程模式不探测本地 `~/.hermes`，也不提供本地附件。
- **非默认 WSL home / 多发行版**：自动探测选错时，填 **WSL 发行版** 和/或 **WSL home**（如 `/root`、`/home/alice`）。

## 使用

1. 点左侧栏「Hermes」。
2. 输入消息：第一条创建 Hermes 会话（标题取消息前几十字），后续用同一 `session_id` 续接。
3. 「历史」列出 Hermes 里所有 `api_server` 会话（包括其它 API 客户端创建的），每行显示 `session_id`、消息数，可复制/改名/删除；顶栏也有 `session_id` chip。
4. 「📎 添加文件」把文件（单个 ≤20MB）复制到 Hermes 附件目录，并把路径交给 Hermes。附件元数据不在 Hermes 消息里，所以 chip 只在本次发送时显示。
5. 「停止」或 Esc 取消；Enter 发送，Shift+Enter 换行。

## 安全与隐私

- 浏览器只访问 Harness Host 上的 `/hermes-nook/api`、`/hermes-nook/run-events`、`/hermes-nook/icon.svg`，均仅限 loopback。
- API Key 只在 Host 侧读取，不下发浏览器；设置页保存的 Key 放在 Harness profile 下的插件 `state.json`（权限 0600），否则依次读环境变量、`~/.hermes/.env` 或配置的 `apiKeyEnv`。
- 无遥测，除配置的 Hermes gateway 外不发起外部请求。
- 插件不修改 Hermes 配置，只创建会话、run 和附件文件。

## 已知限制

- 需要 Runs 传输（`/v1/runs` + SSE），Hermes 0.21+ 支持。
- Hermes 的 Runs 请求没有通用文件上传字段，附件采用「复制文件 + ephemeral instructions 里给路径」的方式。
- 远程 gateway 不支持本地附件。
- 关闭整个 Harness 窗口/浏览器会断掉浏览器到 Host 的 SSE；Hermes 侧 run 会继续跑完并写入历史，重新打开面板可看到结果，但看不到当轮实时流。
- Markdown 渲染是轻量实现（标题/列表/引用/行内代码/代码块）。

## 许可

MIT，见 [LICENSE](LICENSE)。

`icon.svg` 来自 Hermes Agent 仓库（MIT，Copyright © 2025 Nous Research），见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。Hermes Agent 及其标识归 Nous Research 所有，本插件与 Nous Research 无隶属关系。
