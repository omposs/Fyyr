import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import NotifMenu from '../shell/NotifMenu.jsx'
import { ICON, ago, seedDemoNotifications, useAccountNotifications } from '../events/notifications.js'
import { useNotifPrefs } from '../Dashboard.jsx'
import { getSession, navigate, signOut } from '../auth.js'
import { useContentMode } from '../data/mode.js'
import { errorText } from '../api/client.js'
import { toProfile, useLiveContent, useSaveInterests, withDemoPark } from './live.js'
import ChatDialog from './ChatDialog.jsx'
import { seedDemoWorkflow } from '../events/demoWorkflow.js'
import SearchBar from './SearchBar.jsx'
import { CAT_COLOR } from '../staff/colors.js'
import ModeSwitch from '../shell/ModeSwitch.jsx'
import { MCATS, MCAT, OPP_BY_ID, byDate, hubKind, isPark, matchesQ, parkOrder, parkPicks, rank } from './data.js'
import { setTrackContext, track } from '../staff/events.js'
import { useMemberStore, dedupe, seedSavedOnce } from './store.js'
import { useSyncedEvents } from '../events/sync.js'
import { memberCompany, viewerFromSession } from '../events/access.js'
import { EventsRouter, memberCtx } from '../staff/EventsPage.jsx'
import { CATEGORIES, LEGACY_MY, MY_OPPS } from '../events/categories.js'
import { Detail, InterestsEditor, OppCard, ParkRow, TopCard } from './ui.jsx'
import Profile from './Profile.jsx'
import { AccountLink, AppHeader, Toolbar } from '../shell/AppHeader.jsx'
import './member.css'

// Saab demo account: one event, funding call, testbed, knowledge item and partner listing from the shared records, plus one of Saab's own.
const INITIAL_SAVES = ['ev-demo-autonomy-day', 'd4', 'd7', 'd11', 'd16', 'ev-saab-maritime-collab']
const PARK_CONTACT = 'https://www.bluesciencepark.se/kontakt/'
const NAV = [
  { id: 'overview', label: 'Overview', icon: 'layers' },
  { id: 'park', label: 'Blue Science Park', icon: 'spark' },
  ...MCATS.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
  { id: 'saved', label: 'Saved opportunities', icon: 'bookmark' },
]
// One unified “My opportunities” page. The older per-category paths are kept as aliases so existing links still work.
const PAGES = [...NAV.map(n => n.id), 'profile', MY_OPPS, ...LEGACY_MY]
const isMy = p => p === MY_OPPS || LEGACY_MY.includes(p)
const pathOf = id => (id === 'overview' ? '/member' : '/member/' + id)
const TITLES = { ...Object.fromEntries(NAV.map(n => [n.id, n.label])), profile: 'My profile', ...Object.fromEntries([MY_OPPS, ...LEGACY_MY].map(p => [p, 'My opportunities'])) }
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const inDays = d => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`)

const FILTERS = {
  events: [{ k: 'format', label: 'Format', opts: [['all', 'Any format'], ['online', 'Online'], ['in', 'In person']], test: (x, v) => (v === 'online' ? x.o.online : !x.o.online) }],
  funding: [{ k: 'window', label: 'Deadline', opts: [['all', 'Any time'], ['30', 'Within 30 days'], ['90', 'Within 90 days']], test: (x, v) => !!x.u && x.u.kind === 'deadline' && x.u.days <= +v }],
  testing: [{ k: 'kind', label: 'Type', opts: [['all', 'Any type'], ['Testbed', 'Testbed'], ['Lab', 'Lab'], ['Pilot site', 'Pilot site']], test: (x, v) => x.o.kind === v }],
  knowledge: [{ k: 'kind', label: 'Type', opts: [['all', 'Any type'], ['Course', 'Course'], ['Report', 'Report'], ['Briefing', 'Briefing'], ['Article', 'Article'], ['Research', 'Research'], ['Guide', 'Guide'], ['Industry update', 'Industry update'], ['Announcement', 'Announcement']], test: (x, v) => x.o.kind === v }],
  people: [{ k: 'type', label: 'Type', opts: [['all', 'Experts and partners'], ['experts', 'Experts'], ['collab', 'Partner companies']], test: (x, v) => x.o.cat === v }],
}
const SORTS = { match: 'Strongest match', soon: 'Soonest date', az: 'Name A to Z' }
// Live records (from the API) have no format/type fields, so live mode keeps only the date filters; demo mode keeps all of FILTERS.
const WINDOW = [['all', 'Any time'], ['30', 'Within 30 days'], ['90', 'Within 90 days']]
const LIVE_FILTERS = {
  events: [{ k: 'window', label: 'Date', opts: WINDOW, test: (x, v) => !!x.u && x.u.days <= +v }],
  funding: FILTERS.funding, testing: [], knowledge: [], people: [],
}
const SORT_KEYS = { events: ['match', 'soon'], funding: ['match', 'soon'], testing: ['match', 'soon'], knowledge: ['match', 'soon'], people: ['match', 'az'] }

function Empty({ title, children }) {
  return <div className="mem-empty"><strong>{title}</strong><p>{children}</p></div>
}

// ---------- Overview ----------
// Up to three interests are shown; the rest open inline. The full list and editor stay in the profile and the editor dialog.
function InterestsSummary({ profile, onEdit }) {
  const [all, setAll] = useState(false)
  const id = useId()
  const list = profile.interests, extra = list.length - 3
  const shown = all ? list : list.slice(0, 3)
  return (
    <section className="mem-card mem-int" aria-labelledby={id}>
      <h2 className="mem-side-h" id={id}>Your interests</h2>
      {list.length ? (
        <ul className="mem-chips">
          {shown.map(i => <li key={i} className="pill pill-blue">{i}</li>)}
          {extra > 0 && <li><button type="button" className="pill mem-more-chip" aria-expanded={all} onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `+${extra} more`}</button></li>}
        </ul>
      ) : <p className="fine">No interests selected yet.</p>}
      <button type="button" className="btn btn-glass btn-sm" onClick={onEdit}>{list.length ? 'Edit interests' : 'Add interests'}</button>
    </section>
  )
}

function Overview({ c, r }) {
  const { profile } = c
  // Ranking comes from the member's profile; the three strongest matches are shown once, with no forced category variety.
  const deadlines = r.live.filter(x => x.u && ((x.u.kind === 'deadline' && x.u.days <= 30) || (x.u.kind === 'event' && x.u.days <= 14))).sort((a, b) => a.u.days - b.u.days || a.idx - b.idx).slice(0, 3)
  // Park-organised items (explicit publisherId) are shown in their own section and are not repeated in Top matches.
  const park = parkPicks(r.live, 3)
  const rest = r.live.filter(x => !park.includes(x))
  const top = r.server ? rest.slice(0, 3) : r.personal ? rest.filter(x => x.strength).slice(0, 3) : [...rest].sort(byDate).slice(0, 3)
  const topKey = [...park, ...top].map(x => x.o.id).join()
  useEffect(() => { c.shown(topKey.split(',').filter(Boolean), 'overview') }, [topKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const strong = r.live.filter(x => x.strength === 'strong').length
  const soon = r.live.filter(x => x.u && x.u.kind === 'deadline' && x.u.days <= 14).length
  const h = new Date().getHours()
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mem-ov">
      <div className="mem-ov-main">
        <header className="mem-hello">
          <h2>{hello}, {profile.name.split(' ')[0] || 'there'}</h2>
          <p>{r.personal ? 'Here are the opportunities most relevant to your company.' : 'Here are upcoming opportunities from across the park.'}
            {r.personal && !r.server && <span className="muted"> {plural(strong, 'strong match', 'strong matches')} · {plural(soon, 'deadline', 'deadlines')} in the next 2 weeks.</span>}
            {r.server && <span className="muted"> {plural(r.live.length, 'recommendation', 'recommendations')} · {plural(soon, 'deadline', 'deadlines')} in the next 2 weeks.</span>}</p>
        </header>

        {!r.personal && <p className="notice">This is a general discovery feed, not personalised. <button type="button" className="auth-link inline" onClick={c.openInterests}>Add interests to personalise</button></p>}

        <section aria-labelledby="top-h">
          <h2 className="mem-sec" id="top-h">{r.personal ? 'Top matches' : 'Upcoming opportunities'}</h2>
          {top.length ? (
            <ul className="mem-tops">{top.map(x => <TopCard key={x.o.id} x={x} c={c} />)}</ul>
          ) : <Empty title="No strong matches yet">Add or change your interests to see what fits your company best.</Empty>}
        </section>

        <section className="mem-park" aria-labelledby="park-h">
          <div className="mem-park-h"><h2 className="mem-sec" id="park-h">From Blue Science Park</h2><a href="/member/park" className="mem-more" onClick={e => { e.preventDefault(); c.go('/member/park') }}>View all from Blue Science Park</a></div>
          {park.length ? <ul className="mem-park-list">{park.map(x => <ParkRow key={x.o.id} x={x} c={c} />)}</ul> : <p className="fine">Nothing new from Blue Science Park right now.</p>}
        </section>
      </div>

      <aside className="mem-ov-side" aria-label="Deadlines and interests">
        <section className="mem-card" aria-labelledby="dl-h">
          <h2 className="mem-side-h" id="dl-h">Upcoming deadlines</h2>
          <p className="fine">Sorted by nearest date, not by match.</p>
          {deadlines.length ? (
            <ul className="mem-dl">{deadlines.map(x => {
              const amber = x.u.kind === 'deadline' && x.u.days <= 14
              return (
                <li key={x.o.id}>
                  <button type="button" className="mem-title" onClick={() => c.openDetail(x.o.id)}>{x.o.title}</button>
                  <span className={'when' + (amber ? ' when-soon' : '')}><Icon n="clock" size={14} />{x.u.label}</span>
                  <span className="fine">{inDays(x.u.days)}{x.u.kind === 'event' ? ' · event date, not a deadline' : ''}</span>
                </li>
              )
            })}</ul>
          ) : <p className="fine mem-dl-empty">Nothing is closing soon. We’ll show deadlines here as they approach.</p>}
        </section>

        <InterestsSummary profile={profile} onEdit={c.openInterests} />
      </aside>
    </div>
  )
}

// ---------- shared list pieces ----------
function Chips({ value, onChange, items }) {
  return <div className="chips-row" role="group" aria-label="Filter by category">{items.map(([k, l, n]) => <button key={k} type="button" className="fchip" aria-pressed={value === k} onClick={() => onChange(k)}>{l}{n != null && <span className="mem-count"> {n}</span>}</button>)}</div>
}

function CategoryPage({ id, c, r, q }) {
  const cat = MCAT[id]
  const keys = r.personal ? SORT_KEYS[id] : SORT_KEYS[id].filter(k => k !== 'match')
  const [sort, setSort] = useState(keys[0])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({})
  const panel = useId()
  const filters = r.server ? LIVE_FILTERS[id] : FILTERS[id]
  const active = filters.filter(x => f[x.k] && f[x.k] !== 'all')
  const base = r.live.filter(x => x.o.mcat === id)
  let items = base.filter(x => matchesQ(x, q) && active.every(a => a.test(x, f[a.k])))
  if (sort === 'soon') items = [...items].sort(byDate)
  if (sort === 'az') items = [...items].sort((a, b) => a.o.title.localeCompare(b.o.title))
  const filtered = items.length !== base.length
  const shownKey = items.slice(0, 10).map(x => x.o.id).join()
  useEffect(() => { c.shown(shownKey.split(',').filter(Boolean), id) }, [shownKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mem-page">
      <p className="mem-lead">{cat.blurb}</p>
      <div className="ev-head">
        <p className="fine">{CATEGORIES[id].lead}</p>
        <div className="st-act">
          <button type="button" className="btn btn-glass btn-sm" onClick={() => c.go('/member/' + MY_OPPS)}>My opportunities</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => c.go('/member/' + MY_OPPS + '/new/' + id)}>{CATEGORIES[id].add}</button>
        </div>
      </div>
      {!r.personal && <p className="notice">General discovery feed, not personalised. <button type="button" className="auth-link inline" onClick={c.openInterests}>Add interests to personalise</button></p>}
      <div className="mem-bar">
        <p className="mem-result" role="status">{filtered ? `${items.length} of ${plural(base.length, 'opportunity', 'opportunities')}` : plural(items.length, 'opportunity', 'opportunities')}{q && <> matching “{q}”</>}</p>
        <div className="mem-bar-r">
          {filters.length > 0 && <button type="button" className="btn btn-glass btn-sm" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(o => !o)}>Filters{active.length > 0 && <b className="mem-badge">{active.length}</b>}</button>}
          <label className="sort">Sort by
            <select className="sel" value={sort} onChange={e => setSort(e.target.value)}>{keys.map(k => <option key={k} value={k}>{SORTS[k]}</option>)}</select>
          </label>
        </div>
      </div>
      {open && (
        <div className="mem-filters" id={panel}>
          {filters.map(x => (
            <label key={x.k} className="sort">{x.label}
              <select className="sel" value={f[x.k] || 'all'} onChange={e => setF({ ...f, [x.k]: e.target.value })}>{x.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
          ))}
          {active.length > 0 && <button type="button" className="link-btn" onClick={() => setF({})}>Clear filters</button>}
        </div>
      )}
      {items.length ? <ul className="cards">{items.map(x => <OppCard key={x.o.id} x={x} c={c} />)}</ul>
        : <Empty title="Nothing matches right now">{q || active.length ? 'Try a different search or clear your filters.' : 'There are no open opportunities in this area at the moment.'}</Empty>}
    </div>
  )
}

function ParkHub({ c, r, q }) {
  const [kind, setKind] = useState('all')
  const all = r.live.filter(x => isPark(x.o) && matchesQ(x, q))
  const items = kind === 'all' ? all : all.filter(x => hubKind(x.o) === kind)
  const [sched, rest] = parkOrder(items)
  const list = [...sched, ...rest]
  const count = k => all.filter(x => hubKind(x.o) === k).length
  const shownKey = list.slice(0, 10).map(x => x.o.id).join()
  useEffect(() => { c.shown(shownKey.split(',').filter(Boolean), 'park') }, [shownKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mem-page">
      <Chips value={kind} onChange={setKind} items={[['all', 'All', all.length], ['activity', 'Activities', count('activity')], ['programme', 'Programmes and opportunities', count('programme')], ['news', 'News and announcements', count('news')]]} />
      <p className="mem-result" role="status">{plural(list.length, 'item', 'items')} organised by Blue Science Park{q && <> matching “{q}”</>}</p>
      {list.length ? <ul className="cards">{list.map(x => <OppCard key={x.o.id} x={x} c={c} />)}</ul> : <Empty title="Nothing here yet">{q || kind !== 'all' ? 'Try another filter or clear the search.' : 'Blue Science Park has not published anything you can see right now.'}</Empty>}
      <section className="mem-card" aria-labelledby="park-sup">
        <h2 className="mem-side-h" id="park-sup">Support and contact</h2>
        <p className="fine">Questions about funding, testing, introductions or your membership go to the park team.</p>
        <p><a href={PARK_CONTACT} target="_blank" rel="noopener noreferrer">Blue Science Park contact page<Icon n="ext" size={13} /></a></p>
      </section>
    </div>
  )
}

function SearchResults({ c, r, q }) {
  const [cat, setCat] = useState('all')
  const hits = r.live.filter(x => matchesQ(x, q))
  const items = cat === 'all' ? hits : hits.filter(x => x.o.mcat === cat)
  const shownKey = items.slice(0, 10).map(x => x.o.id).join()
  useEffect(() => { c.shown(shownKey.split(',').filter(Boolean), 'search') }, [shownKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mem-page">
      <h2 className="mem-side-h">Search results for “{q}”</h2>
      <p className="mem-result" role="status">{plural(hits.length, 'result', 'results')} across all categories</p>
      <Chips value={cat} onChange={setCat} items={[['all', 'All', hits.length], ...MCATS.map(m => [m.id, m.short, hits.filter(x => x.o.mcat === m.id).length])]} />
      {items.length ? <ul className="cards">{items.map(x => <OppCard key={x.o.id} x={x} c={c} />)}</ul> : <Empty title="No results">Try fewer or different words, or browse a category from the sidebar.</Empty>}
    </div>
  )
}

function Saved({ c, r, q }) {
  const [cat, setCat] = useState('all')
  const mine = r.all.filter(x => c.saved.includes(x.o.id))
  const shown = mine.filter(x => (cat === 'all' || x.o.mcat === cat) && matchesQ(x, q))
  const active = shown.filter(x => x.live), expired = shown.filter(x => !x.live)
  if (!mine.length) return <Empty title="Nothing saved yet">Save opportunities to keep them here. <a href="/member" className="mem-more" onClick={e => { e.preventDefault(); c.go('/member') }}>Back to Overview</a></Empty>
  return (
    <div className="mem-page">
      <Chips value={cat} onChange={setCat} items={[['all', 'All', mine.length], ...MCATS.map(m => [m.id, m.short, mine.filter(x => x.o.mcat === m.id).length]).filter(x => x[2])]} />
      <p className="mem-result" role="status">{plural(shown.length, 'saved opportunity', 'saved opportunities')}{q && <> matching “{q}”</>}</p>
      {active.length > 0 && <ul className="cards">{active.map(x => <OppCard key={x.o.id} x={x} c={c} />)}</ul>}
      {expired.length > 0 && <section aria-labelledby="exp-h"><h2 className="mem-sec" id="exp-h">Expired</h2><p className="fine">These are no longer open. Remove them when you’re done.</p><ul className="cards">{expired.map(x => <OppCard key={x.o.id} x={x} c={c} expired />)}</ul></section>}
      {!shown.length && <Empty title="Nothing matches">Try another category or clear the search.</Empty>}
    </div>
  )
}

// ---------- shell ----------
function Bell({ c, live }) {
  const n = useAccountNotifications({ audience: 'member', live })
  const items = n.items.map(x => ({ id: x.id, icon: ICON[x.type] || 'bell', title: x.title, detail: x.detail, time: ago(x.ts), timeFull: new Date(x.ts).toLocaleString('en-GB'), unread: x.unread,
    run: () => { n.markRead(x.id); x.target.kind === 'opp' ? c.openDetail(x.target.id) : c.go(x.target.path) } }))
  return <NotifMenu items={items} unread={n.unread} onMarkAll={n.markAllRead} empty={live ? 'No notifications yet. Notifications are not connected to the live service, so nothing is shown here.' : 'No notifications yet.'} footer={{ label: 'Notification preferences', run: () => c.go('/member/profile') }} />
}

export default function MemberApp({ path }) {
  const session = getSession()
  const mode = useContentMode() // 'demo' (original fixtures) or 'live' (backend API); independent of how you logged in
  const isLive = mode === 'live'
  // Fictional demo records and a few first saves, each written once (idempotent, never overwriting what the user changed).
  useState(() => {
    seedDemoWorkflow(); seedDemoNotifications()
    const mail = String(session?.email || '').toLowerCase()
    if (session?.role === 'member' && memberCompany(mail).id === 'saab') seedSavedOnce(mail, INITIAL_SAVES.filter(id => OPP_BY_ID[id] || id.startsWith('ev-')))
    return 1
  })
  const demoStore = useMemberStore(session?.email)
  const live = useLiveContent(isLive)
  const saveInts = useSaveInterests(live.profile, live.reload)
  const np = useNotifPrefs()
  const now = useMemo(() => new Date(), [])
  const viewer = viewerFromSession()
  const synced = useSyncedEvents(viewer) // events this person may see (public, own company, explicitly granted) join the opportunity list
  const demoR = useMemo(() => rank(demoStore.profile, now), [demoStore.profile.interests, demoStore.profile.sector, demoStore.profile.goals, demoStore.profile.wants, now, synced]) // eslint-disable-line react-hooks/exhaustive-deps
  // Live mode: the profile comes from the server and edits go to the server (never demo ids). Saved items stay local to this browser.
  const profile = isLive ? toProfile(demoStore.profile, session, live.profile) : demoStore.profile
  const store = isLive ? { ...demoStore, profile } : demoStore
  const r = isLive ? withDemoPark(live.r, demoR) : demoR
  const [chatOpen, setChatOpen] = useState(false)
  const [chat, setChat] = useState({ msgs: [], sid: null })
  const slug = path.replace(/^\/member\/?/, '').replace(/\/$/, '') || 'overview'
  const head = slug.split('/')[0]
  const sub = slug.split('/').slice(1).join('/')
  const page = PAGES.includes(head) ? head : 'overview'
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [editInt, setEditInt] = useState(false)
  const [menu, setMenu] = useState(false)
  const main = useRef(null)

  useEffect(() => { document.title = `Fyyr – ${TITLES[page]}`; main.current?.focus({ preventScroll: true }) }, [page])
  useEffect(() => {
    const key = e => e.key === 'Escape' && setMenu(false)
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  // ---- analytics events (what staff see in aggregate). Recorded once per real action, never per render. ----
  setTrackContext({ sector: profile.sector })
  const catOf = id => OPP_BY_ID[id]?.mcat ?? r.all.find(x => x.o.id === id)?.o.mcat
  const c = {
    profile, saved: store.saved, ranked: r,
    toggleSaved: id => { track(store.saved.includes(id) ? 'unsave' : 'save', { oppId: id, cat: catOf(id), page }); store.toggleSaved(id) },
    openDetail: id => { track('view', { oppId: id, cat: catOf(id), page }); setDetail(id) },
    trackSource: id => track('click_source', { oppId: id, cat: catOf(id), page: 'detail' }),
    markNotRelevant: id => track('not_relevant', { oppId: id, cat: catOf(id), page: 'detail' }),
    shown: (ids, from) => ids.forEach(id => track('shown', { oppId: id, cat: catOf(id), page: from })),
    openInterests: () => setEditInt(true),
    go: p => { setMenu(false); if (p === '/member') setQ(''); navigate(p) },
  }

  // A search is recorded once it settles (about a second after typing stops), with a sanitised term and its result count.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2 || page === 'saved' || page === 'profile') return
    const t = setTimeout(() => {
      const scope = MCAT[page] ? page : 'all'
      const n = r.live.filter(x => (scope === 'all' || x.o.mcat === scope) && matchesQ(x, term)).length
      track('search', { term, resultCount: n, cat: scope, page })
    }, 1000)
    return () => clearTimeout(t)
  }, [q, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const detailX = detail && r.all.find(x => x.o.id === detail)
  const logout = async () => { await signOut(); navigate('/') }
  const who = profile.name || profile.company
  const link = (id, label, icon, extra) => (
    <a key={id} href={pathOf(id)} className="side-item" aria-current={page === id || (id === MY_OPPS && isMy(page)) ? 'page' : undefined} onClick={e => { e.preventDefault(); c.go(pathOf(id)) }}>
      {CAT_COLOR[id] ? <span className="cat-ico" style={{ color: CAT_COLOR[id] }}><Icon n={icon} size={18} /></span> : <Icon n={icon} size={18} />}{label}{extra}
    </a>
  )
  const searching = q.trim() && page === 'overview'
  // Pages that search only part of the catalogue say so under the search box.
  const scope = page === 'saved' ? 'Saved opportunities' : isMy(page) ? 'My opportunities' : page === 'park' ? 'Blue Science Park' : MCAT[page] ? MCAT[page].label : null

  return (
    <div className="mem">
      <a className="skip" href="#mem-main" onClick={e => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      {menu && <button type="button" className="mem-scrim" aria-label="Close menu" onClick={() => setMenu(false)} />}
      <aside className={'mem-side' + (menu ? ' open' : '')}>
        <a href="/member" className="brand" aria-label="Fyyr overview" onClick={e => { e.preventDefault(); c.go('/member') }}><span className="wordmark">FYYR</span><span className="by">by Blue Science Park</span></a>
        <nav aria-label="Member" className="mem-nav">
          {NAV.map(n => link(n.id, n.label, n.icon, n.id === 'saved' && store.saved.length > 0 ? <b>{store.saved.length}</b> : null))}
          {link(MY_OPPS, 'My opportunities', 'events')}
        </nav>
        <div className="mem-bottom">
          {isLive && <button type="button" className="side-item" onClick={() => setChatOpen(true)}><Icon n="spark" size={18} />Assistant</button>}
          {link('profile', 'My profile', 'experts')}
          <button type="button" className="side-item" onClick={logout}><Icon n="arrow" size={18} />Log out</button>
        </div>
      </aside>

      <div className="mem-col">
        <AppHeader icon={searching ? 'spark' : page === 'profile' ? 'experts' : isMy(page) ? 'events' : (NAV.find(n => n.id === page)?.icon || 'layers')} title={searching ? 'Search results' : TITLES[page]} menuOpen={menu} onMenu={() => setMenu(m => !m)}>
          <ModeSwitch />
          <Bell c={c} live={isLive} />
          <AccountLink initials={who.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'} name={who} org={profile.name ? profile.company : 'Member company'} href="/member/profile" onGo={c.go} />
        </AppHeader>

        <main id="mem-main" ref={main} tabIndex={-1} className="mem-content">
          <Toolbar left={page === 'profile' ? null : <SearchBar value={q} onChange={v => { setQ(v); if (page === 'profile' && v.trim()) navigate('/member') }} onSubmit={term => { if (term && page === 'profile') navigate('/member') }}
            label={page === 'overview' || page === 'profile' ? 'Search all opportunities' : `Search ${TITLES[page].toLowerCase()}`} scope={scope} onAsk={isLive ? () => setChatOpen(true) : undefined} />} />
          {isLive && live.failed.length > 0 && (
            <div className="mem-empty" role="alert"><strong>Could not load {live.failed.map(f => f.what).join(', ')}</strong><p>{errorText(live.failed[0].error)}</p><button type="button" className="btn btn-primary btn-sm" onClick={live.reload}>Try again</button></div>
          )}
          {isLive && live.loading ? <p className="fine" role="status">Loading live data…</p> : searching ? <SearchResults c={c} r={r} q={q.trim()} />
            : page === 'overview' ? <Overview c={c} r={r} />
            : page === 'park' ? <ParkHub c={c} r={r} q={q.trim()} />
            : page === 'saved' ? <Saved c={c} r={r} q={q.trim()} />
            : page === 'profile' ? <Profile c={c} store={store} np={np} live={isLive} />
            : isMy(page) ? <EventsRouter key="my" ctx={{ ...memberCtx(), q: q.trim() }} sub={sub} />
            : <CategoryPage key={page} id={page} c={c} r={r} q={q.trim()} />}
        </main>
      </div>

      {detailX && <Detail x={detailX} c={c} onClose={() => setDetail(null)} />}
      {editInt && <InterestsEditor current={profile.interests} busy={isLive && saveInts.busy} error={isLive && saveInts.error ? errorText(saveInts.error) : null}
        onClose={() => { saveInts.clearError(); setEditInt(false) }}
        onSave={list => { if (isLive) saveInts.save(dedupe(list)).then(ok => ok && setEditInt(false)); else { store.setProfile({ interests: dedupe(list) }); setEditInt(false) } }} />}
      {chatOpen && <ChatDialog chat={chat} setChat={setChat} onClose={() => setChatOpen(false)} />}
    </div>
  )
}
