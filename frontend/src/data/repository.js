import { OPPS, fmt } from '../demoData.js'
import { DEMO_OPPORTUNITIES } from './demoOpportunities.js'
import { DEMO_RICH } from './demoRich.js'
import { DEMO_ENABLED, demoReference } from './config.js'

// ============================================================================================
// Opportunity repository: the only place that knows where opportunities come from.
// UI code asks for opportunities (via member/data.js) and never imports fixtures directly.
//
// Every source is an adapter: a function returning an array of opportunities in ONE schema (see ./demoOpportunities.js):
//   { id, cat, mcat, title, summary, description?, provider, tags[], sectors[], goals[], where, online, start?, end, urg[], urgLabel, dateText,
//     amount?, eligibility?, facilities?, requirements?, expertise?, collab?, kind?, facts?, url?, next, isDemo? }
// To connect an API, write an adapter that maps API records onto that shape and add it with registerAdapter(); real records must not set isDemo.
// Created opportunities (events/eventStore.js) are a separate layer merged on top by events/sync.js and are never touched here.
// ============================================================================================

const pad = n => String(n).padStart(2, '0')
const isoOf = (ref, n) => { const d = new Date(ref); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const uniq = a => [...new Set(a)]
const CATS = ['events', 'funding', 'testing', 'knowledge', 'experts', 'collab']
const URG_LABEL = { events: 'Registration closes', funding: 'Application deadline', testing: 'Application deadline' }

// ---- adapter 1: sourced public opportunities (real dates and links, unchanged) ----
const MAP = { ai: ['AI'], security: ['Cybersecurity'], offshore: ['Maritime technology'], energy: ['Energy'], manufacturing: ['Advanced manufacturing'], growth: ['International growth'], eu: ['International growth'], deeptech: ['Research collaboration'] }
const SECT = { ai: 'Software & IT', security: 'Software & IT', cloud: 'Software & IT', offshore: 'Maritime & offshore', energy: 'Energy', manufacturing: 'Advanced manufacturing' }
const publicSources = () => OPPS.map(o => ({
  ...o, mcat: o.cat, provider: o.source, public: true, // curated, sourced and approved for public display
  online: /^online/i.test(o.where),
  kind: o.cat === 'knowledge' ? 'Course' : undefined,
  tags: uniq([...o.topics.flatMap(t => MAP[t] || []), ...(o.cat === 'funding' ? ['Funding'] : [])]),
  sectors: uniq(o.topics.map(t => SECT[t]).filter(Boolean)),
  goals: uniq([...(o.cat === 'funding' ? ['Find funding'] : ['Build skills']), ...(o.topics.some(t => t === 'eu' || t === 'growth') ? ['Grow internationally'] : [])]),
}))

// ---- adapter 2: fictional demo opportunities, dated relative to one reference date ----
export function materialiseDemo(r, ref = demoReference()) {
  const { startIn, closesIn, until, pubAgo, ...rest } = r
  const day = n => isoOf(ref, n)
  const start = startIn != null ? day(startIn) : undefined
  const urg = closesIn != null ? [day(closesIn)] : []
  const dates = [...urg, start, until != null ? day(until) : null].filter(Boolean).sort()
  return {
    tags: [], sectors: [], goals: [], where: '', online: false, next: 'View details', ...rest,
    mcat: r.cat === 'experts' || r.cat === 'collab' ? 'people' : r.cat,
    published: pubAgo != null ? new Date(day(-pubAgo) + 'T12:00:00').getTime() : undefined,
    isDemo: true, demo: true, // `demo` is the flag the existing UI reads; it always mirrors isDemo
    start, urg, urgLabel: URG_LABEL[r.cat] || '', end: dates.length ? dates[dates.length - 1] : day(365), // open-ended items stay open a year from the reference date
    dateText: r.dateText ?? (start ? fmt(start) : pubAgo != null ? `Published ${fmt(day(-pubAgo))}` : ''),
  }
}
const demoSource = () => DEMO_OPPORTUNITIES.map(r => ({ ...materialiseDemo(DEMO_RICH[r.id] ? { ...r, facts: [...(r.facts || []), ...DEMO_RICH[r.id]] } : r), public: true })) // explicitly public fictional examples

const adapters = [publicSources, ...(DEMO_ENABLED ? [demoSource] : [])]
export const registerAdapter = fn => { adapters.push(fn) }

// Required fields every record must have. Invalid records are dropped with a console warning rather than breaking the app.
export function checkOpportunity(o) {
  const p = []
  if (!o || typeof o.id !== 'string' || !o.id) p.push('id')
  if (!CATS.includes(o?.cat)) p.push('cat')
  if (!o?.title) p.push('title')
  if (!o?.summary) p.push('summary')
  if (!Array.isArray(o?.urg)) p.push('urg')
  if (!o?.end) p.push('end')
  if (!Array.isArray(o?.tags) || !Array.isArray(o?.sectors) || !Array.isArray(o?.goals)) p.push('tags/sectors/goals')
  if (o?.isDemo && o.demo !== true) p.push('demo flag')
  return p
}

// All base opportunities, in adapter order, each id once. Real records come before demo ones, so a demo record can never shadow a real one.
export function listOpportunities() {
  const seen = new Set(), out = []
  for (const a of adapters) {
    for (const o of a()) {
      const bad = checkOpportunity(o)
      if (bad.length) { console.warn(`Opportunity ${o?.id ?? '(no id)'} skipped, invalid: ${bad.join(', ')}`); continue }
      if (seen.has(o.id)) { console.warn(`Duplicate opportunity id ${o.id} skipped`); continue }
      seen.add(o.id); out.push(o)
    }
  }
  return out
}
export const isDemoRecord = o => !!o?.isDemo
export { DEMO_ENABLED }
