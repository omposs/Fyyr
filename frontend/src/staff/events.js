import { groupTopic, sanitiseTerm } from './topics.js'

// ---- Application event tracking (member side) ----
// Events are recorded in this browser (localStorage) because the prototype has no backend. `staff/analyticsApi.js` is the
// only place staff screens read them from, so swapping in a real endpoint later does not touch the UI.
//
// Event shape: { id, ts, type, sid, company, sector, oppId?, cat?, term?, topic?, resultCount?, page?, interests?, wants?, src, env }
// type: search | shown | view | save | unsave | click_source | not_relevant | interests_set
// Search events keep only a sanitised short term (see sanitiseTerm) and its topic, never the raw text.
const KEY = 'fyyr.events.v1'
const MAX = 3000
export const LIVE_COMPANY = 'live-demo-member'
export const EVENTS_CHANGED = 'fyyr:events'

// Accidental repeats are dropped inside these windows (same session, same item). `shown` counts one impression per
// session and page per 30 minutes, so re-renders and filter changes are not counted as new impressions.
const DEDUPE_MS = { shown: 30 * 60e3, view: 10e3, search: 3e3, save: 800, unsave: 800, click_source: 3e3, not_relevant: 3e3, interests_set: 1500 }
const recent = new Map()
const ctx = { sector: '' }
export const setTrackContext = c => Object.assign(ctx, c)

const sid = (() => {
  try { let s = sessionStorage.getItem('fyyr.sid'); if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('fyyr.sid', s) } return s } catch { return 'nosession' }
})()

export function readLive() { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : [] } catch { return [] } }
export function clearLive() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } window.dispatchEvent(new Event(EVENTS_CHANGED)) }

export function track(type, data = {}) {
  const ts = Date.now()
  const key = [type, data.oppId || data.term || '', data.page || ''].join('|')
  const last = recent.get(key)
  if (last && ts - last < (DEDUPE_MS[type] ?? 2000)) return false
  recent.set(key, ts)
  const e = { id: `${ts}-${Math.random().toString(36).slice(2, 7)}`, ts, type, sid, company: LIVE_COMPANY, sector: ctx.sector || '', src: 'live', env: 'demo-session' }
  if (type === 'search') {
    const term = sanitiseTerm(data.term)
    if (!term) return false
    Object.assign(e, { term, topic: term === 'redacted' ? 'Ungrouped' : groupTopic(term), resultCount: data.resultCount ?? 0, cat: data.cat || 'all', page: data.page })
  } else Object.assign(e, { oppId: data.oppId, cat: data.cat, page: data.page, interests: data.interests, wants: data.wants })
  try {
    const all = readLive(); all.push(e)
    localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX)))
  } catch { return false }
  window.dispatchEvent(new Event(EVENTS_CHANGED))
  return true
}
