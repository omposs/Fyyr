import { useMemo, useSyncExternalStore } from 'react'
import { useNotifications as useSharedEvents } from './notify.js'
import { getSession } from '../auth.js'

// ============================================================================================
// Notifications = discrete UPDATES for the signed-in account (something was submitted, published, changed or became available).
// They are separate records with a stable id, type, creation time and target. They are never derived from overview analytics.
//
//   record  { id, type, ts, title, detail, audience: ['staff'|'member'], target: { kind: 'path'|'opp', path|id }, simulated? }
//   read    per account (login email): { [email]: { [id]: readAt } }, so one account reading an item never marks it read for another.
//
// Sources:
//   - REAL, local to this browser: a member company sharing an event with staff (events/notify.js, written by the event store).
//   - SIMULATED demo updates, written ONCE into localStorage the first time they are needed (marker below) and never regenerated on
//     render or refresh. They are shown in demo content mode only and are labelled in the data (simulated: true).
//   - Live content mode: the backend has no notification endpoint, so nothing is invented. The menu shows an honest empty state.
// Nothing here sends email or push.
// ============================================================================================
const DEMO_KEY = 'fyyr.notifications.demo.v1'
const READ_KEY = 'fyyr.notifications.read.v1'

function store(key) {
  let raw = null, cache = null
  const subs = new Set()
  const get = () => {
    let r = null
    try { r = localStorage.getItem(key) } catch { /* private mode */ }
    if (r !== raw || cache === null) { raw = r; try { cache = JSON.parse(r) } catch { cache = null } }
    return cache
  }
  const set = v => {
    const s = JSON.stringify(v)
    try { localStorage.setItem(key, s) } catch { /* kept for this visit only below */ }
    raw = s; cache = v; subs.forEach(f => f())
  }
  window.addEventListener('storage', e => { if (e.key === key) subs.forEach(f => f()) })
  return { get, set, subscribe: f => { subs.add(f); return () => subs.delete(f) } }
}
const demoS = store(DEMO_KEY), readS = store(READ_KEY)

const H = 36e5, D = 24 * H
const demoRecords = now => [
  { id: 'demo:event_submitted:iot-meetup', type: 'event_submitted', ts: now - 3 * H, audience: ['staff'], title: 'A member company submitted an event for review', detail: 'IoT in practice: member lightning talks', target: { kind: 'path', path: '/staff/events/ev-demo-iot-meetup' } },
  { id: 'demo:opportunity_published:marine-call:staff', type: 'opportunity_published', ts: now - 26 * H, audience: ['staff'], title: 'New opportunity published', detail: 'Sustainable marine technology funding call (fictional)', target: { kind: 'path', path: '/staff/events/ev-demo-marine-call' } },
  { id: 'demo:opportunity_published:marine-call:member', type: 'opportunity_published', ts: now - 26 * H, audience: ['member'], title: 'New opportunity published', detail: 'Sustainable marine technology funding call (fictional)', target: { kind: 'opp', id: 'ev-demo-marine-call' } },
  { id: 'demo:deadline_changed:cyber-workshop:staff', type: 'deadline_changed', ts: now - 2 * D, audience: ['staff'], title: 'Registration deadline changed', detail: 'Cybersecurity workshop for connected industry', target: { kind: 'path', path: '/staff/events/ev-demo-cyber-workshop' } },
  { id: 'demo:deadline_changed:cyber-workshop:member', type: 'deadline_changed', ts: now - 2 * D, audience: ['member'], title: 'Registration deadline changed', detail: 'Cybersecurity workshop for connected industry', target: { kind: 'opp', id: 'ev-demo-cyber-workshop' } },
  { id: 'demo:match_available:spirius-cleura', type: 'match_available', ts: now - 3 * D, audience: ['staff'], title: 'New company match available', detail: 'Spirius and Cleura: IoT connectivity with compliant hosting', target: { kind: 'path', path: '/staff/network/suggestions' } },
  { id: 'demo:profile_refresh:staff', type: 'profile_refresh', ts: now - 5 * D, audience: ['staff'], title: 'Profile refresh completed', detail: 'Your account details were refreshed.', target: { kind: 'path', path: '/staff/profile' } },
  { id: 'demo:profile_refresh:member', type: 'profile_refresh', ts: now - 5 * D, audience: ['member'], title: 'Profile refresh completed', detail: 'Your profile was refreshed.', target: { kind: 'path', path: '/member/profile' } },
].map(r => ({ ...r, simulated: true }))

// Written once. A second call (render, refresh, another tab) finds the marker and does nothing, so ids and timestamps stay stable.
export function seedDemoNotifications() {
  if (demoS.get()?.seeded) return
  demoS.set({ seeded: true, records: demoRecords(Date.now()) })
}

export const ICON = { event_submitted: 'events', opportunity_published: 'check', deadline_changed: 'clock', match_available: 'collab', profile_refresh: 'experts' }
const account = () => (getSession()?.email || '').trim().toLowerCase()
const readOf = (map, who) => (map && map[who]) || {}

export function ago(ts, now = Date.now()) {
  const m = Math.round((now - ts) / 6e4)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  if (m < 10080) return `${Math.round(m / 1440)} d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// audience: 'staff' | 'member'. live: true when the content mode is live (no simulated updates, no invented ones).
export function useAccountNotifications({ audience, live }) {
  const shared = useSharedEvents()
  const demo = useSyncExternalStore(demoS.subscribe, demoS.get)
  const map = useSyncExternalStore(readS.subscribe, readS.get)
  const who = account()
  const items = useMemo(() => {
    const recs = []
    if (audience === 'staff') for (const n of shared) if (n.type === 'shared') recs.push({ id: 'shared:' + n.eventId, type: 'event_submitted', ts: n.ts, title: `${n.company || 'A member company'} submitted an event for review`, detail: n.title, target: { kind: 'path', path: '/staff/events/shared' } })
    if (!live) for (const r of demo?.records || []) if (r.audience.includes(audience)) recs.push(r)
    const seen = readOf(map, who)
    return recs.sort((a, b) => b.ts - a.ts).map(r => ({ ...r, unread: !seen[r.id] }))
  }, [shared, demo, map, who, audience, live])
  const unread = items.filter(i => i.unread).length
  const mark = ids => {
    const cur = readOf(readS.get(), who), next = { ...cur }
    let changed = false
    for (const id of ids) if (!next[id]) { next[id] = Date.now(); changed = true }
    if (changed) readS.set({ ...(readS.get() || {}), [who]: next })
  }
  return { items, unread, markRead: id => mark([id]), markAllRead: () => mark(items.map(i => i.id)) }
}

// Opening the shared queue counts as having seen those submissions, for this account only.
export function markSharedSeen() {
  const who = account()
  const cur = { ...readOf(readS.get(), who) }
  let list = []
  try { list = JSON.parse(localStorage.getItem('fyyr.staff.notifications.v1') || '[]') } catch { /* nothing to mark */ }
  for (const n of list) if (n.type === 'shared') cur['shared:' + n.eventId] = cur['shared:' + n.eventId] || Date.now()
  readS.set({ ...(readS.get() || {}), [who]: cur })
}
