import { MEMBER_OPPS, isPark, matchesQ } from '../member/data.js'
import { groupTopic, OPP_TOPICS } from './topics.js'

// ============================================================================================
// SIMULATED SAMPLE. Not real member activity.
// 14 fictional "Demo company" accounts and ~180 days of generated events, built with a fixed random seed so the
// numbers are stable. Result counts come from the same search function the member area uses, so "no results"
// is real for this catalogue. Every event carries src:'demo'. No real Blue Science Park member appears here.
// ============================================================================================
const DAY = 864e5
const rng = seed => { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const PREF = {
  'Maritime & offshore': { 'Maritime & offshore': 3, 'Testing environments': 2.5, 'Funding & grants': 2, 'IoT & sensors': 1.5, Energy: 1, 'Events & networking': 1, 'Partners & expertise': 1, 'International growth': .5 },
  Energy: { Energy: 3, 'Funding & grants': 2.5, 'Maritime & offshore': 1, 'Testing environments': 1.5, 'International growth': 1, 'Partners & expertise': 1, 'Events & networking': .5 },
  'Software & IT': { 'AI & data': 3, Cybersecurity: 2.5, 'Defence supply': 1, 'Funding & grants': 1.5, 'Events & networking': 1.5, 'International growth': 1, 'Partners & expertise': .8 },
  'Advanced manufacturing': { 'IoT & sensors': 2.5, 'AI & data': 1.5, 'Testing environments': 2, 'Funding & grants': 1.5, 'Defence supply': 1.5, 'Events & networking': 1, 'International growth': 1 },
  'Health & life science': { 'Digital health': 3, 'AI & data': 2, 'Funding & grants': 2, 'Testing environments': 1.5, 'Partners & expertise': 1, 'Events & networking': 1 },
}
const WANTS = { 'Maritime & offshore': ['testing', 'funding', 'events'], Energy: ['funding', 'testing'], 'Software & IT': ['knowledge', 'events', 'funding'], 'Advanced manufacturing': ['testing', 'funding', 'people'], 'Health & life science': ['funding', 'testing', 'knowledge'] }

// share: simulated consent to let staff see this company's own activity summary. Everyone else stays aggregate-only.
// [sector, shares its own summary, activity level, science park id, fictional name]. Names are invented; none is a real organisation.
const SPEC = [
  ['Maritime & offshore', 0, 1.2, 'bsp', 'Skärgård Marine Systems'], ['Maritime & offshore', 1, 1, 'bsp', 'Blekinge Tidewater Labs'], ['Energy', 0, 1, 'bsp', 'Karlskrona Grid Works'],
  ['Software & IT', 1, 1.3, 'bsp', 'Nordhamn Software'], ['Software & IT', 1, .9, 'lsp', 'Östra Data Studio'], ['Advanced manufacturing', 0, 1, 'lsp', 'Linden Precision Parts'],
  ['Maritime & offshore', 0, .8, 'ksp', 'Kalmarsund Offshore Tech'], ['Energy', 0, 1.1, 'ksp', 'Ölandsvind Energy'], ['Health & life science', 1, .9, 'lsp', 'Vättern Clinical Software'],
  ['Software & IT', 0, 1, 'jsp', 'Tabergs Cloud Services'], ['Advanced manufacturing', 1, 1.2, 'jsp', 'Gjuteri Digital'], ['Maritime & offshore', 1, 1, 'cv', 'Göteborg Wave Instruments'],
  ['Energy', 0, .8, 'cv', 'Hav Storage Systems'], ['Software & IT', 0, 1.1, 'jsp', 'Kronoberg AI Works'],
]
export const DEMO_COMPANIES = SPEC.map(([sector, share, level, park, fname], i) => {
  const id = 'dc' + String(i + 1).padStart(2, '0')
  const top = Object.entries(PREF[sector]).sort((a, b) => b[1] - a[1]).map(x => x[0])
  return { id, name: fname, park, isDemo: true, sector, share: !!share, level, wants: WANTS[sector], interests: top.slice(i % 2, (i % 2) + 2) }
})

const TERMS = {
  // Terms are chosen so most return results, except where noted: Energy (hydrogen, storage, solar) and a few testing terms
  // have no matching listing in the current catalogue, which gives the "unmet demand" views something real to find.
  'Testing environments': ['testbed', 'test lab', 'pilot site', 'lab', 'pilot', 'test bed', 'offshore test site', 'battery testing', 'wave tank test'],
  'Funding & grants': ['eic accelerator', 'grant', 'funding', 'eic', 'funding for prototypes', 'horizon europe'],
  Cybersecurity: ['nis2', 'cyber resilience act', 'cybersecurity', 'security audit'],
  'Defence supply': ['defence supplier', 'fmv', 'defence workshop', 'defence'],
  'AI & data': ['ai agent', 'machine learning', 'generative ai', 'ai agent'],
  Energy: ['hydrogen', 'energy storage', 'energy', 'hydrogen', 'solar'],
  'Maritime & offshore': ['offshore', 'marine monitoring', 'autonomous vessels', 'coastal technology', 'marine'],
  'IoT & sensors': ['iot sensors', 'sensors', 'edge computing', 'sensors'],
  'Digital health': ['digital health', 'health', 'medtech'],
  'Events & networking': ['workshop', 'info day', 'workshop', 'networking event'],
  'International growth': ['export', 'eu partners', 'international market', 'growth', 'scale up'],
  'Partners & expertise': ['research collaboration', 'partner', 'collaboration', 'advisor', 'find partner'],
}
const TOPIC_CAT = { 'Testing environments': 'testing', 'Funding & grants': 'funding', 'Events & networking': 'events', 'Partners & expertise': 'people' }

let cache
export function demoEvents(now = new Date()) {
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0)
  const key = today0.getTime()
  if (cache?.key === key) return cache.events
  const rand = rng(20261114)
  const pick = a => a[Math.floor(rand() * a.length)]
  const wpick = (items, w) => { const t = items.reduce((s, x) => s + w(x), 0); let r = rand() * t; for (const x of items) { r -= w(x); if (r <= 0) return x } return items[items.length - 1] }
  const out = []
  const N = 180
  const countHits = term => MEMBER_OPPS.filter(o => matchesQ({ o }, term))
  const hitCache = new Map()
  const hits = term => { if (!hitCache.has(term)) hitCache.set(term, countHits(term)); return hitCache.get(term) }
  let n = 0
  const ev = (company, ts, type, extra) => { if (ts <= now.getTime()) out.push({ id: 'd' + (n++), ts: Math.round(ts), type, company: company.id, sector: company.sector, src: 'demo', env: 'simulated', ...extra }) }

  for (const c of DEMO_COMPANIES) {
    ev(c, key - (N - 12) * DAY + 9 * 36e5, 'interests_set', { sid: `${c.id}-set`, interests: c.interests, wants: c.wants })
  }
  // Simulated profile edits: some companies add a topic to their stated interests over time (so "stated interests" can grow).
  for (const [cid, topic, daysAgo] of [['dc01', 'Energy', 25], ['dc07', 'Energy', 8], ['dc12', 'Energy', 3], ['dc03', 'Testing environments', 20], ['dc10', 'Defence supply', 12], ['dc14', 'Defence supply', 4], ['dc04', 'AI & data', 15], ['dc11', 'AI & data', 6], ['dc05', 'Funding & grants', 9], ['dc09', 'Cybersecurity', 35], ['dc13', 'Testing environments', 40]]) {
    const c = DEMO_COMPANIES.find(x => x.id === cid)
    ev(c, key - daysAgo * DAY + 10 * 36e5, 'interests_set', { sid: `${cid}-edit-${daysAgo}`, interests: [...new Set([...c.interests, topic])], wants: c.wants })
  }
  for (let d = 0; d < N; d++) {
    const dayStart = key - (N - 1 - d) * DAY
    const dow = new Date(dayStart).getDay()
    const weekend = dow === 0 || dow === 6
    for (const c of DEMO_COMPANIES) {
      const sessions = rand() < (weekend ? .05 : .62) * c.level ? (rand() < .35 ? 2 : 1) : 0
      for (let s = 0; s < sessions; s++) {
        const sid = `${c.id}-${d}-${s}`
        let t = dayStart + (8 + rand() * 9) * 36e5
        const step = (type, extra, dt = 0) => { t += dt; ev(c, t, type, { sid, ...extra }) }
        const ramp = Math.max(0, Math.min(1, (d - (N - 28)) / 14))
        const topic = wpick(Object.keys(TERMS), tp => (PREF[c.sector][tp] || .35) * (tp === 'Testing environments' ? 1 + 3 * ramp : tp === 'Energy' ? 1 + .5 * ramp : tp === 'Events & networking' ? 1 - .55 * ramp : tp === 'Cybersecurity' ? 1 - .3 * ramp : 1))
        let pool, opp
        if (rand() < .7) {
          const term = pick(TERMS[topic])
          const found = hits(term)
          step('search', { term, topic: groupTopic(term), resultCount: found.length, cat: 'all', page: 'overview' })
          for (const o of found.slice(0, 3)) step('shown', { oppId: o.id, cat: o.mcat, page: 'search' }, 700)
          pool = found; opp = found.length && rand() < .62 ? wpick(found, o => (o.id === 'o2' ? 3 : isPark(o) ? 4 : 1)) : null
          if (!found.length && rand() < .08) { const f = MEMBER_OPPS.filter(o => OPP_TOPICS.get(o.id).includes(topic)); opp = f.length ? pick(f) : null }
        } else {
          const cat = TOPIC_CAT[topic] || 'knowledge'
          pool = MEMBER_OPPS.filter(o => o.mcat === cat && (OPP_TOPICS.get(o.id).includes(topic) || rand() < .3))
          for (const o of pool.slice(0, 3)) step('shown', { oppId: o.id, cat, page: cat }, 700)
          opp = pool.length && rand() < .55 ? wpick(pool, o => (o.id === 'o2' ? 3 : isPark(o) ? 4 : 1)) : null
        }
        if (opp) {
          step('view', { oppId: opp.id, cat: opp.mcat, page: 'detail' }, 20e3 + rand() * 70e3)
          if (rand() < (opp.id === 'o2' ? .03 : .3)) step('save', { oppId: opp.id, cat: opp.mcat, page: 'detail' }, 10e3 + rand() * 30e3)
          if (opp.url && rand() < .35) step('click_source', { oppId: opp.id, cat: opp.mcat, page: 'detail' }, 5e3 + rand() * 20e3)
          if (rand() < .04) step('not_relevant', { oppId: opp.id, cat: opp.mcat, page: 'detail' }, 4e3)
        }
      }
    }
  }
  out.sort((a, b) => a.ts - b.ts)
  cache = { key, events: out }
  return out
}
