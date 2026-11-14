import { useEffect, useState } from 'react'

// Demo-only client-side auth. Not real authentication or authorization.
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
  try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY)); return s && ROUTES[s.role] ? s : null } catch { return null }
}
export const setSession = (role, email) => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, email })) } catch { /* ignore */ } }
export const clearSession = () => { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ } }

export function navigate(path, replace) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
