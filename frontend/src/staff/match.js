import { CO, SUGGESTIONS, evidenceOf, isReviewed, scopeOf, sharedTags } from '../network/data.js'

// ============================================================================================
// Explainable assessment of a possible company connection. There is NO score and NO percentage.
//
// MATCH STRENGTH = how good the fit looks, from three yes/no criteria worth points:
//   complementary capabilities  2  (one company's verified capability fits what the other does or needs)
//   shared sector or topic      1
//   same science park           1  (practical to meet; different parks open a new ecosystem but are not counted here)
//   -> 3 or 4 points "Strong potential" | 2 points "Worth exploring" | 0 or 1 point "Early idea"
//
// EVIDENCE CONFIDENCE = how well the facts are sourced, independent of strength:
//   Low     either company's park affiliation is not confirmed, or fewer than two cited facts come from the companies' or park's own pages
//   Medium  both affiliations are confirmed and at least two facts are sourced, but the fit is inferred (no stated interest) or relies on assumptions
//   High    as Medium, plus at least three sourced facts, no simulated assumption, and at most one open question
//
// A connection is a DEMO ASSESSMENT when any part rests on simulated needs (`simNeeds`) or fictional companies.
// ============================================================================================
export const STRENGTH_ORDER = { 'Strong potential': 3, 'Worth exploring': 2, 'Early idea': 1 }
const CONF_ORDER = { High: 3, Medium: 2, Low: 1 }

export function assess(s) {
  const a = CO[s.a], b = CO[s.b]
  const facts = evidenceOf(s)
  const sourced = facts.filter(e => e.fact.via === 'official' || e.fact.via === 'directory').length
  const verifiedBoth = a.affiliation.status === 'confirmed' && b.affiliation.status === 'confirmed'
  const demo = !!(s.simNeeds?.length || s.isDemo)
  const samePark = a.park === b.park
  const shared = sharedTags(s)
  const criteria = [
    { k: 'comp', label: 'Complementary capabilities', pts: 2, met: s.type === 'complementary', why: s.type === 'complementary' ? 'One company’s verified capability fits what the other does.' : 'The two offers overlap rather than complete each other.' },
    { k: 'sector', label: 'Shared sector or topic', pts: 1, met: s.type === 'shared' || shared.length > 0, why: shared.length ? `Both are tagged: ${shared.join(', ')}.` : s.type === 'shared' ? 'Both work in the same area.' : 'No shared tag in the sources read.' },
    { k: 'park', label: 'Same science park', pts: 1, met: samePark, why: samePark ? 'Both are in the same park, so meeting is easy.' : 'Different parks: a chance to connect two ecosystems.' },
  ]
  const points = criteria.reduce((n, c) => n + (c.met ? c.pts : 0), 0)
  const strength = points >= 3 ? 'Strong potential' : points === 2 ? 'Worth exploring' : 'Early idea'
  const confidence = !verifiedBoth || sourced < 2 ? 'Low' : (sourced >= 3 && !demo && s.gaps.length <= 1 ? 'High' : 'Medium')
  const confWhy = confidence === 'Low' ? 'An affiliation is not confirmed or fewer than two facts come from official pages.'
    : confidence === 'High' ? 'Both affiliations are confirmed, three or more facts are sourced and nothing is assumed.'
    : `Both affiliations and ${sourced} facts are sourced; the fit itself is inferred${demo ? ' and part of it rests on simulated needs' : ''}.`
  const tags = [
    s.type === 'complementary' && 'Complementary capabilities',
    (s.type === 'shared' || shared.length > 0) && 'Shared sector',
    scopeOf(s) === 'external' ? 'Cross-park connection' : 'Same park',
    verifiedBoth && 'Verified affiliations',
  ].filter(Boolean).slice(0, 3)
  const parts = (s.parts || '').split(/(?<=\.)\s+/).filter(Boolean)
  return { points, max: 4, strength, confidence, confWhy, criteria, tags, demo, sourced, verifiedBoth, parts, shared, facts }
}

// Three suggestions for the overview: sourced real companies only, best fit first, different companies where possible.
export function connectionPicks(n = 3) {
  const all = SUGGESTIONS.filter(s => isReviewed(s) && !s.isDemo).map(s => ({ s, a: assess(s) }))
    .sort((x, y) => STRENGTH_ORDER[y.a.strength] - STRENGTH_ORDER[x.a.strength] || CONF_ORDER[y.a.confidence] - CONF_ORDER[x.a.confidence] || x.s.id.localeCompare(y.s.id))
  const out = [], used = new Set()
  for (const x of all) if (out.length < n && !used.has(x.s.a) && !used.has(x.s.b)) { out.push(x); used.add(x.s.a); used.add(x.s.b) }
  for (const x of all) if (out.length < n && !out.includes(x)) out.push(x)
  return out
}
