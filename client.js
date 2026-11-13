/**
 * dsh-hermes-nook — browser half.
 *
 * A standalone Hermes chat panel: the panel talks to the Hermes gateway through
 * the Host's loopback proxy. Chats are real Hermes sessions (session ids visible
 * and persisted by Hermes), so history is durable and unlimited. No Harness
 * model, tools or system prompt are involved, and no workspace instruction is
 * injected — Hermes runs from its own default home directory.
 */
window.__ModuleLoader__.load({
  id: 'dsh-hermes-nook',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ENDPOINT = '/hermes-nook/api'
    const ICON_URL = '/hermes-nook/icon.svg'
    const PANEL_ID = 'hermes-nook-page'
    const LAST_SESSION_KEY = 'dsh-hermes-nook/last-session-v1'
    const PAGE_SIZE = 50

    // ------------------------------------------------------------------ i18n
    const zh = {
      'settings.section': 'Hermes Nook',
      'settings.endpoint': 'Hermes 地址',
      'settings.key': 'API Key',
      'settings.key.placeholder': '粘贴 HERMES_API_KEY（只写不回显）',
      'settings.key.useWsl': '使用本机/WSL 的 .env',
      'settings.key.clear': '清除',
      'settings.key.configured': '已配置（{source}）',
      'settings.key.missing': '未配置',
      'settings.wslDistro': 'WSL 发行版',
      'settings.wslDistro.placeholder': '留空自动探测',
      'settings.wslUser': 'WSL 用户',
      'settings.wslUser.placeholder': '留空自动探测',
      'settings.wslHome': 'WSL home（可选）',
      'settings.wslHome.placeholder': '/home/your-user',
      'settings.runtime': 'Hermes 运行环境',
      'settings.runtime.auto': '自动探测（推荐）',
      'settings.runtime.wsl': 'WSL 内',
      'settings.runtime.native': '本机原生 Hermes',
      'settings.runtime.remote': '远程 gateway',
      'settings.detected': '自动探测：{kind} · {path}',
      'settings.detectedNone': '未探测到本地 Hermes（远程 gateway 请手动填写 API Key）',
      'settings.attachment': '附件目录：{target}',
      'settings.attachmentNone': '附件不可用：未找到本地 Hermes 目录',
      'settings.remoteMode': '当前是远程 endpoint：文件附件不可用，API Key 需要手动填写或来自环境变量。',
      'settings.timeout': '超时（毫秒）',
      'settings.model': '模型（留空用 Hermes 默认）',
      'settings.autoApprove': '自动批准工具调用（关闭后由面板弹批准按钮）',
      'settings.activityDisplay': '工具/思考过程展示',
      'settings.activity.detailed': '详细（命令、输出、思考展开）',
      'settings.activity.compact': '简洁（标签 + 思考折叠）',
      'settings.activity.hidden': '隐藏（只显示"正在思考"）',
      'settings.quickPrompts': '新会话快捷问题（每行一个）',
      'settings.quickPrompts.placeholder': '例如：帮我总结这个仓库\n检查最近的测试失败',
      'settings.quickPrompts.hint': '留空则不显示快捷按钮，最多 8 条。',
      'settings.discover': '自动发现',
      'settings.test': '测试连接',
      'settings.save': '保存',
      'settings.saving': '保存中…',
      'settings.save.hint': '保存连接配置会重载插件。',
      'settings.online': '在线 · v{version} · {latency}ms',
      'settings.offline': '离线',
      'settings.authOk': '认证 ok',
      'settings.authBad': '认证缺失',
      'settings.stateFile': '状态文件：{path}',
      'panel.title': 'Hermes Nook',
      'panel.newChat': '新对话',
      'panel.history': '历史',
      'panel.refresh': '刷新',
      'panel.back': '返回对话',
      'panel.newSessionHint': '新对话 · 发送第一条消息后创建 Hermes 会话',
      'panel.sessionHint': 'session_id',
      'panel.copy': '复制',
      'panel.copied': '已复制',
      'panel.empty': '直接输入消息。第一条消息会创建一个新的 Hermes 会话，之后可在「历史」里随时找回。',
      'panel.placeholder': '发消息给 Hermes…（Enter 发送，Shift+Enter 换行，Esc 停止）',
      'panel.attach': '添加文件',
      'panel.attachHint': '附件会复制到 WSL 并告诉 Hermes 路径',
      'panel.removeAttachment': '移除',
      'panel.uploading': '上传中…',
      'panel.attached': '附件',
      'panel.thinkingOnly': 'Hermes 正在思考…',
      'panel.send': '发送',
      'panel.stop': '停止',
      'panel.loading': '加载中…',
      'panel.thinking': 'Hermes 正在处理…',
      'panel.modelDefault': 'Hermes 默认模型',
      'panel.you': '你',
      'panel.hermes': 'Hermes',
      'panel.reasoning': '思考过程',
      'panel.deleteChat': '删除',
      'panel.confirmDelete': '确认删除？',
      'panel.rename': '重命名',
      'panel.renamePlaceholder': '会话标题',
      'panel.cancel': '取消',
      'panel.noChats': '还没有历史会话',
      'panel.noMatch': '没有匹配的会话',
      'panel.loadMore': '加载更多',
      'panel.error': '出错了：{message}',
      'panel.stopped': '已停止',
      'panel.cancelled': '本轮已取消',
      'panel.approval': 'Hermes 请求执行工具，需要你批准',
      'panel.approveOnce': '允许一次',
      'panel.approveSession': '本次会话允许',
      'panel.approveAlways': '始终允许',
      'panel.deny': '拒绝',
      'panel.jump': '回到底部',
      'panel.usage': '输入 {input} · 输出 {output} tokens',
      'panel.searchPlaceholder': '搜索标题或 session_id',
      'toast.newChat': '已新建 Hermes 会话',
      'toast.saved': '已保存',
      'general.loading': '加载中…',
    }
    const en = {
      'settings.section': 'Hermes Nook',
      'settings.endpoint': 'Hermes address',
      'settings.key': 'API key',
      'settings.key.placeholder': 'Paste HERMES_API_KEY (write-only)',
      'settings.key.useWsl': 'Use the local .env (WSL or native)',
      'settings.key.clear': 'Clear',
      'settings.key.configured': 'Configured ({source})',
      'settings.key.missing': 'Not configured',
      'settings.wslDistro': 'WSL distribution',
      'settings.wslDistro.placeholder': 'Blank = auto-detect',
      'settings.wslUser': 'WSL user',
      'settings.wslUser.placeholder': 'Blank = auto-detect',
      'settings.wslHome': 'WSL home (optional)',
      'settings.wslHome.placeholder': '/home/your-user',
      'settings.runtime': 'Hermes runtime',
      'settings.runtime.auto': 'Auto-detect (recommended)',
      'settings.runtime.wsl': 'Inside WSL',
      'settings.runtime.native': 'Native Hermes',
      'settings.runtime.remote': 'Remote gateway',
      'settings.detected': 'Detected: {kind} · {path}',
      'settings.detectedNone': 'No local Hermes found (for a remote gateway, paste the API key manually)',
      'settings.attachment': 'Attachments directory: {target}',
      'settings.attachmentNone': 'Attachments unavailable: no local Hermes directory found',
      'settings.remoteMode': 'Remote endpoint: attachments are unavailable and the API key must be provided manually or via environment.',
      'settings.timeout': 'Timeout (ms)',
      'settings.model': 'Model (blank = Hermes default)',
      'settings.autoApprove': 'Auto-approve tool calls (off = approval buttons in the panel)',
      'settings.activityDisplay': 'Tool / reasoning display',
      'settings.activity.detailed': 'Detailed (command, output, reasoning expanded)',
      'settings.activity.compact': 'Compact (chips + reasoning collapsed)',
      'settings.activity.hidden': 'Hidden (only the “thinking” hint)',
      'settings.quickPrompts': 'New-chat quick prompts (one per line)',
      'settings.quickPrompts.placeholder': 'e.g. Summarize this repository\nCheck the latest test failures',
      'settings.quickPrompts.hint': 'Leave empty to hide the quick buttons; up to 8 entries.',
      'settings.discover': 'Discover',
      'settings.test': 'Test connection',
      'settings.save': 'Save',
      'settings.saving': 'Saving…',
      'settings.save.hint': 'Saving connection settings reloads the plugin.',
      'settings.online': 'Online · v{version} · {latency}ms',
      'settings.offline': 'Offline',
      'settings.authOk': 'auth ok',
      'settings.authBad': 'auth missing',
      'settings.stateFile': 'State file: {path}',
      'panel.title': 'Hermes Nook',
      'panel.newChat': 'New chat',
      'panel.history': 'History',
      'panel.refresh': 'Refresh',
      'panel.back': 'Back to chat',
      'panel.newSessionHint': 'New chat · the Hermes session is created with your first message',
      'panel.sessionHint': 'session_id',
      'panel.copy': 'Copy',
      'panel.copied': 'Copied',
      'panel.empty': 'Type a message. The first one creates a new Hermes session; every session stays in History.',
      'panel.placeholder': 'Message Hermes… (Enter to send, Shift+Enter newline, Esc stop)',
      'panel.attach': 'Attach file',
      'panel.attachHint': 'Files are copied into WSL and Hermes gets their paths',
      'panel.removeAttachment': 'Remove',
      'panel.uploading': 'Uploading…',
      'panel.attached': 'Attachments',
      'panel.thinkingOnly': 'Hermes is thinking…',
      'panel.send': 'Send',
      'panel.stop': 'Stop',
      'panel.loading': 'Loading…',
      'panel.thinking': 'Hermes is working…',
      'panel.modelDefault': 'Hermes default model',
      'panel.you': 'You',
      'panel.hermes': 'Hermes',
      'panel.reasoning': 'Reasoning',
      'panel.deleteChat': 'Delete',
      'panel.confirmDelete': 'Delete?',
      'panel.rename': 'Rename',
      'panel.renamePlaceholder': 'Session title',
      'panel.cancel': 'Cancel',
      'panel.noChats': 'No previous sessions',
      'panel.noMatch': 'No matching sessions',
      'panel.loadMore': 'Load more',
      'panel.error': 'Error: {message}',
      'panel.stopped': 'Stopped',
      'panel.cancelled': 'Run cancelled',
      'panel.approval': 'Hermes asks for approval to run a tool',
      'panel.approveOnce': 'Allow once',
      'panel.approveSession': 'Allow for session',
      'panel.approveAlways': 'Always allow',
      'panel.deny': 'Deny',
      'panel.jump': 'Jump to bottom',
      'panel.usage': 'input {input} · output {output} tokens',
      'panel.searchPlaceholder': 'Search title or session_id',
      'toast.newChat': 'New Hermes session',
      'toast.saved': 'Saved',
      'general.loading': 'Loading…',
    }

    // ---------------------------------------------------------------- styles
    const STYLE_ATTR_NAME = 'data-plugin'
    const STYLE_ATTR_VALUE = 'dsh-hermes-nook'
    const STYLE_SELECTOR = 'style[data-plugin="dsh-hermes-nook"]'
    const CSS = `
.dhn-settings { display:flex; flex-direction:column; gap:14px; max-width:720px; }
.dhn-status { display:flex; gap:10px; align-items:center; flex-wrap:wrap; font-size:13px; color:var(--dsw-alias-label-secondary); }
.dhn-dot { width:8px; height:8px; border-radius:50%; background:var(--dsw-alias-label-tertiary); }
.dhn-dot--ok { background:var(--dsw-alias-state-business-primary); }
.dhn-dot--bad { background:var(--dsw-alias-state-error-primary); }
.dhn-field { display:flex; flex-direction:column; gap:6px; }
.dhn-label { font-size:13px; color:var(--dsw-alias-label-secondary); }
.dhn-input, .dhn-select { height:34px; padding:0 10px; border-radius:8px; font-size:14px;
  border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
.dhn-input:focus, .dhn-select:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.dhn-textarea { box-sizing:border-box; width:100%; min-height:86px; padding:8px 10px; border-radius:8px; font-size:13px;
  font-family:inherit; line-height:1.5; resize:vertical; border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
.dhn-textarea:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.dhn-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.dhn-btn { height:32px; padding:0 12px; border-radius:8px; font-size:13px; cursor:pointer; white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); }
.dhn-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.dhn-btn--primary { background:var(--dsw-alias-state-business-primary); color:var(--dsw-alias-label-primary-foreground); border-color:transparent; }
.dhn-btn--danger { color:var(--dsw-alias-state-error-primary); }
.dhn-btn--ghost { border-color:transparent; background:transparent; }
.dhn-btn:disabled { opacity:.5; cursor:default; }
.dhn-btn--sm { height:26px; padding:0 8px; font-size:12px; border-radius:6px; }
.dhn-note { font-size:12px; color:var(--dsw-alias-label-tertiary); }
.dhn-note--error { color:var(--dsw-alias-state-error-primary); }
.dhn-note--ok { color:var(--dsw-alias-state-business-primary); }
.dhn-toast { position:fixed; right:18px; bottom:18px; z-index:9999; max-width:420px; padding:10px 14px;
  border-radius:10px; font-size:13px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-3);
  border:1px solid var(--dsw-alias-border-l3); box-shadow:0 6px 18px rgba(0,0,0,.25); }
.dhn-toast--error { border-color:var(--dsw-alias-state-error-primary); }
.dhn-page { display:flex; flex-direction:column; height:100%; min-height:0; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-1); }
.dhn-page-head { display:flex; align-items:center; gap:10px; padding:9px 16px; border-bottom:1px solid var(--dsw-alias-border-l2); flex:none; min-height:44px; }
.dhn-page-head img { width:20px; height:20px; }
.dhn-page-title { font-size:15px; font-weight:600; white-space:nowrap; }
.dhn-page-sub { font-size:12px; color:var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:340px; }
.dhn-page-spacer { flex:1; }
.dhn-session-chip { display:inline-flex; align-items:center; gap:6px; max-width:330px; padding:2px 6px 2px 9px; border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2); font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11px; color:var(--dsw-alias-label-secondary); }
.dhn-session-chip span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dhn-page-body { flex:1; min-height:0; display:flex; }
.dhn-chat-col { flex:1; min-width:0; display:flex; flex-direction:column; position:relative; }
.dhn-scroll { flex:1; min-height:0; overflow:auto; padding:18px 20px 8px; display:flex; flex-direction:column; gap:16px; }
.dhn-msg { display:flex; flex-direction:column; gap:4px; max-width:min(900px, 94%); }
.dhn-msg--user { align-self:flex-end; align-items:flex-end; }
.dhn-msg--assistant { align-self:flex-start; align-items:flex-start; }
.dhn-msg-role { font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dhn-bubble { padding:10px 13px; border-radius:10px; background:var(--dsw-alias-bg-layer-3); font-size:14px; line-height:1.6; min-width:1px; }
.dhn-msg--user .dhn-bubble { background:var(--dsw-alias-state-business-primary); color:var(--dsw-alias-label-primary-foreground); }
.dhn-text { white-space:pre-wrap; word-break:break-word; }
.dhn-bubble p { margin:0 0 8px; white-space:pre-wrap; word-break:break-word; }
.dhn-bubble p:last-child { margin-bottom:0; }
.dhn-bubble h1, .dhn-bubble h2, .dhn-bubble h3, .dhn-bubble h4 { margin:4px 0 8px; font-size:15px; font-weight:600; line-height:1.4; }
.dhn-bubble ul, .dhn-bubble ol { margin:4px 0 8px; padding-left:22px; }
.dhn-bubble li { margin:2px 0; }
.dhn-bubble blockquote { margin:4px 0; padding-left:10px; border-left:3px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary); }
.dhn-code { margin:8px 0; padding:10px 12px; border-radius:8px; background:var(--dsw-alias-bg-layer-1); border:1px solid var(--dsw-alias-border-l2);
  font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12px; overflow:auto; white-space:pre; }
.dhn-inline-code { font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12px; padding:1px 5px; border-radius:5px;
  background:var(--dsw-alias-bg-layer-1); border:1px solid var(--dsw-alias-border-l2); }
.dhn-bubble a { color:var(--dsw-alias-state-business-primary); text-decoration:underline; }
.dhn-tools { display:flex; flex-wrap:wrap; gap:6px; margin-top:2px; }
.dhn-chip { font-size:11px; padding:2px 7px; border-radius:999px; background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-secondary); border:1px solid var(--dsw-alias-border-l2); }
.dhn-chip--failed { color:var(--dsw-alias-state-error-primary); }
.dhn-chip--running { color:var(--dsw-alias-label-primary); }
.dhn-tool-card { margin-top:6px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); overflow:hidden; max-width:100%; }
.dhn-tool-head { display:flex; gap:8px; align-items:center; padding:5px 9px; font-size:12px; color:var(--dsw-alias-label-secondary); }
.dhn-tool-head strong { color:var(--dsw-alias-label-primary); font-weight:600; }
.dhn-tool-preview { margin:0; padding:7px 10px; border-top:1px solid var(--dsw-alias-border-l2);
  font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11px; line-height:1.45; white-space:pre-wrap; word-break:break-word;
  max-height:220px; overflow:auto; color:var(--dsw-alias-label-secondary); }
.dhn-attachments { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px; margin-bottom:6px; }
.dhn-attach { display:inline-flex; align-items:center; gap:6px; max-width:340px; padding:3px 6px 3px 9px; border-radius:8px;
  background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); font-size:12px; }
.dhn-attach-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dhn-attach-meta { color:var(--dsw-alias-label-tertiary); font-size:11px; }
.dhn-file-input { display:none; }
.dhn-msg-attachments { display:flex; flex-wrap:wrap; gap:5px; margin-top:3px; justify-content:flex-end; }
.dhn-msg-attachments .dhn-attach { font-size:11px; padding:2px 6px; }
.dhn-reasoning { margin-top:2px; font-size:12px; color:var(--dsw-alias-label-tertiary); max-width:100%; }
.dhn-reasoning pre { white-space:pre-wrap; margin:4px 0 0; font-family:inherit; }
.dhn-typing { font-size:12px; color:var(--dsw-alias-label-tertiary); margin-top:4px; }
.dhn-typing::after { content:'▍'; animation:dhn-blink 1.1s steps(2, start) infinite; }
@keyframes dhn-blink { to { visibility:hidden; } }
.dhn-composer { flex:none; border-top:1px solid var(--dsw-alias-border-l2); padding:10px 16px 12px; display:flex; flex-direction:column; gap:8px; }
.dhn-composer textarea { width:100%; box-sizing:border-box; height:70px; min-height:70px; max-height:240px; resize:vertical; padding:10px 12px;
  border-radius:10px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary);
  font-size:14px; font-family:inherit; line-height:1.5; }
.dhn-composer textarea:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.dhn-composer-bar { display:flex; align-items:center; gap:10px; }
.dhn-meta { font-size:11px; color:var(--dsw-alias-label-tertiary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dhn-drawer { width:min(360px, 42vw); flex:none; border-right:1px solid var(--dsw-alias-border-l2); display:flex; flex-direction:column; min-height:0; }
.dhn-drawer-head { padding:10px; display:flex; flex-direction:column; gap:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dhn-drawer-list { flex:1; min-height:0; overflow:auto; padding:6px; }
.dhn-chat-row { display:flex; gap:8px; align-items:flex-start; padding:8px 8px 8px 10px; border-radius:8px; cursor:pointer; border:1px solid transparent; }
.dhn-chat-row:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dhn-chat-row--active { border-color:var(--dsw-alias-state-business-primary); }
.dhn-chat-row-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.dhn-chat-row-title { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dhn-chat-row-sub { display:flex; gap:6px; align-items:center; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dhn-chat-row-id { font-family:ui-monospace, Menlo, Consolas, monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dhn-chat-row-actions { display:flex; gap:2px; flex:none; }
.dhn-empty { display:flex; flex-direction:column; gap:14px; align-items:flex-start; margin:auto; max-width:640px; padding:24px; }
.dhn-empty-title { font-size:17px; font-weight:600; }
.dhn-suggest { display:flex; flex-wrap:wrap; gap:8px; }
.dhn-suggest button { height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--dsw-alias-border-l2);
  background:transparent; color:var(--dsw-alias-label-secondary); font-size:12px; cursor:pointer; }
.dhn-suggest button:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dhn-banner { margin:0 16px 8px; padding:8px 12px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-3); font-size:13px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.dhn-banner--approval { border-color:var(--dsw-alias-state-business-primary); }
.dhn-banner--error { border-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); }
.dhn-jump { position:absolute; right:22px; bottom:14px; z-index:3; }
.dhn-approval-actions { display:flex; gap:6px; flex-wrap:wrap; }
`

    function ensureStyles() {
      if (document.querySelector(STYLE_SELECTOR) !== null) return
      const style = document.createElement('style')
      style.setAttribute(STYLE_ATTR_NAME, STYLE_ATTR_VALUE)
      style.textContent = CSS
      document.head.appendChild(style)
    }

    let toastTimer = null
    function toast(message, kind = 'info') {
      try {
        const node = document.createElement('div')
        node.className = kind === 'error' ? 'dhn-toast dhn-toast--error' : 'dhn-toast'
        node.textContent = String(message)
        document.body.appendChild(node)
        if (toastTimer !== null) clearTimeout(toastTimer)
        toastTimer = setTimeout(() => { node.remove(); toastTimer = null }, 4200)
      } catch { /* ignore */ }
    }

    // ---------------------------------------------------------------- api
    async function api(method, params = {}, timeoutMs = 30000) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
      let response
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method, params }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (!response.ok) throw new Error(`bridge HTTP ${response.status}`)
      const body = await response.json()
      if (body?.ok !== true) throw new Error(body?.error ?? `${method} failed`)
      return body.value
    }

    // ------------------------------------------------------------- helpers
    function readLastSession() {
      try { return localStorage.getItem(LAST_SESSION_KEY) ?? '' } catch { return '' }
    }
    function writeLastSession(id) {
      try {
        if (typeof id === 'string' && id !== '') localStorage.setItem(LAST_SESSION_KEY, id)
        else localStorage.removeItem(LAST_SESSION_KEY)
      } catch { /* ignore */ }
    }
    function toMillis(value) {
      const numeric = Number(value) || 0
      if (numeric <= 0) return 0
      return numeric > 1e12 ? numeric : numeric * 1000
    }
    function formatRelative(value) {
      const millis = toMillis(value)
      if (millis === 0) return ''
      const delta = Date.now() - millis
      if (delta < 60_000) return '刚刚'
      if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`
      if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`
      if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前`
      return new Date(millis).toLocaleDateString()
    }
    function formatClock(value) {
      const millis = toMillis(value)
      return millis === 0 ? '' : new Date(millis).toLocaleString()
    }
    function shortSessionId(id) {
      if (typeof id !== 'string') return ''
      return id.length > 22 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id
    }
    function copyText(text) {
      try {
        if (navigator.clipboard?.writeText !== undefined) {
          navigator.clipboard.writeText(text).catch(() => {})
          return true
        }
      } catch { /* fall through */ }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
        return true
      } catch { return false }
    }
    function titleOfSession(session) {
      if (session === null || typeof session !== 'object') return ''
      const title = typeof session.title === 'string' ? session.title.trim() : ''
      return title !== '' ? title : '未命名会话'
    }
    function sessionSortValue(session) {
      return toMillis(session?.lastActive) || toMillis(session?.startedAt)
    }

    // ------------------------------------------------------------- markdown
    const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/g
    function inlineNodes(text, keyPrefix) {
      const nodes = []
      let last = 0
      let index = 0
      let match = INLINE_PATTERN.exec(text)
      while (match !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index))
        const token = match[0]
        if (token.startsWith('**')) {
          nodes.push(h('strong', { key: `${keyPrefix}-b-${index}` }, token.slice(2, -2)))
        } else if (token.startsWith('`')) {
          nodes.push(h('code', { key: `${keyPrefix}-c-${index}`, className: 'dhn-inline-code' }, token.slice(1, -1)))
        } else {
          const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
          nodes.push(h('a', { key: `${keyPrefix}-a-${index}`, href: link?.[2] ?? '#', target: '_blank', rel: 'noreferrer' }, link?.[1] ?? token))
        }
        last = INLINE_PATTERN.lastIndex
        index += 1
        match = INLINE_PATTERN.exec(text)
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes.length === 0 ? [''] : nodes
    }

    function renderMarkdown(text, keyPrefix) {
      const lines = String(text ?? '').split('\n')
      const blocks = []
      let index = 0
      let paragraph = []
      let listItems = []
      let listOrdered = false

      const flushParagraph = () => {
        if (paragraph.length === 0) return
        const value = paragraph.join('\n')
        blocks.push(h('p', { key: `${keyPrefix}-p-${blocks.length}` }, inlineNodes(value, `${keyPrefix}-p-${blocks.length}`)))
        paragraph = []
      }
      const flushList = () => {
        if (listItems.length === 0) return
        const children = listItems.map((item, itemIndex) => h('li', { key: `${keyPrefix}-li-${blocks.length}-${itemIndex}` }, inlineNodes(item, `${keyPrefix}-li-${itemIndex}`)))
        blocks.push(listOrdered
          ? h('ol', { key: `${keyPrefix}-ol-${blocks.length}` }, ...children)
          : h('ul', { key: `${keyPrefix}-ul-${blocks.length}` }, ...children))
        listItems = []
      }

      while (index < lines.length) {
        const line = lines[index]
        const fence = /^\s*```/.test(line)
        if (fence) {
          flushParagraph(); flushList()
          const body = []
          index += 1
          while (index < lines.length && !/^\s*```/.test(lines[index])) { body.push(lines[index]); index += 1 }
          if (index < lines.length) index += 1
          blocks.push(h('pre', { key: `${keyPrefix}-code-${blocks.length}`, className: 'dhn-code' }, h('code', null, body.join('\n'))))
          continue
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          flushParagraph(); flushList()
          const level = Math.min(6, heading[1].length)
          blocks.push(h(`h${level}`, { key: `${keyPrefix}-h-${blocks.length}` }, inlineNodes(heading[2], `${keyPrefix}-h-${blocks.length}`)))
          index += 1
          continue
        }
        const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
        if (ordered !== null || bullet !== null) {
          flushParagraph()
          const nextOrdered = ordered !== null
          if (listItems.length > 0 && listOrdered !== nextOrdered) flushList()
          listOrdered = nextOrdered
          listItems.push((ordered ?? bullet)[1])
          index += 1
          continue
        }
        if (/^\s*>\s?/.test(line)) {
          flushParagraph(); flushList()
          const body = []
          while (index < lines.length && /^\s*>\s?/.test(lines[index])) { body.push(lines[index].replace(/^\s*>\s?/, '')); index += 1 }
          blocks.push(h('blockquote', { key: `${keyPrefix}-q-${blocks.length}` }, inlineNodes(body.join('\n'), `${keyPrefix}-q-${blocks.length}`)))
          continue
        }
        if (line.trim() === '') {
          flushParagraph(); flushList()
          index += 1
          continue
        }
        paragraph.push(line)
        index += 1
      }
      flushParagraph(); flushList()
      if (blocks.length === 0) blocks.push(h('p', { key: `${keyPrefix}-empty` }, ''))
      return blocks
    }

    function MessageView({ message, t, display }) {
      const toolEvents = Array.isArray(message.toolEvents) ? message.toolEvents : []
      const showActivity = display !== 'hidden'
      const detailed = display === 'detailed'
      const attachmentNodes = Array.isArray(message.attachments) && message.attachments.length > 0
        ? h('div', { className: 'dhn-msg-attachments' }, message.attachments.map((file, index) => h('span', {
            key: `${message.id}-attach-${index}`,
            className: 'dhn-attach',
            title: file.path ?? '',
          },
            h('span', { className: 'dhn-attach-name' }, file.name ?? 'file'),
            h('span', { className: 'dhn-attach-meta' }, file.size !== undefined ? `${Math.max(1, Math.round(file.size / 1024))} KB` : ''),
          )))
        : null
      return h('div', { className: message.role === 'user' ? 'dhn-msg dhn-msg--user' : 'dhn-msg dhn-msg--assistant' },
        h('span', { className: 'dhn-msg-role' }, message.role === 'user' ? t('panel.you') : t('panel.hermes')),
        attachmentNodes,
        h('div', { className: 'dhn-bubble' },
          message.content === '' && message.pending
            ? h('span', { className: 'dhn-typing' }, t('panel.thinkingOnly'))
            : renderMarkdown(message.content, message.id),
          message.pending && message.content !== '' ? h('span', { className: 'dhn-typing' }) : null,
        ),
        showActivity && toolEvents.length > 0
          ? (detailed
              ? h('div', { className: 'dhn-tools' }, toolEvents.map((tool, index) => h('div', {
                  key: `${message.id}-tool-${index}`,
                  className: 'dhn-tool-card',
                },
                  h('div', { className: 'dhn-tool-head' },
                    h('strong', null, tool.name),
                    h('span', null, `· ${tool.status}`),
                    tool.duration !== undefined ? h('span', null, `· ${Number(tool.duration).toFixed(2)}s`) : null,
                    tool.error === true ? h('span', { className: 'dhn-note--error' }, '· failed') : null,
                  ),
                  tool.command !== undefined && tool.command !== ''
                    ? h('pre', { className: 'dhn-tool-preview' }, tool.command)
                    : null,
                  tool.output !== undefined && tool.output !== ''
                    ? h('pre', { className: 'dhn-tool-preview' }, tool.output)
                    : null,
                )))
              : h('div', { className: 'dhn-tools' }, toolEvents.map((tool, index) => h('span', {
                  key: `${message.id}-tool-${index}`,
                  className: tool.status === 'failed' ? 'dhn-chip dhn-chip--failed' : (tool.status === 'running' ? 'dhn-chip dhn-chip--running' : 'dhn-chip'),
                  title: tool.output ?? tool.command ?? '',
                }, `${tool.name} · ${tool.status}`))))
          : null,
        showActivity && message.reasoning !== undefined && message.reasoning !== null && message.reasoning !== ''
          ? h('details', { className: 'dhn-reasoning', open: detailed },
              h('summary', null, t('panel.reasoning')),
              h('pre', null, message.reasoning),
            )
          : null,
      )
    }

    // ------------------------------------------------------------------ sse
    async function streamRun(runId, { signal, onEvent }) {
      const response = await fetch(`/hermes-nook/run-events?runId=${encodeURIComponent(runId)}`, { signal })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text === '' ? `run stream HTTP ${response.status}` : text.slice(0, 300))
      }
      if (response.body === null) throw new Error('run stream has no body')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index = buffer.indexOf('\n\n')
        while (index >= 0) {
          const block = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          const data = block.split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (data !== '' && !data.startsWith(':')) {
            try { onEvent(JSON.parse(data)) } catch { /* ignore malformed */ }
          }
          index = buffer.indexOf('\n\n')
        }
      }
    }

    // ------------------------------------------------------------- settings
    // Cached so a plugin restart during save never blanks the settings form.
    const settingsCache = { config: null, key: { configured: false, source: '' }, stateFile: '' }

    function SettingsSection({ t: translate }) {
      const t = translate
      const [config, setConfig] = React.useState(() => settingsCache.config)
      const [key, setKey] = React.useState(() => settingsCache.key)
      const [secret, setSecret] = React.useState('')
      const [dirty, setDirty] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [status, setStatus] = React.useState(null)
      const [error, setError] = React.useState('')
      const [stateFile, setStateFile] = React.useState(() => settingsCache.stateFile)

      const load = React.useCallback(async (attempt = 0) => {
        try {
          const value = await api('getConfig')
          settingsCache.config = value.config
          settingsCache.key = value.key
          settingsCache.stateFile = value.stateFile ?? ''
          setConfig(value.config)
          setKey(value.key)
          setStateFile(value.stateFile ?? '')
          setError('')
        } catch (failure) {
          if (settingsCache.config !== null) setConfig(settingsCache.config)
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, 350))
            return load(attempt + 1)
          }
          setError(String(failure.message ?? failure))
        }
      }, [])

      React.useEffect(() => { void load() }, [load])
      React.useEffect(() => {
        let cancelled = false
        api('testConnection', {}, 30000)
          .then((value) => { if (!cancelled) setStatus(value) })
          .catch(() => {})
        return () => { cancelled = true }
      }, [])

      const patch = (field, value) => {
        setConfig((current) => ({ ...(current ?? {}), [field]: value }))
        setDirty(true)
      }
      const run = async (fn) => {
        setBusy(true)
        setError('')
        try { await fn() } catch (failure) { setError(String(failure.message ?? failure)) } finally { setBusy(false) }
      }
      const save = () => run(async () => {
        const result = await api('saveConfig', { config: config ?? {} })
        setDirty(false)
        toast(t('toast.saved'))
        try { window.dispatchEvent(new CustomEvent('hermes-nook:config-changed')) } catch { /* ignore */ }
        if (result?.restart === true) {
          setTimeout(() => { void load(2) }, 1200)
        } else {
          await load(0)
        }
      })
      const test = () => run(async () => { setStatus(await api('testConnection', {}, 30000)) })
      const discover = () => run(async () => {
        const value = await api('discover')
        if (value?.endpoint !== undefined) {
          setConfig((current) => ({ ...(current ?? {}), endpoint: value.endpoint }))
          setDirty(true)
        }
        if (value?.online === true) setStatus({ online: true, version: value.version, latencyMs: null, authOk: value.authOk === true })
        else setError('未发现可用的 Hermes API')
      })
      const useWslKey = () => run(async () => {
        const value = await api('saveSecretFromWsl')
        setKey({ configured: true, source: value?.source ?? 'wsl-env-file' })
      })
      const saveSecret = () => run(async () => {
        if (secret.trim() === '') return
        await api('saveSecret', { apiKey: secret.trim() })
        setSecret('')
        setKey({ configured: true, source: 'plugin-state' })
      })
      const clearSecret = () => run(async () => {
        await api('clearSecret')
        setKey({ configured: false, source: '' })
      })

      if (config === null) {
        return h('div', { className: 'dhn-settings' },
          h('span', { className: 'dhn-note' }, t('general.loading')),
          error !== '' ? h('span', { className: 'dhn-note dhn-note--error' }, error) : null,
          h('button', { type: 'button', className: 'dhn-btn', onClick: () => { void load(0) } }, '重试'),
        )
      }

      const statusLine = status === null
        ? null
        : status.online
          ? t('settings.online').replace('{version}', String(status.version ?? '')).replace('{latency}', String(status.latencyMs ?? '?'))
          : t('settings.offline')

      const detected = config.detectedWsl
      const detectionText = detected !== null && detected !== undefined
        ? t('settings.detected').replace('{kind}', 'WSL').replace('{path}', `${detected.distro} · ${detected.home}`)
        : (config.detectedNativeHome
          ? t('settings.detected').replace('{kind}', 'native').replace('{path}', config.detectedNativeHome)
          : t('settings.detectedNone'))
      const attachmentText = config.attachmentKind === 'wsl'
        ? t('settings.attachment').replace('{target}', 'WSL ~/.hermes/attachments')
        : (config.attachmentKind === 'native'
          ? t('settings.attachment').replace('{target}', config.detectedNativeHome ?? '~/.hermes/attachments')
          : t('settings.attachmentNone'))

      return h('div', { className: 'dhn-settings' },
        h('div', { className: 'dhn-status' },
          h('span', { className: `dhn-dot ${status?.online === true ? 'dhn-dot--ok' : 'dhn-dot--bad'}` }),
          h('span', null, statusLine ?? '—'),
          status?.online === true ? h('span', { className: 'dhn-note' }, status.authOk ? t('settings.authOk') : t('settings.authBad')) : null,
        ),
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.endpoint')),
          h('div', { className: 'dhn-row' },
            h('input', { className: 'dhn-input', style: { flex: 1 }, value: config.endpoint ?? '', onChange: (event) => patch('endpoint', event.target.value) }),
            h('button', { type: 'button', className: 'dhn-btn', disabled: busy, onClick: discover }, t('settings.discover')),
          ),
        ),
        h('div', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.key')),
          h('div', { className: 'dhn-row' },
            h('input', {
              className: 'dhn-input', type: 'password', style: { flex: 1 },
              placeholder: t('settings.key.placeholder'), value: secret,
              onChange: (event) => setSecret(event.target.value),
            }),
            h('button', { type: 'button', className: 'dhn-btn', disabled: busy || secret.trim() === '', onClick: saveSecret }, t('settings.save')),
            h('button', { type: 'button', className: 'dhn-btn', disabled: busy, onClick: useWslKey }, t('settings.key.useWsl')),
            key.configured ? h('button', { type: 'button', className: 'dhn-btn', disabled: busy, onClick: clearSecret }, t('settings.key.clear')) : null,
          ),
          h('span', { className: key.configured ? 'dhn-note dhn-note--ok' : 'dhn-note' },
            key.configured ? t('settings.key.configured').replace('{source}', key.source) : t('settings.key.missing')),
        ),
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.runtime')),
          h('select', {
            className: 'dhn-select',
            value: config.hermesRuntime === 'wsl' || config.hermesRuntime === 'native' || config.hermesRuntime === 'remote' ? config.hermesRuntime : 'auto',
            onChange: (event) => patch('hermesRuntime', event.target.value),
          },
            h('option', { value: 'auto' }, t('settings.runtime.auto')),
            h('option', { value: 'wsl' }, t('settings.runtime.wsl')),
            h('option', { value: 'native' }, t('settings.runtime.native')),
            h('option', { value: 'remote' }, t('settings.runtime.remote')),
          ),
        ),
        h('div', { className: 'dhn-row' },
          h('label', { className: 'dhn-field', style: { flex: 1 } },
            h('span', { className: 'dhn-label' }, t('settings.wslDistro')),
            h('input', {
              className: 'dhn-input',
              placeholder: t('settings.wslDistro.placeholder'),
              value: config.wslDistro ?? '',
              onChange: (event) => patch('wslDistro', event.target.value),
            }),
          ),
          h('label', { className: 'dhn-field', style: { flex: 1 } },
            h('span', { className: 'dhn-label' }, t('settings.wslUser')),
            h('input', {
              className: 'dhn-input',
              placeholder: t('settings.wslUser.placeholder'),
              value: config.wslUser ?? '',
              onChange: (event) => patch('wslUser', event.target.value),
            }),
          ),
          h('label', { className: 'dhn-field', style: { width: 170 } },
            h('span', { className: 'dhn-label' }, t('settings.timeout')),
            h('input', { className: 'dhn-input', type: 'number', value: config.timeoutMs ?? 900000, onChange: (event) => patch('timeoutMs', Number(event.target.value) || 900000) }),
          ),
        ),
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.wslHome')),
          h('input', {
            className: 'dhn-input',
            placeholder: t('settings.wslHome.placeholder'),
            value: config.wslHome ?? '',
            onChange: (event) => patch('wslHome', event.target.value),
          }),
        ),
        h('span', { className: 'dhn-note' }, detectionText),
        h('span', { className: config.attachmentKind ? 'dhn-note dhn-note--ok' : 'dhn-note' }, attachmentText),
        config.localEndpoint === false ? h('span', { className: 'dhn-note' }, t('settings.remoteMode')) : null,
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.model')),
          h('input', { className: 'dhn-input', value: config.model ?? '', onChange: (event) => patch('model', event.target.value) }),
        ),
        h('label', { className: 'dhn-row' },
          h('input', { type: 'checkbox', checked: config.autoApproveTools !== false, onChange: (event) => patch('autoApproveTools', event.target.checked) }),
          h('span', { className: 'dhn-label' }, t('settings.autoApprove')),
        ),
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.activityDisplay')),
          h('select', {
            className: 'dhn-select',
            value: config.activityDisplay === 'detailed' || config.activityDisplay === 'hidden' ? config.activityDisplay : 'compact',
            onChange: (event) => patch('activityDisplay', event.target.value),
          },
            h('option', { value: 'detailed' }, t('settings.activity.detailed')),
            h('option', { value: 'compact' }, t('settings.activity.compact')),
            h('option', { value: 'hidden' }, t('settings.activity.hidden')),
          ),
        ),
        h('label', { className: 'dhn-field' },
          h('span', { className: 'dhn-label' }, t('settings.quickPrompts')),
          h('textarea', {
            className: 'dhn-textarea',
            rows: 4,
            placeholder: t('settings.quickPrompts.placeholder'),
            value: Array.isArray(config.quickPrompts) ? config.quickPrompts.join('\n') : '',
            onChange: (event) => patch('quickPrompts', event.target.value.split(/\r?\n/)),
          }),
          h('span', { className: 'dhn-note' }, t('settings.quickPrompts.hint')),
        ),
        h('div', { className: 'dhn-row' },
          h('button', { type: 'button', className: 'dhn-btn dhn-btn--primary', disabled: busy || !dirty, onClick: save }, busy ? t('settings.saving') : t('settings.save')),
          h('button', { type: 'button', className: 'dhn-btn', disabled: busy, onClick: test }, t('settings.test')),
        ),
        h('span', { className: 'dhn-note' }, t('settings.save.hint')),
        error !== '' ? h('span', { className: 'dhn-note dhn-note--error' }, error) : null,
        stateFile !== '' ? h('span', { className: 'dhn-note' }, t('settings.stateFile').replace('{path}', stateFile)) : null,
      )
    }

    // -------------------------------------------------- live run registry
    // Runs are owned here, not by the panel component: switching panels/sessions
    // or closing the sidebar only detaches the view, it never stops Hermes.
    const liveRuns = new Map()
    const liveRunListeners = new Set()

    function notifyLiveRuns() {
      for (const listener of [...liveRunListeners]) {
        try { listener() } catch { /* ignore */ }
      }
    }

    function subscribeLiveRuns(listener) {
      liveRunListeners.add(listener)
      return () => { liveRunListeners.delete(listener) }
    }

    function getLiveRun(sessionId) {
      return typeof sessionId === 'string' && sessionId !== '' ? (liveRuns.get(sessionId) ?? null) : null
    }

    function createLiveRun(sessionId) {
      const run = {
        sessionId,
        assistantId: `live-${sessionId}-${Date.now()}`,
        runId: '',
        controller: new AbortController(),
        content: '',
        reasoning: '',
        toolEvents: [],
        pending: true,
        stopped: false,
        completedSuccess: false,
        error: '',
        approval: null,
        usage: null,
      }
      liveRuns.set(sessionId, run)
      notifyLiveRuns()
      return run
    }

    function updateLiveRun(run, mutator) {
      if (liveRuns.get(run.sessionId) !== run) return
      mutator(run)
      notifyLiveRuns()
    }

    function finishLiveRun(run) {
      if (liveRuns.get(run.sessionId) !== run) return
      run.pending = false
      run.controller = null
      notifyLiveRuns()
    }

    function removeLiveRun(run) {
      if (liveRuns.get(run.sessionId) === run) liveRuns.delete(run.sessionId)
      notifyLiveRuns()
    }

    function stopLiveRun(run) {
      if (run === null || run.pending !== true) return
      run.stopped = true
      try { run.controller?.abort() } catch { /* ignore */ }
      if (run.runId !== '') api('stopChatRun', { runId: run.runId }).catch(() => {})
      notifyLiveRuns()
    }

    // ---------------------------------------------------------------- panel
    function HermesPanel({ t: translate, ctx }) {
      const t = translate
      const [sessions, setSessions] = React.useState([])
      const [sessionsLoading, setSessionsLoading] = React.useState(false)
      const [hasMore, setHasMore] = React.useState(false)
      const [search, setSearch] = React.useState('')
      const [drawer, setDrawer] = React.useState(false)
      const [activeSession, setActiveSession] = React.useState(null)
      const [messages, setMessages] = React.useState([])
      const [loadingSession, setLoadingSession] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      const [config, setConfig] = React.useState(null)
      const [models, setModels] = React.useState([])
      const [error, setError] = React.useState('')
      const [showJump, setShowJump] = React.useState(false)
      const [editingId, setEditingId] = React.useState('')
      const [editingTitle, setEditingTitle] = React.useState('')
      const [confirmId, setConfirmId] = React.useState('')
      const [attachments, setAttachments] = React.useState([])
      const [uploading, setUploading] = React.useState(false)
      const [liveTick, setLiveTick] = React.useState(0)

      const scrollRef = React.useRef(null)
      const composerRef = React.useRef(null)
      const fileInputRef = React.useRef(null)
      const stickRef = React.useRef(true)
      const activeSessionRef = React.useRef(null)
      activeSessionRef.current = activeSession

      const liveRun = getLiveRun(activeSession?.id)
      const streaming = liveRun?.pending === true
      const pendingApproval = liveRun?.approval ?? null
      const usage = liveRun?.usage ?? null

      React.useEffect(() => subscribeLiveRuns(() => setLiveTick((value) => value + 1)), [])

      const refreshSessions = React.useCallback(async ({ reset = false, forSearch = false } = {}) => {
        setSessionsLoading(true)
        try {
          const offset = reset || forSearch ? 0 : sessions.length
          const page = await api('listChatSessions', { limit: PAGE_SIZE, offset })
          setSessions((current) => {
            const next = reset || forSearch ? page.sessions : [...current, ...page.sessions]
            const seen = new Set()
            return next.filter((session) => {
              if (session === null || typeof session.id !== 'string' || seen.has(session.id)) return false
              seen.add(session.id)
              return true
            }).sort((a, b) => sessionSortValue(b) - sessionSortValue(a))
          })
          setHasMore(page.hasMore === true)
        } catch (failure) {
          setError(String(failure.message ?? failure))
        } finally {
          setSessionsLoading(false)
        }
      }, [sessions.length])

      const openSession = React.useCallback(async (sessionId, options = {}) => {
        if (typeof sessionId !== 'string' || sessionId === '') return
        setLoadingSession(true)
        setError('')
        try {
          const [meta, page] = await Promise.all([
            api('getChatSession', { sessionId }),
            api('getChatMessages', { sessionId, limit: 200, order: 'latest' }, 60000),
          ])
          setActiveSession(meta)
          writeLastSession(meta.id)
          setMessages(page.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            reasoning: '',
            toolEvents: [],
            pending: false,
          })))
          const existingRun = getLiveRun(meta.id)
          if (existingRun !== null && !existingRun.pending && existingRun.error === '' && !existingRun.stopped) {
            removeLiveRun(existingRun)
          }
          stickRef.current = true
        } catch (failure) {
          const message = String(failure.message ?? failure)
          setError(t('panel.error').replace('{message}', message))
          if (/not.?found|不存在|404/i.test(message)) {
            setActiveSession(null)
            setMessages([])
            writeLastSession('')
          }
        } finally {
          setLoadingSession(false)
        }
      }, [t])

      React.useEffect(() => {
        let cancelled = false
        const refreshConfig = () => {
          api('getConfig')
            .then((value) => { if (!cancelled) setConfig(value.config) })
            .catch(() => {})
        }
        refreshConfig()
        api('getModels').then((value) => {
          if (cancelled) return
          const list = Array.isArray(value?.data) ? value.data : []
          setModels(list.map((model) => (typeof model?.id === 'string' ? model.id : '')).filter((id) => id !== ''))
        }).catch(() => {})
        void refreshSessions({ reset: true })
        const last = readLastSession()
        if (last !== '') void openSession(last)
        const onConfigChanged = () => refreshConfig()
        window.addEventListener('hermes-nook:config-changed', onConfigChanged)
        return () => {
          cancelled = true
          window.removeEventListener('hermes-nook:config-changed', onConfigChanged)
        }
      }, [])

      function newChatSession() {
        setActiveSession(null)
        setMessages([])
        setError('')
        setDraft('')
        setDrawer(false)
        writeLastSession('')
        setTimeout(() => { composerRef.current?.focus?.() }, 0)
      }

      function stopActiveRun() {
        const run = getLiveRun(activeSessionRef.current?.id)
        if (run !== null) stopLiveRun(run)
      }

      async function addFiles(fileList) {
        const files = Array.from(fileList ?? [])
        if (files.length === 0) return
        setUploading(true)
        setError('')
        for (const file of files) {
          if (file.size > 20 * 1024 * 1024) {
            setError(t('panel.error').replace('{message}', `${file.name}: 超过 20MB 限制`))
            continue
          }
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result ?? ''))
              reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
              reader.readAsDataURL(file)
            })
            const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
            const uploaded = await api('uploadAttachment', { name: file.name, dataBase64: base64 }, 120000)
            setAttachments((current) => [...current, uploaded])
          } catch (failure) {
            setError(t('panel.error').replace('{message}', String(failure?.message ?? failure)))
          }
        }
        setUploading(false)
      }

      function removeAttachment(path) {
        setAttachments((current) => current.filter((item) => item.path !== path))
      }

      React.useEffect(() => {
        const node = scrollRef.current
        if (node === null) return
        if (stickRef.current) node.scrollTop = node.scrollHeight
      }, [messages, liveTick])

      function onScroll() {
        const node = scrollRef.current
        if (node === null) return
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight
        stickRef.current = distance < 80
        setShowJump(distance >= 120)
      }

      async function send() {
        const text = draft.trim()
        if (text === '' || uploading) return
        let session = activeSessionRef.current
        if (session !== null && getLiveRun(session.id)?.pending === true) return
        const pendingAttachments = attachments.slice()
        setAttachments([])
        setDraft('')
        setError('')
        stickRef.current = true

        try {
          if (session === null) {
            session = await api('createChatSession', { title: text.slice(0, 60) })
            setActiveSession(session)
            activeSessionRef.current = session
            writeLastSession(session.id)
          }
        } catch (failure) {
          setError(t('panel.error').replace('{message}', String(failure.message ?? failure)))
          return
        }
        if (getLiveRun(session.id)?.pending === true) return
        const previousRun = getLiveRun(session.id)
        if (previousRun !== null) removeLiveRun(previousRun)

        const userMessage = {
          id: `local-user-${Date.now()}`,
          role: 'user',
          content: text,
          reasoning: '',
          toolEvents: [],
          pending: false,
          attachments: pendingAttachments,
        }
        setMessages((current) => [...current, userMessage])

        const run = createLiveRun(session.id)
        try {
          const started = await api('startChatRun', {
            input: text,
            sessionId: session.id,
            model: config?.model ?? '',
            attachments: pendingAttachments.map((item) => item.path),
          })
          if (liveRuns.get(session.id) !== run) return
          run.runId = started.runId
          notifyLiveRuns()
          await streamRun(started.runId, {
            signal: run.controller.signal,
            onEvent: (event) => {
              const name = typeof event?.event === 'string' ? event.event : ''
              if (name === 'message.delta') {
                const delta = typeof event.delta === 'string' ? event.delta : ''
                if (delta !== '') updateLiveRun(run, (state) => { state.content += delta })
                return
              }
              if (name === 'reasoning.available') {
                const value = typeof event.text === 'string' ? event.text : (typeof event.delta === 'string' ? event.delta : '')
                if (value !== '') updateLiveRun(run, (state) => { state.reasoning += value })
                return
              }
              if (name === 'tool.started' || name === 'tool.completed' || name === 'tool.failed') {
                const status = name === 'tool.completed' ? 'completed' : (name === 'tool.failed' ? 'failed' : 'running')
                const toolName = typeof event.tool === 'string' ? event.tool : (typeof event.tool_name === 'string' ? event.tool_name : 'tool')
                const preview = typeof event.preview === 'string' ? event.preview : ''
                const duration = typeof event.duration === 'number' ? event.duration : undefined
                const failed = event.error === true || name === 'tool.failed'
                updateLiveRun(run, (state) => {
                  const events = [...state.toolEvents]
                  if (name === 'tool.started') {
                    events.push({ name: toolName, status: 'running', command: preview })
                  } else {
                    let index = -1
                    for (let cursor = events.length - 1; cursor >= 0; cursor -= 1) {
                      if (events[cursor].name === toolName && events[cursor].status === 'running') { index = cursor; break }
                    }
                    const update = { name: toolName, status, output: preview, duration, error: failed }
                    if (index >= 0) events[index] = { ...events[index], ...update }
                    else events.push(update)
                  }
                  state.toolEvents = events.slice(-60)
                })
                return
              }
              if (name === 'approval.request') {
                const requestId = typeof event.request_id === 'string' ? event.request_id : ''
                const executionGeneration = event.execution_generation
                if (config?.autoApproveTools !== false) {
                  updateLiveRun(run, (state) => {
                    state.toolEvents = [...state.toolEvents, { name: 'approval', status: 'completed', output: 'auto-approved' }].slice(-60)
                  })
                  api('approveChatRun', { runId: started.runId, choice: 'always', requestId, executionGeneration }).catch(() => {})
                } else {
                  updateLiveRun(run, (state) => {
                    state.approval = { runId: started.runId, requestId, executionGeneration }
                  })
                }
                return
              }
              if (name === 'run.completed') {
                const output = typeof event.output === 'string' ? event.output : ''
                const raw = event.usage ?? {}
                const inputTokens = Number(raw.prompt_tokens ?? raw.input_tokens ?? 0) || 0
                const outputTokens = Number(raw.completion_tokens ?? raw.output_tokens ?? 0) || 0
                updateLiveRun(run, (state) => {
                  state.content = state.content === '' ? output : state.content
                  state.pending = false
                  state.completedSuccess = true
                  if (inputTokens + outputTokens > 0) state.usage = { input: inputTokens, output: outputTokens }
                })
                void refreshSessions({ reset: true })
                return
              }
              if (name === 'run.failed') {
                const value = typeof event.error === 'string' && event.error !== '' ? event.error : 'Hermes run failed'
                updateLiveRun(run, (state) => {
                  state.error = value
                  state.content = state.content === '' ? `[error] ${value}` : state.content
                  state.pending = false
                })
                void refreshSessions({ reset: true })
                return
              }
              if (name === 'run.cancelled') {
                updateLiveRun(run, (state) => {
                  state.content = state.content === '' ? `[${t('panel.cancelled')}]` : state.content
                  state.pending = false
                  state.stopped = true
                })
                void refreshSessions({ reset: true })
              }
            },
          })
          if (run.pending) {
            updateLiveRun(run, (state) => {
              state.pending = false
              if (state.content === '') state.content = `[${t('panel.stopped')}]`
            })
          }
        } catch (failure) {
          if (failure?.name === 'AbortError' || run.stopped) {
            updateLiveRun(run, (state) => {
              state.pending = false
              state.stopped = true
              if (state.content === '') state.content = `[${t('panel.stopped')}]`
            })
          } else {
            const value = String(failure?.message ?? failure)
            updateLiveRun(run, (state) => {
              state.pending = false
              state.error = value
              if (state.content === '') state.content = `[error] ${value}`
            })
          }
        } finally {
          finishLiveRun(run)
          void refreshSessions({ reset: true })
          if (run.completedSuccess === true) {
            try {
              const page = await api('getChatMessages', { sessionId: session.id, limit: 200, order: 'latest' }, 60000)
              if (activeSessionRef.current?.id === session.id) {
                setMessages(page.messages.map((message) => ({
                  id: message.id,
                  role: message.role,
                  content: message.content,
                  reasoning: '',
                  toolEvents: [],
                  pending: false,
                })))
              }
              removeLiveRun(run)
            } catch { /* keep the completed run visible */ }
          }
        }
      }

      async function respondApproval(choice) {
        const run = getLiveRun(activeSessionRef.current?.id)
        const approval = run?.approval ?? null
        if (run === null || approval === null) return
        updateLiveRun(run, (state) => { state.approval = null })
        try {
          await api('approveChatRun', {
            runId: approval.runId,
            choice,
            requestId: approval.requestId,
            executionGeneration: approval.executionGeneration,
          })
        } catch (failure) {
          setError(t('panel.error').replace('{message}', String(failure.message ?? failure)))
        }
      }

      async function renameSession(session) {
        const title = editingTitle.trim()
        setEditingId('')
        if (title === '' || title === session.title) return
        try {
          const updated = await api('renameChatSession', { sessionId: session.id, title })
          setSessions((current) => current.map((item) => (item.id === session.id ? { ...item, ...updated } : item)))
          setActiveSession((current) => (current !== null && current.id === session.id ? { ...current, ...updated } : current))
        } catch (failure) {
          setError(t('panel.error').replace('{message}', String(failure.message ?? failure)))
        }
      }

      async function deleteSession(session) {
        setConfirmId('')
        try {
          await api('deleteChatSession', { sessionId: session.id })
          setSessions((current) => current.filter((item) => item.id !== session.id))
          if (activeSessionRef.current?.id === session.id) newChatSession()
          toast(t('panel.deleteChat'))
        } catch (failure) {
          setError(t('panel.error').replace('{message}', String(failure.message ?? failure)))
        }
      }

      function composerKeyDown(event) {
        if (event.key === 'Escape' && streaming) {
          event.preventDefault()
          stopActiveRun()
          return
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
          event.preventDefault()
          void send()
        }
      }

      const filtered = sessions.filter((session) => {
        if (search.trim() === '') return true
        const needle = search.trim().toLowerCase()
        return session.id.toLowerCase().includes(needle) || titleOfSession(session).toLowerCase().includes(needle)
      })
      const modelLabel = (config?.model ?? '') !== '' ? config.model : (models[0] ?? t('panel.modelDefault'))
      const quickPrompts = Array.isArray(config?.quickPrompts)
        ? config.quickPrompts.filter((prompt) => typeof prompt === 'string' && prompt.trim() !== '')
        : []
      const activeTitle = activeSession === null ? '' : titleOfSession(activeSession)
      const sessionId = activeSession?.id ?? ''
      const liveVisible = liveRun !== null
        && (liveRun.pending || liveRun.error !== '' || liveRun.stopped || liveRun.completedSuccess === true)
      const renderedMessages = messages.map((message) => h(MessageView, {
        key: message.id,
        message,
        t,
        display: config?.activityDisplay ?? 'compact',
      }))
      if (liveVisible) {
        renderedMessages.push(h(MessageView, {
          key: liveRun.assistantId,
          message: {
            id: liveRun.assistantId,
            role: 'assistant',
            content: liveRun.content,
            reasoning: liveRun.reasoning,
            toolEvents: liveRun.toolEvents,
            pending: liveRun.pending,
          },
          t,
          display: config?.activityDisplay ?? 'compact',
        }))
      }
      const shownError = error !== '' ? error : (liveRun?.error ?? '')

      return h('div', { className: 'dhn-page' },
        h('div', { className: 'dhn-page-head' },
          h('img', { src: ICON_URL, alt: '' }),
          h('span', { className: 'dhn-page-title' }, t('panel.title')),
          activeSession !== null ? h('span', { className: 'dhn-page-sub' }, `· ${activeTitle}`) : null,
          activeSession !== null
            ? h('span', { className: 'dhn-session-chip', title: sessionId },
                h('span', null, shortSessionId(sessionId)),
                h('button', {
                  type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--ghost',
                  onClick: () => { if (copyText(sessionId)) toast(t('panel.copied')) },
                  title: t('panel.copy'),
                }, t('panel.copy')),
              )
            : h('span', { className: 'dhn-note' }, t('panel.newSessionHint')),
          h('span', { className: 'dhn-page-spacer' }),
          h('span', { className: 'dhn-meta', title: models.join(', ') }, modelLabel),
          h('button', { type: 'button', className: 'dhn-btn', onClick: () => { setDrawer((value) => !value); if (!drawer) void refreshSessions({ reset: true }) } }, t('panel.history')),
          h('button', { type: 'button', className: 'dhn-btn dhn-btn--primary', onClick: newChatSession }, `＋ ${t('panel.newChat')}`),
        ),
        h('div', { className: 'dhn-page-body' },
          drawer ? h('div', { className: 'dhn-drawer' },
            h('div', { className: 'dhn-drawer-head' },
              h('div', { className: 'dhn-row' },
                h('input', {
                  className: 'dhn-input', style: { flex: 1 }, placeholder: t('panel.searchPlaceholder'),
                  value: search, onChange: (event) => setSearch(event.target.value),
                }),
                h('button', { type: 'button', className: 'dhn-btn', disabled: sessionsLoading, onClick: () => void refreshSessions({ reset: true }) }, t('panel.refresh')),
              ),
              h('span', { className: 'dhn-note' }, `${sessions.length} 个会话`),
            ),
            h('div', { className: 'dhn-drawer-list' },
              filtered.length === 0 && !sessionsLoading ? h('span', { className: 'dhn-note', style: { padding: 10 } }, t('panel.noChats')) : null,
              filtered.map((session) => h('div', {
                key: session.id,
                className: activeSession?.id === session.id ? 'dhn-chat-row dhn-chat-row--active' : 'dhn-chat-row',
                onClick: () => { setDrawer(false); setSearch(''); void openSession(session.id) },
              },
                h('div', { className: 'dhn-chat-row-main' },
                  editingId === session.id
                    ? h('input', {
                        className: 'dhn-input', style: { height: 26, fontSize: 13 },
                        autoFocus: true, value: editingTitle,
                        onChange: (event) => setEditingTitle(event.target.value),
                        onClick: (event) => event.stopPropagation(),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); void renameSession(session) }
                          if (event.key === 'Escape') { event.preventDefault(); setEditingId('') }
                        },
                        onBlur: () => void renameSession(session),
                      })
                    : h('span', { className: 'dhn-chat-row-title', title: titleOfSession(session) }, titleOfSession(session)),
                  h('span', { className: 'dhn-chat-row-sub' },
                    h('span', { className: 'dhn-chat-row-id', title: session.id }, shortSessionId(session.id)),
                    h('span', null, '·'),
                    h('span', null, `${session.messageCount} 条`),
                    session.lastActive ? h('span', null, `· ${formatRelative(session.lastActive)}`) : null,
                  ),
                ),
                h('div', { className: 'dhn-chat-row-actions' },
                  h('button', {
                    type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--ghost', title: t('panel.copy'),
                    onClick: (event) => { event.stopPropagation(); if (copyText(session.id)) toast(t('panel.copied')) },
                  }, '⧉'),
                  h('button', {
                    type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--ghost', title: t('panel.rename'),
                    onClick: (event) => { event.stopPropagation(); setEditingId(session.id); setEditingTitle(titleOfSession(session)) },
                  }, '✎'),
                  confirmId === session.id
                    ? h('button', {
                        type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--danger',
                        onClick: (event) => { event.stopPropagation(); void deleteSession(session) },
                      }, t('panel.confirmDelete'))
                    : h('button', {
                        type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--ghost', title: t('panel.deleteChat'),
                        onClick: (event) => { event.stopPropagation(); setConfirmId(session.id) },
                      }, '🗑'),
                ),
              )),
              hasMore ? h('button', {
                type: 'button', className: 'dhn-btn', style: { margin: 8 },
                disabled: sessionsLoading,
                onClick: () => void refreshSessions(),
              }, t('panel.loadMore')) : null,
            ),
          ) : null,
          h('div', { className: 'dhn-chat-col' },
            h('div', { className: 'dhn-scroll', ref: scrollRef, onScroll },
              loadingSession
                ? h('div', { className: 'dhn-empty' }, h('span', { className: 'dhn-note' }, t('panel.loading')))
                : (messages.length === 0 && !liveVisible
                  ? h('div', { className: 'dhn-empty' },
                      h('img', { src: ICON_URL, alt: '', style: { width: 40, height: 40 } }),
                      h('div', { className: 'dhn-empty-title' }, t('panel.title')),
                      h('div', { className: 'dhn-note' }, t('panel.empty')),
                      quickPrompts.length > 0
                        ? h('div', { className: 'dhn-suggest' },
                            quickPrompts.map((suggestion, index) => h('button', {
                              key: `suggest-${index}`,
                              type: 'button',
                              onClick: () => { setDraft(suggestion); composerRef.current?.focus?.() },
                            }, suggestion)),
                          )
                        : null,
                      sessionId !== '' ? h('div', { className: 'dhn-note' }, `${t('panel.sessionHint')}: ${sessionId}`) : null,
                    )
                  : renderedMessages)),
            showJump ? h('button', {
              type: 'button', className: 'dhn-jump dhn-btn', onClick: () => {
                const node = scrollRef.current
                if (node !== null) node.scrollTop = node.scrollHeight
                stickRef.current = true
                setShowJump(false)
              },
            }, `↓ ${t('panel.jump')}`) : null,
            shownError !== '' ? h('div', { className: 'dhn-banner dhn-banner--error' }, h('span', null, shownError), h('button', {
              type: 'button', className: 'dhn-btn dhn-btn--sm', onClick: () => setError(''),
            }, '×')) : null,
            pendingApproval !== null
              ? h('div', { className: 'dhn-banner dhn-banner--approval' },
                  h('span', null, t('panel.approval')),
                  h('div', { className: 'dhn-approval-actions' },
                    h('button', { type: 'button', className: 'dhn-btn dhn-btn--sm', onClick: () => void respondApproval('once') }, t('panel.approveOnce')),
                    h('button', { type: 'button', className: 'dhn-btn dhn-btn--sm', onClick: () => void respondApproval('session') }, t('panel.approveSession')),
                    h('button', { type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--primary', onClick: () => void respondApproval('always') }, t('panel.approveAlways')),
                    h('button', { type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--danger', onClick: () => void respondApproval('deny') }, t('panel.deny')),
                  ),
                )
              : null,
            h('div', { className: 'dhn-composer' },
              h('input', {
                ref: fileInputRef,
                type: 'file',
                multiple: true,
                className: 'dhn-file-input',
                onChange: (event) => {
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  void addFiles(files)
                },
              }),
              attachments.length > 0
                ? h('div', { className: 'dhn-attachments', style: { padding: 0, margin: 0 } }, attachments.map((file) => h('span', {
                    key: file.path,
                    className: 'dhn-attach',
                    title: file.path,
                  },
                    h('span', { className: 'dhn-attach-name' }, file.name),
                    h('span', { className: 'dhn-attach-meta' }, `${Math.max(1, Math.round((file.size ?? 0) / 1024))} KB`),
                    h('button', {
                      type: 'button', className: 'dhn-btn dhn-btn--sm dhn-btn--ghost',
                      title: t('panel.removeAttachment'),
                      onClick: () => removeAttachment(file.path),
                    }, '×'),
                  )))
                : null,
              h('textarea', {
                ref: composerRef,
                placeholder: t('panel.placeholder'),
                value: draft,
                onChange: (event) => setDraft(event.target.value),
                onKeyDown: composerKeyDown,
                disabled: streaming,
                rows: 2,
              }),
              h('div', { className: 'dhn-composer-bar' },
                h('button', {
                  type: 'button',
                  className: 'dhn-btn',
                  disabled: streaming || uploading,
                  title: t('panel.attachHint'),
                  onClick: () => fileInputRef.current?.click?.(),
                }, uploading ? t('panel.uploading') : `📎 ${t('panel.attach')}`),
                h('span', { className: 'dhn-meta' },
                  usage !== null ? t('panel.usage').replace('{input}', String(usage.input)).replace('{output}', String(usage.output)) : modelLabel),
                h('span', { className: 'dhn-page-spacer' }),
                streaming
                  ? h('button', { type: 'button', className: 'dhn-btn', onClick: () => stopActiveRun() }, t('panel.stop'))
                  : h('button', { type: 'button', className: 'dhn-btn dhn-btn--primary', disabled: draft.trim() === '' || uploading, onClick: () => void send() }, t('panel.send')),
              ),
            ),
          ),
        ),
      )
    }

    function HermesSidebarIcon({ size }) {
      const dimension = typeof size === 'number' && size > 0 ? size : 18
      return h('img', { src: ICON_URL, alt: 'Hermes Nook', style: { width: dimension, height: dimension, objectFit: 'contain' } })
    }

    // ---------------------------------------------------------------- plugin
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ensureStyles()
        ctx.effect(() => ctx.locale.register('hermesBridge', { zh, en }), 'dsh-hermes-nook: locale')
        const t = ctx.locale.bind('hermesBridge')

        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'hermes-nook',
          order: 30,
          label: t('settings.section'),
        }, (props) => h(SettingsSection, { ...props, t }))), 'dsh-hermes-nook: settings section')

        if (typeof ctx.inject === 'function') {
          ctx.inject(['layout'], (pageCtx) => {
            const pageSlots = pageCtx.slots
            const layout = pageCtx.layout
            if (pageSlots === undefined || layout === undefined) return undefined
            const stopMain = pageSlots.inject('main', () => pageSlots.register({
              name: 'main',
              key: PANEL_ID,
            }, (props) => h(HermesPanel, { ...props, t, ctx })))
            const stopSidebar = pageSlots.inject('sidebar.panellist', () => pageSlots.register({
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 8,
              label: 'Hermes',
            }, HermesSidebarIcon))
            return () => { stopMain(); stopSidebar() }
          })
        }
      },
    }
  },
})
