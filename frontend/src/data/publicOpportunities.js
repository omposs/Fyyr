import { useCallback, useEffect, useMemo, useState } from 'react'
import { fmt } from '../demoData.js'
import { publicOpportunities } from '../api/api.js'
import { listOpportunities } from './repository.js'
import { seedDemoWorkflow } from '../events/demoWorkflow.js'
import { useStaffEvents } from '../events/eventStore.js'
import { toOpp } from '../events/sync.js'
import { ANON, canView } from '../events/access.js'
import { useOrgs } from '../events/logoLib.js'

// ============================================================================================
// ONE adapter for the landing page's public opportunities. It never uses a staff token or member credentials. Sources, in priority order:
//   1. API      GET /public/opportunities (app/api/public.py): the SERVER returns only records staff approved for public display, with
//               an allow-list of fields. Nothing private is fetched and then hidden here.
//   2. Local    published company-created and Blue Science Park opportunities held in this browser, kept only if the same access check
//               an anonymous visitor would get (events/access.js canView with ANON) allows them: public + published.
//               Company-only and draft fixtures never pass it. (These live in browser storage in this prototype, so the server cannot
//               enforce them; the check is the simulated access control described in access.js.)
//   3. Base     committed examples (data/repository.js): sourced public records plus fictional demo examples, each marked `public: true`.
// Records are de-duplicated by stable id, then by source URL and normalised title; an API record is never replaced by demo content.
// ============================================================================================
const CAT = { events: 'events', funding: 'funding', testbeds: 'testing', news: 'knowledge' }
const normTitle = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function fromApi(r) {
  const cat = CAT[r.module] || 'knowledge'
  const iso = r.starts_at || ''
  const isDeadline = r.module === 'funding' || r.module === 'testbeds' // starts_at is a deadline here, an event date for events
  return {
    id: 'api-' + r.id, apiId: r.id, cat, mcat: cat, title: r.title, summary: r.summary, description: r.summary, provider: r.source_name, source: r.source_name,
    url: r.url, next: 'Open original source', where: r.location || '', online: false, tags: r.tags || [], sectors: [], goals: [],
    isDemo: false, demo: false, public: true, fromApi: true,
    start: !isDeadline && iso ? iso : undefined, urg: isDeadline && iso ? [iso] : [], urgLabel: cat === 'funding' ? 'Application deadline' : 'Application deadline',
    end: iso || '2999-12-31', published: r.published_at ? new Date(r.published_at + 'T12:00:00').getTime() : undefined,
    dateText: iso ? `${isDeadline ? 'Deadline' : 'Event date'} ${fmt(iso)}` : r.published_at ? `Published ${fmt(r.published_at)}` : '',
  }
}

export function mergePublic(api, local, base) {
  const out = [], ids = new Set(), urls = new Set(), titles = new Set()
  const add = o => {
    const u = (o.url || '').replace(/\/$/, ''), t = normTitle(o.title)
    if (!o.id || ids.has(o.id) || (u && urls.has(u)) || (t && titles.has(t))) return
    ids.add(o.id); if (u) urls.add(u); if (t) titles.add(t); out.push(o)
  }
  api.forEach(add); local.forEach(add); base.filter(o => o.public === true).forEach(add) // anything not explicitly public is dropped
  return out
}

export function usePublicOpportunities() {
  useState(() => { seedDemoWorkflow(); return 1 }) // fictional Blue Science Park examples (idempotent), so a first-time visitor sees them
  const events = useStaffEvents(), orgs = useOrgs()
  const [state, setState] = useState({ status: 'loading', api: [], error: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const ctl = new AbortController()
    setState(s => ({ ...s, status: 'loading' }))
    ;(async () => {
      try {
        const rows = []
        for (let offset = 0, total = 1; offset < total && offset < 500; offset += 100) {
          const r = await publicOpportunities({ limit: 100, offset, sort: 'soon' }, ctl.signal)
          rows.push(...r.items); total = r.total
        }
        setState({ status: 'ok', api: rows.map(fromApi), error: null })
      } catch (e) { if (e?.name !== 'AbortError') setState({ status: 'error', api: [], error: e }) }
    })()
    return () => ctl.abort()
  }, [tick])
  const items = useMemo(() => {
    const local = events.filter(e => e.status === 'published' && (e.category || 'events') !== undefined && e.title.trim() && ((e.category || 'events') !== 'events' || e.date) && canView(e, ANON)).map(e => toOpp(e, orgs, ANON))
    return mergePublic(state.api, local, listOpportunities())
  }, [state.api, events, orgs])
  return { items, status: state.status, error: state.error, reload: useCallback(() => setTick(t => t + 1), []) }
}

// Anonymous saves: public record ids kept in THIS browser only. The key deliberately does not start with "fyyr." so signing in or out
// (which wipes private account data) neither reads nor clears it, and it never touches a signed-in account's saved items.
const SAVE_KEY = 'fyyr:public-saved'
const readSaved = () => { try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }
export function useLocalSaved() {
  const [ids, setIds] = useState(readSaved)
  const commit = next => { setIds(next); try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)) } catch { /* kept for this visit only */ } }
  return { ids, toggle: id => commit(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]), keepOnly: valid => { const n = ids.filter(x => valid.has(x)); if (n.length !== ids.length) commit(n) } }
}
