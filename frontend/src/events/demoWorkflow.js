import { blankEvent, getEvent, listEvents, saveEvent, todayIso } from './eventStore.js'
import { PARK_RICH } from './demoRichPark.js'

// ============================================================================================
// DEMO opportunity workflow. Sixteen clearly FICTIONAL opportunities created through the normal staff store (eventStore.js), so they
// appear in staff management (status tabs), staff analytics, the member area ("From Blue Science Park", categories, upcoming) with the
// SAME ids. Every record carries `demoSeed`, which the member area renders as a "Demo" listing: no real registration link, no real
// funding, no commitment by any company. Nothing here touches the backend.
//
// Repeatable: records are keyed by a stable id. A missing id is added once; a record you edited, published, archived or deleted is
// never overwritten or re-added. Records you have not touched only get their dates moved forward so the demo stays current
// (dates are stored relative to today, see `rel`).
// `demoSeed` also holds the knobs for the SIMULATED activity generated in staff/demoEvents.js (pop = interest level, save/click = rates,
// sectors = which simulated company sectors care most, pubAgo = days since publication).
// ============================================================================================
const KEY = 'fyyr.staff.demoseed.v1' // { [id]: updated timestamp of the last untouched write } ; ids present = seeded once
const ACTOR = { role: 'staff', email: 'demo-seed', companyId: '' }
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const INV = slug => `https://demo.invalid/fyyr/${slug}` // reserved, never-resolving address: a demo listing has no working link

const ev = (slug, o) => ({ category: 'events', status: 'published', type: 'Workshop', mode: 'in-person', location: 'Karlskrona', tz: 'Europe/Stockholm', start: '09:00', end: '12:00', regUrl: INV('register/' + slug), ...o, slug })
const fund = (slug, o) => ({ category: 'funding', status: 'published', regUrl: INV('apply/' + slug), link: INV('apply/' + slug), ...o, slug })
const test = (slug, o) => ({ category: 'testing', status: 'published', regUrl: INV('enquire/' + slug), link: INV('enquire/' + slug), ...o, slug })
const know = (slug, o) => ({ category: 'knowledge', status: 'published', regUrl: INV('read/' + slug), link: INV('read/' + slug), ...o, slug })
const peer = (slug, o) => ({ category: 'people', status: 'published', ...o, slug })

const SEC = { sea: 'Maritime & offshore', it: 'Software & IT', man: 'Advanced manufacturing', en: 'Energy' }

// rel: day offsets from today for each date field. meta: simulated-activity knobs.
export const SEED = [
  ev('autonomy-day', { title: 'Maritime autonomy demonstration day', type: 'Conference', description: 'A day of live demonstrations of uncrewed vessels and subsea vehicles, with short talks on safety cases, sensing and regulation. Open to member companies and invited guests.', tags: ['autonomy', 'maritime', 'demonstration'], rel: { date: 21, regDeadline: 14 }, meta: { pop: 4.6, save: .34, click: .5, sectors: [SEC.sea, SEC.man], pubAgo: 19 }, start: '09:30', end: '16:00' }),
  ev('cyber-workshop', { title: 'Cybersecurity workshop for connected industry', description: 'A hands-on workshop on securing connected equipment in industrial settings: asset inventories, secure updates and incident response. Bring a real system you want to discuss.', tags: ['cybersecurity', 'industry', 'IoT'], rel: { date: 12, regDeadline: 9 }, meta: { pop: 3.6, save: .05, click: .45, sectors: [SEC.it, SEC.man], pubAgo: 24 } }),
  ev('ai-workshop', { title: 'AI adoption workshop for small and medium companies', mode: 'online', location: '', link: 'https://demo.invalid/fyyr/online/ai-workshop', description: 'A practical online session on choosing a first AI use case, preparing data and judging results. Includes a short exercise and time for questions.', tags: ['AI', 'data', 'adoption'], rel: { date: 34, regDeadline: 28 }, meta: { pop: 2.5, save: .22, click: .4, sectors: [SEC.it, SEC.man], pubAgo: 10 }, start: '13:00', end: '15:00' }),
  ev('networking', { title: 'Cross-company innovation networking session', type: 'Networking', description: 'An evening of structured introductions between companies from different sectors, built around short problem pitches and open conversation.', tags: ['networking', 'collaboration', 'innovation'], rel: { date: 8, regDeadline: 5 }, meta: { pop: 3.2, save: .3, click: .4, sectors: [SEC.sea, SEC.it, SEC.en], pubAgo: 16 }, start: '17:00', end: '20:00' }),
  ev('iot-meetup', { title: 'IoT in practice: member lightning talks', type: 'Meetup', status: 'draft', description: 'Five-minute talks on IoT deployments that worked, and ones that did not, followed by an open discussion.', tags: ['IoT', 'sensors'], rel: { date: 45, regDeadline: 38 }, meta: { pop: 0, save: 0, click: 0, sectors: [], pubAgo: 0 }, start: '16:00', end: '18:00' }),
  ev('energy-webinar', { title: 'Energy systems and grid resilience webinar', type: 'Webinar', status: 'draft', mode: 'online', location: '', link: '', description: 'A webinar on resilience in local energy systems.', tags: ['energy', 'grid'], rel: { date: 52 }, regUrl: '', meta: { pop: 0, save: 0, click: 0, sectors: [], pubAgo: 0 } }),
  ev('past-infoday', { title: 'Blue growth funding info day', type: 'Info day', description: 'An information day about funding routes for marine and maritime technology companies, with time for one-to-one questions.', tags: ['funding', 'maritime'], rel: { date: -21, regDeadline: -26 }, meta: { pop: 3.1, save: .26, click: .4, sectors: [SEC.sea, SEC.en], pubAgo: 52 } }),
  ev('past-meetup', { title: 'Autumn technology meetup', type: 'Meetup', description: 'An informal meetup with short presentations from member companies and time to talk.', tags: ['meetup', 'technology'], rel: { date: -9, regDeadline: -12 }, meta: { pop: 2, save: .2, click: .3, sectors: [SEC.it, SEC.sea], pubAgo: 33 }, start: '17:00', end: '19:00' }),

  fund('marine-call', { title: 'Sustainable marine technology funding call (fictional)', description: 'A fictional funding call used to demonstrate how Fyyr lists funding. It does not exist and no money is offered.', tags: ['funding', 'marine', 'sustainability'], rel: { deadline: 16 }, meta: { pop: 3.8, save: .24, click: .5, sectors: [SEC.sea, SEC.en], pubAgo: 28 },
    x: { sharedAs: 'provider', provider: 'Fictional Blue Growth Programme', fundingType: 'Grant', amountMode: 'specified', amount: '50,000 to 250,000', currency: 'SEK', purpose: 'Fictional co-funding for pilots that reduce the environmental impact of marine technology.', eligibility: 'Fictional: small and medium companies in Sweden.', geography: 'Sweden', deadlineMode: 'date' } }),
  fund('digital-voucher', { title: 'Digitalisation voucher for small suppliers (fictional)', status: 'draft', description: 'A fictional voucher scheme used to demonstrate a draft funding listing.', tags: ['funding', 'digital'], rel: {}, meta: { pop: 0, save: 0, click: 0, sectors: [], pubAgo: 0 },
    x: { sharedAs: 'provider', provider: 'Fictional Digital Voucher Scheme', fundingType: 'Voucher or in-kind support', amountMode: 'notspecified', purpose: 'Fictional support for small suppliers adopting digital tools.', eligibility: 'Fictional: suppliers with fewer than 50 employees.', geography: 'Blekinge region', deadlineMode: 'rolling' } }),

  test('sensor-programme', { title: 'Sensor testing programme', description: 'A fictional programme that lets companies validate sensors in realistic coastal conditions, with guidance on test plans and data collection.', tags: ['sensors', 'testing', 'marine'], rel: {}, meta: { pop: 3.1, save: .28, click: .45, sectors: [SEC.sea, SEC.man], pubAgo: 30 },
    x: { kind: 'Testbed', locMode: 'site', location: 'Karlskrona coast (fictional)', capabilities: 'Fictional: moored and shore-based test stations with power and data links.', applications: 'Underwater and surface sensors, loggers and communication gear.', access: 'Fictional: a one-page test plan.', availMode: 'ongoing', cost: 'Fictional: free for demonstration purposes' } }),
  test('pilot-site', { title: 'Coastal pilot site access', description: 'A fictional pilot site where companies can run small field trials of autonomous or monitoring equipment.', tags: ['pilot', 'autonomy', 'coastal'], rel: { availFrom: -10, availTo: 60 }, meta: { pop: 1.7, save: .2, click: .3, sectors: [SEC.sea, SEC.en], pubAgo: 12 },
    x: { kind: 'Pilot site', locMode: 'site', location: 'Blekinge archipelago (fictional)', capabilities: 'Fictional: sheltered water, a small quay and a safety boat on request.', applications: 'Field trials of vessels, buoys and monitoring systems.', access: 'Fictional: safety briefing and a short project outline.', availMode: 'period', cost: '' } }),

  know('autonomy-briefing', { title: 'Trend briefing: autonomy in marine operations', description: 'A fictional short briefing summarising where autonomy is heading in marine operations and what it means for suppliers.', tags: ['autonomy', 'trends', 'marine'], rel: { pubDate: -6 }, meta: { pop: 2.3, save: .26, click: .4, sectors: [SEC.sea, SEC.it], pubAgo: 6 },
    x: { contentType: 'Industry update', publisher: 'Fictional Maritime Review' } }),
  know('nis2-guide', { title: 'Guide: getting started with NIS2', status: 'archived', description: 'A fictional guide to the first steps for organisations preparing for new cybersecurity rules. Archived to show the archive tab.', tags: ['cybersecurity', 'regulation'], rel: { pubDate: -70 }, meta: { pop: 1.4, save: .2, click: .3, sectors: [SEC.it], pubAgo: 70 },
    x: { contentType: 'Guide', publisher: 'Fictional Security Forum' } }),

  peer('seek-subsea', { title: 'Seeking a test partner for subsea communication', description: 'A fictional listing from a company looking for a partner to trial subsea communication equipment.', tags: ['subsea', 'communication', 'partner'], rel: {}, meta: { pop: 1.9, save: .3, click: .3, sectors: [SEC.sea, SEC.it], pubAgo: 14 }, contact: 'Demo listing: no real contact route',
    x: { listing: 'seek', project: 'Trial of subsea communication equipment', sought: 'A partner with access to test waters and measurement expertise', canOffer: 'Fictional: prototype units and engineering time', outcome: 'A joint test report', timeframe: 'Next spring' } }),
  peer('offer-embedded', { title: 'Offering: embedded software expertise', description: 'A fictional listing from a consultant offering embedded software support to hardware companies.', tags: ['embedded', 'software', 'expertise'], rel: {}, meta: { pop: 1.3, save: .25, click: .3, sectors: [SEC.man, SEC.it], pubAgo: 9 }, contact: 'Demo listing: no real contact route',
    x: { listing: 'offer', who: 'A fictional embedded software consultant', expertise: 'Real-time software, sensor interfaces and low-power design', services: 'Fictional: design reviews and short development sprints', location: 'Karlskrona', availability: 'Two days a month' } }),
]

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const write = m => { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* storage blocked: seeding repeats next visit */ } }
const datesOf = (rel, cat) => {
  const r = rel || {}, out = {}
  if (cat === 'events') { out.date = r.date != null ? day(r.date) : ''; out.regDeadline = r.regDeadline != null ? day(r.regDeadline) : '' }
  return out
}
function build(s) {
  const { slug, rel, meta, x, ...rest } = s
  const published = s.status === 'published' || s.status === 'archived'
  const rec = {
    ...blankEvent({ category: s.category, x: x ? { ...x } : undefined }), ...rest, id: 'ev-demo-' + slug,
    ...datesOf(rel, s.category), x: { ...blankEvent({ category: s.category }).x, ...(x || {}) },
    organiser: null, sponsors: [], demoSeed: { slug, meta, rel: rel || {} },
  }
  const r = rel || {}
  if (s.category === 'funding' && r.deadline != null) rec.x.deadline = day(r.deadline)
  if (s.category === 'testing' && r.availFrom != null) { rec.x.availFrom = day(r.availFrom); rec.x.availTo = day(r.availTo) }
  if (s.category === 'knowledge' && r.pubDate != null) rec.x.pubDate = day(r.pubDate)
  if (published) rec.publishedAt = Date.now() - (meta?.pubAgo || 0) * 864e5
  const R = PARK_RICH[slug] // fuller fictional content for the detail popup
  if (R) { rec.rich = R.rich; if (R.description) rec.description = R.description; if (R.details) rec.details = R.details }
  return rec
}

// Adds missing demo records and moves the dates of untouched ones. Safe to call on every visit.
export function seedDemoWorkflow() {
  const marks = read()
  let changed = false
  for (const s of SEED) {
    const id = 'ev-demo-' + s.slug
    const existing = getEvent(id)
    if (!existing) {
      if (id in marks) continue // it was seeded before and then deleted by a user: respect that
      try { marks[id] = saveEvent(build(s), ACTOR).updated; changed = true } catch { /* store unavailable: try next time */ }
    } else if (marks[id] === existing.updated) { // untouched since the last write: refresh relative dates
      const fresh = build(s)
      const content = JSON.stringify([fresh.rich, fresh.description, fresh.details]) !== JSON.stringify([existing.rich, existing.description, existing.details])
      if (content || fresh.date !== existing.date || fresh.x?.deadline !== existing.x?.deadline || fresh.x?.availTo !== existing.x?.availTo || fresh.x?.pubDate !== existing.x?.pubDate) {
        try { marks[id] = saveEvent({ ...existing, ...datesOf(s.rel, s.category), rich: fresh.rich, description: fresh.description, details: fresh.details, x: { ...existing.x, ...pickDates(fresh.x) } }, ACTOR).updated; changed = true } catch { /* ignore */ }
      }
    }
  }
  if (changed) write(marks)
}
const pickDates = x => Object.fromEntries(['deadline', 'availFrom', 'availTo', 'pubDate'].filter(k => x?.[k]).map(k => [k, x[k]]))
export const isSeed = e => !!e?.demoSeed
export { listEvents, todayIso }
