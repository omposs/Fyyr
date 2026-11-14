import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { useNotifPrefs } from '../Dashboard.jsx'
import { clearSession, getSession, navigate } from '../auth.js'
import { MCATS, MCAT, byDate, matchesQ, rank } from './data.js'
import { useMemberStore, dedupe } from './store.js'
import { Detail, InterestsEditor, OppCard, Row, TopCard } from './ui.jsx'
import Profile from './Profile.jsx'
import './member.css'

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'layers' },
  ...MCATS.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
  { id: 'saved', label: 'Saved opportunities', icon: 'bookmark' },
]
const PAGES = [...NAV.map(n => n.id), 'profile']
const pathOf = id => (id === 'overview' ? '/member' : '/member/' + id)
const TITLES = { ...Object.fromEntries(NAV.map(n => [n.id, n.label])), profile: 'My profile' }
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const inDays = d => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`)

const FILTERS = {
  events: [{ k: 'format', label: 'Format', opts: [['all', 'Any format'], ['online', 'Online'], ['in', 'In person']], test: (x, v) => (v === 'online' ? x.o.online : !x.o.online) }],
  funding: [{ k: 'window', label: 'Deadline', opts: [['all', 'Any time'], ['30', 'Within 30 days'], ['90', 'Within 90 days']], test: (x, v) => !!x.u && x.u.kind === 'deadline' && x.u.days <= +v }],
  testing: [{ k: 'kind', label: 'Type', opts: [['all', 'Any type'], ['Testbed', 'Testbed'], ['Lab', 'Lab'], ['Pilot site', 'Pilot site']], test: (x, v) => x.o.kind === v }],
  knowledge: [{ k: 'kind', label: 'Type', opts: [['all', 'Any type'], ['Course', 'Course'], ['Report', 'Report'], ['Briefing', 'Briefing']], test: (x, v) => x.o.kind === v }],
  people: [{ k: 'type', label: 'Type', opts: [['all', 'Experts and partners'], ['experts', 'Experts'], ['collab', 'Partner companies']], test: (x, v) => x.o.cat === v }],
}
const SORTS = { match: 'Strongest match', soon: 'Soonest date', az: 'Name A to Z' }
const SORT_KEYS = { events: ['match', 'soon'], funding: ['match', 'soon'], testing: ['match', 'soon'], knowledge: ['match', 'soon'], people: ['match', 'az'] }

function Empty({ title, children }) {
  return <div className="mem-empty"><strong>{title}</strong><p>{children}</p></div>
}

// ---------- Overview ----------
function Overview({ c, r }) {
  const { profile } = c
  const top = r.personal ? r.live.filter(x => x.strength).slice(0, 3) : [...r.live].sort(byDate).slice(0, 3)
  const topIds = new Set(top.map(x => x.o.id))
  const deadlines = r.live.filter(x => x.u && ((x.u.kind === 'deadline' && x.u.days <= 30) || (x.u.kind === 'event' && x.u.days <= 14))).sort((a, b) => a.u.days - b.u.days || a.idx - b.idx).slice(0, 3)
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
            {r.personal && <span className="muted"> {plural(strong, 'strong match', 'strong matches')} · {plural(soon, 'deadline', 'deadlines')} in the next 2 weeks.</span>}</p>
        </header>

        {!r.personal && <p className="notice">This is a general discovery feed, not personalised. <button type="button" className="auth-link inline" onClick={c.openInterests}>Add interests to personalise</button></p>}

        <section aria-labelledby="top-h">
          <h2 className="mem-sec" id="top-h">{r.personal ? 'Top matches' : 'Upcoming opportunities'}</h2>
          {top.length ? (
            <ul className="mem-tops">{top.map((x, i) => <TopCard key={x.o.id} x={x} c={c} feature={i === 0} />)}</ul>
          ) : <Empty title="No strong matches yet">Add or change your interests to see what fits your company best.</Empty>}
        </section>

        <section aria-labelledby="across-h">
          <h2 className="mem-sec" id="across-h">Across your opportunities</h2>
          <div className="mem-cats">
            {MCATS.map(cat => {
              const all = r.live.filter(x => x.o.mcat === cat.id)
              const rest = all.filter(x => !topIds.has(x.o.id)).slice(0, 2)
              return (
                <section key={cat.id} className="mem-cat" aria-label={cat.label}>
                  <div className="mem-cat-h">
                    <h3><Icon n={cat.icon} size={16} />{cat.label}<span className="mem-count">{all.length}</span></h3>
                    <a href={pathOf(cat.id)} className="mem-more" onClick={e => { e.preventDefault(); c.go(pathOf(cat.id)) }}>View all<span className="sr"> {cat.label}</span></a>
                  </div>
                  {rest.length ? <ul>{rest.map(x => <Row key={x.o.id} x={x} c={c} />)}</ul> : <p className="fine">{all.length ? 'Everything here is already in your top matches.' : 'Nothing open in this area right now.'}</p>}
                </section>
              )
            })}
          </div>
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

        <section className="mem-card" aria-labelledby="int-h">
          <h2 className="mem-side-h" id="int-h">Your interests</h2>
          <p className="fine">Your interests help us prioritise relevant opportunities.</p>
          {profile.interests.length ? <ul className="mem-chips">{profile.interests.map(i => <li key={i} className="pill pill-blue">{i}</li>)}</ul> : <p className="fine">No interests selected yet.</p>}
          <button type="button" className="btn btn-glass btn-sm" onClick={c.openInterests}>{profile.interests.length ? 'Edit interests' : 'Add interests'}</button>
        </section>
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
  const filters = FILTERS[id]
  const active = filters.filter(x => f[x.k] && f[x.k] !== 'all')
  const base = r.live.filter(x => x.o.mcat === id)
  let items = base.filter(x => matchesQ(x, q) && active.every(a => a.test(x, f[a.k])))
  if (sort === 'soon') items = [...items].sort(byDate)
  if (sort === 'az') items = [...items].sort((a, b) => a.o.title.localeCompare(b.o.title))
  const filtered = items.length !== base.length
  return (
    <div className="mem-page">
      <p className="mem-lead">{cat.blurb}</p>
      {!r.personal && <p className="notice">General discovery feed, not personalised. <button type="button" className="auth-link inline" onClick={c.openInterests}>Add interests to personalise</button></p>}
      <div className="mem-bar">
        <p className="mem-result" role="status">{filtered ? `${items.length} of ${plural(base.length, 'opportunity', 'opportunities')}` : plural(items.length, 'opportunity', 'opportunities')}{q && <> matching “{q}”</>}</p>
        <div className="mem-bar-r">
          <button type="button" className="btn btn-glass btn-sm" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(o => !o)}>Filters{active.length > 0 && <b className="mem-badge">{active.length}</b>}</button>
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

function SearchResults({ c, r, q }) {
  const [cat, setCat] = useState('all')
  const hits = r.live.filter(x => matchesQ(x, q))
  const items = cat === 'all' ? hits : hits.filter(x => x.o.mcat === cat)
  return (
    <div className="mem-page">
      <p className="mem-result" role="status">{plural(hits.length, 'result', 'results')} for “{q}”</p>
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
function Bell({ r, c }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const key = e => e.key === 'Escape' && (setOpen(false), wrap.current?.querySelector('button')?.focus())
    const down = e => !wrap.current?.contains(e.target) && setOpen(false)
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', down)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down) }
  }, [open])
  const soon = r.live.filter(x => x.u && x.u.kind === 'deadline' && x.u.days <= 14).sort((a, b) => a.u.days - b.u.days).slice(0, 3)
  return (
    <div className="bell-wrap" ref={wrap}>
      <button type="button" className="icon-btn" aria-label="Notifications" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}><Icon n="bell" />{soon.length > 0 && <i className="dot" />}</button>
      {open && (
        <div className="pop mem-pop" id={id} role="region" aria-label="Notifications">
          <strong>Closing soon</strong>
          {soon.length ? <ul className="mem-dl">{soon.map(x => <li key={x.o.id}><button type="button" className="mem-title" onClick={() => { setOpen(false); c.openDetail(x.o.id) }}>{x.o.title}</button><span className="when when-soon">{x.u.label}</span></li>)}</ul> : <p className="fine">Nothing is closing in the next 2 weeks.</p>}
          <p className="fine">Preview only: nothing is delivered in this demo.</p>
          <a href="/member/profile" className="mem-more" onClick={e => { e.preventDefault(); setOpen(false); c.go('/member/profile') }}>Notification preferences</a>
        </div>
      )}
    </div>
  )
}

export default function MemberApp({ path }) {
  const session = getSession()
  const store = useMemberStore(session?.email)
  const np = useNotifPrefs()
  const { profile } = store
  const now = useMemo(() => new Date(), [])
  const r = useMemo(() => rank(profile, now), [profile.interests, profile.sector, profile.goals, profile.wants, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const slug = path.replace(/^\/member\/?/, '').replace(/\/$/, '') || 'overview'
  const page = PAGES.includes(slug) ? slug : 'overview'
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

  const c = {
    profile, saved: store.saved, toggleSaved: store.toggleSaved, ranked: r,
    openDetail: setDetail, openInterests: () => setEditInt(true),
    go: p => { setMenu(false); if (p === '/member') setQ(''); navigate(p) },
  }
  const detailX = detail && r.all.find(x => x.o.id === detail)
  const logout = () => { clearSession(); navigate('/') }
  const link = (id, label, icon, extra) => (
    <a key={id} href={pathOf(id)} className="side-item" aria-current={page === id ? 'page' : undefined} onClick={e => { e.preventDefault(); c.go(pathOf(id)) }}>
      <Icon n={icon} size={18} />{label}{extra}
    </a>
  )
  const searching = q.trim() && page === 'overview'

  return (
    <div className="mem">
      <a className="skip" href="#mem-main" onClick={e => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      {menu && <button type="button" className="mem-scrim" aria-label="Close menu" onClick={() => setMenu(false)} />}
      <aside className={'mem-side' + (menu ? ' open' : '')}>
        <a href="/member" className="brand" aria-label="Fyyr overview" onClick={e => { e.preventDefault(); c.go('/member') }}><span className="wordmark">FYYR</span><span className="by">by Blue Science Park</span></a>
        <nav aria-label="Member" className="mem-nav">
          {NAV.map(n => link(n.id, n.label, n.icon, n.id === 'saved' && store.saved.length > 0 ? <b>{store.saved.length}</b> : null))}
        </nav>
        <div className="mem-bottom">
          {link('profile', 'My profile', 'experts')}
          <button type="button" className="side-item" onClick={logout}><Icon n="arrow" size={18} />Log out</button>
        </div>
      </aside>

      <div className="mem-col">
        <header className="mem-top">
          <button type="button" className="icon-btn mem-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icon n={menu ? 'x' : 'layers'} /></button>
          <h1 className="mem-h1">{searching ? 'Search results' : TITLES[page]}</h1>
          <form className="mem-search" role="search" onSubmit={e => e.preventDefault()}>
            <Icon n="spark" size={16} />
            <input type="search" aria-label={page === 'overview' || page === 'profile' ? 'Search all opportunities' : `Search ${TITLES[page].toLowerCase()}`} placeholder="Search opportunities" value={q} maxLength={80} autoComplete="off"
              onChange={e => { setQ(e.target.value); if (page === 'profile' && e.target.value.trim()) navigate('/member') }} />
          </form>
          <Bell r={r} c={c} />
          <a href="/member/profile" className="mem-who" onClick={e => { e.preventDefault(); c.go('/member/profile') }} aria-label={`My profile: ${profile.name}, ${profile.company}`}>
            <span className="mem-av" aria-hidden="true">{profile.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}</span>
            <span className="mem-who-t"><b>{profile.name}</b><small>{profile.company}</small></span>
          </a>
        </header>

        <main id="mem-main" ref={main} tabIndex={-1} className="mem-content">
          {searching ? <SearchResults c={c} r={r} q={q.trim()} />
            : page === 'overview' ? <Overview c={c} r={r} />
            : page === 'saved' ? <Saved c={c} r={r} q={q.trim()} />
            : page === 'profile' ? <Profile c={c} store={store} np={np} />
            : <CategoryPage key={page} id={page} c={c} r={r} q={q.trim()} />}
        </main>
      </div>

      {detailX && <Detail x={detailX} c={c} onClose={() => setDetail(null)} />}
      {editInt && <InterestsEditor current={profile.interests} onClose={() => setEditInt(false)} onSave={list => { store.setProfile({ interests: dedupe(list) }); setEditInt(false) }} />}
    </div>
  )
}
