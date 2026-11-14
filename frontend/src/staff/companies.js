import { MEMBER_LOGOS } from '../logos.js'
import { COMPANIES, TOPIC, CHECKED } from '../demoData.js'

// Member directory for staff. Public profiles exist for three members only (built from their own websites and their Blue Science
// Park member page). Everyone else shows as "no profile yet": nothing is guessed.
export const CONTACT_URL = 'https://www.bluesciencepark.se/kontakt/'
export const BSP_MEMBER = 'https://www.bluesciencepark.se/medlem/'

// What the reviewed public sources did NOT state, using the brief's profile checklist.
// These lists are written by hand after reading each profile; they are not generated.
const MISSING = {
  cleura: ['Geographic focus', 'Publicly stated development priorities', 'Projects and collaborations'],
  roxtec: ['Publicly stated development priorities', 'Projects and collaborations', 'Customer groups beyond the listed industries'],
  oht: ['Customer groups', 'Geographic markets beyond office locations', 'Publicly stated collaborations beyond the EU projects'],
}

const norm = s => s.toLowerCase()
const byName = new Map(COMPANIES.map(c => [norm(c.name), c]))
const rows = MEMBER_LOGOS.map(l => ({ slug: l.slug, name: l.name, profile: byName.get(norm(l.name)) || null }))
for (const c of COMPANIES) if (!rows.some(r => r.profile?.id === c.id)) rows.push({ slug: c.id === 'oht' ? 'ocean-harvesting' : c.id, name: c.name, profile: c })

export const DIRECTORY = rows.map(r => {
  const p = r.profile
  return {
    ...r,
    memberPage: BSP_MEMBER + r.slug + '/',
    missing: p ? MISSING[p.id] || [] : [],
    retrieved: p ? p.facts[0]?.retrieved : null,
    ageDays: p ? Math.max(0, Math.round((Date.now() - new Date(p.facts[0]?.retrieved).getTime()) / 864e5)) : null,
    stated: p ? p.interests.filter(i => i.s === 'stated') : [],
    inferred: p ? p.interests.filter(i => i.s === 'inferred') : [],
  }
}).sort((a, b) => a.name.localeCompare(b.name, 'sv'))

// Possible introductions are built from PUBLIC profiles only, never from private activity.
// "Stated overlap" = both companies publicly state the topic. Anything involving an inferred topic stays tentative.
export function introductions() {
  const out = []
  for (let i = 0; i < COMPANIES.length; i++) for (let j = i + 1; j < COMPANIES.length; j++) {
    const a = COMPANIES[i], b = COMPANIES[j]
    const sa = new Map(a.interests.map(x => [x.t, x])), sb = new Map(b.interests.map(x => [x.t, x]))
    const both = [], mixed = [], inf = []
    for (const [t, x] of sa) { const y = sb.get(t); if (!y) continue; if (x.s === 'stated' && y.s === 'stated') both.push(t); else if (x.s === 'stated' || y.s === 'stated') mixed.push(t); else inf.push(t) }
    if (!both.length && !mixed.length && !inf.length) continue
    out.push({ key: `intro:${a.id}:${b.id}`, a, b, both: both.map(t => TOPIC[t]), mixed: mixed.map(t => TOPIC[t]), inferred: inf.map(t => TOPIC[t]), strength: both.length * 3 + mixed.length * 2 + inf.length })
  }
  return out.sort((x, y) => y.strength - x.strength)
}
export { CHECKED }
