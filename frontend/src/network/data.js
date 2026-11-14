import { listParks, listCompanies, listConnections, listSuggestions } from '../data/networkRepository.js'
import { D13, D14 } from '../data/verifiedNetwork.js'
export { D13, D14 }

// ---- Network data facade: everything below is derived from the repository (src/data/networkRepository.js) ----
export const PARKS = Object.fromEntries(listParks().map(p => [p.id, p]))
export const COMPANIES = listCompanies()
export const CO = Object.fromEntries(COMPANIES.map(c => [c.id, c]))
export const CONNECTIONS = listConnections()
const RAW = listSuggestions()

// ---- normalise: no self-matches, A<->B and B<->A are one suggestion, Blue Science Park company listed first ----
export const pairKey = (a, b) => [a, b].sort().join('|')
export const TYPE_LABEL = { shared: 'Shared interests', complementary: 'Complementary expertise' }
const normalise = list => {
  const seen = new Set()
  return list.flatMap(s => {
    if (s.a === s.b || !CO[s.a] || !CO[s.b]) return []
    const k = pairKey(s.a, s.b)
    if (seen.has(k)) return []
    seen.add(k)
    const flip = CO[s.b].park === 'bsp' && CO[s.a].park !== 'bsp'
    const x = flip ? { ...s, a: s.b, b: s.a } : s
    return [{ ...x, isDemo: !!(CO[x.a].isDemo || CO[x.b].isDemo), topics: x.topics || [], why: x.why || x.explore, propose: x.propose || x.explore, label: TYPE_LABEL[x.type] }]
  })
}
export const SUGGESTIONS = normalise(RAW)
// 'internal' = two Blue Science Park companies; 'external' = a Blue Science Park company and a company from another park.
export const scopeOf = s => (CO[s.a].park === CO[s.b].park ? 'internal' : 'external')
export const SCOPE_LABEL = { internal: 'Within Blue Science Park', external: 'Across science parks' }
// Shown by default only when BOTH park affiliations are confirmed. Others stay in staff review.
export const reviewIssues = s => [CO[s.a], CO[s.b]].filter(c => !['confirmed', 'demo'].includes(c.affiliation.status)).map(c => c.name + ': ' + (c.affiliation.status === 'conflicting' ? 'conflicting affiliation information' : 'affiliation not confirmed'))
export const isReviewed = s => reviewIssues(s).length === 0
export const ALL_TOPICS = [...new Set(SUGGESTIONS.filter(isReviewed).flatMap(s => s.topics))].sort()
export const verifyNote = s => (reviewIssues(s).length ? reviewIssues(s) : s.verify ? [s.gaps[0]] : [])
export const evidenceOf = s => s.ev.map(([id, g, i]) => ({ company: CO[id], group: g, fact: CO[id][g][i] })).filter(e => e.fact)
export const daysOld = (d, now = new Date()) => Math.round((now - new Date(d + 'T12:00:00')) / 864e5)
export const STALE_DAYS = 90
export const stale = d => daysOld(d) > STALE_DAYS
export const SOURCE_LABEL = { demo: 'Fictional demo content, no source', official: 'Official page, read', directory: 'Park directory page, read', search: 'Search summary only, page not read' }
export const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const STATUSES = ['Saved', 'Reviewing', 'Contact planned', 'Dismissed']
export const unique = a => [...new Set(a)].sort((x, y) => x.localeCompare(y))
export const ALL_INDUSTRIES = unique(COMPANIES.flatMap(c => c.industry))
export const ALL_TECH = unique(COMPANIES.flatMap(c => c.tech))

// ---- verified public contact routes (pages read by us). Nothing is sent from Fyyr. ----
export const BSP_CONTACT = { label: 'Blue Science Park contact page', u: 'https://www.bluesciencepark.se/kontakt/', note: 'General contact page of the park.' }
export const ROUTES = {
  requtech: [{ label: 'ReQuTech contact page', u: 'https://requtech.com/contact/', note: 'Lists a headquarters address and general sales and info routes.', d: D14 }],
  sectra: [{ label: 'Sectra Communications contact page', u: 'https://communications.sectra.com/about-sectra/contact/', note: 'Says the form is for sales inquiries and product information only, so it is not a stated route for partnership enquiries.', d: D14 }],
}
export const routesOf = id => ROUTES[id] || []

// ---- ranking for the overview: practical, evidenced suggestions first; weak-evidence ones last. No numeric score. ----
export const rankedSuggestions = () => SUGGESTIONS.filter(isReviewed).sort((x, y) => ((y.type === 'complementary') - (x.type === 'complementary')) || (x.gaps.length - y.gaps.length))
export const sharedTags = s => { const a = CO[s.a], b = CO[s.b]; return [...new Set([...a.industry, ...a.tech].filter(t => [...b.industry, ...b.tech].includes(t)))] }
// 'explicit' only if BOTH companies state a partnership interest on their own pages (none of the sampled companies does).
export const basisOf = s => (CO[s.a].needs.length && CO[s.b].needs.length ? { explicit: true, text: 'Both companies publicly state an interest in collaborating.' } : { explicit: false, text: 'Based on public descriptions only. Neither company states an interest in this collaboration.' })

// ---- labels, counts and picks used by the directory and the overview ----
// A suggestion is either a demo (it involves a fictional company) or a real inferred connection that nobody has confirmed.
export const suggestionStatus = s => (s.isDemo ? 'Demo suggestion' : 'Unconfirmed suggestion')
// Sample coverage per park. These are profiles in this demo, never the park's membership.
export const parkCounts = id => {
  const cs = COMPANIES.filter(c => c.park === id)
  return { verified: cs.filter(c => c.affiliation.status === 'confirmed').length, review: cs.filter(c => !['confirmed', 'demo'].includes(c.affiliation.status)).length, demo: cs.filter(c => c.isDemo).length }
}
// Overview: a few pairs, mixing a connection inside Blue Science Park with connections to other ecosystems, real ones first.
// It never pads the list: with fewer supported suggestions it simply shows fewer.
export const overviewPicks = (n = 3) => {
  const all = rankedSuggestions().sort((x, y) => (x.isDemo - y.isDemo) || 0)
  const parkOf = s => CO[s.b].park
  const out = []
  const add = s => s && !out.includes(s) && out.push(s)
  add(all.find(s => scopeOf(s) === 'internal'))
  add(all.find(s => scopeOf(s) === 'external' && !s.isDemo))
  for (const s of all) if (out.length < n && scopeOf(s) === 'external' && !out.some(o => scopeOf(o) === 'external' && parkOf(o) === parkOf(s))) add(s)
  for (const s of all) if (out.length < n) add(s)
  return out.slice(0, n)
}
