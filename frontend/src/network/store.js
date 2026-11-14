import { useSyncExternalStore } from 'react'

// Saved collaboration suggestions: internal staff follow-up (status + note). Stored in this browser (prototype).
// Nothing here contacts a company. Only the suggestion id, status and staff note are kept, never member activity data.
const KEY = 'fyyr.staff.network.v1'
let raw = null, cache = {}
const subs = new Set()
function read() {
  let r = null
  try { r = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (r !== raw) { raw = r; try { const v = JSON.parse(r); cache = v && typeof v === 'object' && !Array.isArray(v) ? v : {} } catch { cache = {} } }
  return cache
}
function write(next) {
  const s = JSON.stringify(next)
  try { localStorage.setItem(KEY, s) } catch { throw new Error('Could not save in this browser.') }
  raw = s; cache = next; subs.forEach(f => f())
}
window.addEventListener('storage', e => { if (e.key === KEY) subs.forEach(f => f()) })
const subscribe = f => { subs.add(f); return () => subs.delete(f) }

export function useSaved() {
  const saved = useSyncExternalStore(subscribe, read)
  return {
    saved,
    save: (id, by) => write({ ...read(), [id]: { status: 'Saved', note: '', savedAt: Date.now(), by: by || '' } }),
    update: (id, patch) => read()[id] && write({ ...read(), [id]: { ...read()[id], ...patch, updatedAt: Date.now() } }),
    remove: id => { const n = { ...read() }; delete n[id]; write(n) },
  }
}
