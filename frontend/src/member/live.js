import { useCallback, useMemo, useState } from 'react'
import * as api from '../api/api.js'
import { useAsync } from '../api/useApi.js'
import { fmt, isLive, sortTs, urgency } from '../demoData.js'
import { normInterest, isPark } from './data.js'

// ============================================================================================
// LIVE content adapters. The UI keeps its existing component interfaces; this file translates backend responses into the record shape
// the UI already renders (see data/repository.js) and never the other way round. Nothing is invented: a field the API does not return
// stays empty, and the raw score is never shown as a percentage. If a request fails the error is surfaced, never replaced by demo data.
// Fictional demo fixtures only ever enter live mode as clearly flagged fill-ins for sections the backend has no data for (see withDemoPark).
// ============================================================================================
const FAR = '2999-12-31' // "no end date": keeps an undated item open and sorts it after dated ones
const CAT_OF = { events: 'events', funding: 'funding', testbeds: 'testing', news: 'knowledge' } // API module -> UI category
const NEXT = { events: 'View event page', funding: 'View call', testbeds: 'View testbed', news: 'Read at source' }
const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : '' } catch { return '' } }
// Records created by the backend's demo seed use a reserved, never-resolving domain: they are shown as demo and offer no link.
const isDemoUrl = u => /^https:\/\/demo\.invalid\//.test(u || '')
const isDemoName = n => /\(demo\)\s*$/i.test(n || '')

// GET /me/recommendations item -> UI record
export function toOpp(rec) {
  const cat = CAT_OF[rec.module] || 'knowledge'
  const isEvent = rec.module === 'events', isFunding = rec.module === 'funding'
  const start = isEvent ? rec.starts_at || undefined : undefined
  const deadline = isFunding ? rec.starts_at || undefined : undefined // the backend stores a funding deadline in starts_at
  const demo = isDemoUrl(rec.url)
  return {
    id: `item-${rec.item_id}`, itemId: rec.item_id, cat, mcat: cat, module: rec.module,
    title: rec.title, summary: rec.summary || rec.why_it_matters, provider: rec.source_name, source: rec.source_name,
    tags: [], sectors: [], goals: [], where: rec.location || '', online: false,
    start, urg: deadline ? [deadline] : [], urgLabel: deadline ? 'Application deadline' : '', end: start || deadline || FAR,
    dateText: isEvent && start ? `Event date ${fmt(start)}` : deadline ? `Deadline ${fmt(deadline)}` : rec.published_at ? `Published ${fmt(rec.published_at)}` : '',
    url: demo ? undefined : safeUrl(rec.url) || undefined, next: NEXT[rec.module] || 'Open source',
    published: rec.published_at ? Date.parse(rec.published_at + 'T12:00:00') : undefined,
    ...(demo ? { demo: true, isDemo: true } : {}),
  }
}

// GET /me/matches item -> UI record on the "Experts & partners" page. Only what the other company published is used.
export function matchToOpp(m) {
  const co = m.member
  const theirs = [...new Set(m.basis.map(b => b.their_item).filter(Boolean))]
  const demo = isDemoName(co.name)
  return {
    id: `co-${co.id}`, memberId: co.id, cat: 'collab', mcat: 'people', kind: 'collab',
    title: co.name, summary: m.explanation, provider: co.name, source: 'Published company profile',
    tags: [], sectors: [], goals: [], where: '', online: false, urg: [], urgLabel: '', end: FAR, dateText: '',
    expertise: theirs.join(', ') || undefined,
    facts: m.basis.slice(0, 4).map(b => [b.label, [b.your_item && `Your profile: ${b.your_item}`, b.their_item && `Theirs: ${b.their_item}`].filter(Boolean).join(' · ')]).filter(f => f[1]),
    next: 'View details', // no url: the primary button opens the details, nothing is sent to the company
    ...(demo ? { demo: true, isDemo: true } : {}),
  }
}

// Same shape as rank() in data.js. Order is the server's relevance order (recommendations first, then company matches in the backend's order).
function row(o, idx, now, score, reasons) { const u = urgency(o, now); return { o, idx, u, ts: sortTs(u), live: isLive(o, now), score, reasons, strength: null } }
export function buildRank(recs, matches = [], now = new Date()) {
  const seen = new Set()
  const items = [
    ...recs.filter(r => (seen.has(r.item_id) ? false : seen.add(r.item_id))).map(r => [toOpp(r), r.score, r.why_it_matters ? [r.why_it_matters] : []]),
    ...matches.map(m => [matchToOpp(m), m.score, m.basis.map(b => b.label)]),
  ]
  const all = items.map(([o, score, reasons], idx) => row(o, idx, now, score, reasons))
  return { all, live: all.filter(x => x.live), personal: true, server: true }
}
// The backend has no Blue Science Park-published items, so that section keeps the demo fixtures, flagged as demo (never hidden or emptied).
export function withDemoPark(liveR, demoR, now = new Date()) {
  const extra = demoR.all.filter(x => isPark(x.o) && x.o.demo).map((x, i) => ({ ...x, idx: liveR.all.length + i, score: 0, reasons: [], strength: null }))
  const all = [...liveR.all, ...extra]
  return { ...liveR, all, live: all.filter(x => x.live), now }
}

// GET /me/profile + GET /me -> the profile object the existing screens read. Fields the backend does not hold are left empty ("Not specified").
export function toProfile(base, session, prof) {
  const items = prof ? [...prof.stated, ...prof.inferred.filter(i => i.approved)] : []
  return {
    ...base, name: '', title: '', company: session?.name || '', website: session?.website || '', email: session?.email || '',
    sector: '', about: '', unit: '', office: '', workplace: '', location: '', size: '', goals: [], wants: [],
    interests: [...new Set(items.map(i => i.value))], _items: items,
  }
}

async function fetchRecs(signal) {
  const lists = await Promise.all(api.MODULES.map(module => api.recommendations({ module, limit: 50 }, signal)))
  return lists.flat().sort((a, b) => b.score - a.score)
}

// Fetches only while enabled (live mode). Errors stay visible per source; nothing falls back to demo data.
export function useLiveContent(enabled) {
  const recs = useAsync(s => (enabled ? fetchRecs(s) : Promise.resolve(null)), [enabled])
  const matches = useAsync(s => (enabled ? api.matches(20, s) : Promise.resolve(null)), [enabled])
  const profile = useAsync(s => (enabled ? api.profile(s) : Promise.resolve(null)), [enabled])
  const now = useMemo(() => new Date(), [recs.data])
  const r = useMemo(() => buildRank(recs.data || [], matches.data || [], now), [recs.data, matches.data, now])
  const sources = { recommendations: recs, 'company matches': matches, profile }
  const failed = Object.entries(sources).filter(([, q]) => q.error && !q.data).map(([k, q]) => ({ what: k, error: q.error }))
  const reload = useCallback(() => { recs.reload(); matches.reload(); profile.reload() }, [recs.reload, matches.reload, profile.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  return { r, profile: profile.data, loading: enabled && (recs.loading && !recs.data), loaded: !!recs.data, failed, reload, reloadProfile: profile.reload }
}

// Saves the interests editor in live mode: removed interests are deleted and new ones added as profile items. Only real server item ids
// are ever sent (items come from /me/profile); demo fixtures never reach these endpoints.
export function useSaveInterests(profile, reload) {
  const [state, setState] = useState({ busy: false, error: null })
  const save = useCallback(async list => {
    setState({ busy: true, error: null })
    try {
      const want = new Map(list.map(v => [normInterest(v), v]))
      const items = profile ? [...profile.stated, ...profile.inferred.filter(i => i.approved)] : []
      const have = new Set(items.map(i => normInterest(i.value)))
      for (const it of items) if (!want.has(normInterest(it.value))) await api.deleteItem(it.id)
      for (const [k, v] of want) if (!have.has(k)) await api.addItem('technology', v, true)
      await reload()
      setState({ busy: false, error: null })
      return true
    } catch (error) { setState({ busy: false, error }); return false }
  }, [profile, reload])
  return { ...state, save, clearError: () => setState(s => ({ ...s, error: null })) }
}
