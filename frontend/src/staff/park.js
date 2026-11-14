import { MEMBER_OPPS, MCAT, isPark } from '../member/data.js'
import { listEvents, todayIso } from '../events/eventStore.js'
import { CATEGORIES } from '../events/categories.js'
import { delivery } from '../events/delivery.js'

// ============================================================================================
// Blue Science Park's own opportunities, for staff reporting.
// Ownership comes from the record: seeded items carry publisherId 'bsp'; created items are those saved by staff (source !== 'member').
// Member-created content shared with staff keeps its company attribution and is never counted here.
// Engagement (views, saves, clicks) comes from the shared analytics dataset (staff/metrics.js). Registrations, attendance and invitation
// delivery have no tracking connected, so they are reported as unavailable, never as zero.
// ============================================================================================
export const NOT_CONNECTED = 'Not connected'
export const REGISTRATIONS_TRACKED = false // no registration system reports confirmed registrations or attendance
export const INVITES_TRACKED = delivery.connected

export function parkCatalogue() {
  const seeded = MEMBER_OPPS.filter(o => isPark(o) && !o.staffEvent).map(o => ({ id: o.id, title: o.title, mcat: o.mcat, status: 'published', date: o.start || '', demo: !!o.demo }))
  const created = listEvents().filter(e => e.source !== 'member').map(e => ({ id: e.id, title: e.title || 'Untitled', mcat: CATEGORIES[e.category || 'events'].mcat, status: e.status, date: e.date || '', demo: !!e.demoSeed }))
  return [...seeded, ...created]
}
export const STATUS_LABEL = { published: 'Published', draft: 'Draft', archived: 'Archived' }

// Stock figures about the catalogue (not about a period).
export function parkSummary(cat = parkCatalogue()) {
  const published = cat.filter(c => c.status === 'published')
  const byCat = Object.keys(MCAT).map(id => ({ id, label: MCAT[id].short, n: published.filter(c => c.mcat === id).length })).filter(x => x.n)
  const today = todayIso()
  const upcoming = published.filter(c => c.mcat === 'events' && c.date && c.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  return { published: published.length, byCat, upcoming }
}
