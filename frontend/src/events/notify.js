import { useSyncExternalStore } from 'react'

// Staff notifications for member-shared events. Stored in this browser only (prototype); no email or push is sent.
const KEY = 'fyyr.staff.notifications.v1'
let raw = null, cache = []
const subs = new Set()
function read() {
  let r = null
  try { r = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (r !== raw) { raw = r; try { const v = JSON.parse(r); cache = Array.isArray(v) ? v : [] } catch { cache = [] } }
  return cache
}
function write(list) {
  const s = JSON.stringify(list)
  try { localStorage.setItem(KEY, s) } catch { return }
  raw = s; cache = list; subs.forEach(f => f())
}
window.addEventListener('storage', e => { if (e.key === KEY) subs.forEach(f => f()) })
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
export const useNotifications = () => useSyncExternalStore(subscribe, read)

// One notification per event: a second call for the same event does nothing.
export function notifyShared(e) {
  const list = read()
  if (list.some(n => n.type === 'shared' && n.eventId === e.id)) return
  write([{ id: 'n-' + e.id, type: 'shared', eventId: e.id, title: e.title, category: e.category || 'events', company: e.owner?.company || '', ts: Date.now(), read: false }, ...list])
}
export const markAllRead = () => write(read().map(n => ({ ...n, read: true })))
