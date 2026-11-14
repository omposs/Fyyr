import { MEMBER_LOGOS } from '../logos.js'
import { INTERESTS, MCATS } from '../member/data.js'

// ---- Simulated authorised member contacts (prototype). ----
// Real use: only people who agreed to receive event invitations, supplied by a server-side contacts service.
// Addresses here are fictional (.example). They are masked in the UI and never leave this browser.
const FIRST = ['Alex', 'Sam', 'Maja', 'Erik', 'Linnea', 'Oskar', 'Frida', 'Nils', 'Ida', 'Karl', 'Elin', 'Axel', 'Sara', 'Johan']
const LAST = ['Berg', 'Lind', 'Holm', 'Nyberg', 'Sjö', 'Ek', 'Strand', 'Dahl', 'Norén', 'Falk']
let seed = 77
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const pick = a => a[Math.floor(rnd() * a.length)]
const some = (a, n) => [...a].sort(() => rnd() - 0.5).slice(0, n)
const ascii = s => s.toLowerCase().replace(/ö/g, 'o').replace(/[åä]/g, 'a').replace(/[^a-z]/g, '')

export const CONTACTS = MEMBER_LOGOS.flatMap(co => Array.from({ length: 1 + Math.floor(rnd() * 2) }, (_, i) => {
  const f = pick(FIRST), l = pick(LAST)
  return {
    id: `${co.slug}-${i}`, name: `${f} ${l}`, email: `${ascii(f)}.${ascii(l)}@${co.slug.replace(/[^a-z0-9]/g, '')}.example`,
    company: co.name, companyId: co.slug,
    interests: some(INTERESTS, 1 + Math.floor(rnd() * 3)), categories: some(MCATS.map(c => c.id), 1 + Math.floor(rnd() * 3)),
    invitations: rnd() > 0.1, // false = has opted out of event invitations
    unsubscribed: rnd() > 0.95,
  }
}))
// A deliberate duplicate address (same person listed at two companies) to demonstrate de-duplication.
CONTACTS.push({ ...CONTACTS[3], id: 'dup-demo', company: CONTACTS[4].company, companyId: CONTACTS[4].companyId })

export const COMPANY_LIST = MEMBER_LOGOS.map(c => ({ id: c.slug, name: c.name }))
export const maskEmail = e => e.replace(/^(.).*?(@)(.*)$/, (_, a, at, d) => `${a}•••${at}${d}`)

// Audience = contacts matching ANY chosen company OR ANY explicit interest OR ANY category (when none chosen: all authorised),
// then plus manually added, minus manually removed. Opted-out and unsubscribed people are always excluded and reported separately.
export function resolveAudience(aud) {
  const any = aud.companies.length || aud.interests.length || aud.categories.length
  let pool = CONTACTS.filter(c => !any || aud.companies.includes(c.companyId) || c.interests.some(i => aud.interests.includes(i)) || c.categories.some(i => aud.categories.includes(i)))
  const opted = pool.filter(c => !c.invitations || c.unsubscribed)
  pool = pool.filter(c => c.invitations && !c.unsubscribed)
  const manual = (aud.added || []).map(a => ({ id: 'm-' + a.email, name: a.name || a.email.split('@')[0], email: a.email, company: a.company || 'Added manually', companyId: 'manual', manual: true }))
  pool = [...pool, ...manual].filter(c => !(aud.removed || []).includes(c.id))
  const seen = new Set(), out = []
  let dupes = 0
  for (const c of pool) { const k = c.email.trim().toLowerCase(); if (seen.has(k)) { dupes++; continue } seen.add(k); out.push(c) }
  return { recipients: out, duplicates: dupes, excluded: opted.length }
}
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
