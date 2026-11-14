import { OPPS, fmt, isLive, urgency, sortTs } from '../demoData.js'

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

export const DEFAULT_PROFILE = {
  name: 'Alex Morgan', email: '', title: 'Operations lead',
  company: 'Kustvind Technologies', sector: 'Maritime & offshore', about: 'Fictional demo company building sensor systems for coastal and offshore monitoring.',
  website: 'https://kustvind.example', location: 'Karlskrona, Sweden', size: '11–50',
  interests: ['Maritime technology', 'Sustainability', 'Funding', 'Energy'],
  wants: ['funding', 'events', 'testing'], goals: ['Find funding', 'Test a product'],
}

// ---- sourced opportunities, mapped onto the member interest vocabulary ----
const MAP = { ai: ['AI'], security: ['Cybersecurity'], offshore: ['Maritime technology'], energy: ['Energy'], manufacturing: ['Advanced manufacturing'], growth: ['International growth'], eu: ['International growth'], deeptech: ['Research collaboration'] }
const SECT = { ai: 'Software & IT', security: 'Software & IT', cloud: 'Software & IT', offshore: 'Maritime & offshore', energy: 'Energy', manufacturing: 'Advanced manufacturing' }
const uniq = a => [...new Set(a)]
const sourced = OPPS.map(o => ({
  ...o, mcat: o.cat, provider: o.source,
  online: /^online/i.test(o.where),
  kind: o.cat === 'knowledge' ? 'Course' : undefined,
  tags: uniq([...o.topics.flatMap(t => MAP[t] || []), ...(o.cat === 'funding' ? ['Funding'] : [])]),
  sectors: uniq(o.topics.map(t => SECT[t]).filter(Boolean)),
  goals: uniq([...(o.cat === 'funding' ? ['Find funding'] : ['Build skills']), ...(o.topics.some(t => t === 'eu' || t === 'growth') ? ['Grow internationally'] : [])]),
}))

// ---- fictional demo entries ----
const pad = n => String(n).padStart(2, '0')
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const D = (id, cat, title, summary, x) => ({ id, cat, mcat: cat === 'experts' || cat === 'collab' ? 'people' : cat, title, summary, demo: true, urg: [], urgLabel: '', where: '', next: 'View details', tags: [], sectors: [], goals: [], ...x })

const fictional = [
  D('d1', 'events', 'Coastal technology meetup', 'An evening for companies building maritime and coastal technology, with short demos and time to meet potential partners.', { start: day(9), urg: [day(6)], urgLabel: 'Registration closes', where: 'Karlskrona, in person', online: false, provider: 'Harbour Innovation Network (fictional)', audience: 'Founders and technical leads in maritime technology', eligibility: 'Free for member companies.', tags: ['Maritime technology', 'Sustainability'], sectors: ['Maritime & offshore'], goals: ['Find partners'], next: 'Register (demo)' }),
  D('d2', 'events', 'Hands-on workshop: IoT sensors in harsh environments', 'A practical half-day on choosing, deploying and maintaining sensors outdoors and at sea.', { start: day(21), urg: [day(18)], urgLabel: 'Registration closes', where: 'Online', online: true, provider: 'Northern Makers Lab (fictional)', audience: 'Engineers and product owners', tags: ['IoT', 'Advanced manufacturing'], sectors: ['Advanced manufacturing', 'Maritime & offshore'], goals: ['Build skills', 'Test a product'], next: 'Register (demo)' }),
  D('d3', 'events', 'Digital health pitch afternoon', 'Five health-tech companies pitch to clinicians and investors. Open to listen and ask questions.', { start: day(35), where: 'Online', online: true, provider: 'Care Tech Forum (fictional)', audience: 'Health-tech founders, clinicians, investors', tags: ['Digital health', 'AI'], sectors: ['Health & life science'], goals: ['Find partners', 'Grow internationally'], next: 'Register (demo)' }),
  D('d4', 'funding', 'Blue Growth Pilot Grant', 'Co-funding for pilots that take ocean and coastal technology from prototype to a first real deployment.', { urg: [day(12)], urgLabel: 'Application deadline', where: 'Online application', provider: 'Regional Innovation Fund (fictional)', amount: 'Up to SEK 500,000', eligibility: 'Small and medium-sized companies in the region with a working prototype.', audience: 'SMEs with a working prototype', tags: ['Maritime technology', 'Funding', 'Sustainability'], sectors: ['Maritime & offshore'], goals: ['Find funding', 'Test a product'], next: 'Start application (demo)' }),
  D('d5', 'funding', 'Regional Export Boost', 'Support for companies preparing their first sales push in a new international market.', { urg: [day(40)], urgLabel: 'Application deadline', where: 'Online application', provider: 'Trade & Export Council (fictional)', amount: 'Up to SEK 250,000', eligibility: 'Companies with at least one year of revenue.', tags: ['International growth', 'Funding'], goals: ['Find funding', 'Grow internationally'], next: 'Start application (demo)' }),
  D('d6', 'funding', 'Green Energy Prototype Support', 'Funding for prototypes that reduce energy use or enable renewable generation.', { urg: [day(25)], urgLabel: 'Application deadline', where: 'Online application', provider: 'Clean Transition Programme (fictional)', amount: 'SEK 100,000 to 1,000,000', eligibility: 'Companies with a prototype and a named test partner.', tags: ['Energy', 'Sustainability', 'Funding'], sectors: ['Energy'], goals: ['Find funding'], next: 'Start application (demo)' }),
  D('d7', 'testing', 'Coastal test bed access', 'Book time at a sheltered coastal test area with quay access and wave and current monitoring.', { urg: [day(30)], urgLabel: 'Application deadline', where: 'Karlskrona archipelago', kind: 'Testbed', provider: 'Blekinge Ocean Lab (fictional)', facilities: 'Sheltered test area, quay access, wave and current sensors, workshop space', requirements: 'Safety briefing and liability insurance. Test plan reviewed before booking.', audience: 'Companies testing marine hardware or sensors', tags: ['Maritime technology', 'IoT', 'Sustainability'], sectors: ['Maritime & offshore'], goals: ['Test a product'], next: 'Request access (demo)' }),
  D('d8', 'testing', 'Cybersecurity lab pilot slot', 'A limited pilot slot to test a product against realistic attack scenarios in an isolated lab.', { urg: [day(18)], urgLabel: 'Application deadline', where: 'Karlskrona, on site', kind: 'Lab', provider: 'Secure Systems Lab (fictional)', facilities: 'Isolated network lab, red-team tooling, monitoring', requirements: 'Signed non-disclosure agreement. Two staff on site for one week.', tags: ['Cybersecurity', 'AI'], sectors: ['Software & IT'], goals: ['Test a product'], next: 'Request access (demo)' }),
  D('d9', 'testing', 'Smart factory pilot line', 'Try your automation or monitoring idea on a small production line used for research.', { where: 'Karlskrona, on site', kind: 'Pilot site', provider: 'Industry Pilot Hub (fictional)', facilities: 'Small assembly line, machine data gateway, edge computing rack', requirements: 'Project outline and a named contact. Availability agreed case by case.', tags: ['Advanced manufacturing', 'IoT', 'AI'], sectors: ['Advanced manufacturing'], goals: ['Test a product', 'Find partners'], next: 'Request access (demo)' }),
  D('d10', 'testing', 'Digital health sandbox', 'A safe environment with synthetic patient data for testing digital health tools.', { urg: [day(50)], urgLabel: 'Application deadline', where: 'Online', kind: 'Testbed', provider: 'Health Data Sandbox (fictional)', facilities: 'Synthetic datasets, secure cloud workspace', requirements: 'Description of the tool and its intended users.', tags: ['Digital health', 'AI'], sectors: ['Health & life science'], goals: ['Test a product'], next: 'Request access (demo)' }),
  D('d11', 'knowledge', 'Offshore energy and sustainability: trend briefing', 'A short briefing on where offshore energy and sustainable marine technology are heading over the next three years.', { where: 'Online reading', kind: 'Briefing', provider: 'Baltic Technology Review (fictional)', audience: 'Leaders and product owners', tags: ['Energy', 'Sustainability', 'Maritime technology'], sectors: ['Energy', 'Maritime & offshore'], goals: ['Build skills'], next: 'Read briefing (demo)' }),
  D('d12', 'knowledge', 'AI in manufacturing: a practical guide', 'What works, what does not, and how small companies can start with AI on the factory floor.', { where: 'Online reading', kind: 'Report', provider: 'Industry Digital Lab (fictional)', tags: ['AI', 'Advanced manufacturing'], sectors: ['Advanced manufacturing'], goals: ['Build skills'], next: 'Read report (demo)' }),
  D('d13', 'knowledge', 'Cybersecurity for small companies: what NIS2 means for you', 'A plain-language explainer on new security obligations and the first steps for a small company.', { where: 'Online reading', kind: 'Briefing', provider: 'Digital Trust Centre (fictional)', tags: ['Cybersecurity'], sectors: ['Software & IT'], goals: ['Build skills'], next: 'Read briefing (demo)' }),
  D('d14', 'experts', 'Dr. Mira Lindqvist, marine robotics', 'Researcher in autonomous vessels and underwater robotics, open to short advisory projects.', { where: 'Karlskrona', provider: 'Fictional researcher', expertise: 'Marine robotics, autonomous vessels, sensor fusion', collab: 'Open to research collaboration and advisory work', tags: ['Maritime technology', 'AI', 'Research collaboration'], sectors: ['Maritime & offshore'], goals: ['Find partners'], next: 'Request intro (demo)' }),
  D('d15', 'experts', 'Jonas Berg, funding adviser', 'Helps small companies choose, write and manage regional and EU funding applications.', { where: 'Online or in person', provider: 'Fictional adviser', expertise: 'Grant applications, EU programmes, budgeting', collab: 'Offers a free first consultation to members', tags: ['Funding', 'International growth'], goals: ['Find funding'], next: 'Request intro (demo)' }),
  D('d16', 'collab', 'Nordlight Sensors', 'Fictional sensor company looking for pilot partners with offshore access.', { where: 'Göteborg', provider: 'Fictional company', expertise: 'Low-power sensors, wireless data links', collab: 'Seeking offshore pilot partners and integrators', tags: ['IoT', 'Maritime technology', 'Energy'], sectors: ['Maritime & offshore', 'Energy'], goals: ['Find partners', 'Test a product'], next: 'Request intro (demo)' }),
  D('d17', 'collab', 'GreenGrid Analytics', 'Fictional analytics company working on energy forecasting and grid optimisation.', { where: 'Malmö', provider: 'Fictional company', expertise: 'Energy forecasting, machine learning, grid data', collab: 'Looking for data partners in renewable energy', tags: ['Energy', 'AI', 'Sustainability'], sectors: ['Energy', 'Software & IT'], goals: ['Find partners'], next: 'Request intro (demo)' }),
].map(o => {
  const dates = [...o.urg, o.start].filter(Boolean).sort()
  return { ...o, end: o.end || (dates.length ? dates[dates.length - 1] : day(365)), dateText: o.start ? `${fmt(o.start)}` : '' }
})

export const MEMBER_OPPS = [...sourced, ...fictional]
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
