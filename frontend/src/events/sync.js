import { useMemo } from 'react'
import { MEMBER_OPPS, OPP_BY_ID } from '../member/data.js'
import { OPP_TOPICS, oppTopics } from '../staff/topics.js'
import { contactHref, fmtShort, norm, placeOf, regHref, useStaffEvents } from './eventStore.js'
import { CATEGORIES } from './categories.js'
import { useOrgs } from './logoLib.js'
import { audienceBadge, canView, isMemberEvent, sameCompany, sharedBadge, viewerKey } from './access.js'

// Published staff events become ordinary member opportunities (same card, search, saving, analytics).
// Which events a person gets is decided by canView (events/access.js): public events for everyone, company-only events for the owning
// company and explicitly granted audiences. Drafts are never listed. This is browser-only, simulated access control.
const PREFIX = 'ev-'
const short = s => (s.length > 170 ? s.slice(0, 167).replace(/\s+\S*$/, '') + '…' : s)

const FAR = '2999-12-31' // "no end date": keeps an undated item open and sorts it after dated ones
const fmtLong = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const facts = a => a.filter(([, v]) => v && String(v).trim())

// Category-specific parts of an opportunity. Nothing is invented: a missing deadline stays missing, a missing cost stays unknown.
function catProps(e) {
  const x = e.x || {}
  switch (e.category) {
    case 'funding': {
      const fixed = x.deadlineMode !== 'rolling' && x.deadline
      return {
        cat: 'funding', mcat: 'funding', kind: x.fundingType, where: x.geography || '', provider: x.provider || undefined,
        urg: fixed ? [x.deadline] : [], urgLabel: 'Application deadline', end: fixed ? x.deadline : FAR, dateText: x.deadlineMode === 'rolling' ? 'Rolling applications' : '',
        amount: x.amountMode === 'specified' && x.amount ? `${x.amount} ${x.currency || ''}`.trim() : 'Not specified', eligibility: x.eligibility, next: 'Open official page',
        sharedCall: x.sharedAs === 'shared', goals: ['Find funding'],
        facts: facts([['Funding type', x.fundingType], ['Purpose', x.purpose], ['Geographical scope', x.geography], ['Application timing', x.deadlineMode === 'rolling' ? 'Rolling applications' : x.deadline ? 'Fixed deadline' : '']]),
      }
    }
    case 'testing': {
      const period = x.availMode === 'period' && x.availTo
      return {
        cat: 'testing', mcat: 'testing', kind: x.kind, where: x.locMode === 'remote' ? 'Remote' : x.locMode === 'both' ? `${x.location || 'On site'} and remote` : x.location || '', online: x.locMode === 'remote',
        urg: period ? [x.availTo] : [], urgLabel: 'Available until', end: period ? x.availTo : FAR, dateText: x.availMode === 'ongoing' ? 'Ongoing access' : '',
        facilities: x.capabilities, requirements: x.access, next: 'Apply or enquire', goals: ['Test a product'],
        facts: facts([['Suitable applications', x.applications], ['Availability', x.availMode === 'ongoing' ? 'Ongoing access' : period ? `${x.availFrom ? fmtLong(x.availFrom) + ' to ' : 'Until '}${fmtLong(x.availTo)}` : ''], ['Cost', x.cost || 'Not stated']]),
      }
    }
    case 'knowledge':
      return {
        cat: 'knowledge', mcat: 'knowledge', kind: x.contentType, where: 'Online reading', provider: x.publisher || undefined, source: x.publisher || undefined,
        urg: [], end: FAR, dateText: x.pubDate ? `Published ${fmtLong(x.pubDate)}` : '', next: 'Read original', goals: ['Build skills'],
        facts: facts([['Content type', x.contentType], ['Publisher or author', x.publisher], ['Publication date', x.pubDate ? fmtLong(x.pubDate) : '']]),
      }
    case 'people': {
      const seek = x.listing === 'seek'
      return {
        cat: seek ? 'collab' : 'experts', mcat: 'people', kind: seek ? 'Collaborator wanted' : 'Expertise offered', where: seek ? '' : x.location || '', provider: seek ? undefined : x.who || undefined,
        urg: [], end: FAR, dateText: '', expertise: seek ? x.sought : x.expertise, collab: seek ? x.canOffer : x.services, next: 'See how to get in touch', goals: ['Find partners'],
        facts: facts(seek ? [['Project or challenge', x.project], ['Intended outcome', x.outcome], ['Timeframe', x.timeframe]] : [['Availability', x.availability]]),
      }
    }
    default: return null
  }
}

export function toOpp(e0, orgs, viewer) {
  const e = norm(e0)
  const o = buildOpp(e0, orgs, viewer)
  // Demo records may carry extra detail rows (`rich`: [[label, text]]) shown in the detail popup after the category's own facts.
  const rich = facts(e.rich || [])
  if (rich.length) o.facts = [...(o.facts || []), ...rich]
  // Records from the demo workflows (events/demoWorkflow.js, data/fixtures/saabOpportunities.js) are fictional: flagged demo, and they offer no working link.
  return e.demoSeed || e.demoMember ? { ...o, demo: true, isDemo: true, demoSeed: !!e.demoSeed, url: undefined } : o
}
function buildOpp(e0, orgs, viewer) {
  const e = norm(e0) // an unsaved draft has no ownership or access fields yet
  const byId = Object.fromEntries(orgs.map(o => [o.id, o]))
  const organiser = e.organiser ? byId[e.organiser] || null : null
  const sponsors = e.sponsors.map(s => ({ org: byId[s.orgId], role: s.role, primary: !!s.primary })).filter(s => s.org)
  const time = e.start ? ` · ${e.start}${e.end ? '–' + e.end : ''}` : ''
  return {
    id: e.id, cat: 'events', mcat: 'events', title: e.title.trim(), summary: short(e.description.trim().replace(/\s+/g, ' ')), description: e.description.trim(),
    provider: organiser ? organiser.name : (e.owner?.company || 'Blue Science Park'), demo: false, staffEvent: true, publisherId: e.publisherId || (isMemberEvent(e) ? '' : 'bsp'), memberEvent: isMemberEvent(e), userSubmitted: isMemberEvent(e), owner: e.owner?.company || '',
    audienceBadge: isMemberEvent(e) ? audienceBadge(e) : '', sharedBadge: isMemberEvent(e) && viewer && (viewer.role === 'staff' || sameCompany(e, viewer)) ? sharedBadge(e) : null, kind: e.type,
    start: e.date, end: e.date, urg: e.regDeadline ? [e.regDeadline] : [], urgLabel: 'Registration closes',
    where: placeOf(e), online: e.mode === 'online', url: regHref(e), next: 'Register', source: organiser ? organiser.name : (e.owner?.company || 'Blue Science Park'),
    tags: e.tags, sectors: [], goals: [], dateText: fmtShort(e.date) + time, cover: e.cover || '', organiser, sponsors, eventType: e.type, tz: e.tz, published: e.publishedAt || e.updated,
    ...(e.category !== 'events' ? {
      description: (e.details || '').trim() || e.description.trim(), sectors: e.industries || [], start: '', provider: organiser ? organiser.name : (e.owner?.company || 'Blue Science Park'),
      source: organiser ? organiser.name : (e.owner?.company || 'Blue Science Park'), online: false, eventType: undefined, tz: undefined, category: e.category,
      // Everything here is submitted by a company or staff member. Fyyr has not independently verified it.
      userSubmitted: true, submittedBy: isMemberEvent(e) ? (e.owner?.company || 'a member company') : 'Blue Science Park staff', contact: (e.contact || '').trim(), contactHref: contactHref(e.contact),
      ...Object.fromEntries(Object.entries(catProps(e) || {}).filter(([, v]) => v !== undefined)),
    } : {}),
  }
}

export function syncStaffEvents(events, orgs, viewer) {
  for (let i = MEMBER_OPPS.length - 1; i >= 0; i--) if (MEMBER_OPPS[i].staffEvent) { delete OPP_BY_ID[MEMBER_OPPS[i].id]; OPP_TOPICS.delete(MEMBER_OPPS[i].id); MEMBER_OPPS.splice(i, 1) }
  for (const e of events) {
    if (e.status !== 'published' || ((e.category || 'events') === 'events' && !e.date) || !e.title.trim() || !canView(e, viewer)) continue
    const o = toOpp(e, orgs, viewer)
    MEMBER_OPPS.unshift(o); OPP_BY_ID[o.id] = o; OPP_TOPICS.set(o.id, oppTopics(o))
  }
}

// Call at the top of any screen that lists opportunities. Returns a version token to use in memo dependency lists.
export function useSyncedEvents(viewer) {
  const events = useStaffEvents(), orgs = useOrgs()
  const vk = viewerKey(viewer)
  return useMemo(() => { syncStaffEvents(events, orgs, viewer); return { events, orgs, vk } }, [events, orgs, vk]) // eslint-disable-line react-hooks/exhaustive-deps
}
export { PREFIX }
