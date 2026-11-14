import { useSyncExternalStore } from 'react'
import { canEdit, canManageAudience, isMemberEvent } from './access.js'
import { notifyShared } from './notify.js'
import { CATEGORIES, defaultsFor, visibleFields } from './categories.js'

// ---- Staff-created events (draft / published). Stored in this browser; the same shape fits a server table. ----
const KEY = 'fyyr.staff.events.v1'
export const EVENT_TYPES = ['Workshop', 'Info day', 'Meetup', 'Webinar', 'Conference', 'Networking', 'Other']
export const TIMEZONES = ['Europe/Stockholm', 'Europe/London', 'UTC', 'America/New_York', 'Asia/Singapore']
export const MODES = [['in-person', 'In person'], ['online', 'Online'], ['hybrid', 'Hybrid']]
export const DEFAULT_INVITE = { accent: '#2b3cff', intro: '', cover: true, layout: 'standard', buttonLabel: 'Register now' }
export const LAYOUTS = [['standard', 'Standard'], ['compact', 'Compact'], ['banner', 'Cover on top']]
export const DEFAULT_AUDIENCE = { companies: [], interests: [], categories: [], added: [], removed: [] }

// Older records have no ownership or audience fields: they are staff events, public once published.
const EMPTY_ACCESS = { companies: [], members: [] }
export const norm = e => ({ category: 'events', x: {}, details: '', industries: [], contact: '', source: 'staff', publisherId: '', owner: null, visibility: 'public', shareWithBsp: false, shareNotifiedAt: null, audit: [], ...e, access: { ...EMPTY_ACCESS, ...(e.access || {}) } })

let raw = null, cache = []
const subs = new Set()
function read() {
  let r = null
  try { r = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (r !== raw) { raw = r; try { const v = JSON.parse(r); cache = Array.isArray(v) ? v.map(norm) : [] } catch { cache = [] } }
  return cache
}
function write(list) {
  const s = JSON.stringify(list)
  try { localStorage.setItem(KEY, s) } catch { throw new Error('Could not save: browser storage is full. Remove a cover image or logo.') }
  raw = s; cache = list; subs.forEach(f => f())
}
window.addEventListener('storage', e => { if (e.key === KEY) subs.forEach(f => f()) })
const subscribe = f => { subs.add(f); return () => subs.delete(f) }
export const useStaffEvents = () => useSyncExternalStore(subscribe, read)
export const listEvents = read
export const getEvent = id => read().find(e => e.id === id) || null

export const newId = () => 'ev-' + Math.random().toString(36).slice(2, 9)
export const blankEvent = (extra = {}) => norm({
  id: newId(), status: 'draft', title: '', description: '', type: 'Workshop', tags: [], date: '', start: '', end: '', tz: 'Europe/Stockholm',
  mode: 'in-person', location: '', link: '', regDeadline: '', regUrl: '', cover: '', category: 'events', x: {}, details: '', industries: [], contact: '',
  organiser: null, sponsors: [], invite: { ...DEFAULT_INVITE }, audience: { ...DEFAULT_AUDIENCE }, sends: [], created: Date.now(), updated: Date.now(), step: 0, ...extra,
  ...(extra.category && extra.category !== 'events' ? { x: { ...defaultsFor(extra.category), ...(extra.x || {}) } } : {}),
})
const auditRow = (by, action, target = '', name = '') => ({ ts: Date.now(), by, action, target, name })
const nameOf = actor => (actor.role === 'staff' ? 'Blue Science Park staff' : actor.email)
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`

// Saves content. The actor must be allowed to edit. Ownership, grants, audit and sharing are never taken from the caller's copy
// (an open editor can be stale), so a staff member's change to the audience is not overwritten by the owner's autosave.
export function saveEvent(ev, actor) {
  if (!actor) throw new Error('Not signed in.')
  const list = read()
  const old = list.find(e => e.id === ev.id)
  if (old && !canEdit(old, actor)) throw new Error('You do not have permission to edit this event.')
  if (!old && actor.role === 'member' && !actor.companyId) throw new Error('Your company could not be identified.')
  const base = norm(ev)
  const rec = old
    ? { ...base, source: old.source, owner: old.owner, access: old.access, audit: old.audit, shareNotifiedAt: old.shareNotifiedAt, shareWithBsp: old.status === 'published' ? old.shareWithBsp : base.shareWithBsp, publishedAt: base.publishedAt ?? old.publishedAt }
    : { ...base, source: actor.role === 'member' ? 'member' : 'staff', owner: actor.role === 'member' ? { email: actor.email, company: actor.companyName || actor.companyId, companyId: actor.companyId } : null, access: { ...EMPTY_ACCESS }, audit: [], shareNotifiedAt: null }
  rec.updated = Date.now()
  rec.publisherId = isMemberEvent(rec) ? '' : 'bsp' // explicit publisher: content created by staff is park-organised
  if (isMemberEvent(rec)) {
    if (rec.visibility !== 'company' && rec.visibility !== 'public') rec.visibility = 'company'
    const was = old?.visibility
    const justPublished = rec.status === 'published' && old?.status !== 'published'
    if (rec.visibility === 'public') {
      if (rec.shareWithBsp || rec.access.companies.length || rec.access.members.length) rec.audit = [...rec.audit, auditRow(nameOf(actor), 'Sharing and extra access removed because the event is now public')]
      rec.shareWithBsp = false; rec.access = { ...EMPTY_ACCESS }
    }
    if (old && was !== rec.visibility) rec.audit = [...rec.audit, auditRow(nameOf(actor), `Visibility changed to ${rec.visibility === 'public' ? 'Public' : 'Company only'}`)]
    if (justPublished) rec.audit = [...rec.audit, auditRow(nameOf(actor), 'Published')]
    if (old?.status === 'published' && rec.status !== 'published') rec.audit = [...rec.audit, auditRow(nameOf(actor), rec.status === 'archived' ? 'Archived' : 'Unpublished')]
    if (rec.status === 'published' && rec.visibility === 'company' && rec.shareWithBsp && !rec.shareNotifiedAt) { rec.shareNotifiedAt = Date.now(); notifyShared(rec) }
  }
  write(old ? list.map(e => (e.id === rec.id ? rec : e)) : [rec, ...list])
  return rec
}

// Owner changes sharing after publication. Turning it off removes staff management access and everything staff granted.
export function setSharing(id, on, actor) {
  const e = getEvent(id)
  if (!e || !isMemberEvent(e) || !canEdit(e, actor)) throw new Error('You do not have permission to change sharing.')
  if (e.visibility !== 'company') throw new Error('Sharing applies to company-only events.')
  if (!!e.shareWithBsp === !!on) return e
  const rec = { ...e, updated: Date.now() }
  if (on) {
    rec.shareWithBsp = true
    rec.audit = [...e.audit, auditRow(nameOf(actor), 'Sharing with Blue Science Park turned on')]
    if (rec.status === 'published' && !rec.shareNotifiedAt) { rec.shareNotifiedAt = Date.now(); notifyShared(rec) }
  } else {
    const n = e.access.companies.length, m = e.access.members.length
    rec.shareWithBsp = false; rec.access = { ...EMPTY_ACCESS }
    rec.audit = [...e.audit, auditRow(nameOf(actor), `Sharing turned off: staff access removed; ${plural(n, 'granted company', 'granted companies')} and ${plural(m, 'named person', 'named people')} lost access`)]
  }
  write(read().map(x => (x.id === id ? rec : x)))
  return rec
}

// Staff only, only for shared company-only member events. Never changes content or visibility.
export function grantAccess(id, kind, target, actor) {
  const e = getEvent(id)
  if (!e || !canManageAudience(e, actor)) throw new Error('You cannot manage the audience of this event.')
  const list = kind === 'company' ? e.access.companies : e.access.members
  const key = kind === 'company' ? target.id : target.email.toLowerCase()
  if (kind === 'company' && target.id === e.owner.companyId) return e
  if (list.some(x => (kind === 'company' ? x.id : x.email) === key)) return e
  const entry = kind === 'company' ? { id: target.id, name: target.name, ts: Date.now() } : { email: key, name: target.name, company: target.company, ts: Date.now() }
  const access = kind === 'company' ? { ...e.access, companies: [...list, entry] } : { ...e.access, members: [...list, entry] }
  const rec = { ...e, access, audit: [...e.audit, auditRow(nameOf(actor), 'Access granted', kind === 'company' ? 'Entire company' : 'Named person only', target.name)], updated: Date.now() }
  write(read().map(x => (x.id === id ? rec : x)))
  return rec
}
export function revokeAccess(id, kind, key, actor) {
  const e = getEvent(id)
  if (!e || !canManageAudience(e, actor)) throw new Error('You cannot manage the audience of this event.')
  const was = (kind === 'company' ? e.access.companies : e.access.members).find(x => (kind === 'company' ? x.id : x.email) === key)
  if (!was) return e
  const access = kind === 'company' ? { ...e.access, companies: e.access.companies.filter(x => x.id !== key) } : { ...e.access, members: e.access.members.filter(x => x.email !== key) }
  const rec = { ...e, access, audit: [...e.audit, auditRow(nameOf(actor), 'Access removed', kind === 'company' ? 'Entire company' : 'Named person only', was.name)], updated: Date.now() }
  write(read().map(x => (x.id === id ? rec : x)))
  return rec
}

export function deleteEvent(id, actor) {
  const e = getEvent(id)
  if (e && !canEdit(e, actor)) throw new Error('You do not have permission to delete this event.')
  write(read().filter(x => x.id !== id))
}
const clearDates = src => Object.fromEntries(Object.entries(src.x || {}).map(([k, v]) => [k, (CATEGORIES[src.category]?.fields || []).find(f => f.k === k)?.type === 'date' ? '' : v]))
export function duplicateEvent(id, actor) {
  const src = getEvent(id)
  if (!src || !canEdit(src, actor)) return null
  const copy = { ...JSON.parse(JSON.stringify(src)), x: clearDates(src), id: newId(), status: 'draft', title: src.title + ' (copy)', date: '', start: '', end: '', regDeadline: '', sends: [], created: Date.now(), publishedAt: undefined, step: 0, shareWithBsp: false, shareNotifiedAt: null, access: { ...EMPTY_ACCESS }, audit: [], source: undefined, owner: undefined }
  return saveEvent(copy, actor)
}

const pad = n => String(n).padStart(2, '0')
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
// draft | published | past. "Past" is derived from the date, never stored.
// Only events have a date that can pass; other categories stay published until archived. Archived items are never listed to anyone else.
export const stateOf = (e, today = todayIso()) => (e.status === 'archived' ? 'archived' : e.status === 'published' ? ((e.category || 'events') === 'events' && e.date && e.date < today ? 'past' : 'published') : 'draft')

// Accepts example.com, www.example.com/path?x=1, http(s)://... Any provider. https:// is added only here (validation/saving), never while typing.
// Rejects spaces, non-web schemes (javascript:, data:, mailto:...) and anything without a real-looking host. Returns the usable URL or ''.
export function webUrl(input) {
  const t = (input || '').trim()
  if (!t || /\s/.test(t) || /[<>"']/.test(t)) return ''
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[^/:]+:\d+(\/|$)/.test(t) // "example.com:8080" is a host and port, not a scheme
  if (hasScheme && !/^https?:\/\//i.test(t)) return ''
  const full = hasScheme ? t : 'https://' + t.replace(/^\/\//, '')
  try {
    const u = new URL(full)
    if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]{1,}$/i.test(u.hostname) || u.username || u.password) return ''
    return full
  } catch { return '' }
}

// Everything required before publishing. Returned as { field: message } so the form can point at the exact field.
const EMAIL = /^[^s@]+@[^s@]+.[^s@]{2,}$/
// A contact route is an email address, a website, or a short plain-text instruction (for example “Call reception on …”).
export const contactOk = t => { const v = (t || '').trim(); return v.length >= 4 && (!v.includes('@') || /s/.test(v) || EMAIL.test(v)) }
export const contactHref = t => { const v = (t || '').trim(); return EMAIL.test(v) ? 'mailto:' + v : webUrl(v) || '' }
function otherProblems(e) {
  const c = CATEGORIES[e.category], p = {}
  if (!e.title.trim()) p.title = 'Add a title.'
  else if (e.title.trim().length < 4) p.title = 'Use a more descriptive title.'
  if (!e.description.trim()) p.description = 'Add a short description.'
  for (const f of visibleFields(e.category, e.x)) {
    const v = (e.x[f.k] || '').toString().trim()
    if (!f.opt && !v) p['x.' + f.k] = f.type === 'date' ? 'Choose a date.' : f.type === 'select' || f.type === 'radio' ? 'Choose an option.' : 'This field is required.'
  }
  const x = e.x || {}
  if (c.id === 'testing' && x.availMode === 'period' && x.availFrom && x.availTo && x.availTo < x.availFrom) p['x.availTo'] = 'The end date must be after the start date.'
  const link = (e.regUrl || '').trim(), contact = (e.contact || '').trim()
  if (link && !webUrl(link)) p.regUrl = 'Enter a valid website address.'
  if (contact && !contactOk(contact)) p.contact = 'Enter an email address, a website or a short instruction.'
  if (c.link === 'req' && !link) p.regUrl = 'Add this link.'
  if (c.contact === 'req' && !contact) p.contact = 'Add a contact route.'
  if (c.link === 'either' && !link && !contact) { p.regUrl = 'Add a link or a contact route.'; p.contact = 'Add a link or a contact route.' }
  return p
}
export function problems(e) {
  if ((e.category || 'events') !== 'events') return otherProblems(e)
  const p = {}
  if (!e.title.trim()) p.title = 'Add a title.'
  else if (e.title.trim().length < 4) p.title = 'Use a more descriptive title.'
  if (!e.description.trim()) p.description = 'Add a short description.'
  if (!e.date) p.date = 'Choose the event date.'
  if (!e.start) p.start = 'Add a start time.'
  if (e.start && e.end && e.end <= e.start) p.end = 'End time must be after the start time.'
  if (e.mode !== 'online' && !e.location.trim()) p.location = 'Add a location, or switch to Online.'
  if (e.mode !== 'in-person' && !/^https?:\/\//i.test(e.link.trim())) p.link = 'Add an online link starting with https://'
  if (e.regDeadline && e.date && e.regDeadline > e.date) p.regDeadline = 'The deadline cannot be after the event.'
  if (!(e.regUrl || '').trim()) p.regUrl = 'Add a registration link.'
  else if (!webUrl(e.regUrl)) p.regUrl = 'Enter a valid website address.'
  return p
}
export const regHref = e => webUrl(e.regUrl)
export const isEmpty = e => (e.category || 'events') !== 'events'
  ? !e.title.trim() && !e.description.trim() && !(e.details || '').trim() && !e.sponsors.length && !e.organiser && !(e.regUrl || '').trim() && !(e.contact || '').trim() && !e.tags.length && !Object.entries(e.x || {}).some(([k, v]) => v && !(CATEGORIES[e.category].fields.find(f => f.k === k)?.def === v))
  : !e.title.trim() && !e.description.trim() && !e.date && !e.sponsors.length && !e.organiser && !e.location.trim() && !e.regUrl.trim()

export function fmtDate(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '' }
export function fmtShort(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '' }
export const fmtTime = e => (e.start ? e.start + (e.end ? '–' + e.end : '') : '')
export const tzLabel = tz => ({ 'Europe/Stockholm': 'Stockholm time (CET/CEST)', 'Europe/London': 'London time', UTC: 'UTC', 'America/New_York': 'New York time', 'Asia/Singapore': 'Singapore time' }[tz] || tz)
export const placeOf = e => (e.mode === 'online' ? 'Online' : e.mode === 'hybrid' ? `${e.location || 'On site'} and online` : e.location)
