import { MEMBER_OPPS, MCATS, OPP_BY_ID, isPark } from '../member/data.js'
import { urgency, CHECKED } from '../demoData.js'
import { TOPIC_LABELS, UNGROUPED, supplyFor, topicsOfEvent } from './topics.js'

// ---- Metric definitions (shown to staff in the interface and repeated in every report) ----
export const DEFINITIONS = [
  ['Active company', 'A company with at least one search, detail view, save or source-link click in the period. Impressions ("shown") do not count.'],
  ['Comparison period', 'The period of the same length immediately before the selected one.'],
  ['Search', 'One search settled for about a second. Typing is not counted per keystroke. Repeats within 3 seconds are dropped.'],
  ['Shown', 'An opportunity appearing in a results list. Counted once per session and page per 30 minutes, never per re-render.'],
  ['View', 'Opening an opportunity’s detail panel. Repeats within 10 seconds are dropped.'],
  ['Save / Not relevant', 'The member pressing Save, or "Not relevant". Not relevant does not change a profile.'],
  ['Source click', 'The member opening the external source link. It is not an application, registration or outcome.'],
  ['Follow-up engagement', 'A view, save or source click in the same session within 15 minutes after a search that returned results. Events are linked by session only, so this is not a conversion funnel.'],
  ['Saves per 100 views', 'Saves divided by views for the same opportunity and period. Views and saves are not linked per person.'],
  ['Distinct companies', 'Companies that contributed at least one counted event. Small groups are hidden (see the small-group threshold).'],
  ['Stated interest', 'Selected or confirmed by the member (interests, wanted opportunity types).'],
  ['Observed activity', 'Searches, views, saves and source clicks. Never a confirmed priority.'],
  ['Inferred interest', 'A tentative pattern: a topic with at least 3 interactions from a company that has not stated it.'],
]
export const LIMITS = [
  'Registrations, applications and outcomes are not tracked, so no result is described as a success.',
  'Free-text feedback is not collected. "Not relevant" is a single signal without a reason.',
  'Activity is linked within a session only, not across devices or visits.',
  'Topic grouping is automated with keyword rules and can misplace a term.',
  'Searches from the overview have no category, so they are left out when a category filter is on.',
]

const DAY = 864e5
const FOLLOW_MS = 15 * 60e3
const ENGAGE = new Set(['view', 'save', 'click_source'])
const ACTIVE = new Set(['search', 'view', 'save', 'click_source'])
export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
export const fmtD = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const fmtDY = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function makeRange(preset, custom = {}, now = new Date()) {
  const today = startOfDay(now)
  let from, to
  if (preset === 'custom' && custom.from && custom.to) {
    from = startOfDay(new Date(custom.from + 'T12:00:00')); to = startOfDay(new Date(custom.to + 'T12:00:00')) + DAY - 1
    if (from > to) [from, to] = [startOfDay(to), from + DAY - 1]
  } else { const n = { 7: 7, 30: 30, 90: 90 }[preset] || 30; from = today - (n - 1) * DAY; to = today + DAY - 1 }
  const days = Math.round((to - from + 1) / DAY)
  return { from, to, days, prevFrom: from - days * DAY, prevTo: from - 1, label: `${fmtD(from)} – ${fmtDY(to)}`, prevLabel: `${fmtD(from - days * DAY)} – ${fmtDY(from - 1)}` }
}

// Change with a guard against tiny numbers: 1 -> 2 is +100% but not a trend.
export function change(cur, prev) {
  const reliable = cur + prev >= 8 && Math.abs(cur - prev) >= 3
  const pct = prev ? (cur - prev) / prev : null
  const text = reliable
    ? (prev === 0 ? `New: 0 → ${cur}` : `${pct >= 0 ? '+' : '−'}${Math.abs(Math.round(pct * 100))}% (${prev} → ${cur})`)
    : `${prev} → ${cur} (too few to call a trend)`
  return { cur, prev, abs: cur - prev, pct, reliable, text }
}

// Weekly buckets end on the last day of the period and cover whole weeks only. A part-week would look like a false drop,
// so any leading days that do not fill a week are left out of the charts (the counts elsewhere still include them).
export function makeBuckets(range) {
  const daily = range.days <= 14
  const size = daily ? DAY : 7 * DAY
  const n = daily ? range.days : Math.floor(range.days / 7)
  const start = daily ? range.from : range.to + 1 - n * size
  const labels = Array.from({ length: n }, (_, i) => fmtD(start + i * size))
  return { n, labels, unit: daily ? 'day' : 'week', skipped: daily ? 0 : range.days - n * 7,
    idx: ts => (ts < start ? -1 : Math.min(n - 1, Math.floor((ts - start) / size))) }
}

const supplyCache = new Map()
const supply = (t, now) => { const k = t + startOfDay(now); if (!supplyCache.has(k)) supplyCache.set(k, supplyFor(t, now)); return supplyCache.get(k) }

export function compute(all, o) {
  const { range, f, k: kSetting, now = new Date(), shared = [] } = o
  const k = f.company !== 'all' && shared.includes(f.company) ? 1 : kSetting
  const sectorOk = e => f.sector === 'all' || e.sector === f.sector
  const companyOk = e => f.company === 'all' || e.company === f.company
  const pass = e => sectorOk(e) && companyOk(e) && (f.cat === 'all' || e.cat === f.cat)
  const cur = [], prev = [], statedEv = []
  for (const e of all) {
    if (e.type === 'interests_set') { if (sectorOk(e) && companyOk(e) && e.ts <= range.to) statedEv.push(e); continue }
    if (!pass(e)) continue
    if (e.ts >= range.from && e.ts <= range.to) cur.push(e)
    else if (e.ts >= range.prevFrom && e.ts <= range.prevTo) prev.push(e)
  }
  const buckets = makeBuckets(range)
  const distinct = (arr, fn = () => true) => new Set(arr.filter(fn).map(e => e.company))
  const known = new Set(all.filter(e => sectorOk(e) && companyOk(e)).map(e => e.company))
  const activeCur = distinct(cur, e => ACTIVE.has(e.type)), activePrev = distinct(prev, e => ACTIVE.has(e.type))

  // latest stated interests per company
  const stated = new Map()
  for (const e of statedEv) { const p = stated.get(e.company); if (!p || e.ts >= p.ts) stated.set(e.company, e) }

  // ---------- search topics ----------
  const bySid = new Map()
  for (const e of cur) if (e.sid && ENGAGE.has(e.type)) { (bySid.get(e.sid) || bySid.set(e.sid, []).get(e.sid)).push(e) }
  const T = new Map()
  const getT = t => T.get(t) || (T.set(t, { topic: t, searches: 0, cos: new Set(), zero: 0, withResults: 0, follow: 0, prev: 0, terms: new Map() }), T.get(t))
  for (const e of cur) if (e.type === 'search') {
    const r = getT(e.topic); r.searches++; r.cos.add(e.company)
    if (e.resultCount === 0) r.zero++
    else { r.withResults++; if ((bySid.get(e.sid) || []).some(x => x.ts > e.ts && x.ts <= e.ts + FOLLOW_MS)) r.follow++ }
    const tm = r.terms.get(e.term) || r.terms.set(e.term, { term: e.term, n: 0, cos: new Set(), zero: 0 }).get(e.term)
    tm.n++; tm.cos.add(e.company); if (e.resultCount === 0) tm.zero++
  }
  for (const e of prev) if (e.type === 'search') getT(e.topic).prev++
  const topicRows = [...T.values()].filter(r => r.searches > 0).map(r => {
    const terms = [...r.terms.values()].map(t => ({ term: t.term, n: t.n, companies: t.cos.size, zero: t.zero }))
    const shownTerms = terms.filter(t => t.companies >= k).sort((a, b) => b.n - a.n)
    const hiddenTerms = terms.filter(t => t.companies < k)
    return {
      topic: r.topic, searches: r.searches, companies: r.cos.size, prev: r.prev, change: change(r.searches, r.prev), zero: r.zero, withResults: r.withResults, follow: r.follow,
      supply: r.topic === UNGROUPED ? null : supply(r.topic, now), terms: shownTerms, otherTerms: { n: hiddenTerms.reduce((s, t) => s + t.n, 0), count: hiddenTerms.length }, hidden: r.cos.size < k,
    }
  }).sort((a, b) => b.searches - a.searches)
  const topics = { rows: topicRows.filter(r => !r.hidden), hiddenCount: topicRows.filter(r => r.hidden).length, hiddenSearches: topicRows.filter(r => r.hidden).reduce((s, r) => s + r.searches, 0) }

  // ---------- all topic activity (searches + engagement on opportunities of that topic) ----------
  const A = new Map()
  const getA = t => A.get(t) || (A.set(t, { topic: t, cur: 0, prev: 0, cos: new Set(), prevCos: new Set(), perCo: new Map() }), A.get(t))
  for (const e of cur) if (ACTIVE.has(e.type)) for (const t of topicsOfEvent(e)) { const a = getA(t); a.cur++; a.cos.add(e.company); a.perCo.set(e.company, (a.perCo.get(e.company) || 0) + 1) }
  for (const e of prev) if (ACTIVE.has(e.type)) for (const t of topicsOfEvent(e)) { const a = getA(t); a.prev++; a.prevCos.add(e.company) }
  const activity = [...A.values()].filter(a => a.topic !== UNGROUPED && a.cos.size >= k).map(a => ({ topic: a.topic, cur: a.cur, prev: a.prev, companies: a.cos.size, change: change(a.cur, a.prev), perCo: a.perCo }))
  const growing = activity.filter(a => a.change.reliable && a.change.abs > 0 && (a.change.pct == null || a.change.pct >= .15)).sort((a, b) => b.change.abs - a.change.abs || (b.cur + 1) / (b.prev + 1) - (a.cur + 1) / (a.prev + 1))

  // ---------- overview: growing interests (distinct companies, each counted once per topic) ----------
  // Two separate sources, never blended: stated (interests the company selected) and activity (searches, views, saves, source clicks).
  const statedPrev = new Map()
  for (const e of statedEv) if (e.ts <= range.prevTo) { const p = statedPrev.get(e.company); if (!p || e.ts >= p.ts) statedPrev.set(e.company, e) }
  const statedSets = m => { const r = new Map(); for (const s of m.values()) for (const t of s.interests || []) if (t !== UNGROUPED) (r.get(t) || r.set(t, new Set()).get(t)).add(s.company); return r }
  const stCur = statedSets(stated), stPrev = statedSets(statedPrev)
  const growRow = (topic, cur, prv) => ({ topic, cur: cur.size, prev: prv.size, abs: cur.size - prv.size, ids: [...cur], prevIds: [...prv] })
  const byGrowth = (a, b) => b.abs - a.abs || b.cur - a.cur || a.topic.localeCompare(b.topic)
  const growth = {
    activity: [...A.values()].filter(a => a.topic !== UNGROUPED && a.cos.size >= k).map(a => growRow(a.topic, a.cos, a.prevCos)).filter(r => r.abs > 0).sort(byGrowth),
    stated: [...new Set([...stCur.keys(), ...stPrev.keys()])].map(t => growRow(t, stCur.get(t) || new Set(), stPrev.get(t) || new Set())).filter(r => r.cur >= k && r.abs > 0).sort(byGrowth),
    statedCompanies: stated.size,
  }

  // ---------- overview: searches that returned no results in Fyyr ----------
  // Only searches with a usable term and zero results. Empty queries are never recorded and 'redacted' text is skipped.
  // Terms of one broad topic are grouped; terms that fit no topic stay separate so different needs are not merged.
  const U = new Map()
  for (const e of cur) if (e.type === 'search' && e.resultCount === 0 && e.term && e.term !== 'redacted') {
    const key = e.topic === UNGROUPED ? 'term:' + e.term : e.topic
    const u = U.get(key) || U.set(key, { key, label: e.topic === UNGROUPED ? e.term : e.topic, topic: e.topic, n: 0, cos: new Set(), last: 0, terms: new Map() }).get(key)
    u.n++; u.cos.add(e.company); if (e.ts > u.last) u.last = e.ts
    const t = u.terms.get(e.term) || u.terms.set(e.term, { term: e.term, n: 0, cos: new Set() }).get(e.term)
    t.n++; t.cos.add(e.company)
  }
  const unmetAll = [...U.values()].map(u => {
    const terms = [...u.terms.values()].map(t => ({ term: t.term, n: t.n, companies: t.cos.size }))
    return { key: u.key, label: u.label, topic: u.topic, zero: u.n, companies: u.cos.size, last: u.last, terms: terms.filter(t => t.companies >= k).sort((a, b) => b.n - a.n),
      otherTerms: terms.filter(t => t.companies < k).reduce((s, t) => s + t.n, 0), supply: u.topic === UNGROUPED ? null : supply(u.topic, now), total: T.get(u.topic)?.searches ?? u.n }
  }).sort((a, b) => b.zero - a.zero || b.companies - a.companies || a.label.localeCompare(b.label))
  const unmet = { rows: unmetAll.filter(r => r.companies >= k), hiddenCount: unmetAll.filter(r => r.companies < k).length, totalZero: unmetAll.reduce((s, r) => s + r.zero, 0) }

  // ---------- opportunity performance ----------
  const O = new Map()
  const getO = id => O.get(id) || (O.set(id, { id, shown: 0, views: 0, saves: 0, clicks: 0, notRel: 0, eng: new Set(), any: new Set() }), O.get(id))
  for (const e of cur) if (e.oppId && OPP_BY_ID[e.oppId]) {
    const r = getO(e.oppId); r.any.add(e.company)
    if (e.type === 'shown') r.shown++
    else if (e.type === 'view') { r.views++; r.eng.add(e.company) }
    else if (e.type === 'save') { r.saves++; r.eng.add(e.company) }
    else if (e.type === 'click_source') { r.clicks++; r.eng.add(e.company) }
    else if (e.type === 'not_relevant') r.notRel++
  }
  const oppAll = [...O.values()].map(r => {
    const o = OPP_BY_ID[r.id], u = urgency(o, now)
    return { id: r.id, title: o.title, cat: o.mcat, catLabel: o.mcat && MCATS.find(c => c.id === o.mcat)?.short, deadline: u ? u.label : 'No fixed date', deadlineTs: u ? new Date(u.iso).getTime() : null, demoListing: !!o.demo,
      shown: r.shown, views: r.views, saves: r.saves, clicks: r.clicks, notRel: r.notRel, companies: r.any.size, savesPer100: r.views ? Math.round(r.saves / r.views * 100) : null, hidden: r.any.size < k }
  })
  const opps = { rows: oppAll.filter(r => !r.hidden), hiddenCount: oppAll.filter(r => r.hidden).length }

  // ---------- Blue Science Park's own content ----------
  // Park-owned content is identified by the record's publisherId (member/data.js isPark), never by title. It is a slice of the SAME events
  // and the same opportunity rows as everything else, so these figures can never disagree with Opportunity performance.
  // Network-wide figures (searches, interests, companies overall) are deliberately not part of it.
  const isParkOpp = id => { const o = OPP_BY_ID[id]; return !!o && isPark(o) }
  const PK = { views: 0, saves: 0, clicks: 0, cos: new Set(), series: Array(buckets.n).fill(0), sb: { views: Array(buckets.n).fill(0), saves: Array(buckets.n).fill(0), clicks: Array(buckets.n).fill(0) }, byCo: new Map(), byCat: new Map() }
  const PV = { views: 0, saves: 0, clicks: 0, cos: new Set() }
  const KEYOF = { view: 'views', save: 'saves', click_source: 'clicks' }
  for (const e of cur) if (e.oppId && ENGAGE.has(e.type) && isParkOpp(e.oppId)) {
    PK[KEYOF[e.type]]++; PK.cos.add(e.company)
    const i = buckets.idx(e.ts); if (i >= 0) { PK.series[i]++; PK.sb[KEYOF[e.type]][i]++ }
    const ct = PK.byCat.get(OPP_BY_ID[e.oppId].mcat) || PK.byCat.set(OPP_BY_ID[e.oppId].mcat, { id: OPP_BY_ID[e.oppId].mcat, views: 0, saves: 0, clicks: 0, cos: new Set() }).get(OPP_BY_ID[e.oppId].mcat); ct[KEYOF[e.type]]++; ct.cos.add(e.company)
    const c = PK.byCo.get(e.company) || PK.byCo.set(e.company, { id: e.company, views: 0, saves: 0, clicks: 0 }).get(e.company); c[KEYOF[e.type]]++
  }
  for (const e of prev) if (e.oppId && ENGAGE.has(e.type) && isParkOpp(e.oppId)) { PV[KEYOF[e.type]]++; PV.cos.add(e.company) }
  const park = {
    views: PK.views, saves: PK.saves, clicks: PK.clicks, engagement: PK.views + PK.saves + PK.clicks, companies: PK.cos.size, series: PK.series, seriesBy: PK.sb, labels: buckets.labels,
    byCat: [...PK.byCat.values()].map(c => ({ id: c.id, views: c.views, saves: c.saves, clicks: c.clicks, companies: c.cos.size })),
    prev: { views: PV.views, saves: PV.saves, clicks: PV.clicks, engagement: PV.views + PV.saves + PV.clicks, companies: PV.cos.size },
    byCompany: [...PK.byCo.values()].sort((a, b) => (b.views + b.saves + b.clicks) - (a.views + a.saves + a.clicks)),
    rows: oppAll.filter(r => isParkOpp(r.id) && !r.hidden), hiddenRows: oppAll.filter(r => isParkOpp(r.id) && r.hidden).length, hiddenIds: new Set(oppAll.filter(r => isParkOpp(r.id) && r.hidden).map(r => r.id)),
  }

  // ---------- interest by category / over time ----------
  const catRows = MCATS.map(c => {
    const ev = cur.filter(e => ENGAGE.has(e.type) && e.cat === c.id), pv = prev.filter(e => ENGAGE.has(e.type) && e.cat === c.id)
    const cos = new Set(ev.map(e => e.company))
    const statedN = [...stated.values()].filter(s => (s.wants || []).includes(c.id)).length
    return { id: c.id, label: c.label, short: c.short, engagement: ev.length, prev: pv.length, change: change(ev.length, pv.length), companies: cos.size, stated: statedN, hidden: cos.size < k }
  })
  const catSeries = catRows.map(c => { const pts = Array(buckets.n).fill(0); for (const e of cur) if (ENGAGE.has(e.type) && e.cat === c.id) { const i = buckets.idx(e.ts); if (i >= 0) pts[i]++ }; return { id: c.id, name: c.short, points: pts } })
  const activitySeries = ['search', 'view', 'save'].map(t => { const pts = Array(buckets.n).fill(0); for (const e of cur) if (e.type === t) { const i = buckets.idx(e.ts); if (i >= 0) pts[i]++ }; return { id: t, name: { search: 'Searches', view: 'Views', save: 'Saves' }[t], points: pts } })

  // ---------- stated vs observed vs inferred ----------
  const statedBy = new Map()
  for (const s of stated.values()) for (const t of s.interests || []) { (statedBy.get(t) || statedBy.set(t, new Set()).get(t)).add(s.company) }
  const triRows = TOPIC_LABELS.map(t => {
    const a = A.get(t), st = statedBy.get(t) || new Set()
    const obs = a ? [...a.perCo.keys()] : []
    const inferred = a ? [...a.perCo.entries()].filter(([c, n]) => n >= 3 && !st.has(c)).length : 0
    return { topic: t, stated: st.size, observed: obs.length, inferred }
  }).filter(r => r.stated || r.observed)
  // combinations of observed topics (>= 3 interactions) per company
  const pairs = new Map()
  const perCoTopics = new Map()
  for (const a of A.values()) for (const [c, n] of a.perCo) if (n >= 3 && a.topic !== UNGROUPED) (perCoTopics.get(c) || perCoTopics.set(c, []).get(c)).push(a.topic)
  for (const ts of perCoTopics.values()) { ts.sort(); for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const key = ts[i] + ' + ' + ts[j]; pairs.set(key, (pairs.get(key) || 0) + 1) } }
  const combos = [...pairs.entries()].map(([pair, n]) => ({ pair, companies: n })).filter(x => x.companies >= Math.max(k, 2)).sort((a, b) => b.companies - a.companies).slice(0, 6)

  // ---------- summary ----------
  const topSaved = opps.rows.filter(r => r.saves > 0).sort((a, b) => b.saves - a.saves).slice(0, 3)
  const summary = {
    active: { cur: activeCur.size, prev: activePrev.size, total: known.size },
    topSearched: topics.rows.filter(r => r.topic !== UNGROUPED).slice(0, 3),
    topSaved, growing: growing.slice(0, 3),
  }

  // ---------- what needs attention ----------
  const period = range.label
  const findings = []
  const termTable = r => ({ head: ['Term (normalised)', 'Searches', 'Companies', 'No results'], rows: [...r.terms.map(t => [t.term, t.n, t.companies, `${t.zero} of ${t.n}`]), ...(r.otherTerms.count ? [[`${r.otherTerms.count} other term(s), fewer than ${k} companies`, r.otherTerms.n, '—', '—']] : [])] })
  for (const r of topics.rows) {
    if (r.topic === UNGROUPED) continue
    if (r.searches >= 6 && r.zero / r.searches >= .5) {
      findings.push({ id: `nores:${r.topic}:${range.from}`, kind: 'unmet', weight: 100 + r.zero, title: `Searches for “${r.topic}” often return nothing`,
        observed: `${r.zero} of ${r.searches} searches on this topic returned no results.`, period, counts: [['Searches', r.searches], ['No results', r.zero]], companies: r.companies,
        next: `Hypothesis: the catalogue has little on this topic. Consider sourcing relevant listings or asking a partner whether something suitable exists.`, evidence: termTable(r) })
    } else if (r.searches >= 8 && r.supply != null && r.supply <= 3 && r.companies >= Math.max(k, 3)) {
      findings.push({ id: `supply:${r.topic}:${range.from}`, kind: 'supply', weight: 70 + r.searches, title: `Steady interest in “${r.topic}” with few open listings`,
        observed: `${r.searches} searches from ${r.companies} companies, but only ${r.supply} open listing${r.supply === 1 ? '' : 's'} on this topic.`, period, counts: [['Searches', r.searches], ['Open listings', r.supply]], companies: r.companies,
        next: `Hypothesis: demand is higher than supply. Consider adding sources or planning a members’ session on this topic.`, evidence: termTable(r) })
    }
  }
  for (const a of growing.slice(0, 3)) {
    // A finding needs a clear rise (at least +25%) and enough volume, not just any positive change.
    if ((a.change.pct == null || a.change.pct >= .25) && a.change.abs >= 6) findings.push({ id: `grow:${a.topic}:${range.from}`, kind: 'growth', weight: 90 + a.change.abs, title: `Growing interest in “${a.topic}”`,
      observed: `Activity on this topic went ${a.prev} → ${a.cur} (${a.change.pct == null ? 'new' : '+' + Math.round(a.change.pct * 100) + '%'}) compared with ${range.prevLabel}.`, period, counts: [['Now', a.cur], ['Before', a.prev]], companies: a.companies,
      next: a.topic === 'Testing environments' ? 'Hypothesis: more members are looking to validate products. Consider sourcing more testbeds, labs or pilot sites, or hosting a short session with providers.' : 'Hypothesis: this topic is becoming more relevant to members. Consider a workshop or a curated round-up.',
      evidence: { head: ['Measure', 'This period', 'Previous period'], rows: [['Searches, views, saves and source clicks on this topic', a.cur, a.prev], ['Distinct companies', a.companies, '—']] } })
  }
  for (const r of opps.rows) if (r.views >= 8 && r.savesPer100 != null && r.savesPer100 < 10 && r.companies >= Math.max(k, 3)) {
    findings.push({ id: `viewsave:${r.id}:${range.from}`, kind: 'lowsave', weight: 60 + r.views, title: `“${r.title}” is viewed often but rarely saved`,
      observed: `${r.views} views and ${r.saves} save${r.saves === 1 ? '' : 's'} (${r.savesPer100} per 100 views) from ${r.companies} companies.`, period, counts: [['Views', r.views], ['Saves', r.saves], ['Source clicks', r.clicks]], companies: r.companies,
      next: 'Hypothesis: members open it to check whether it fits and then decide it does not (for example eligibility). Review how it is summarised and whether the match explanation is accurate.',
      evidence: { head: ['Measure', 'Count'], rows: [['Shown in lists', r.shown], ['Views', r.views], ['Saves', r.saves], ['Source clicks', r.clicks], ['Marked not relevant', r.notRel]] } })
  }
  findings.sort((a, b) => b.weight - a.weight)

  // ---------- coverage ----------
  const countBy = {}; for (const e of all) countBy[e.type] = (countBy[e.type] || 0) + 1
  const lastTs = all.length ? Math.max(...all.map(e => e.ts)) : null
  const coverage = { total: all.length, inPeriod: cur.length, byType: countBy, first: all.length ? Math.min(...all.map(e => e.ts)) : null, last: lastTs, companies: known.size, checked: CHECKED }

  // If fewer than k companies were active at all, even network totals would describe a single company: withhold everything.
  const tooSmall = cur.length > 0 && activeCur.size < k
  return { range, f, k, tooSmall, park, activeCompanies: activeCur.size, cur: cur.length, prev: prev.length, buckets, summary, findings: findings.slice(0, 4), allFindings: findings, topics, activity, growth, unmet, opps, catRows, catSeries, activitySeries, triRows, combos, coverage, stated: stated.size }
}

// A company's own summary, only for companies that opted in (simulated consent).
export function companySummary(all, id, range) {
  const ev = all.filter(e => e.company === id && e.type !== 'interests_set' && e.ts >= range.from && e.ts <= range.to)
  const topics = new Map(); for (const e of ev) if (ACTIVE.has(e.type)) for (const t of topicsOfEvent(e)) if (t !== UNGROUPED) topics.set(t, (topics.get(t) || 0) + 1)
  return { searches: ev.filter(e => e.type === 'search').length, views: ev.filter(e => e.type === 'view').length, saves: ev.filter(e => e.type === 'save').length, topics: [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]) }
}

// Weekly engagement for one opportunity, plus aggregate sector groups (small groups combined).
export function oppDetail(all, id, ctx) {
  const { range, f, k } = ctx
  const b = makeBuckets(range)
  const ev = all.filter(e => e.oppId === id && e.ts >= range.from && e.ts <= range.to && (f.sector === 'all' || e.sector === f.sector) && (f.company === 'all' || e.company === f.company))
  const series = ['view', 'save', 'click_source'].map(t => { const pts = Array(b.n).fill(0); for (const e of ev) if (e.type === t) { const i = b.idx(e.ts); if (i >= 0) pts[i]++ }; return { id: t, name: { view: 'Views', save: 'Saves', click_source: 'Source clicks' }[t], points: pts } })
  const bySector = new Map()
  for (const e of ev) if (ENGAGE.has(e.type) && e.sector) { const s = bySector.get(e.sector) || bySector.set(e.sector, { sector: e.sector, cos: new Set(), n: 0 }).get(e.sector); s.cos.add(e.company); s.n++ }
  const sectors = [...bySector.values()].map(s => ({ sector: s.sector, companies: s.cos.size, n: s.n }))
  const shown = sectors.filter(s => s.companies >= k).sort((a, b) => b.n - a.n)
  const small = sectors.filter(s => s.companies < k)
  const o = OPP_BY_ID[id]
  return { series, labels: b.labels, unit: b.unit, sectors: shown, other: small.length ? { groups: small.length, n: small.reduce((s, x) => s + x.n, 0) } : null,
    notRel: ev.filter(e => e.type === 'not_relevant').length, o, checked: o.demo ? null : CHECKED }
}

// ---------- exports (aggregate, small-group-safe data only) ----------
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
export const toCsv = (head, rows) => [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')

// Detail for one growing topic: signals behind it, companies per week, and who contributed. Names are added by the page only for
// companies that consented to being identified; this function returns identifiers and counts, never individual search histories.
export function growthDetail(all, topic, source, ctx) {
  const { range } = ctx
  const b = makeBuckets(range)
  const inCur = e => e.ts >= range.from && e.ts <= range.to, inPrev = e => e.ts >= range.prevFrom && e.ts <= range.prevTo
  const rel = all.filter(e => ACTIVE.has(e.type) && topicsOfEvent(e).includes(topic))
  const count = (arr, t) => arr.filter(e => e.type === t).length
  const cur = rel.filter(inCur), prev = rel.filter(inPrev)
  const signals = [['search', 'Searches'], ['view', 'Detail views'], ['save', 'Saves'], ['click_source', 'Source clicks']].map(([t, l]) => [l, count(cur, t), count(prev, t)])
  const cos = Array.from({ length: b.n }, () => new Set()), ev = Array(b.n).fill(0)
  for (const e of cur) { const i = b.idx(e.ts); if (i >= 0) { cos[i].add(e.company); ev[i]++ } }
  const per = new Map(); for (const e of cur) per.set(e.company, (per.get(e.company) || 0) + 1)
  const statedNow = new Set(), statedBefore = new Set()
  const last = new Map(); for (const e of all) if (e.type === 'interests_set' && e.ts <= range.to) { const p = last.get(e.company); if (!p || e.ts >= p.ts) last.set(e.company, e) }
  for (const s of last.values()) if ((s.interests || []).includes(topic)) statedNow.add(s.company)
  const lastPrev = new Map(); for (const e of all) if (e.type === 'interests_set' && e.ts <= range.prevTo) { const p = lastPrev.get(e.company); if (!p || e.ts >= p.ts) lastPrev.set(e.company, e) }
  for (const s of lastPrev.values()) if ((s.interests || []).includes(topic)) statedBefore.add(s.company)
  return { signals, labels: b.labels, unit: b.unit, series: [{ id: 'c', name: 'Companies active', points: cos.map(s => s.size) }, { id: 'e', name: 'Signals', points: ev }],
    contributors: [...per.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n), statedNow: [...statedNow], statedBefore: [...statedBefore], source }
}
