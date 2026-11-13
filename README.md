# Hermes Nook

A standalone **Hermes Agent** chat panel for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), packaged as `dsh-hermes-nook`. The panel talks straight to a Hermes gateway over its HTTP API — the Harness model, tools and system prompts are never involved.

> Unofficial community plugin. Hermes Agent is a project of Nous Research.

## Features

- **Independent panel** — open it from the Hermes icon in the left sidebar. It is not a Harness session, so there is no Harness model picker, tool list or workspace prompt in the way.
- **Real Hermes sessions** — every chat is a Hermes session (`session_id` such as `api_…`) persisted by Hermes itself. History is unlimited and supports search, refresh, load-more, rename, delete and copying the `session_id`.
- **Direct Runs/SSE** — `POST /v1/runs` + `GET /v1/runs/{id}/events`, token-by-token streaming, stop, approvals.
- **File attachments** — files are copied next to the Hermes install and their paths are passed to Hermes; it reads them with its own file/terminal tools.
- **Adjustable activity display** — detailed (tool cards with command/output/duration and reasoning), compact (chips + collapsed reasoning), or hidden (only a “thinking” hint).
- **Configurable quick prompts** — up to 8 shortcuts on the new-chat screen.
- **Background runs** — switching sessions or closing the panel does not interrupt a running turn; only Stop/Esc does. Reopening the panel reattaches to the in-flight run.
- **Local-only transport** — the API key stays in the Host process. The browser talks to three loopback endpoints; nothing is exposed to the network.

## Requirements

- DeepSeek Harness Desktop with the `desktop` profile (plugin API `0.2.x`).
- Hermes Agent `0.21+` with the gateway API server enabled:
  - `platforms.api_server.enabled: true`
  - `API_SERVER_KEY` set (16+ chars); anonymous requests are rejected.
  - Reachable at `http://127.0.0.1:8642` by default.
- One of:
  - **WSL2** with Hermes installed in a distro (default setup), or
  - **Hermes Desktop / native Hermes** on the same machine, or
  - a **remote gateway** (see limitations).

## Install

**From npm (once published):**

```bash
dsh plugin --profile web add dsh-hermes-nook
# or the profile you use, e.g. --profile tui / --profile desktop
```

The plugin manager recognizes the package's `dsh.bundle` field and adds it to the profile's bundle list automatically. Then restart the profile and refresh the page.

**From a local checkout:**

Clone/download this repository, then install the directory as a local bundle:

```bash
# macOS/Linux
dsh plugin --profile desktop add /absolute/path/to/dsh-hermes-nook

# Windows PowerShell
dsh.cmd plugin --profile desktop add C:\absolute\path\to\dsh-hermes-nook
```

If your `dsh` CLI is not on `PATH`, run it from the DeepSeek Harness installation (`resources/runtime/cli/bin/dsh.cmd` on Windows). You can also add the directory as a local bundle from the Harness plugin manager.

After installing, restart DeepSeek Harness (or disable/enable the plugin once) and refresh the page.

> A GitHub URL works too before/without npm: `dsh plugin --profile web add github:you/dsh-hermes-nook`.

## Configuration

Open **Settings → Hermes Nook**.

| Setting | Meaning |
| --- | --- |
| Hermes address | Gateway base URL, default `http://127.0.0.1:8642`. |
| Hermes runtime | `Auto` / `Inside WSL` / `Native Hermes` / `Remote gateway`. Auto detects WSL first, then native `~/.hermes`. Set it explicitly when both a WSL and a native Hermes are installed. |
| API key | Write-only. Click **Use the local .env** to copy `API_SERVER_KEY` from WSL or native `~/.hermes/.env`. |
| WSL distribution / user / home | **Leave blank to auto-detect.** The Host asks `wsl.exe -l -q`, then looks for `~/.hermes` under each distro/home. |
| Timeout | Per-request timeout (runs can be long). |
| Model | Optional Hermes model override; blank uses the gateway default. |
| Auto-approve tools | On by default. Turn off to get Allow once / session / always / deny buttons in the panel. |
| Activity display | `Detailed`, `Compact` or `Hidden`. |
| Quick prompts | One per line, up to 8; empty hides the shortcuts. |

The settings page shows what was auto-detected (WSL distro/home, native `~/.hermes`, or remote mode) and where attachments will be copied.

### Common environments

**WSL2 (recommended on Windows)**

Hermes runs inside a distro; its gateway listens on `127.0.0.1:8642`, which Windows forwards. Leave the WSL fields blank — the plugin finds the distro and user that owns `~/.hermes`. Attachments are copied to `~/.hermes/attachments` inside that distro and Hermes receives POSIX paths.

**Native Hermes (Windows/macOS/Linux)**

If Hermes runs directly on the Harness host, no WSL settings are needed. The plugin reads `%USERPROFILE%\.hermes\.env` (or `$HOME/.hermes/.env`) and copies attachments into the local `~/.hermes/attachments`; Hermes receives native paths.

**Remote gateway**

Set **Hermes address** to the gateway URL and paste the API key (or set the `HERMES_API_KEY` environment variable for the Harness process). Local `~/.hermes` auto-detection and file attachments are intentionally disabled in remote mode; there is no way to put files on the remote machine.

**Non-default WSL home / multiple distros**

If auto-detection picks the wrong home or you run Hermes from `/root` or a custom home, fill **WSL distribution** and/or **WSL home** (for example `/root` or `/home/alice`). Setting a home also disables enumeration.

## Usage

1. Click **Hermes** in the left sidebar.
2. Type a message. The first message creates a Hermes session with a title derived from your text; later messages continue through its `session_id`.
3. **History** lists all `api_server` sessions from Hermes (including ones created by other API clients). Each row exposes its `session_id`, message count, rename/delete actions and a copy button; the top bar also has a copy-session-id chip.
4. **📎 Attach file** copies files up to 20 MB each into the Hermes attachments directory and tells Hermes their paths. Attachments aren’t stored in Hermes message metadata, so chips are shown for the current send only.
5. Stop with the **Stop** button or `Esc`; `Enter` sends, `Shift+Enter` inserts a newline.

## Security & privacy

- The browser only calls `/hermes-nook/api`, `/hermes-nook/run-events` and `/hermes-nook/icon.svg` on the Harness Host; all are loopback-only.
- The API key is read on the Host and never sent to the browser. When saved from the settings page it is kept in the plugin state file (`state.json`, mode `0600`) under the Harness profile directory; otherwise it is read from the environment, `~/.hermes/.env`, or the environment variable named by `apiKeyEnv`.
- No telemetry, no external network calls except to the configured Hermes gateway.
- The plugin never modifies Hermes configuration; it only creates sessions, runs, and attachment files.

## Limitations

- Runs transport is required (`/v1/runs` + SSE). Hermes 0.21+ supports it; older gateways fall back nowhere.
- Hermes has no generic file-upload field on `/v1/runs`; attachments are implemented as “copy + path in an ephemeral `instructions` message”.
- Remote gateways cannot receive local attachments.
- If the Harness window/browser is closed, the browser’s SSE connection drops. The Hermes run keeps going server-side and its result appears in history when you reopen the panel; you just lose the live stream for that turn.
- Markdown rendering is intentionally lightweight (headings, lists, quotes, inline code, fenced code blocks).

## License

MIT. See [LICENSE](LICENSE).

The Hermes icon in `icon.svg` comes from the Hermes Agent repository (MIT, Copyright © 2025 Nous Research). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Hermes Agent and its marks belong to Nous Research; this plugin is not endorsed by them.
