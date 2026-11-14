import { PARKS as VERIFIED_PARKS, COMPANIES as VERIFIED_COMPANIES, CONNECTIONS as VERIFIED_CONNECTIONS, VERIFIED_SUGGESTIONS } from './verifiedNetwork.js'
import { DEMO_COMPANIES, DEMO_SUGGESTIONS } from './demoNetwork.js'
import { DEMO_NETWORK_ENABLED } from './config.js'

// ============================================================================================
// Network repository: the only place that knows where science parks, companies and suggestions come from.
// Each source is an adapter returning { parks, companies, connections, suggestions } (any may be omitted):
//   park       { id, name, city, region, website, short, blurb, focusTags[], model, logo, read, focus[], facilities[], members, ... }
//   company    { id, park (a park id), name, website, summary, affiliation{status,relation,note,u,d}, capabilities[], markets[], projects[], needs[], industry[], tech[], isDemo? }
//   suggestion { id, a, b (company ids), type, theme, why, explore, propose, topics[], ev[], gaps[], next }
// Companies reference parks by id only, so a park name lives in one place. To connect an API, add an adapter with registerNetworkAdapter();
// real records must never set isDemo. Saved connections live elsewhere (network/store.js) and are never touched here.
// ============================================================================================
const verified = () => ({ parks: Object.values(VERIFIED_PARKS), companies: VERIFIED_COMPANIES, connections: VERIFIED_CONNECTIONS, suggestions: VERIFIED_SUGGESTIONS })
const demo = () => ({ companies: DEMO_COMPANIES, suggestions: DEMO_SUGGESTIONS })
const adapters = [verified, ...(DEMO_NETWORK_ENABLED ? [demo] : [])]
export const registerNetworkAdapter = fn => { adapters.push(fn); cache = null }

// Merge adapters once. First record wins for each id, so a demo record can never replace a verified one. Invalid records are skipped with a warning.
function build() {
  const parks = new Map(), companies = new Map(), suggestions = new Map()
  const connections = []
  for (const a of adapters) {
    const r = a()
    for (const p of r.parks || []) { if (parks.has(p.id)) console.warn(`Duplicate park ${p.id} skipped`); else parks.set(p.id, p) }
    for (const c of r.companies || []) {
      if (companies.has(c.id)) { console.warn(`Duplicate company ${c.id} skipped`); continue }
      if (!parks.has(c.park)) { console.warn(`Company ${c.id} skipped: unknown park ${c.park}`); continue }
      companies.set(c.id, { industry: [], tech: [], ...c })
    }
    for (const s of r.suggestions || []) {
      if (suggestions.has(s.id)) { console.warn(`Duplicate suggestion ${s.id} skipped`); continue }
      if (s.a === s.b || !companies.has(s.a) || !companies.has(s.b)) { console.warn(`Suggestion ${s.id} skipped: bad companies`); continue }
      suggestions.set(s.id, s)
    }
    connections.push(...(r.connections || []))
  }
  return { parks: [...parks.values()], companies: [...companies.values()], connections, suggestions: [...suggestions.values()] }
}
let cache = null
const data = () => (cache ||= build())
export const listParks = () => data().parks
export const listCompanies = () => data().companies
export const listConnections = () => data().connections
export const listSuggestions = () => data().suggestions
export { DEMO_NETWORK_ENABLED }
