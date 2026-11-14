import { MEMBER_OPPS } from '../member/data.js'
import { isLive } from '../demoData.js'

// ---- Automated topic grouping ----
// Search terms and opportunities are grouped into broad topics with simple keyword rules (no model, no personal data).
// The first matching rule wins for a search term; an opportunity can belong to several topics.
// Staff can inspect which terms ended up in each topic (Search trends), because the grouping is automated and imperfect.
export const TOPIC_RULES = [
  ['Testing environments', /\b(test(s|ing|bed|beds)?|testbed|labs?|laborator(y|ies)|pilots?|sandbox|validat\w+|demonstrat\w+)\b/i],
  ['Funding & grants', /\b(fund(ing|s)?|grants?|eic|horizon|interreg|vinnova|accelerator|pathfinder|subsid\w+|invest(ment)?)\b/i],
  ['Cybersecurity', /\b(cyber\w*|security|nis ?2|resilience act|compliance|gdpr)\b/i],
  ['Defence supply', /\b(defen[cs]e|fmv|military|dual-use)\b/i],
  ['AI & data', /\b(ai|artificial intelligence|machine learning|ml|agents?|generative|llm|data)\b/i],
  ['Energy', /\b(energy|hydrogen|wind|solar|batter(y|ies)|storage|grid|renewable\w*|power)\b/i],
  ['Maritime & offshore', /\b(offshore|marine|maritime|ocean|wave|vessels?|coastal|subsea|ship\w*)\b/i],
  ['IoT & sensors', /\b(iot|sensors?|embedded|edge|automation|monitoring)\b/i],
  ['Digital health', /\b(health\w*|medtech|clinical|patient\w*)\b/i],
  ['Events & networking', /\b(workshops?|conferences?|networking|webinars?|meetups?|info day|information day|events?)\b/i],
  ['International growth', /\b(export|international|eu|europe(an)?|global|growth|scale|markets?)\b/i],
  ['Partners & expertise', /\b(partners?|collaborat\w+|experts?|researchers?|introduc\w+|advis\w+)\b/i],
]
export const TOPIC_LABELS = TOPIC_RULES.map(r => r[0])
export const UNGROUPED = 'Ungrouped'

export const groupTopic = term => {
  const t = String(term || '')
  for (const [label, re] of TOPIC_RULES) if (re.test(t)) return label
  return UNGROUPED
}

// Privacy: search text is reduced to a short, normalised term. Anything that looks like an email, URL, long number or
// a long sentence is dropped ('redacted'), so contact details or confidential text typed into the box are never kept.
export const sanitiseTerm = raw => {
  const t = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (t.length < 2) return null
  if (t.length > 40 || /@|https?:|www\.|\d{4,}|[<>{}]/.test(t)) return 'redacted'
  return t
}

const CAT_TOPIC = { funding: 'Funding & grants', testing: 'Testing environments', people: 'Partners & expertise' }
export function oppTopics(o) {
  const text = [o.title, o.summary, ...(o.tags || []), o.expertise, o.facilities].filter(Boolean).join(' ')
  const set = new Set(TOPIC_RULES.filter(([, re]) => re.test(text)).map(r => r[0]))
  if (CAT_TOPIC[o.mcat]) set.add(CAT_TOPIC[o.mcat])
  return [...set]
}
export const OPP_TOPICS = new Map(MEMBER_OPPS.map(o => [o.id, oppTopics(o)]))

// How many currently open listings exist for a topic (the "supply" side of demand versus availability).
export const supplyFor = (topic, now = new Date()) => MEMBER_OPPS.filter(o => isLive(o, now) && OPP_TOPICS.get(o.id).includes(topic)).length

export const topicsOfEvent = e => (e.type === 'search' ? [e.topic] : e.oppId ? OPP_TOPICS.get(e.oppId) || [] : [])
