# Changelog

## 0.3.0

First public release of **Hermes Nook** (`dsh-hermes-nook`).

- Standalone Hermes chat panel inside DeepSeek Harness (no Harness model/tools/system prompt involved).
- Hermes-native sessions with persistent, unlimited history; search/rename/delete/copy `session_id`.
- Direct Runs + SSE streaming, stop, approvals.
- File attachments copied next to the Hermes install.
- Activity display modes: detailed / compact / hidden.
- Configurable quick prompts.
- Background runs survive panel/session switches; only Stop/Esc cancels.
- Environment adaptation:
  - WSL2 auto-detection (distro/user/home), with optional overrides;
  - native Hermes (`~/.hermes` on the Harness host);
  - remote gateway (key must be supplied manually).
- Repository hygiene: MIT license, third-party notices, `.gitignore`, bilingual README.
