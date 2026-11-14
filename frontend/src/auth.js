import { useEffect, useState } from 'react'
import { ApiError, claimBrowserFor, clearAuth, getAuth, setAuth } from './api/client.js'
import * as api from './api/api.js'

// AUTH mode: 'backend' (default) logs in against the real API; 'demo' keeps the original simulated login (any password, any 6-digit
// code, nothing is checked). Set VITE_AUTH_MODE=demo to use it. This is independent of the CONTENT mode (data/mode.js).
// In backend mode the role gate below only chooses which screens to SHOW; the backend enforces every permission.
export const AUTH_MODE = import.meta.env?.VITE_AUTH_MODE === 'demo' ? 'demo' : 'backend'
// Demo-only client-side auth (AUTH_MODE=demo). Not real authentication or authorization.
const CD_KEY = 'fyyr:code-cooldown-until'
const SESSION_KEY = 'fyyr:demo-session'
export const COOLDOWN_MS = 60_000
export const ROUTES = { member: '/member', staff: '/staff' }

export const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

const readUntil = () => { try { return Number(localStorage.getItem(CD_KEY)) || 0 } catch { return 0 } }
export const cooldownLeft = () => Math.max(0, readUntil() - Date.now())

// Shared by every simulated email send. Returns false (and does nothing) while a cooldown is active.
export function startCooldown() {
  if (cooldownLeft() > 0) return false
  try { localStorage.setItem(CD_KEY, String(Date.now() + COOLDOWN_MS)) } catch { /* storage blocked: no persistence */ }
  return true
}

// Remaining ms, derived from the stored expiry on every tick (no decrementing counter).
export function useCooldown() {
  const [left, setLeft] = useState(cooldownLeft)
  useEffect(() => {
    const sync = () => setLeft(cooldownLeft())
    const id = setInterval(sync, 250)
    window.addEventListener('storage', sync)
    sync()
    return () => { clearInterval(id); window.removeEventListener('storage', sync) }
  }, [])
  return left
}

export const fmtLeft = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export function getSession() {
  if (AUTH_MODE === 'backend') { const a = getAuth(); return a ? { role: a.role, email: a.email, name: a.name, memberId: a.memberId, website: a.website || null } : null }
  try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY)); return s && ROUTES[s.role] ? s : null } catch { return null }
}
export const setSession = (role, email) => { if (AUTH_MODE === 'backend') return; try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, email })) } catch { /* ignore */ } }
export const clearSession = () => { if (AUTH_MODE === 'backend') { clearAuth(); return } try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } }

// ---- backend authentication (AUTH_MODE=backend) ----
const NEXT_KEY = 'fyyr.next'      // where the visitor was heading before being asked to log in
const NOTICE_KEY = 'fyyr.notice'  // one-time message shown in the login dialog

// Logs in, verifies identity (/me) and, when staff access is requested, asks the server (api.isAdmin). A member who asks for staff
// access stays signed in as a member (staffDenied = true): the staff screen then explains and offers the way back.
// Throws ApiError; nothing is left signed in if the login or the identity check fails.
export async function signIn(email, password, role) {
  const out = await api.login(email.trim(), password)
  claimBrowserFor(out.member_id) // wipes data left by a different company before this session starts
  setAuth({ token: out.access_token, expiresAt: out.expires_at, memberId: out.member_id, name: out.name, email: email.trim().toLowerCase(), role: 'member' })
  let staffDenied = false
  try {
    const who = await api.me()
    let admin = false
    if (role === 'staff') { admin = await api.isAdmin(); staffDenied = !admin }
    setAuth({ ...getAuth(), memberId: who.id, name: who.name, website: who.website, admin, role: admin ? 'staff' : 'member' })
  } catch (e) {
    await api.logout().catch(() => {}) // ends the server session we just opened
    clearAuth()
    throw e
  }
  return { ...getSession(), staffDenied }
}
// Re-checks staff rights with the server and updates the stored role. Throws on 401 and on network/server errors (callers offer Retry).
export async function verifyStaff(signal) {
  const admin = await api.isAdmin(signal, 10000)
  const a = getAuth()
  if (a) setAuth({ ...a, admin, role: admin ? 'staff' : 'member' })
  return admin
}
export async function signOut() {
  if (AUTH_MODE === 'backend') { try { await api.logout() } catch { /* already expired or offline: local sign-out still happens */ } clearAuth() } else clearSession()
}
export const rememberDestination = (path, notice) => { try { sessionStorage.setItem(NEXT_KEY, path); if (notice) sessionStorage.setItem(NOTICE_KEY, notice) } catch { /* ignore */ } }
export const hasDestination = () => { try { return AUTH_MODE === 'backend' && !!sessionStorage.getItem(NEXT_KEY) } catch { return false } }
export function takeDestination(role) {
  let next = null
  try { next = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY) } catch { /* ignore */ }
  return next && (next === ROUTES[role] || next.startsWith(ROUTES[role] + '/')) ? next : ROUTES[role]
}
export function takeNotice() { try { const n = sessionStorage.getItem(NOTICE_KEY); sessionStorage.removeItem(NOTICE_KEY); return n } catch { return null } }
export { ApiError }

export function navigate(path, replace) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
