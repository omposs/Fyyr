// REAL public-source data, checked on CHECKED. Nothing here is fetched live: it is a snapshot.
// Companies: Blue Science Park members listed at https://www.bluesciencepark.se/vara-medlemmar/ .
// Profiles are built only from each company's own website and its Blue Science Park member page.
// The companies have not reviewed these profiles; demo edits stay local and never speak for them.
// Matching is a transparent overlap score (see score()), not a trained model.

export const CHECKED = '13 Nov 2026'
const BSP = 'https://www.bluesciencepark.se/medlem/'

export const CATS = [
  { id: 'events', label: 'Events & workshops', icon: 'events', blurb: 'Find workshops and conferences that fit what you are building.' },
  { id: 'funding', label: 'Funding', icon: 'funding', blurb: 'See grants and calls that could suit your company, with sources.' },
  { id: 'testing', label: 'Testing & pilots', icon: 'testing', blurb: 'Find labs, testbeds and pilot sites to validate your ideas.' },
  { id: 'knowledge', label: 'Knowledge & trends', icon: 'knowledge', blurb: 'Follow research and trends in the areas you work in.' },
  { id: 'experts', label: 'Experts', icon: 'experts', blurb: 'Reach people with the specialist knowledge you need.' },
  { id: 'collab', label: 'Collaborations', icon: 'collab', blurb: 'Discover companies whose expertise complements yours.' },
]
export const CAT = Object.fromEntries(CATS.map(c => [c.id, c]))

export const TOPIC = {
  cloud: 'Cloud infrastructure', security: 'Cybersecurity & compliance', ai: 'AI & data', defence: 'Defence & public sector',
  manufacturing: 'Manufacturing & industry', offshore: 'Offshore & marine', infrastructure: 'Infrastructure', energy: 'Energy',
  eu: 'EU innovation programmes', growth: 'Growth & investment', deeptech: 'Deep tech',
}

const S = (t, fact, ref) => ({ t, s: 'stated', from: 'public', fact, ref })
const I = t => ({ t, s: 'inferred', from: 'public' })
const F = (text, url, quote) => ({ text, url, quote, retrieved: CHECKED })

export const COMPANIES = [
  {
    id: 'cleura', name: 'Cleura', summary: 'Cloud infrastructure · Compliance-focused · Karlskrona',
    facts: [
      F('Provides cloud infrastructure as a service built on OpenStack.', 'https://cleura.com/', 'Cleura Cloud is powered by OpenStack'),
      F('Offers Compliant Cloud, Public Cloud and Private Cloud.', 'https://cleura.com/'),
      F('Names Defense, Public Sector, AI, Media, MedTech and Cybersecurity among its sectors.', 'https://cleura.com/'),
      F('Listed in Blue Science Park’s member directory (Karlskrona).', BSP + 'cleura/'),
    ],
    interests: [
      S('cloud', 0, 'provides cloud infrastructure on OpenStack'),
      S('security', 2, 'offers Compliant Cloud and lists Cybersecurity among its sectors'),
      S('ai', 2, 'lists AI among its sectors'),
      S('defence', 2, 'lists Defense and Public Sector among its sectors'),
      I('eu'), I('growth'),
    ],
  },
  {
    id: 'roxtec', name: 'Roxtec', summary: 'Cable and pipe sealing · Industry, marine, power · Karlskrona',
    facts: [
      F('Develops, manufactures and delivers flexible sealing solutions for cable and pipe penetrations.', 'https://www.roxtec.com/', 'Roxtec develops, manufactures and delivers flexible sealing solutions for cable and pipe penetrations.'),
      F('Lists Infrastructure, Manufacturing industry, Marine, Offshore oil & gas, Power and Process industries as its industries.', 'https://www.roxtec.com/en/industries/'),
      F('Serves cable and pipe seal users in more than 80 markets.', 'https://www.roxtec.com/'),
      F('Listed in Blue Science Park’s member directory (Karlskrona).', BSP + 'roxtec/'),
    ],
    interests: [
      S('manufacturing', 1, 'serves the manufacturing industry'),
      S('offshore', 1, 'serves the marine and offshore oil & gas industries'),
      S('infrastructure', 1, 'serves the infrastructure industry'),
      S('energy', 1, 'serves the power industry'),
      I('defence'), I('growth'),
    ],
  },
  {
    id: 'oht', name: 'Ocean Harvesting Technologies', summary: 'Wave energy · EU-funded prototypes · Karlskrona and Göteborg',
    facts: [
      F('Develops wave energy technology, including the 500 kW InfinityWEC point absorbing wave energy converter.', 'https://www.oceanharvesting.com/', 'InfinityWEC is a 500 kW point absorbing wave energy converter.'),
      F('Is validating its technology with prototypes in the EU-funded projects INFINITY and WECHULL+.', 'https://www.oceanharvesting.com/'),
      F('Is based in Göteborg and Karlskrona, Sweden.', 'https://www.oceanharvesting.com/'),
      F('Listed in Blue Science Park’s member directory (Karlskrona), under Energy.', BSP + 'ocean-harvesting/'),
    ],
    interests: [
      S('energy', 0, 'develops wave energy converters'),
      S('offshore', 0, 'develops wave energy converters'),
      S('eu', 1, 'is validating prototypes in EU-funded projects'),
      I('deeptech'), I('growth'),
    ],
  },
]

// urg: dates that create urgency (deadline / registration / cut-off); label says what each date is.
// end: last date on which the item is still relevant; items past it are never shown.
export const OPPS = [
  { id: 'o1', cat: 'funding', title: 'EIC Accelerator', summary: 'EU funding for SMEs and start-ups with innovations ready to scale: a grant component of up to EUR 2.5M, with equity investment of EUR 1M to 10M.', note: 'Open to SMEs established in an EU Member State or an Associated Country.', source: 'European Innovation Council (EISMEA)', url: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en', topics: ['deeptech', 'growth', 'eu'], urg: ['2027-01-20', '2027-03-17', '2027-09-01', '2027-11-04'], urgLabel: 'Next evaluation cut-off', dateText: 'Cut-offs: 20 Jan, 17 Mar, 1 Sep and 4 Nov 2027', where: 'Online (EU Funding & Tenders Portal)', end: '2027-11-04', next: 'Check the call' },
  { id: 'o2', cat: 'funding', title: 'EIC Pathfinder', summary: 'EU research funding of up to EUR 4M for early-stage, high-risk deep-tech work.', note: 'Applications are made by consortia of at least three independent legal entities.', source: 'European Innovation Council (EISMEA)', url: 'https://eic.ec.europa.eu/eic-funding-opportunities/eic-pathfinder_en', topics: ['deeptech', 'eu'], urg: ['2027-02-25', '2027-09-16'], urgLabel: 'Next deadline', dateText: 'Stage 1: 25 Feb 2027 · Stage 2: 16 Sep 2027', where: 'Online (EU Funding & Tenders Portal)', end: '2027-09-16', next: 'Check the call' },
  { id: 'o3', cat: 'events', start: '2026-11-19', title: 'Online information day: EIC funding opportunities in 2027', summary: 'An information day covering EIC Pathfinder, Transition, Accelerator and STEP funding for 2027. Free registration.', source: 'European Innovation Council (EISMEA)', url: 'https://eic.ec.europa.eu/events/online-information-day-eic-funding-opportunities-2027-2026-11-19_en', topics: ['eu', 'growth', 'deeptech'], urg: ['2026-11-18'], urgLabel: 'Registration closes', dateText: 'Thu 19 Nov 2026, 09:30–15:40 CET', where: 'Online', end: '2026-11-19', next: 'View the event' },
  { id: 'o4', cat: 'events', start: '2026-11-20', title: 'Online info day: Accelerator Challenges 2027', summary: 'An information day on the 2027 Accelerator Challenges. The programme includes a session on ocean observation technologies for marine monitoring.', source: 'European Innovation Council (EISMEA)', url: 'https://eic.ec.europa.eu/events/online-info-day-accelerator-challenges-2027-2026-11-20_en', topics: ['eu', 'offshore', 'deeptech'], urg: ['2026-11-19'], urgLabel: 'Registration closes', dateText: 'Fri 20 Nov 2026, 09:00–12:30 CET', where: 'Online', end: '2026-11-20', next: 'View the event' },
  { id: 'o5', cat: 'funding', title: 'Strengthening EU cybersecurity capacities and capabilities (CYBER-11-EULEG)', summary: 'A Digital Europe call on strengthening EU cybersecurity capacities in line with legislative requirements, including the Cyber Resilience Act and NIS 2.', note: 'Eligibility not verified: the call page could not be read when checked.', source: 'European Commission, Digital Europe programme', url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/DIGITAL-ECCC-2027-DEPLOY-CYBER-11-EULEG', topics: ['security', 'eu', 'cloud'], urg: ['2027-01-14'], urgLabel: 'Call closes', dateText: 'Open 1 Sep 2026 – 14 Jan 2027', where: 'Online (EU Funding & Tenders Portal)', end: '2027-01-14', next: 'Check the call' },
  { id: 'o6', cat: 'funding', title: 'New approaches for human/AI collaboration for the workforce of the future', summary: 'A Digital Europe call on new approaches to human/AI collaboration, linked to the Made in Europe and AI, Data and Robotics partnerships.', note: 'Eligibility not verified when checked.', source: 'European Commission, Digital Europe programme', url: 'https://digital-strategy.ec.europa.eu/en/funding/new-approaches-humanai-collaboration-workforce-future', topics: ['ai', 'eu'], urg: ['2027-02-02'], urgLabel: 'Call closes', dateText: 'Open 13 Oct 2026 – 2 Feb 2027', where: 'Online (EU Funding & Tenders Portal)', end: '2027-02-02', next: 'Check the call' },
  { id: 'o7', cat: 'events', start: '2027-01-20', title: 'Workshop series: becoming a supplier to defence companies and FMV', summary: 'Three workshops for companies that want to supply defence companies and the Swedish Defence Materiel Administration, run by Almi and Business Blekinge with Marine Technology Center of Sweden.', note: 'Free, subject to a de minimis declaration. The form is an interest registration, not a binding booking.', source: 'Almi', url: 'https://www.almi.se/kunskap-och-inspiration/kalender/workshopserie-sa-blir-du-leverantor-till-forsvarsindustrin/', topics: ['defence', 'manufacturing', 'growth'], urg: [], urgLabel: '', dateText: 'Sessions 20 Jan, 10 Feb and 10 Mar 2027', where: 'Karlskrona (venue to be announced)', end: '2027-03-10', next: 'See details' },
  { id: 'o8', cat: 'events', start: '2026-11-25', title: 'Nästa steg – gör företaget redo för uppgång', summary: 'A free event for business leaders in Blekinge on timing growth and investment decisions. Lunch and refreshments included.', source: 'Almi', url: 'https://www.almi.se/kunskap-och-inspiration/kalender/nasta-steg--gor-foretaget-redo-for-uppgang-karlskrona/', topics: ['growth'], urg: ['2026-11-20'], urgLabel: 'Registration closes', dateText: 'Wed 25 Nov 2026, 11:30–15:30', where: 'The Pot, Blekingegatan 1, Karlskrona', end: '2026-11-25', next: 'View the event' },
  { id: 'o9', cat: 'knowledge', title: 'Bygg en AI-agent för verksamheten', summary: 'A four-session practical course on building a working AI agent for a real challenge in your organisation, from Tech Concept Lab (Blue Science Park) with AI Lab Blekinge and AI Factory Blekinge.', note: 'The registration deadline shown on the page (30 Oct 2026) has passed. Ask the organiser whether places remain.', source: 'Tech Concept Lab', url: 'https://techconceptlab.com/event/bygg-en-ai-agent-for-verksamheten/', topics: ['ai'], urg: ['2026-10-30'], urgLabel: 'Registration closed', dateText: 'Sessions 19, 24, 26 and 30 Nov 2026', where: 'In person, Karlskrona', end: '2026-11-30', next: 'Ask the organiser' },
]

export const fmt = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const daysUntil = (iso, now = new Date()) => Math.round((new Date(iso + 'T00:00:00') - startOfDay(now)) / 864e5)

// Items past their end date are never shown, so the page cannot present expired events as upcoming.
// An item whose every registration/application date has passed is closed, so it is not an upcoming opportunity either.
export const isLive = (o, now = new Date()) => daysUntil(o.end, now) >= 0 && !(o.urg.length && o.urg.every(x => daysUntil(x, now) < 0))
// The date that governs an item: its next registration/application deadline, otherwise its event date
// (labelled 'Event date', never 'Deadline'), otherwise null (undated).
export function urgency(o, now = new Date()) {
  const iso = o.urg.find(x => daysUntil(x, now) >= 0)
  if (iso) return { iso, days: daysUntil(iso, now), kind: 'deadline', label: `${o.urgLabel} ${fmt(iso)}` }
  if (o.start && daysUntil(o.start, now) >= 0) return { iso: o.start, days: daysUntil(o.start, now), kind: 'event', label: `Event date ${fmt(o.start)}` }
  return null
}
// Real timestamp for sorting (never a formatted string). Undated items return null.
export const sortTs = u => (u ? new Date(u.iso + 'T23:59:59').getTime() : null)

// Transparent overlap score: stated or user-confirmed = 2, inferred = 1, dismissed = 0, prioritised category = +2.
// A stated interest stops counting if the user marks its source fact as incorrect.
export function score(opp, p) {
  let s = 0
  const hits = []
  for (const t of opp.topics) {
    const it = p.interests.find(x => x.t === t)
    if (!it || it.s === 'dismissed' || (it.s === 'stated' && p.wrong.includes(it.fact))) continue
    s += it.s === 'inferred' ? 1 : 2
    hits.push(it)
  }
  const prio = p.priorities.includes(opp.cat)
  if (prio && s > 0) s += 2 // a priority only boosts something that already relates to the profile
  return { s, hits, prio: prio && s > 0 }
}
export const matchLabel = s => (s >= 5 ? 'Strong match' : s >= 3 ? 'Good match' : 'Possible match')

const list = a => (a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
export function why(opp, r, company) {
  const stated = [...new Set(r.hits.filter(h => h.s === 'stated').map(h => h.ref))]
  const conf = r.hits.filter(h => h.s === 'confirmed').map(h => TOPIC[h.t])
  const inf = r.hits.filter(h => h.s === 'inferred').map(h => TOPIC[h.t])
  const parts = []
  if (stated.length) parts.push(`From public sources: ${company.name} ${list(stated)}.`)
  if (conf.length) parts.push(`You confirmed an interest in ${list(conf)} in this demo.`)
  if (inf.length) parts.push(`Also related to ${list(inf)}, which is inferred, not stated by the company.`)
  if (r.prio) parts.push(`You prioritised ${CAT[opp.cat].label.toLowerCase()} in this demo.`)
  return parts.join(' ') || 'Saved by you.'
}
