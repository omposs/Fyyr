// ============================================================================================
// The ONLY place that knows the backend URL, holds the session token and calls fetch().
// Everything else imports from ./api.js.
//
// SECURITY NOTE: sessionStorage is readable by any JavaScript running on this origin, so it gives NO protection against XSS.
// The token is never logged, put in a URL, or written to localStorage or any committed file.
// Token storage tradeoff: the backend issues a bearer token (no cookie). It is kept in sessionStorage under one key, so it
// is scoped to this tab, is gone when the tab closes, and is never written to localStorage or a URL. A page reload keeps
// the user signed in. The cost: any script running on this origin could read it, so keep third-party scripts out of the app.
// ============================================================================================

// Set VITE_API_BASE_URL (see .env.example). An empty string means "same origin" (use with a dev proxy).
// (Outside Vite, e.g. the Node test scripts, the same variable is read from the process environment.)
const BASE = String(import.meta.env?.VITE_API_BASE_URL ?? (typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : undefined) ?? 'http://localhost:8000').replace(/\/+$/, '')
export const API_BASE = BASE

const AUTH_KEY = 'fyyr.auth.v1'
const OWNER_KEY = 'fyyr.owner'

// ---- session (token + verified identity) ----
let memo = null
const readRaw = () => { try { return JSON.parse(sessionStorage.getItem(AUTH_KEY)) } catch { return null } }
export function getAuth() {
  const a = memo || readRaw()
  if (!a || !a.token) return null
  if (a.expiresAt && Date.parse(a.expiresAt) <= Date.now()) return null // expired locally: treated as signed out
  return (memo = a)
}
export function setAuth(a) {
  memo = a
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(a)) } catch { /* storage blocked: the session lasts until reload */ }
}

// Everything the app keeps in this browser belongs to the previous account, so it is removed when the account changes or ends.
// (Opportunities, profile and matches are never cached: they are fetched per mount and live only in component state.)
export function wipePrivateData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fyyr.')) localStorage.removeItem(k)
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('fyyr.') && k !== 'fyyr.next' && k !== AUTH_KEY) sessionStorage.removeItem(k)
  } catch { /* ignore */ }
}
export function clearAuth() { memo = null; try { sessionStorage.removeItem(AUTH_KEY) } catch { /* ignore */ } wipePrivateData() }
// Call right after a successful login. If a different company last used this browser, its leftovers are wiped first.
export function claimBrowserFor(memberId) {
  try {
    if (localStorage.getItem(OWNER_KEY) !== String(memberId)) { wipePrivateData(); localStorage.setItem(OWNER_KEY, String(memberId)) }
  } catch { /* ignore */ }
}

const listeners = new Set()
export const onSessionEnded = fn => { listeners.add(fn); return () => listeners.delete(fn) }
function endSession(reason) { const had = !!getAuth(); clearAuth(); if (had) listeners.forEach(f => f(reason)) }
export const expireSession = () => endSession('expired')

// ---- errors ----
// kind: network | timeout | auth (401) | forbidden (403) | notfound (404) | validation (422) | rate (429) | server (5xx) | client (other 4xx)
export class ApiError extends Error {
  constructor(kind, message, extra = {}) { super(message); this.name = 'ApiError'; this.kind = kind; Object.assign(this, extra) }
}

// FastAPI sends { detail: "text" } or { detail: [{ loc: ["body","email"], msg, type }] }.
export function parseDetail(body) {
  const d = body && typeof body === 'object' ? body.detail : undefined
  if (typeof d === 'string') return { message: d, fields: {} }
  if (Array.isArray(d)) {
    const fields = {}
    const parts = d.map(e => {
      const loc = Array.isArray(e?.loc) ? e.loc.filter(x => x !== 'body' && x !== 'query') : []
      const msg = String(e?.msg || 'Invalid value').replace(/^Value error, /, '')
      const f = String(loc[loc.length - 1] ?? '')
      if (f && !(f in fields)) fields[f] = msg
      return f ? `${f}: ${msg}` : msg
    })
    return { message: parts.join('; ') || 'The request was not valid.', fields }
  }
  return { message: '', fields: {} }
}

const FALLBACK = {
  401: 'Your session is not valid. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'Not found.',
  422: 'Some of the information was not valid.',
  429: 'Too many requests. Please wait a moment and try again.',
}
function kindOf(status) { return status === 401 ? 'auth' : status === 403 ? 'forbidden' : status === 404 ? 'notfound' : status === 422 ? 'validation' : status === 429 ? 'rate' : status >= 500 ? 'server' : 'client' }

// Plain-language text for any error, safe to show in the UI.
export function errorText(e) {
  if (!(e instanceof ApiError)) return 'Something went wrong. Please try again.'
  if (e.kind === 'network') return 'Cannot reach the server. Check your connection and that the backend is running, then try again.'
  if (e.kind === 'timeout') return 'The server took too long to answer. Please try again.'
  if (e.kind === 'rate' && e.retryAfter) { const m = Math.ceil(e.retryAfter / 60); return `${e.message || 'Too many attempts.'} Try again in ${m > 1 ? m + ' minutes' : 'about a minute'}.` }
  if (e.kind === 'server') return 'The server had a problem. Please try again in a moment.'
  return e.message || 'Something went wrong. Please try again.'
}

// ---- request ----
// opts: { method, body, signal, auth = true (send token), expireOn401 = true, timeout = 30000 }
export async function request(path, opts = {}) {
  const { method = 'GET', body, signal, auth = true, expireOn401 = true, timeout = 30000 } = opts
  const headers = { Accept: 'application/json' }
  let token = null
  if (auth) {
    const a = getAuth()
    if (!a) { if (readRaw()) expireSession(); throw new ApiError('auth', 'Your session has expired. Please log in again.', { status: 401 }) }
    token = a.token
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const ctl = new AbortController()
  let timedOut = false
  const t = setTimeout(() => { timedOut = true; ctl.abort() }, timeout)
  const onAbort = () => ctl.abort()
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', onAbort, { once: true }) }

  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal })
  } catch (e) {
    if (timedOut) throw new ApiError('timeout', 'timeout')
    if (e?.name === 'AbortError') throw e // cancelled by the caller: not an error to display
    throw new ApiError('network', 'network')
  } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort) }

  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* empty or non-JSON body */ }
  if (res.ok) return data

  const { message, fields } = parseDetail(data)
  const retryAfter = Number(res.headers.get('Retry-After')) || 0
  const err = new ApiError(kindOf(res.status), message || FALLBACK[res.status] || `Request failed (${res.status}).`, { status: res.status, fields, retryAfter })
  // A 401 on a request that carried a token means the session is gone (expired, revoked, signed out elsewhere).
  // The caller opts out where 401 means something else, e.g. a wrong current password.
  if (res.status === 401 && token && expireOn401) { if (getAuth()?.token === token) endSession('expired') }
  throw err
}
