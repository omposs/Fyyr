import { isLive, urgency, sortTs } from '../demoData.js'
import { listOpportunities } from '../data/repository.js'

// ---- member-area demo data and the one shared matching function ----
// Sourced opportunities come from ../demoData.js (real dates and links, unchanged).
// Entries flagged demo:true are fictional and relative to today, so the area never looks expired.

export const MCATS = [
  { id: 'events', label: 'Events & workshops', short: 'Events', icon: 'events', blurb: 'Workshops, info days and meetups that fit what you are building.' },
  { id: 'funding', label: 'Funding', short: 'Funding', icon: 'funding', blurb: 'Grants and calls that could suit your company. Always check eligibility at the source.' },
  { id: 'testing', label: 'Testing & pilots', short: 'Testing', icon: 'testing', blurb: 'Labs, testbeds and pilot sites to validate your ideas.' },
  { id: 'knowledge', label: 'Knowledge & trends', short: 'Knowledge', icon: 'knowledge', blurb: 'Courses, briefings and reports in the areas you work in.' },
  { id: 'people', label: 'Experts & partners', short: 'Partners', icon: 'experts', blurb: 'People and companies whose expertise complements yours.' },
]
export const MCAT = Object.fromEntries(MCATS.map(c => [c.id, c]))

export const INTERESTS = ['AI', 'Cybersecurity', 'Maritime technology', 'Sustainability', 'IoT', 'Digital health', 'Energy', 'Advanced manufacturing', 'Funding', 'Research collaboration', 'International growth']
export const SECTORS = ['Maritime & offshore', 'Energy', 'Software & IT', 'Advanced manufacturing', 'Health & life science', 'Other']
export const GOALS = ['Find funding', 'Find partners', 'Test a product', 'Grow internationally', 'Build skills']
export const SIZES = ['1–10', '11–50', '51–250', '250+']

// Account details that belong to the organisation, not the member. They are read-only: the profile store ignores any attempt to change them.
// Company facts are from Saab's own site (saab.com/about/company-in-brief, read 14 Nov 2026). Role, sector, business unit and workplace are configured profile labels scoped to Karlskrona, not official Saab data.
export const LOCKED_PROFILE = {
  name: 'Stefan Ungureanu', title: 'Head of Operations — Karlskrona', company: 'Saab', sector: 'Maritime Research',
  about: 'Serves the global market of governments, authorities and corporations with products, services and solutions ranging from military defence to civil security.',
  website: 'https://www.saab.com', location: 'Linköping, Sweden (registered office)', size: 'About 26,100 employees (2025)',
  // Configured profile labels, not verified official Saab divisions. No street address is recorded.
  unit: 'Maritime Research & Operations — Karlskrona', workplace: 'Karlskrona, Sweden', office: 'Karlskrona',
}
export const EDITABLE_PROFILE_KEYS = ['email', 'interests']
export const DEFAULT_PROFILE = {
  ...LOCKED_PROFILE, email: '',
  interests: ['Maritime technology', 'Sustainability', 'Funding', 'Energy'],
  wants: ['funding', 'events', 'testing'], goals: ['Find funding', 'Test a product'],
}

// Opportunities come from the repository (src/data/repository.js): sourced public records plus, while enabled, fictional demo records.
// Created opportunities are merged on top by events/sync.js and never stored here.
export const MEMBER_OPPS = listOpportunities()
export const OPP_BY_ID = Object.fromEntries(MEMBER_OPPS.map(o => [o.id, o]))

// ---- matching: one deterministic function used everywhere ----
// interest tag +3, interest mentioned in the text +2, sector +2, each goal +1 (max 2), wanted opportunity type +1.
// Strong match >= 6, Relevant to you >= 2. Anything lower is unlabelled.
const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ')
export const normInterest = norm
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const list = a => (a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
export const isPersonal = p => !!(p.interests.length || p.goals.length || p.wants.length || p.sector)

export function scoreOpp(o, p) {
  const reasons = []
  let s = 0
  const tags = o.tags.map(norm)
  const text = norm([o.title, o.summary, o.expertise, o.facilities].filter(Boolean).join(' '))
  const hit = []
  for (const i of p.interests) {
    const n = norm(i)
    if (tags.includes(n)) { s += 3; hit.push(i) } else if (n.length >= 2 && new RegExp(`(^|[^a-z0-9])${esc(n)}([^a-z0-9]|$)`).test(text)) { s += 2; hit.push(i) }
  }
  if (hit.length) reasons.push(`Matches your interest in ${list(hit.slice(0, 2))}${hit.length > 2 ? ` and ${hit.length - 2} more` : ''}`)
  if (p.sector && o.sectors.includes(p.sector)) { s += 2; reasons.push(`Matches your sector: ${p.sector}`) }
  const goals = p.goals.filter(g => o.goals.includes(g)).slice(0, 2)
  if (goals.length) { s += goals.length; reasons.push(`Fits your goal: ${list(goals)}`) }
  if (p.wants.includes(o.mcat)) { s += 1; reasons.push(`You asked for ${MCAT[o.mcat].label.toLowerCase()}`) }
  return { score: s, reasons }
}

export const strengthLabel = x => (x.strength === 'strong' ? 'Strong match' : x.strength === 'relevant' ? 'Relevant to you' : null)
const tsCmp = (a, b) => (a.ts == null ? (b.ts == null ? 0 : 1) : b.ts == null ? -1 : a.ts - b.ts)

// Every opportunity (live or expired) with score, strength and its governing date, in default order:
// strongest match, then nearest deadline (undated last), then data order. Without a usable profile everything
// is unscored and ordered by date only: a general discovery feed.
export function rank(p, now = new Date()) {
  const personal = isPersonal(p)
  const all = MEMBER_OPPS.map((o, idx) => {
    const u = urgency(o, now)
    const m = personal ? scoreOpp(o, p) : { score: 0, reasons: [] }
    return { o, idx, u, ts: sortTs(u), live: isLive(o, now), score: m.score, reasons: m.reasons, strength: m.score >= 6 ? 'strong' : m.score >= 2 ? 'relevant' : null }
  }).sort((a, b) => b.score - a.score || tsCmp(a, b) || a.idx - b.idx)
  return { all, live: all.filter(x => x.live), personal }
}
export const byDate = (a, b) => tsCmp(a, b) || b.score - a.score || a.idx - b.idx

export const haystack = o => norm([o.title, o.summary, o.provider, o.where, o.expertise, o.kind, ...o.tags].filter(Boolean).join(' '))
export const matchesQ = (x, q) => { const t = norm(q); return !t || t.split(' ').every(w => (x._h ??= haystack(x.o)).includes(w)) }

// ---- Blue Science Park content ----
// Park-organised content is identified by an explicit publisherId on the record, never by words in a title or provider name.
// Staff-created records get it when they are saved (events/eventStore.js); sourced and demo records set it in their own data.
export const PARK_ID = 'bsp'
export const isPark = o => o.publisherId === PARK_ID
// Hub grouping comes from the category: events are activities, knowledge items are news, everything else is a programme or opportunity.
export const hubKind = o => (o.mcat === 'events' ? 'activity' : o.mcat === 'knowledge' ? 'news' : 'programme')
export const HUB_LABEL = { activity: 'Event', programme: 'Programme or call', news: 'Announcement' }

// Up to n park items for the Overview. Scheduled activities come first by nearest date, then announcements by recency; never padded.
export const parkOrder = items => {
  const sched = items.filter(x => hubKind(x.o) !== 'news' && x.u).sort((a, b) => a.u.days - b.u.days || a.idx - b.idx)
  const rest = items.filter(x => !sched.includes(x)).sort((a, b) => (b.o.published || 0) - (a.o.published || 0) || a.idx - b.idx)
  return [sched, rest]
}
export const parkPicks = (live, n = 3) => {
  const [sched, rest] = parkOrder(live.filter(x => isPark(x.o)))
  const news = rest.filter(x => hubKind(x.o) === 'news')
  const out = [...sched.slice(0, 2), ...news.slice(0, 1)]
  for (const x of [...sched, ...rest]) if (out.length < n && !out.includes(x)) out.push(x)
  return out.slice(0, n)
}
