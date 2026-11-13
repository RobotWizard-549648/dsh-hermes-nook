/**
 * dsh-hermes-nook — Host half.
 *
 * Serves the standalone Hermes chat panel: a loopback API for the browser half
 * and a proxy for Hermes gateway sessions / runs / SSE. No Harness tools,
 * commands, system prompts, LLM providers or session bindings are involved.
 *
 * State lives under $DSH_PROFILE_DIR/dsh-hermes-nook/state.json:
 *   - secrets:    API key saved by the settings page
 *   - liveConfig: hot-applied settings (model / activityDisplay / quickPrompts / autoApproveTools)
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, promises as fsPromises } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'

const PLUGIN = 'hermes-nook'
const ROUTE = '/hermes-nook/api'
const MAX_BODY_BYTES = 40 * 1024 * 1024
const DEFAULT_STATE = () => ({ version: 2, secrets: {}, liveConfig: {} })

const DEFAULT_CONFIG = {
  endpoint: 'http://127.0.0.1:8642',
  // Leave blank to auto-detect the WSL distribution / user / home that owns ~/.hermes.
  wslDistro: '',
  wslUser: '',
  wslHome: '',
  hermesRuntime: 'auto',
  timeoutMs: 900000,
  apiKey: '',
  apiKeyEnv: 'HERMES_API_KEY',
  model: '',
  autoApproveTools: true,
  activityDisplay: 'compact',
  quickPrompts: [],
}

const CONFIG_KEYS = [
  'endpoint', 'wslDistro', 'wslUser', 'wslHome', 'hermesRuntime', 'timeoutMs', 'apiKey', 'apiKeyEnv',
  'model', 'autoApproveTools', 'activityDisplay', 'quickPrompts',
]

// Settings that can be applied live without editing the profile patch (which
// restarts the plugin and would blank an open settings page).
const HOT_CONFIG_KEYS = new Set(['activityDisplay', 'quickPrompts', 'model', 'autoApproveTools'])

function messageOf(value) {
  return value instanceof Error ? value.message : String(value)
}

function normalizeQuickPrompts(value) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(/\r?\n/) : [])
  return list
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .slice(0, 8)
}

function normalizeActivityDisplay(value) {
  return value === 'detailed' || value === 'hidden' ? value : 'compact'
}

function normalizeRuntime(value) {
  return value === 'wsl' || value === 'native' || value === 'remote' ? value : 'auto'
}

function normalizeConfig(raw) {
  const cfg = { ...DEFAULT_CONFIG }
  if (raw !== null && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (raw[key] !== undefined && raw[key] !== null) cfg[key] = raw[key]
    }
  }
  cfg.timeoutMs = Math.max(5000, Number(cfg.timeoutMs) || DEFAULT_CONFIG.timeoutMs)
  if (typeof cfg.endpoint === 'string') cfg.endpoint = cfg.endpoint.replace(/\/+$/, '')
  cfg.wslDistro = typeof cfg.wslDistro === 'string' ? cfg.wslDistro.trim() : ''
  cfg.wslUser = typeof cfg.wslUser === 'string' ? cfg.wslUser.trim() : ''
  cfg.wslHome = typeof cfg.wslHome === 'string' ? normalizeHomePath(cfg.wslHome) : ''
  cfg.hermesRuntime = normalizeRuntime(cfg.hermesRuntime)
  cfg.model = typeof cfg.model === 'string' ? cfg.model.trim() : ''
  cfg.autoApproveTools = cfg.autoApproveTools !== false
  cfg.activityDisplay = normalizeActivityDisplay(cfg.activityDisplay)
  cfg.quickPrompts = normalizeQuickPrompts(cfg.quickPrompts)
  return cfg
}

// ---------------------------------------------------------------------------
// WSL filesystem helpers

function decodeWslText(buffer) {
  if (typeof buffer === 'string') return buffer
  if (!(buffer instanceof Uint8Array)) return String(buffer ?? '')
  const sample = Math.min(buffer.length, 2048)
  let nulOdd = 0
  let nulEven = 0
  for (let i = 0; i < sample; i += 1) {
    if (buffer[i] !== 0) continue
    if (i % 2 === 0) nulEven += 1
    else nulOdd += 1
  }
  if (nulOdd + nulEven > 0 && Math.max(nulOdd, nulEven) / (nulOdd + nulEven) > 0.9) {
    return Buffer.from(buffer).toString('utf16le')
  }
  return Buffer.from(buffer).toString('utf8')
}

async function readText(path, timeoutMs = 3000) {
  let settled = false
  const data = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(null)
    }, timeoutMs)
    fsPromises.readFile(path).then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
  if (data === null) return null
  return decodeWslText(data)
}

function parseDotEnv(text) {
  const values = {}
  if (typeof text !== 'string') return values
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

const WSL_UNC_PREFIX = '\\\\wsl.localhost'

function normalizeHomePath(value) {
  const home = String(value ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (home === '') return ''
  return home.startsWith('/') ? home : `/${home}`
}

function wslUncHome(distro, home) {
  return `${WSL_UNC_PREFIX}\\${distro}${home.replace(/\//g, '\\')}`
}

function decodeWslOutput(output) {
  const buffer = Buffer.isBuffer(output) ? output : Buffer.from(String(output ?? ''))
  const utf8 = buffer.toString('utf8')
  const text = utf8.includes('\u0000') ? buffer.toString('utf16le') : utf8
  return text.replace(/\u0000/g, '').replace(/^\uFEFF/, '')
}

async function listWslDistros() {
  return await new Promise((resolve) => {
    try {
      execFile('wsl.exe', ['-l', '-q'], { timeout: 5000, windowsHide: true }, (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        const names = decodeWslOutput(stdout).split(/\r?\n/).map((name) => name.trim()).filter((name) => name !== '' && name !== '*')
        resolve([...new Set(names)])
      })
    } catch {
      resolve([])
    }
  })
}

async function safeListDirectories(path) {
  const entries = await Promise.race([
    fsPromises.readdir(path, { withFileTypes: true }).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
  ])
  if (!Array.isArray(entries)) return []
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

async function pathExists(path) {
  try {
    await fsPromises.access(path)
    return true
  } catch {
    return false
  }
}

let wslTargetCache = { key: '', at: 0, value: null }

/**
 * Resolve the WSL distribution/home that owns the Hermes install. Everything is
 * optional: wslDistro / wslUser / wslHome may all be blank (auto-detect).
 */
async function resolveWslTarget(cfg, force = false) {
  const cacheKey = [cfg.wslDistro, cfg.wslUser, cfg.wslHome].join('|')
  if (!force && wslTargetCache.key === cacheKey && Date.now() - wslTargetCache.at < 60000) return wslTargetCache.value

  const explicitHome = normalizeHomePath(cfg.wslHome) || (cfg.wslUser.trim() !== '' ? `/home/${cfg.wslUser.trim()}` : '')
  const distros = cfg.wslDistro.trim() !== '' ? [cfg.wslDistro.trim()] : await listWslDistros()
  let resolved = null

  for (const distro of distros.slice(0, 8)) {
    let homes = []
    if (explicitHome !== '') {
      homes = [explicitHome]
    } else {
      const entries = await safeListDirectories(`${WSL_UNC_PREFIX}\\${distro}\\home`)
      homes = entries.map((name) => `/home/${name}`)
    }
    const withHermes = []
    for (const home of homes) {
      const uncHome = wslUncHome(distro, home)
      if (await pathExists(join(uncHome, '.hermes'))) withHermes.push({ distro, home, uncHome })
    }
    if (withHermes.length > 0) {
      resolved = withHermes[0]
      break
    }
    if (explicitHome !== '' && homes[0] === explicitHome) {
      resolved = { distro, home: explicitHome, uncHome: wslUncHome(distro, explicitHome) }
      break
    }
  }

  wslTargetCache = { key: cacheKey, at: Date.now(), value: resolved }
  return resolved
}

function nativeHermesHome() {
  const fromEnv = typeof process.env.HERMES_HOME === 'string' ? process.env.HERMES_HOME.trim() : ''
  return fromEnv !== '' ? fromEnv : join(homedir(), '.hermes')
}

async function readNativeHermesEnvFile() {
  return parseDotEnv(await readText(join(nativeHermesHome(), '.env')))
}

async function readNativeHermesConfigFile() {
  return await readText(join(nativeHermesHome(), 'config.yaml'))
}

function parseHermesEnvText(text) {
  return parseDotEnv(text)
}

async function readWslHermesEnvFile(cfg) {
  const target = await resolveWslTarget(cfg)
  if (target === null) return {}
  return parseHermesEnvText(await readText(join(target.uncHome, '.hermes', '.env')))
}

async function readHermesEnvKeyInfo(cfg) {
  const runtime = normalizeRuntime(cfg.hermesRuntime)
  if (runtime === 'remote') return { value: '', source: '' }
  if (runtime !== 'native') {
    const wsl = await readWslHermesEnvFile(cfg)
    if (typeof wsl.API_SERVER_KEY === 'string' && wsl.API_SERVER_KEY.trim() !== '') {
      return { value: wsl.API_SERVER_KEY.trim(), source: 'wsl-env-file' }
    }
  }
  if (runtime !== 'wsl') {
    const native = await readNativeHermesEnvFile()
    if (typeof native.API_SERVER_KEY === 'string' && native.API_SERVER_KEY.trim() !== '') {
      return { value: native.API_SERVER_KEY.trim(), source: 'native-env-file' }
    }
  }
  return { value: '', source: '' }
}

function extractApiServerBlock(text) {
  if (typeof text !== 'string') return {}
  const lines = text.split(/\r?\n/)
  const result = {}
  for (let i = 0; i < lines.length; i += 1) {
    const header = /^(\s*)api_server:\s*(#.*)?$/.exec(lines[i])
    if (header === null) continue
    const baseIndent = header[1].length
    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = lines[j]
      if (candidate.trim() === '') continue
      const indent = /^\s*/.exec(candidate)[0].length
      if (indent <= baseIndent) break
      const pair = /^\s*([A-Za-z_][A-Za-z0-9_]*):\s*['"]?([^'"#]*?)['"]?\s*(#.*)?$/.exec(candidate)
      if (pair !== null) result[pair[1]] = pair[2].trim()
    }
  }
  return result
}

function endpointHost(host) {
  if (typeof host !== 'string' || host.trim() === '' || host === '0.0.0.0' || host === '::') return '127.0.0.1'
  return host.trim()
}

function endpointIsLocal(endpoint) {
  try {
    const host = new URL(endpoint).hostname.toLowerCase()
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

async function readHermesApiConfig(cfg) {
  const runtime = normalizeRuntime(cfg.hermesRuntime)
  const target = runtime === 'native' ? null : await resolveWslTarget(cfg)
  const useWsl = runtime === 'wsl' || (runtime !== 'native' && target !== null)
  const wslEnv = target === null ? {} : parseHermesEnvText(await readText(join(target.uncHome, '.hermes', '.env')))
  const nativeEnv = await readNativeHermesEnvFile()
  const env = useWsl ? wslEnv : nativeEnv
  const yaml = useWsl
    ? (target === null ? null : await readText(join(target.uncHome, '.hermes', 'config.yaml')))
    : await readNativeHermesConfigFile()
  const block = extractApiServerBlock(yaml ?? '')
  const port = Number(env.API_SERVER_PORT ?? block.port ?? 0) || 8642
  const host = endpointHost(env.API_SERVER_HOST ?? block.host ?? '127.0.0.1')
  const enabled = String(env.API_SERVER_ENABLED ?? block.enabled ?? 'true').toLowerCase() !== 'false'
  const key = env.API_SERVER_KEY ?? block.key ?? ''
  return { env, block, port, host, enabled, key, source: useWsl ? 'wsl' : 'native', wslTarget: useWsl ? target : null }
}

// ---------------------------------------------------------------------------
// state store

function createStore(ctx) {
  const base = process.env.DSH_PROFILE_DIR || process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(base, PLUGIN)
  const file = join(dir, 'state.json')
  let data = DEFAULT_STATE()
  try {
    mkdirSync(dir, { recursive: true })
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      if (parsed !== null && typeof parsed === 'object') {
        // Only current fields are kept; legacy bridge keys are dropped on the next save.
        data = {
          version: 2,
          secrets: parsed.secrets !== null && typeof parsed.secrets === 'object' ? parsed.secrets : {},
          liveConfig: parsed.liveConfig !== null && typeof parsed.liveConfig === 'object' ? parsed.liveConfig : {},
        }
      }
    }
  } catch {
    data = DEFAULT_STATE()
  }

  let queue = Promise.resolve()

  function save() {
    try {
      mkdirSync(dir, { recursive: true })
      const tmp = `${file}.tmp`
      writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
      renameSync(tmp, file)
    } catch (error) {
      ctx.logger?.warn?.(`dsh-hermes-nook: state save failed: ${messageOf(error)}`)
    }
  }

  function update(mutator) {
    const run = queue.then(async () => {
      const value = await mutator(data)
      save()
      return value
    })
    queue = run.catch(() => {})
    return run
  }

  return { dir, file, get data() { return data }, save, update }
}

// ---------------------------------------------------------------------------
// Hermes HTTP client

class HermesError extends Error {
  constructor(message, info = {}) {
    super(message)
    this.name = 'HermesError'
    this.status = info.status
    this.code = info.code
    this.body = info.body
  }
}

function actionable(error) {
  const code = error?.code ?? ''
  const status = Number(error?.status) || 0
  const text = messageOf(error)
  if (code === 'connection') return `${text}。请检查 WSL 里 gateway 是否在运行：hermes gateway status（必要时 hermes gateway run），以及 127.0.0.1:8642 是否可达。`
  if (status === 401 || code === 'gateway_auth_failed') return 'Hermes API key 缺失或无效：检查 ~/.hermes/.env 的 API_SERVER_KEY，或在设置页填写。'
  if (code === 'session_not_found' || status === 404) return '该 Hermes 会话不存在（可能被删除）。'
  if (code === 'session_active_turn' || status === 409) return '该 Hermes 会话正在执行另一轮，请稍后再试。'
  if (status === 429 || code === 'rate_limit_exceeded') return 'Hermes 并发上限已到，稍等几秒再试。'
  if (code === 'timeout' || /timeout/i.test(text)) return 'Hermes 请求超时；任务可能仍在运行，可稍后刷新历史。'
  return text
}

function createHermesClient({ cfg, getKey, invalidateKey }) {
  async function request(path, options = {}) {
    const { method = 'GET', body, signal, timeoutMs = 20000, auth = true, retryAuth = true } = options
    const key = auth ? await getKey() : ''
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('timeout')), Math.max(1000, timeoutMs))
    const onAbort = () => controller.abort(new Error('aborted'))
    if (signal !== undefined) {
      if (signal.aborted) controller.abort(new Error('aborted'))
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    let response
    let text = ''
    try {
      response = await fetch(`${cfg.endpoint}${path}`, {
        method,
        headers: {
          ...(key !== '' ? { authorization: `Bearer ${key}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      text = await response.text()
    } catch (error) {
      if (signal?.aborted) throw new HermesError('已取消', { code: 'cancelled' })
      if (error?.name === 'AbortError') throw new HermesError(`Hermes 请求超时（${Math.round(timeoutMs / 1000)}s）`, { code: 'timeout' })
      throw new HermesError(`无法连接 Hermes（${cfg.endpoint}）：${messageOf(error)}`, { code: 'connection' })
    } finally {
      clearTimeout(timer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
    }

    let json = null
    try { json = text === '' ? null : JSON.parse(text) } catch { json = null }

    if (!response.ok) {
      const code = json?.error?.code ?? json?.error?.type ?? `http_${response.status}`
      const message = json?.error?.message ?? (text === '' ? `HTTP ${response.status}` : text.slice(0, 300))
      if (response.status === 401 && retryAuth && auth) {
        await invalidateKey()
        return request(path, { ...options, retryAuth: false })
      }
      throw new HermesError(message, { status: response.status, code, body: json })
    }
    return json ?? text
  }

  function sessionPath(id, suffix = '') {
    return `/api/sessions/${encodeURIComponent(id)}${suffix}`
  }

  return {
    async health() {
      const started = Date.now()
      const value = await request('/health', { auth: false, timeoutMs: 5000 })
      return { ...value, latencyMs: Date.now() - started }
    },
    capabilities() { return request('/v1/capabilities', { timeoutMs: 8000 }) },
    models() { return request('/v1/models', { timeoutMs: 8000 }) },
    listSessions(query = '') { return request(`/api/sessions${query}`, { timeoutMs: 10000 }) },
    createSession(body) { return request('/api/sessions', { method: 'POST', body, timeoutMs: 10000 }) },
    getSession(id) { return request(sessionPath(id), { timeoutMs: 8000 }) },
    patchSession(id, body) { return request(sessionPath(id), { method: 'PATCH', body, timeoutMs: 8000 }) },
    deleteSession(id) { return request(sessionPath(id), { method: 'DELETE', timeoutMs: 10000 }) },
    messages(id, query = '') { return request(sessionPath(id, `/messages${query}`), { timeoutMs: 15000 }) },
    startRun(body) { return request('/v1/runs', { method: 'POST', body, timeoutMs: 30000 }) },
    stopRun(runId) { return request(`/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', timeoutMs: 10000 }) },
    approveRun(runId, body) { return request(`/v1/runs/${encodeURIComponent(runId)}/approval`, { method: 'POST', body, timeoutMs: 10000 }) },
    runEventsUrl(runId) { return `${cfg.endpoint}/v1/runs/${encodeURIComponent(runId)}/events` },
  }
}

// ---------------------------------------------------------------------------
// Host plugin

export const name = 'hermes-nook'

export function apply(ctx, rawConfig) {
  const cfg = normalizeConfig(rawConfig)
  const logger = ctx.logger
  const store = createStore(ctx)

  // ---- API key resolution -------------------------------------------------
  let keyCache = { value: '', source: '', at: 0, resolved: false }

  async function resolveKey(force = false) {
    if (!force && keyCache.resolved && Date.now() - keyCache.at < 30000) return keyCache
    let source = ''
    let value = ''
    if (typeof store.data.secrets.apiKey === 'string' && store.data.secrets.apiKey !== '') {
      value = store.data.secrets.apiKey
      source = 'plugin-state'
    } else if (typeof cfg.apiKey === 'string' && cfg.apiKey !== '') {
      value = cfg.apiKey
      source = 'config'
    } else if (typeof process.env[cfg.apiKeyEnv] === 'string' && process.env[cfg.apiKeyEnv] !== '') {
      value = process.env[cfg.apiKeyEnv]
      source = 'env'
    } else {
      const fromEnvFile = endpointIsLocal(cfg.endpoint) ? await readHermesEnvKeyInfo(cfg) : { value: '', source: '' }
      if (fromEnvFile.value !== '') {
        value = fromEnvFile.value
        source = fromEnvFile.source
      }
    }
    keyCache = { value, source, at: Date.now(), resolved: true }
    return keyCache
  }

  async function getKey() {
    return (await resolveKey()).value
  }

  async function getKeyInfo() {
    const found = await resolveKey()
    return {
      configured: found.value !== '',
      source: found.source,
      fromConfig: typeof cfg.apiKey === 'string' && cfg.apiKey !== '',
    }
  }

  async function invalidateKey() {
    keyCache = { value: '', source: '', at: 0, resolved: false }
    await resolveKey(true)
  }

  const client = createHermesClient({ cfg, getKey, invalidateKey })

  // ---- live config overlay ------------------------------------------------
  function liveConfigValue(key) {
    const live = store.data.liveConfig
    return live !== null && typeof live === 'object' ? live[key] : undefined
  }

  function effectiveConfigValue(key) {
    const live = liveConfigValue(key)
    return live !== undefined ? live : cfg[key]
  }

  function effectiveQuickPrompts() {
    return normalizeQuickPrompts(effectiveConfigValue('quickPrompts'))
  }

  function effectiveActivityDisplay() {
    return normalizeActivityDisplay(effectiveConfigValue('activityDisplay'))
  }

  function effectiveAutoApproveTools() {
    return effectiveConfigValue('autoApproveTools') !== false
  }

  // ---- chat sessions / runs / attachments ---------------------------------
  function normalizeChatSession(raw) {
    if (raw === null || typeof raw !== 'object') return null
    const id = typeof raw.id === 'string' ? raw.id : (typeof raw.session_id === 'string' ? raw.session_id : '')
    if (id === '') return null
    const startedAt = Number(raw.started_at ?? raw.startedAt ?? 0) || 0
    const lastActive = Number(raw.last_active ?? raw.lastActive ?? raw.updated_at ?? 0) || startedAt
    return {
      id,
      title: typeof raw.title === 'string' ? raw.title : '',
      model: typeof raw.model === 'string' ? raw.model : '',
      source: typeof raw.source === 'string' ? raw.source : '',
      startedAt,
      lastActive,
      messageCount: Number(raw.message_count ?? raw.messageCount ?? 0) || 0,
      toolCallCount: Number(raw.tool_call_count ?? 0) || 0,
      endReason: typeof raw.end_reason === 'string' ? raw.end_reason : '',
      inputTokens: Number(raw.input_tokens ?? 0) || 0,
      outputTokens: Number(raw.output_tokens ?? 0) || 0,
    }
  }

  function extractSessionPayload(response) {
    return response?.session ?? response ?? null
  }

  function requireSessionId(value) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (id === '') throw new Error('需要 sessionId')
    return id
  }

  function messageContentText(message) {
    if (typeof message?.content === 'string') return message.content
    if (Array.isArray(message?.content)) {
      return message.content.map((part) => (typeof part?.text === 'string' ? part.text : '')).filter((part) => part !== '').join('\n')
    }
    if (message?.content !== null && typeof message?.content === 'object' && typeof message.content.text === 'string') return message.content.text
    return ''
  }

  function normalizeChatMessage(raw) {
    if (raw === null || typeof raw !== 'object') return null
    const role = raw.role === 'assistant' ? 'assistant' : (raw.role === 'user' ? 'user' : '')
    if (role === '') return null
    const content = messageContentText(raw)
    if (content === '') return null
    const timestamp = Number(raw.created_at ?? raw.timestamp ?? raw.started_at ?? 0) || 0
    const id = typeof raw.id === 'string' ? raw.id : `${role}-${timestamp}-${content.length}`
    return { id, role, content, timestamp }
  }

  async function listChatSessions(params = {}) {
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50))
    const offset = Math.max(0, Number(params.offset) || 0)
    const page = await client.listSessions(`?source=api_server&limit=${limit}&offset=${offset}`)
    const rows = Array.isArray(page?.data) ? page.data : (Array.isArray(page?.sessions) ? page.sessions : [])
    const sessions = rows.map(normalizeChatSession).filter((session) => session !== null)
    sessions.sort((a, b) => b.lastActive - a.lastActive)
    const total = Number(page?.total ?? 0) || sessions.length
    const hasMore = typeof page?.has_more === 'boolean'
      ? page.has_more
      : (typeof page?.total === 'number' ? offset + rows.length < page.total : rows.length >= limit)
    return { sessions, hasMore, total }
  }

  async function createChatSession(params = {}) {
    const title = typeof params.title === 'string' ? params.title.trim().slice(0, 120) : ''
    const response = await client.createSession(title === '' ? {} : { title })
    const session = normalizeChatSession(extractSessionPayload(response))
    if (session === null) throw new HermesError('Hermes 未返回会话 id', { code: 'create_failed' })
    return session
  }

  async function getChatSession(params = {}) {
    const sessionId = requireSessionId(params.sessionId)
    const session = normalizeChatSession(extractSessionPayload(await client.getSession(sessionId)))
    if (session === null) throw new HermesError('会话不存在', { code: 'not_found' })
    return session
  }

  async function getChatMessages(params = {}) {
    const sessionId = requireSessionId(params.sessionId)
    const limit = Math.min(500, Math.max(1, Number(params.limit) || 200))
    const offset = Math.max(0, Number(params.offset) || 0)
    const order = params.order === 'oldest' ? 'oldest' : 'latest'
    const page = await client.messages(sessionId, `?limit=${limit}&offset=${offset}&order=${order}`)
    const rows = Array.isArray(page?.data) ? page.data : (Array.isArray(page?.messages) ? page.messages : [])
    const messages = rows.map(normalizeChatMessage).filter((message) => message !== null)
    if (messages.length > 0 && messages.every((message) => message.timestamp === 0) && order === 'latest') messages.reverse()
    messages.sort((a, b) => a.timestamp - b.timestamp)
    return { messages, hasMore: page?.has_more === true || rows.length >= limit }
  }

  async function renameChatSession(params = {}) {
    const sessionId = requireSessionId(params.sessionId)
    const title = typeof params.title === 'string' ? params.title.trim().slice(0, 120) : ''
    if (title === '') throw new Error('标题不能为空')
    const response = await client.patchSession(sessionId, { title })
    return normalizeChatSession(extractSessionPayload(response)) ?? { id: sessionId, title }
  }

  async function deleteChatSession(params = {}) {
    const sessionId = requireSessionId(params.sessionId)
    await client.deleteSession(sessionId)
    return { deleted: true, sessionId }
  }

  async function startChatRun(params) {
    const input = typeof params?.input === 'string' ? params.input.trim() : ''
    if (input === '') throw new Error('消息不能为空')
    const sessionId = typeof params?.sessionId === 'string' ? params.sessionId.trim() : ''
    const body = { input }
    if (sessionId !== '') body.session_id = sessionId
    const attachments = Array.isArray(params?.attachments)
      ? params.attachments
        .map((value) => (typeof value === 'string' ? value : (typeof value?.path === 'string' ? value.path : '')))
        .filter((value) => value !== '')
      : []
    if (attachments.length > 0) {
      body.instructions = [
        'The user attached the following local files to this turn:',
        ...attachments.map((path, index) => `${index + 1}. ${path}`),
        'Read these files with your file or terminal tools before answering the user.',
      ].join('\n')
    }
    const configuredModel = effectiveConfigValue('model')
    const model = typeof params?.model === 'string' && params.model.trim() !== ''
      ? params.model.trim()
      : (typeof configuredModel === 'string' ? configuredModel.trim() : '')
    if (model !== '') body.model = model
    const response = await client.startRun(body)
    const runId = typeof response?.run_id === 'string' ? response.run_id : ''
    if (runId === '') throw new HermesError('Hermes 没有返回 run_id', { code: 'run_not_started' })
    return { runId, sessionId: sessionId !== '' ? sessionId : (typeof response?.session_id === 'string' ? response.session_id : '') }
  }

  async function stopChatRun(runId) {
    if (typeof runId !== 'string' || runId === '') throw new Error('缺少 runId')
    return client.stopRun(runId)
  }

  async function approveChatRun(runId, choice, extra = {}) {
    if (typeof runId !== 'string' || runId === '') throw new Error('缺少 runId')
    const allowed = new Set(['once', 'session', 'always', 'deny'])
    const body = { choice: allowed.has(choice) ? choice : 'always', resolve_all: true }
    if (typeof extra.requestId === 'string' && extra.requestId !== '') body.request_id = extra.requestId
    if (extra.executionGeneration !== undefined) body.execution_generation = extra.executionGeneration
    return client.approveRun(runId, body)
  }

  function sanitizeAttachmentName(value) {
    const raw = typeof value === 'string' ? value : 'file'
    const base = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim()
    return (base === '' ? 'file' : base).slice(0, 140)
  }

  async function resolveAttachmentTarget() {
    if (!endpointIsLocal(cfg.endpoint)) return null
    const info = await environmentInfo()
    if (info.attachment === 'wsl' && info.wslTarget !== null) {
      return {
        kind: 'wsl',
        dir: join(info.wslTarget.uncHome, '.hermes', 'attachments'),
        hermesBase: `${info.wslTarget.home}/.hermes/attachments`,
      }
    }
    if (info.attachment === 'native' && info.nativeHome !== null) {
      return { kind: 'native', dir: join(info.nativeHome, 'attachments'), hermesBase: join(info.nativeHome, 'attachments') }
    }
    return null
  }

  async function uploadAttachment(params = {}) {
    const name = sanitizeAttachmentName(params.name)
    const encoded = typeof params.dataBase64 === 'string' ? params.dataBase64 : ''
    if (encoded === '') throw new Error('缺少文件内容')
    const buffer = Buffer.from(encoded, 'base64')
    if (buffer.length === 0) throw new Error('文件为空')
    if (buffer.length > 20 * 1024 * 1024) throw new Error('文件超过 20MB 限制')
    const target = await resolveAttachmentTarget()
    if (target === null) {
      throw new Error(endpointIsLocal(cfg.endpoint)
        ? '无法确定 Hermes 的本地目录：请配置 WSL 信息，或确认本机安装了 Hermes（~/.hermes）'
        : '远程 gateway 模式不支持本地文件附件；请改用本机/WSL 的 Hermes endpoint')
    }
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const directory = join(target.dir, stamp)
    await fsPromises.mkdir(directory, { recursive: true })
    await fsPromises.writeFile(join(directory, name), buffer)
    const hermesPath = target.kind === 'wsl'
      ? `${target.hermesBase}/${stamp}/${name}`
      : join(target.hermesBase, stamp, name)
    return { name, size: buffer.length, path: hermesPath, kind: target.kind }
  }

  // ---- connection diagnostics --------------------------------------------
  async function testConnection() {
    const started = Date.now()
    let health
    try {
      health = await client.health()
    } catch (error) {
      return { online: false, error: actionable(error), endpoint: cfg.endpoint, latencyMs: Date.now() - started }
    }
    let authOk = false
    let capabilities = null
    try {
      capabilities = await client.capabilities()
      authOk = true
    } catch {
      authOk = false
    }
    return {
      online: true,
      version: health?.version ?? '',
      endpoint: cfg.endpoint,
      latencyMs: Date.now() - started,
      authOk,
      features: capabilities?.features ?? null,
      key: await getKeyInfo(),
    }
  }

  async function environmentInfo() {
    const runtime = normalizeRuntime(cfg.hermesRuntime)
    const local = runtime !== 'remote' && endpointIsLocal(cfg.endpoint)
    const wslTarget = local && runtime !== 'native' ? await resolveWslTarget(cfg) : null
    const nativeHome = nativeHermesHome()
    const nativeExists = await pathExists(nativeHome)
    const nativeAllowed = local && (runtime === 'native' || (runtime === 'auto' && wslTarget === null))
    const attachment = !local ? null : (wslTarget !== null ? 'wsl' : (nativeAllowed && nativeExists ? 'native' : null))
    return {
      wslTarget,
      nativeHome: nativeAllowed && nativeExists ? nativeHome : null,
      nativeExists,
      attachment,
      local,
      runtime,
    }
  }

  async function discover() {
    const runtime = normalizeRuntime(cfg.hermesRuntime)
    if (runtime === 'remote' || !endpointIsLocal(cfg.endpoint)) {
      const remote = { endpoint: cfg.endpoint, source: 'remote', remote: true, foundKey: (await resolveKey()).value !== '' }
      try {
        const health = await client.health()
        remote.online = true
        remote.version = health?.version ?? ''
      } catch {
        remote.online = false
      }
      if (remote.online) {
        try {
          await client.capabilities()
          remote.authOk = true
        } catch {
          remote.authOk = false
        }
      }
      return remote
    }

    const found = await readHermesApiConfig(cfg)
    const endpoint = `http://${found.host}:${found.port}`
    const envInfo = await environmentInfo()
    const result = {
      endpoint,
      foundKey: found.key !== '',
      enabled: found.enabled,
      port: found.port,
      host: found.host,
      keySource: found.key !== '' ? (found.source === 'wsl' ? 'wsl-env-file' : 'native-env-file') : 'none',
      source: found.source,
      wsl: envInfo.wslTarget === null ? null : { distro: envInfo.wslTarget.distro, home: envInfo.wslTarget.home },
      nativeHome: envInfo.nativeHome,
      attachment: envInfo.attachment,
    }
    const probe = createHermesClient({ cfg: { ...cfg, endpoint }, getKey, invalidateKey })
    try {
      const health = await probe.health()
      result.online = true
      result.version = health?.version ?? ''
    } catch {
      result.online = false
    }
    if (result.online) {
      try {
        await probe.capabilities()
        result.authOk = true
      } catch {
        result.authOk = false
      }
    }
    return result
  }

  // ---- settings save ------------------------------------------------------
  async function saveConfig(patch) {
    const hot = {}
    for (const key of CONFIG_KEYS) {
      if (!HOT_CONFIG_KEYS.has(key) || patch?.[key] === undefined) continue
      if (key === 'quickPrompts') hot[key] = normalizeQuickPrompts(patch[key])
      else if (key === 'activityDisplay') hot[key] = normalizeActivityDisplay(patch[key])
      else if (key === 'model') hot[key] = typeof patch[key] === 'string' ? patch[key].trim() : ''
      else if (key === 'autoApproveTools') hot[key] = patch[key] !== false
    }
    if (Object.keys(hot).length > 0) {
      await store.update((data) => {
        data.liveConfig = { ...(data.liveConfig ?? {}), ...hot }
        return data
      })
    }

    const structural = {}
    for (const key of CONFIG_KEYS) {
      if (HOT_CONFIG_KEYS.has(key) || patch?.[key] === undefined) continue
      if (JSON.stringify(patch[key]) !== JSON.stringify(cfg[key])) structural[key] = patch[key]
    }
    if (Object.keys(structural).length === 0) return { saved: true, restart: false, hot: Object.keys(hot) }

    const entry = ctx.fiber?.entry
    const editor = ctx.get('configEditor')
    if (entry === undefined || editor === undefined) throw new Error('当前 profile 无法保存插件配置')
    setTimeout(() => {
      editor.edit(entry, (current) => ({ ...current, ...structural, ...hot })).catch((error) => {
        logger?.warn?.(`dsh-hermes-nook: config save failed: ${messageOf(error)}`)
      })
    }, 50)
    return { saved: true, restart: true, hot: Object.keys(hot) }
  }

  async function saveSecret(apiKey) {
    const value = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (value === '') throw new Error('API key 不能为空')
    await store.update((data) => { data.secrets.apiKey = value })
    keyCache = { value: '', source: '', at: 0, resolved: false }
    return { configured: true }
  }

  async function clearSecret() {
    await store.update((data) => { delete data.secrets.apiKey })
    keyCache = { value: '', source: '', at: 0, resolved: false }
    return { configured: false }
  }

  async function saveSecretFromEnvFile() {
    const found = await readHermesEnvKeyInfo(cfg)
    if (found.value === '') throw new Error('WSL 或本机的 ~/.hermes/.env 中没有 API_SERVER_KEY')
    await store.update((data) => { data.secrets.apiKey = found.value })
    keyCache = { value: '', source: '', at: 0, resolved: false }
    return { configured: true, source: found.source }
  }

  // ---- browser API --------------------------------------------------------
  const methods = {
    getConfig: async () => {
      const envInfo = await environmentInfo()
      return {
        config: {
          endpoint: cfg.endpoint,
          wslDistro: cfg.wslDistro,
          wslUser: cfg.wslUser,
          wslHome: cfg.wslHome,
          hermesRuntime: normalizeRuntime(cfg.hermesRuntime),
          timeoutMs: cfg.timeoutMs,
          model: effectiveConfigValue('model'),
          autoApproveTools: effectiveAutoApproveTools(),
          activityDisplay: effectiveActivityDisplay(),
          quickPrompts: effectiveQuickPrompts(),
          detectedWsl: envInfo.wslTarget === null ? null : { distro: envInfo.wslTarget.distro, home: envInfo.wslTarget.home },
          detectedNativeHome: envInfo.nativeHome,
          attachmentKind: envInfo.attachment,
          localEndpoint: envInfo.local,
        },
        key: await getKeyInfo(),
        stateFile: store.file,
      }
    },
    saveConfig: async (params) => saveConfig(params?.config ?? params),
    saveSecret: async (params) => saveSecret(params?.apiKey),
    saveSecretFromWsl: async () => saveSecretFromEnvFile(),
    clearSecret: async () => clearSecret(),
    discover: async () => discover(),
    testConnection: async () => testConnection(),
    getModels: async () => client.models(),
    listChatSessions: async (params) => listChatSessions(params ?? {}),
    createChatSession: async (params) => createChatSession(params ?? {}),
    getChatSession: async (params) => getChatSession(params ?? {}),
    getChatMessages: async (params) => getChatMessages(params ?? {}),
    renameChatSession: async (params) => renameChatSession(params ?? {}),
    deleteChatSession: async (params) => deleteChatSession(params ?? {}),
    startChatRun: async (params) => startChatRun(params ?? {}),
    stopChatRun: async (params) => stopChatRun(params?.runId),
    approveChatRun: async (params) => approveChatRun(params?.runId, params?.choice, {
      requestId: params?.requestId,
      executionGeneration: params?.executionGeneration,
    }),
    uploadAttachment: async (params) => uploadAttachment(params ?? {}),
  }

  // ---- loopback routes ----------------------------------------------------
  function isLoopback(address) {
    return typeof address === 'string' && (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1')
  }

  function isLoopbackHost(hostHeader) {
    if (typeof hostHeader !== 'string' || hostHeader === '') return false
    const host = hostHeader.split(':')[0].toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
  }

  function sendJson(res, statusCode, value) {
    const body = Buffer.from(JSON.stringify(value), 'utf8')
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length })
    res.end(body)
  }

  async function readBody(req) {
    return await new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          reject(new Error('请求体过大'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch (error) { reject(error) }
      })
      req.on('error', reject)
    })
  }

  let iconBytes = null
  function readIconBytes() {
    if (iconBytes !== null) return iconBytes
    try { iconBytes = readFileSync(new URL('./icon.svg', import.meta.url)) } catch { iconBytes = null }
    return iconBytes
  }

  function registerRoutes(scope) {
    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/hermes-nook/icon.svg',
      handler: (req, res) => {
        if (!isLoopback(req.socket?.remoteAddress)) { res.writeHead(403); res.end(); return }
        const bytes = readIconBytes()
        if (bytes === null) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { 'content-type': 'image/svg+xml', 'content-length': bytes.length, 'cache-control': 'public, max-age=3600' })
        res.end(bytes)
      },
    }), 'dsh-hermes-nook: icon route')

    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: ROUTE,
      handler: async (req, res) => {
        if (!isLoopback(req.socket?.remoteAddress) || !isLoopbackHost(req.headers.host)) {
          sendJson(res, 403, { ok: false, error: 'loopback-only' })
          return
        }
        if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }
        let body
        try { body = await readBody(req) } catch (error) { sendJson(res, 400, { ok: false, error: messageOf(error) }); return }
        const method = typeof body?.method === 'string' ? body.method : ''
        const params = body?.params !== null && typeof body?.params === 'object' ? body.params : {}
        const handler = methods[method]
        if (typeof handler !== 'function') { sendJson(res, 200, { ok: false, error: `未知方法：${method}` }); return }
        try {
          const value = await handler(params)
          sendJson(res, 200, { ok: true, value })
        } catch (error) {
          sendJson(res, 200, { ok: false, error: actionable(error) })
        }
      },
    }), 'dsh-hermes-nook: client api route')

    scope.effect(() => scope.webServer.register({
      kind: 'exact',
      path: '/hermes-nook/run-events',
      handler: async (req, res) => {
        if (!isLoopback(req.socket?.remoteAddress)) { res.writeHead(403); res.end(); return }
        if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
        let runId = ''
        try { runId = new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('runId') ?? '' } catch { runId = '' }
        if (runId === '') { res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); res.end('missing runId'); return }
        const controller = new AbortController()
        req.on('close', () => controller.abort())
        let upstream
        try {
          const key = await getKey()
          upstream = await fetch(client.runEventsUrl(runId), {
            headers: key !== '' ? { authorization: `Bearer ${key}` } : {},
            signal: controller.signal,
          })
        } catch (error) {
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
          res.end(messageOf(error))
          return
        }
        if (!upstream.ok) {
          const text = await upstream.text().catch(() => '')
          res.writeHead(upstream.status, { 'content-type': 'text/plain; charset=utf-8' })
          res.end(text)
          return
        }
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        })
        const reader = upstream.body?.getReader()
        if (reader === undefined) { res.end(); return }
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
          }
        } catch { /* client disconnected */ }
        try { res.end() } catch { /* ignore */ }
      },
    }), 'dsh-hermes-nook: run events proxy')
  }

  // webServer may arrive after this plugin starts; register lazily so the row
  // never sits "pending" during a cold boot.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => registerRoutes(scope))
  }

  logger?.info?.(`dsh-hermes-nook: ready (endpoint=${cfg.endpoint}, state=${store.file})`)
}
