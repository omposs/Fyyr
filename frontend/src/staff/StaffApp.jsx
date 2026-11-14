import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import NotifMenu from '../shell/NotifMenu.jsx'
import { getSession, navigate, signOut } from '../auth.js'
import ModeSwitch from '../shell/ModeSwitch.jsx'
import { SimNote } from './perf.jsx'
import { seedDemoWorkflow } from '../events/demoWorkflow.js'
import { MCATS, SECTORS } from '../member/data.js'
import { Dialog } from '../member/ui.jsx'
import '../member/member.css'
import './privacy.css'
import './staff.css'
import { AccessError, SOURCES, demoCompany, loadEvents, sharedCompanies } from './analyticsApi.js'
import { EVENTS_CHANGED, clearLive } from './events.js'
import { DEFINITIONS, LIMITS, compute, fmtDY, makeRange } from './metrics.js'
import { STATUSES, DEFAULT_K, useStaffStore } from './store.js'
import { Companies, Insights, OurPerformance, Performance, Reports, SearchTrends } from './pages.jsx'
import { Overview } from './overview.jsx'
import { DemoCtx, SimpleTable } from './charts.jsx'
import EventsPage from './EventsPage.jsx'
import StaffProfile from './StaffProfile.jsx'
import { AccountLink, AppHeader, Toolbar } from '../shell/AppHeader.jsx'
import { useStaffProfile } from './profileStore.js'
import NetworkPage from '../network/NetworkPage.jsx'
import { useSyncedEvents } from '../events/sync.js'
import { viewerFromSession } from '../events/access.js'
import { ICON, ago, seedDemoNotifications, useAccountNotifications } from '../events/notifications.js'

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'layers' },
  { id: 'insights', label: 'Member insights', icon: 'spark' },
  { id: 'search', label: 'Search trends', icon: 'knowledge' },
  { id: 'performance', label: 'Opportunity performance', icon: 'up' },
  { id: 'ours', label: 'Our performance', icon: 'spark' },
  { id: 'companies', label: 'Companies', icon: 'experts' },
  { id: 'events', label: 'Opportunities', icon: 'events' },
  { id: 'network', label: 'Science park network', icon: 'collab' },
  { id: 'reports', label: 'Reports', icon: 'bookmark' },
]
const PAGES = [...NAV.map(n => n.id), 'profile']
const labelOf = id => (id === 'profile' ? 'My profile' : id === 'ours' ? 'Blue Science Park analytics' : NAV.find(n => n.id === id).label)
const pathOf = id => (id === 'overview' ? '/staff' : '/staff/' + id)
const DEFAULT_F = { preset: '30', from: '', to: '', cat: 'all', sector: 'all', company: 'all' }
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`

// ---------- filters ----------
// Compact inline period control: label plus a select as wide as its value. Custom dates appear only for "Custom".
function PeriodControl({ f, setF, range, presetsOnly }) {
  const uid = useId()
  const set = patch => setF(x => ({ ...x, ...patch }))
  return (
    <span className="st-period">
      <label className="sort" htmlFor={uid + 'p'}>Period
        <select id={uid + 'p'} className="sel st-period-sel" value={f.preset} onChange={e => set({ preset: e.target.value, ...(e.target.value === 'custom' && !f.from ? { from: range.from ? new Date(range.from).toISOString().slice(0, 10) : '', to: todayIso() } : {}) })}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>{!presetsOnly && <option value="custom">Custom range</option>}
        </select>
      </label>
      {f.preset === 'custom' && !presetsOnly && (
        <>
          <label className="sort">From <input type="date" className="sel st-period-sel" value={f.from} max={f.to || todayIso()} onChange={e => set({ from: e.target.value })} /></label>
          <label className="sort">To <input type="date" className="sel st-period-sel" value={f.to} min={f.from} max={todayIso()} onChange={e => set({ to: e.target.value })} /></label>
        </>
      )}
    </span>
  )
}

function FilterBar({ f, setF, range, companies, minimal, source, presetsOnly, parkOnly }) {
  const uid = useId()
  const set = patch => setF(x => ({ ...x, ...patch }))
  const active = []
  if (f.cat !== 'all') active.push(MCATS.find(c => c.id === f.cat).label)
  if (f.sector !== 'all') active.push(f.sector)
  if (f.company !== 'all') active.push(companies.find(c => c.id === f.company)?.name || 'One company')
  const dirty = f.preset !== DEFAULT_F.preset || active.length > 0
  return (
    <section className="st-filters" aria-label="Filters">
      <div className="st-frow">
        <PeriodControl f={f} setF={setF} range={range} presetsOnly={presetsOnly} />
        {!minimal && (
          <>
            <label className="sort">Category
              <select className="sel" value={f.cat} onChange={e => set({ cat: e.target.value })}><option value="all">All categories</option>{MCATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            </label>
            {!parkOnly && <>
            <label className="sort">Industry
              <select className="sel" value={f.sector} onChange={e => set({ sector: e.target.value })}><option value="all">All industries</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="sort">Company
              <select className="sel" value={f.company} onChange={e => set({ company: e.target.value })} disabled={!companies.length} title={companies.length ? '' : 'No company has agreed to share its own activity in this data source'}>
                <option value="all">All companies (aggregate)</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            </>}
          </>
        )}
      </div>
      {(active.length > 0 || dirty) && <p className="st-active" role="status">
        {active.map(a => <span key={a} className="pill pill-blue">{a}</span>)}
        {dirty && <button type="button" className="link-btn st-reset" onClick={() => setF(DEFAULT_F)}>Reset filters</button>}
      </p>}
    </section>
  )
}

// ---------- dialogs ----------
function FollowDialog({ prefill, store, onClose }) {
  const uid = useId()
  const [title, setTitle] = useState(prefill.title)
  const [owner, setOwner] = useState(store.defaultOwner)
  const [status, setStatus] = useState('New')
  const save = e => { e.preventDefault(); store.add({ ...prefill, title: title.trim() || prefill.title, owner: owner.trim(), status }); onClose() }
  return (
    <Dialog label="Save as follow-up" onClose={onClose}>
      <form onSubmit={save} noValidate>
        <h2 className="auth-h">Save as follow-up</h2>
        <p className="auth-sub">An internal item for Blue Science Park staff. Nobody is contacted.</p>
        <div className="auth-fld"><label htmlFor={uid + 't'}>Short description</label><input id={uid + 't'} data-af value={title} maxLength={140} onChange={e => setTitle(e.target.value)} /></div>
        <div className="st-evid-sum"><b>Supporting evidence</b><p>{prefill.observed}</p><p className="fine">{prefill.period}{prefill.companies ? ` · ${plural(prefill.companies, 'company', 'companies')}` : ''}. Aggregate evidence is attached.</p></div>
        <div className="mem-grid2">
          <div className="auth-fld"><label htmlFor={uid + 'o'}>Owner</label><input id={uid + 'o'} value={owner} maxLength={80} placeholder="Name or team" onChange={e => setOwner(e.target.value)} /></div>
          <div className="auth-fld"><label htmlFor={uid + 's'}>Status</label><select id={uid + 's'} value={status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary btn-sm">Save follow-up</button></div>
      </form>
    </Dialog>
  )
}

function FollowupsDialog({ store, onClose }) {
  const [open, setOpen] = useState(null)
  return (
    <Dialog label="Follow-up items" onClose={onClose} side>
      <h2 className="auth-h det-h">Follow-up items</h2>
      <p className="auth-sub">Internal to staff. Saved in this browser (prototype).</p>
      {!store.items.length && <p className="fine">Nothing saved yet. Use "Save as follow-up" on a finding, topic, opportunity or introduction.</p>}
      <ul className="st-fu">{store.items.map(i => (
        <li key={i.id}>
          <h3>{i.title}</h3>
          <p className="fine">{i.observed}</p>
          <p className="fine">{i.period} · saved {new Date(i.created).toLocaleDateString('en-GB')}</p>
          <div className="mem-grid2">
            <div className="auth-fld"><label htmlFor={'o' + i.id}>Owner</label><input id={'o' + i.id} value={i.owner} placeholder="Name or team" onChange={e => store.update(i.id, { owner: e.target.value })} /></div>
            <div className="auth-fld"><label htmlFor={'s' + i.id}>Status</label><select id={'s' + i.id} value={i.status} onChange={e => store.update(i.id, { status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          {open === i.id && i.evidence && <SimpleTable head={i.evidence.head} rows={i.evidence.rows} caption={`Evidence for ${i.title}`} />}
          <div className="st-act">
            {i.evidence && <button type="button" className="btn btn-glass btn-sm" aria-expanded={open === i.id} onClick={() => setOpen(o => (o === i.id ? null : i.id))}>{open === i.id ? 'Hide evidence' : 'Show evidence'}</button>}
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => store.remove(i.id)}>Delete</button>
          </div>
        </li>))}
      </ul>
    </Dialog>
  )
}

function PrivacyDialog({ d, onClose }) {
  const c = d.res.coverage
  const types = Object.entries(c.byType).sort((a, b) => b[1] - a[1])
  return (
    <Dialog label="Data and privacy" onClose={onClose} side cls="dlg-privacy">
      <header className="pv-head"><h2 className="auth-h det-h">Data and privacy</h2></header>
      <div className="pv-body">
      <h3 className="mem-sec st-h3">What is collected</h3>
      <p>When a member uses the member area, Fyyr records: searches (a short normalised term, its topic and how many results it returned), opportunities shown in lists, detail views, saves, source-link clicks, "not relevant" marks, and changes to selected interests. Each event has a time, a company identifier and the company’s industry. Typed text containing emails, URLs, long numbers or long sentences is dropped, not stored.</p>
      <h3 className="mem-sec st-h3">Why</h3>
      <p>To help Blue Science Park see what members need and where to add support or opportunities. It is not used to rate or rank companies.</p>
      <h3 className="mem-sec st-h3">What staff can see</h3>
      <ul className="st-plain"><li>Aggregate topics, counts and trends.</li><li>Groups with fewer than {d.ctx.k} companies are hidden .</li><li>A company’s own summary only if that company agreed to share it.</li></ul>
      <h3 className="mem-sec st-h3">What staff cannot see</h3>
      <ul className="st-plain"><li>Individual search histories or browsing timelines.</li><li>Raw search text.</li><li>Private conversations or another company’s non-public profile data.</li></ul>
      <h3 className="mem-sec st-h3">Coverage</h3>
      <p>{d.ctx.source === 'demo' ? 'Demo data.' : 'Events recorded in this browser.'} {c.total} events{c.first ? `, ${fmtDY(c.first)} to ${fmtDY(c.last)}` : ''} from {plural(c.companies, 'company', 'companies')}. Last update {c.last ? new Date(c.last).toLocaleString('en-GB') : 'none'}.</p>
      {types.length > 0 && <SimpleTable caption="Events by type" head={['Event type', 'Events']} rows={types} />}
      <h3 className="mem-sec st-h3">Not tracked or unavailable</h3>
      <ul className="st-plain">{LIMITS.map(l => <li key={l}>{l}</li>)}</ul>
      <h3 className="mem-sec st-h3">Metric definitions</h3>
      <ul className="st-plain">{DEFINITIONS.map(([a, b]) => <li key={a}><b>{a}.</b> {b}</li>)}</ul>
      <p className="notice"><b>Prototype notice.</b> Access checks and small-group rules run in the browser. Before real member data is used, they and the export rules must be enforced on a server.</p>
      </div>
    </Dialog>
  )
}

function Bell({ d, go }) {
  const live = d.source === 'live'
  const n = useAccountNotifications({ audience: 'staff', live })
  const items = n.items.map(x => ({ id: x.id, icon: ICON[x.type] || 'bell', title: x.title, detail: x.detail, time: ago(x.ts), timeFull: new Date(x.ts).toLocaleString('en-GB'), unread: x.unread,
    run: () => { n.markRead(x.id); go(x.target.path) } }))
  return <NotifMenu items={items} unread={n.unread} onMarkAll={n.markAllRead} empty={live ? 'No notifications yet. Notifications are not connected to recorded data, so nothing is shown here.' : 'No notifications yet.'} footer={{ label: 'Notification preferences', run: () => go('/staff/profile') }} />
}

// ---------- shell ----------
export default function StaffApp({ path }) {
  const session = getSession()
  const store = useStaffStore(session?.email)
  const sp = useStaffProfile()
  store.defaultOwner = session?.email || ''
  const seg = path.replace(/^\/staff\/?/, '').split('/').filter(Boolean)
  const slug = seg[0] || 'overview'
  const sub = seg.slice(1).join('/') || undefined
  useState(() => { seedDemoWorkflow(); seedDemoNotifications(); return 1 }) // adds the fictional demo opportunities once (events/demoWorkflow.js)
  const synced = useSyncedEvents(viewerFromSession()) // changes whenever a demo opportunity is published, edited or archived
  const page = PAGES.includes(slug) ? slug : 'overview'
  const [source, setSource] = useState('demo')
  const [f, setF] = useState(DEFAULT_F)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState(false)
  const [dlg, setDlg] = useState(null)
  const [follow, setFollow] = useState(null)
  const main = useRef(null)

  useEffect(() => { document.title = `Fyyr – Staff – ${labelOf(page)}`; main.current?.focus({ preventScroll: true }) }, [page])
  useEffect(() => {
    const bump = () => setTick(t => t + 1)
    window.addEventListener(EVENTS_CHANGED, bump); window.addEventListener('storage', bump)
    const key = e => e.key === 'Escape' && setMenu(false)
    document.addEventListener('keydown', key)
    return () => { window.removeEventListener(EVENTS_CHANGED, bump); window.removeEventListener('storage', bump); document.removeEventListener('keydown', key) }
  }, [])

  // The overview answers three fixed questions for the whole network: only the period applies (7, 30 or 90 days).
  const eff = useMemo(() => (page === 'overview' ? { ...f, preset: f.preset === 'custom' ? '30' : f.preset, cat: 'all', sector: 'all', company: 'all' } : page === 'ours' ? { ...f, cat: 'all', sector: 'all', company: 'all' } : f), [f, page])
  const range = useMemo(() => makeRange(eff.preset, { from: eff.from, to: eff.to }), [eff.preset, eff.from, eff.to])
  const data = useMemo(() => {
    try {
      const events = loadEvents(source), shared = sharedCompanies(source)
      const ctx = { range, f: eff, k: store.k, source }
      return { events, shared, ctx, res: compute(events, { range, f: eff, k: store.k, shared: shared.map(c => c.id) }) }
    } catch (e) { return { error: e } }
  }, [source, range, eff, store.k, tick, synced])

  useEffect(() => { if (data.shared && f.company !== 'all' && !data.shared.some(c => c.id === f.company)) setF(x => ({ ...x, company: 'all' })) }, [data.shared, f.company])

  const go = p => { setMenu(false); navigate(p) }
  const logout = async () => { await signOut(); navigate('/') }
  if (data.error) return (
    <main className="mem-content" ref={main} tabIndex={-1}><div className="mem-empty"><strong>{data.error instanceof AccessError ? 'Staff access required' : 'Something went wrong'}</strong><p>{data.error instanceof AccessError ? 'This area is only for Blue Science Park staff.' : 'The analytics could not be loaded.'}</p><button type="button" className="btn btn-primary btn-sm" onClick={logout}>Back to home</button></div></main>
  )

  const d = { ...data, store, openFollow: setFollow, source, sub, synced }
  const c = data.res.coverage
  const sharedList = data.shared.map(s => ({ id: s.id, name: demoCompany(s.id).name }))
  const tool = page === 'events' || page === 'network' || page === 'profile' // event authoring is not an analytics view: no period filters or data banners
  const minimal = page === 'companies' || page === 'overview' // the directory only needs the period; behavioural filters do not apply
  const title = labelOf(page)
  const Page = { overview: Overview, insights: Insights, search: SearchTrends, performance: Performance, ours: OurPerformance, companies: Companies, reports: Reports, events: null, network: null }[page]

  return (
    <div className="mem st">
      <a className="skip" href="#st-main" onClick={e => { e.preventDefault(); main.current?.focus() }}>Skip to content</a>
      {menu && <button type="button" className="mem-scrim" aria-label="Close menu" onClick={() => setMenu(false)} />}
      <aside className={'mem-side' + (menu ? ' open' : '')}>
        <a href="/staff" className="brand" aria-label="Fyyr staff overview" onClick={e => { e.preventDefault(); go('/staff') }}><span className="wordmark">FYYR</span><span className="by">Staff workspace</span></a>
        <nav aria-label="Staff" className="mem-nav">
          {NAV.map(n => <a key={n.id} href={pathOf(n.id)} className="side-item" aria-current={page === n.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(pathOf(n.id)) }}><Icon n={n.icon} size={18} />{n.label}</a>)}
        </nav>
        <div className="mem-bottom">
          <a href="/staff/profile" className="side-item" aria-current={page === 'profile' ? 'page' : undefined} onClick={e => { e.preventDefault(); go('/staff/profile') }}><Icon n="experts" size={18} />My profile</a>
          <button type="button" className="side-item" onClick={() => setDlg('privacy')}><Icon n="check" size={18} />Data and privacy</button>
          <button type="button" className="side-item" onClick={logout}><Icon n="arrow" size={18} />Log out</button>
        </div>
      </aside>

      <div className="mem-col">
        <AppHeader icon={page === 'profile' ? 'experts' : NAV.find(n => n.id === page).icon} title={title} menuOpen={menu} onMenu={() => setMenu(m => !m)}>
          <ModeSwitch fixed />
          <Bell d={d} go={go} />
          <AccountLink initials={sp.profile.initials} name={sp.profile.name} org={sp.profile.organisation} href="/staff/profile" onGo={go} />
        </AppHeader>

        <main id="st-main" ref={main} tabIndex={-1} className="mem-content">
          <div className="mem-page">
            <Toolbar className="st-tb"
              left={page === 'overview' || page === 'ours' ? <PeriodControl f={eff} setF={setF} range={range} presetsOnly={page === 'overview'} /> : !tool ? <FilterBar f={eff} setF={setF} presetsOnly={page === 'overview'} range={range} companies={sharedList} minimal={minimal} parkOnly={page === 'ours'} source={source} /> : null}
              right={page === 'profile' ? null : <>
                {!tool && <label className="sort st-source">Data
            <select className="sel" value={source} onChange={e => { setSource(e.target.value); setF(x => ({ ...x, company: 'all' })) }}>{SOURCES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
          </label>}
                <button type="button" className="btn btn-glass btn-sm st-fu-btn" onClick={() => setDlg('follow')}><Icon n="bookmark" size={16} />Follow-ups{store.items.length > 0 && <b className="mem-badge">{store.items.length}</b>}</button>
              </>} />
            {!tool && source !== 'demo' && <p className="notice st-banner"><b>Recorded in this browser.</b> Events from the member area in this browser, one company. Groups with fewer than {store.k} companies are hidden, so most detail stays hidden here.</p>}
            {!tool && store.k < DEFAULT_K && <p className="notice st-warn" role="alert"><b>Small-group protection is reduced (threshold {store.k}).</b> Results involving fewer than {DEFAULT_K} companies may reveal one company’s activity. <button type="button" className="auth-link inline" onClick={() => store.setK(DEFAULT_K)}>Restore the default ({DEFAULT_K})</button></p>}
            {tool ? (page === 'network' ? <NetworkPage /> : page === 'profile' ? <StaffProfile sp={sp} source={source} /> : <EventsPage sub={sub} />) : <><SimNote /><DemoCtx.Provider value={source === 'demo'}><Page d={d} /></DemoCtx.Provider></>}
            {!tool && <footer className="st-foot fine">
              Last event {c.last ? new Date(c.last).toLocaleString('en-GB') : 'none yet'} · {c.inPeriod} counted events in this period, {c.total} in total from {plural(c.companies, 'company', 'companies')} · Not tracked: registrations, applications, free-text feedback · <button type="button" className="auth-link inline" onClick={() => setDlg('privacy')}>Data and privacy</button>
            </footer>}
          </div>
        </main>
      </div>

      {follow && <FollowDialog prefill={follow} store={store} onClose={() => setFollow(null)} />}
      {dlg === 'follow' && <FollowupsDialog store={store} onClose={() => setDlg(null)} />}
      {dlg === 'privacy' && <PrivacyDialog d={d} onClose={() => setDlg(null)} />}
          </div>
  )
}
