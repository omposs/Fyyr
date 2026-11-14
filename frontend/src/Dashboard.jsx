import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { CATS, CHECKED, isLive, urgency, sortTs } from './demoData.js'
import { errorText } from './api/client.js'
import { publicOpportunity } from './api/api.js'
import { usePublicOpportunities, useLocalSaved } from './data/publicOpportunities.js'
import { matchesQ } from './member/data.js'
import { OppCard, Detail } from './member/ui.jsx'
import SearchBar from './member/SearchBar.jsx'

// Anonymous saves: public record ids in this browser only (data/publicOpportunities.js), separate from any signed-in account.
export const useSaved = useLocalSaved

// ---- notification preferences: stored only in this browser (localStorage); nothing is delivered ----
const KEY = 'fyyr.notification-preferences.v1'
const DEFAULT_PREFS = { freq: 'weekly', time: '08:00', weekday: 'mon', topics: { events: true, funding: true, testing: true, knowledge: false, experts: false, collab: false }, critical: false, window: 48 }
const WEEKDAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']]
export const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'local time' } })()
const readPrefs = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v ? { ...DEFAULT_PREFS, ...v, topics: { ...DEFAULT_PREFS.topics, ...v.topics } } : null } catch { return null } }

export function useNotifPrefs() {
  const [saved, setSaved] = useState(readPrefs)
  const save = v => { setSaved(v); try { localStorage.setItem(KEY, JSON.stringify(v)); return true } catch { return false } }
  return { prefs: saved || DEFAULT_PREFS, hasSaved: !!saved, save }
}
const short = c => c.label.replace(' & workshops', '').replace(' & pilots', '').replace(' & trends', '')
const joinList = a => (a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])
export const prefsSummary = p => {
  const names = CATS.filter(c => p.topics[c.id]).map(short)
  const reg = p.freq === 'off' ? 'Regular updates: Off' : `${p.freq === 'daily' ? 'Daily' : 'Weekly'} · ${names.length ? joinList(names) : 'No topics selected'}`
  return [reg, `Critical alerts: ${p.critical ? `On · Within ${p.window} hours` : 'Off'}`]
}

const NAV = [
  { id: 'events', label: 'Events & workshops', icon: 'events' },
  { id: 'funding', label: 'Funding', icon: 'funding' },
  { id: 'testing', label: 'Testing & pilots', icon: 'testing' },
  { id: 'knowledge', label: 'Knowledge & trends', icon: 'knowledge' },
  { id: 'people', label: 'Experts & partners', icon: 'experts' },
  { id: 'saved', label: 'Saved opportunities', icon: 'bookmark' },
]
// Undated items go last in both directions.
const byTs = dir => (a, b) => (a.ts == null ? 1 : b.ts == null ? -1 : dir * (a.ts - b.ts))

const SORTS = [['soon', 'Soonest date'], ['late', 'Latest date'], ['newest', 'Newest'], ['title', 'Title A to Z']]

export function Dashboard({ saved, np, notify }) {
  const [view, setView] = useState('events')
  const [sort, setSort] = useState('soon')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)
  const [gone, setGone] = useState(() => new Set()) // API records the server no longer lists as public
  const [notifOpen, setNotifOpen] = useState(false)
  const bellRef = useRef(null)
  const now = useMemo(() => new Date(), [])
  const pub = usePublicOpportunities()

  // Both the bell and "Edit preferences" (here or elsewhere on the page) open the same panel.
  useEffect(() => {
    const open = e => e.detail === 'notif' && setNotifOpen(true)
    window.addEventListener('fyyr:open-panel', open)
    return () => window.removeEventListener('fyyr:open-panel', open)
  }, [])

  // One eligible, upcoming list. Past or closed items are excluded everywhere (cards, counts, deadlines). No scores: not personalised.
  const base = useMemo(() => pub.items.filter(o => !gone.has(o.id) && isLive(o, now)).map((o, i) => { const u = urgency(o, now); return { o, idx: i, u, ts: sortTs(u), live: true, score: 0, reasons: [], strength: null } }), [pub.items, gone, now])
  const available = useMemo(() => new Set(base.map(x => x.o.id)), [base])
  const savedNow = saved.ids.filter(id => available.has(id)) // anonymous saves of records that are no longer public disappear from results
  useEffect(() => { if (pub.status !== 'loading') saved.keepOnly?.(available) }, [available, pub.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const cmp = (a, b) => {
    if (sort === 'title') return a.o.title.localeCompare(b.o.title)
    if (sort === 'newest') return (b.o.published || 0) - (a.o.published || 0) || a.idx - b.idx
    return (a.ts == null ? 1 : b.ts == null ? -1 : (sort === 'late' ? -1 : 1) * (a.ts - b.ts)) || a.idx - b.idx // undated go last in both directions
  }
  const pool = view === 'saved' ? base.filter(x => saved.ids.includes(x.o.id)) : base.filter(x => x.o.mcat === view)
  const shown = pool.filter(x => matchesQ(x, q.trim())).sort(cmp)
  const deadlines = base.filter(x => x.u && x.u.kind === 'deadline' && x.u.days <= 14).sort((a, b) => a.ts - b.ts)
  const [regular, critical] = prefsSummary(np.prefs)
  const cur = NAV.find(n => n.id === view)
  const closePanel = restore => { setNotifOpen(false); if (restore) setTimeout(() => bellRef.current?.focus(), 0) }
  const detailX = detail && base.find(x => x.o.id === detail)
  const c = { saved: saved.ids, toggleSaved: saved.toggle, openDetail: id => setDetail(id), trackSource: () => {}, pub: true, openInterests: () => {} }

  // Opening an API record re-asks the server (the public detail endpoint applies the same rule). If it is no longer public, it is removed.
  useEffect(() => {
    const x = detail && base.find(y => y.o.id === detail)
    if (!x?.o.fromApi) return
    const ctl = new AbortController()
    publicOpportunity(x.o.apiId, ctl.signal).catch(e => { if (e?.kind === 'notfound') { setGone(g => new Set(g).add(x.o.id)); setDetail(null) } })
    return () => ctl.abort()
  }, [detail]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div id="demo" tabIndex={-1} className="dash" role="region" aria-label="Fyyr public opportunities">
      <div className="dash-top">
        <div className="dash-top-l">
          <span className="dash-brand">FYYR</span>
          <h2 className="dash-title">Public opportunities</h2>
        </div>
        <button ref={bellRef} type="button" className="icon-btn" aria-label="Notification preferences" aria-expanded={notifOpen} data-np-trigger onClick={() => (notifOpen ? closePanel(false) : setNotifOpen(true))}><Icon n="bell" />{np.prefs.freq !== 'off' || np.prefs.critical ? <i className="dot" /> : null}</button>
      </div>

      <div className="dash-grid">
        <nav className="side" aria-label="Opportunity categories">
          {NAV.map(n => (
            <button key={n.id} type="button" className="side-item" aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}>
              <Icon n={n.icon} size={18} />{n.label}
              {n.id === 'saved' && savedNow.length > 0 && <b>{savedNow.length}</b>}
            </button>
          ))}
        </nav>

        <div className="feed">
          <label className="cat-menu">Category
            <select className="sel" value={view} onChange={e => setView(e.target.value)}>
              {NAV.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </label>
          <SearchBar value={q} onChange={setQ} label="Search public opportunities" scope={view === 'saved' ? 'Saved opportunities' : null} />
          <div className="feed-head">
            <div>
              <h3>{cur.label}</h3>
              <p className="muted" role="status">{q.trim() ? `${shown.length} of ${pool.length} matching “${q.trim()}”. ` : `${shown.length} upcoming. `}Public results are not personalised.</p>
            </div>
            <label className="sort">Sort by
              <select className="sel" value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
          </div>
          <p className="sim-note"><Icon n="layers" size={14} /><span> Public-source opportunities, checked {CHECKED}, plus clearly labelled demo examples. Continuous monitoring is not connected.
            {pub.status === 'loading' && <> Loading live public results…</>}
            {pub.status === 'error' && <> Live public results could not be loaded ({errorText(pub.error).replace(/\.$/, '')}); showing the examples only. <button type="button" className="link-btn" onClick={pub.reload}>Try again</button></>}
            {view === 'saved' && <> Saved here means saved in this browser only.</>}
          </span></p>

          <div className="feed-list" tabIndex={0} role="region" aria-label="Opportunities" data-lenis-prevent>
            {shown.length === 0 && (
              <p className="empty">{view === 'saved' ? (q.trim() ? 'No saved opportunity matches your search.' : 'Nothing saved yet. Save an opportunity to keep it here, in this browser.')
                : q.trim() ? 'No public opportunity matches your search. Try fewer or different words.'
                : 'No public listings in this area yet. Fyyr is not continuously monitoring sources, so this area stays empty until items are added.'}</p>
            )}
            <ul className="cards">{shown.map(x => <OppCard key={x.o.id} x={x} c={c} />)}</ul>
          </div>
        </div>

        <aside className="side-r" aria-label="Updates and deadlines">
          <h3>Updates and deadlines</h3>
          <div className="upd">
            <span className="upd-k upd-amber"><Icon n="clock" size={14} /> Closing in the next 14 days</span>
            {deadlines.length ? deadlines.slice(0, 3).map(x => <span key={x.o.id}><button type="button" className="link-btn" onClick={() => setDetail(x.o.id)}><strong>{x.o.title}</strong></button><br />{x.u.label}</span>) : <span>No public deadlines in the next 14 days.</span>}
          </div>
          <div className="upd">
            <span className="upd-k"><Icon n="bell" size={14} /> Your notification preferences</span>
            <strong>{regular}</strong>
            <strong>{critical}</strong>
            <span className="fine">Preferences preview. Notifications are not delivered yet.</span>
            <button type="button" className="link-btn" data-np-trigger onClick={() => setNotifOpen(true)}>Edit preferences</button>
          </div>
          <p className="fine">Dates come from the source: deadlines where one exists, otherwise the event date.</p>
        </aside>
      </div>

      {detailX && <Detail x={detailX} c={c} onClose={() => setDetail(null)} />}
      {notifOpen && <NotifPanel np={np} anchorRef={bellRef} notify={notify} onClose={closePanel} />}
    </div>
  )
}


// Accessible custom select (listbox pattern): arrow keys, Home/End, type-ahead, Enter/Space to choose, Escape to close.
// The menu animates in and out, flips upward when there is no room below, and Escape only closes the menu (not the panel).
function Select({ label, value, options, onChange }) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [up, setUp] = useState(false)
  const [active, setActive] = useState(0)
  const wrap = useRef(null)
  const btn = useRef(null)
  const list = useRef(null)
  const selected = options.findIndex(o => o[0] === value)

  const openMenu = () => {
    const r = btn.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    setUp(below < 300 && r.top > below)
    setActive(Math.max(0, selected))
    setLeaving(false)
    setOpen(true)
  }
  const closeMenu = restore => {
    if (!open) return
    setOpen(false)
    setLeaving(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => setLeaving(false), reduced ? 0 : 130)
    if (restore) btn.current?.focus()
  }
  const choose = i => { onChange(options[i][0]); closeMenu(true) }

  useEffect(() => { if (open) list.current?.focus({ preventScroll: true }) }, [open])
  useEffect(() => { if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  const onBtnKey = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu() }
  }
  const onListKey = e => {
    const n = options.length
    const stop = () => { e.preventDefault(); e.stopPropagation() }
    if (e.key === 'ArrowDown') { stop(); setActive(a => Math.min(n - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { stop(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { stop(); setActive(0) }
    else if (e.key === 'End') { stop(); setActive(n - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { stop(); choose(active) }
    else if (e.key === 'Escape') { stop(); closeMenu(true) }
    else if (e.key === 'Tab') closeMenu(false)
    else if (e.key.length === 1) {
      const i = options.findIndex(o => o[1].toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) { stop(); setActive(i) }
    }
  }

  return (
    <div className="np-field" ref={wrap}>
      <span className="np-lab" id={uid + 'l'}>{label}</span>
      <button ref={btn} type="button" className="fld fld-select" id={uid + 'b'} aria-haspopup="listbox" aria-expanded={open} aria-labelledby={uid + 'l ' + uid + 'b'} aria-controls={uid + 'm'} onClick={() => (open ? closeMenu(true) : openMenu())} onKeyDown={onBtnKey}>
        <span>{options[selected]?.[1]}</span>
        <svg className="fld-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {(open || leaving) && (
        <ul ref={list} id={uid + 'm'} role="listbox" tabIndex={-1} aria-labelledby={uid + 'l'} aria-activedescendant={uid + 'o' + active} className={'sel-menu' + (up ? ' up' : '') + (leaving ? ' out' : '')} onKeyDown={onListKey} onBlur={e => { if (!wrap.current.contains(e.relatedTarget)) closeMenu(false) }}>
          {options.map(([v, l], i) => (
            <li key={v} id={uid + 'o' + i} role="option" aria-selected={v === value} data-active={i === active ? '' : undefined} className="sel-opt" onPointerMove={() => setActive(i)} onClick={() => choose(i)}>
              <span>{l}</span>
              {v === value && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


const pad2 = n => String(n).padStart(2, '0')

// One segment of the time field: an accessible spinbutton. Type digits (auto-advances), Up/Down step, Home/End jump.
function TimeSegment({ label, value, max, onChange, onDone, innerRef, onBack }) {
  const typed = useRef(0)
  const commit = n => onChange(Math.max(0, Math.min(max, n)))
  return (
    <input
      ref={innerRef}
      className="seg-in"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      role="spinbutton"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={pad2(value)}
      value={pad2(value)}
      onFocus={e => { typed.current = 0; e.target.select() }}
      onClick={e => e.target.select()}
      onChange={e => {
        const ch = e.nativeEvent.data
        if (!ch || !/^[0-9]$/.test(ch)) return
        const digit = Number(ch)
        const next = typed.current === 0 ? digit : (value * 10 + digit) % 100
        commit(next)
        typed.current += 1
        if (typed.current >= 2 || next * 10 > max) { typed.current = 0; onDone?.() }
      }}
      onKeyDown={e => {
        const step = k => { e.preventDefault(); typed.current = 0; commit(k) }
        if (e.key === 'ArrowUp') step(value >= max ? 0 : value + 1)
        else if (e.key === 'ArrowDown') step(value <= 0 ? max : value - 1)
        else if (e.key === 'PageUp') step(Math.min(max, value + 10))
        else if (e.key === 'PageDown') step(Math.max(0, value - 10))
        else if (e.key === 'Home') step(0)
        else if (e.key === 'End') step(max)
        else if (e.key === 'Backspace' || e.key === 'Delete') step(0)
        else if (e.key === 'ArrowRight' && onDone) { e.preventDefault(); onDone() }
        else if (e.key === 'ArrowLeft' && onBack) { e.preventDefault(); onBack() }
        else if (e.key === ':' && onDone) { e.preventDefault(); onDone() }
      }}
    />
  )
}

function TimeField({ value, onChange }) {
  const uid = useId()
  const [h, m] = /^\d{1,2}:\d{2}$/.test(value) ? value.split(':').map(Number) : [8, 0]
  const hr = useRef(null)
  const mr = useRef(null)
  return (
    <div className="np-field">
      <span className="np-lab" id={uid}>Time</span>
      <div className="fld fld-time" role="group" aria-labelledby={uid}>
        <TimeSegment label="Hour (0 to 23)" value={h} max={23} onChange={n => onChange(pad2(n) + ':' + pad2(m))} innerRef={hr} onDone={() => mr.current?.focus()} />
        <span className="seg-colon" aria-hidden="true">:</span>
        <TimeSegment label="Minute" value={m} max={59} onChange={n => onChange(pad2(h) + ':' + pad2(n))} innerRef={mr} onBack={() => hr.current?.focus()} />
        <svg className="seg-clock" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2" /></svg>
      </div>
    </div>
  )
}

// Rendered inside the dashboard container (position: absolute, upper-right corner). It never saves on dismissal.
// Closes on outside click, Escape, the close icon and a successful save, after a short exit animation.
function NotifPanel({ np, anchorRef, notify, onClose }) {
  const [d, setD] = useState(np.prefs)
  const [out, setOut] = useState(false)
  const ref = useRef(null)
  const set = patch => setD(x => ({ ...x, ...patch }))
  const all = CATS.every(c => d.topics[c.id])
  const topicsOn = d.freq !== 'off' || d.critical

  const closing = useRef(false)
  const close = restore => {
    if (closing.current) return
    closing.current = true
    setOut(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => onClose(restore), reduced ? 0 : 170)
  }
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => { ref.current?.querySelector('h3')?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    const down = e => {
      if (ref.current?.contains(e.target) || e.target.closest?.('[data-np-trigger]')) return
      closeRef.current(false)
    }
    const key = e => { if (e.key === 'Escape') closeRef.current(true) }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [])

  const save = () => {
    const ok = np.save(d)
    notify(ok ? 'Preferences saved in this browser. Nothing is sent yet.' : 'Storage is blocked, so preferences are kept for this visit only. Nothing is sent yet.')
    close(true)
  }

  return (
    <div ref={ref} className={'np' + (out ? ' out' : '')} role="dialog" aria-label="Notification preferences" data-lenis-prevent>
      <div className="np-head">
        <h3 tabIndex={-1}>Notification preferences</h3>
        <button type="button" className="icon-btn" aria-label="Close preferences" onClick={() => close(true)}><Icon n="x" /></button>
      </div>
      <p className="np-note">Preview only: saved in this browser, nothing is sent yet.</p>

      <fieldset>
        <legend>Regular updates</legend>
        <div className="radios">
          {[['off', 'Off'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(([k, l]) => (
            <label key={k} className="radio"><input type="radio" name="freq" checked={d.freq === k} onChange={() => set({ freq: k })} />{l}</label>
          ))}
        </div>
        {d.freq !== 'off' && (
          <div className="np-row">
            {d.freq === 'weekly' && <Select label="Weekday" value={d.weekday} options={WEEKDAYS} onChange={v => set({ weekday: v })} />}
            <TimeField value={d.time} onChange={v => set({ time: v })} />
            <span className="np-tz">{TZ}</span>
          </div>
        )}
      </fieldset>

      <fieldset className="crit">
        <legend className="sr">Last-minute critical alerts</legend>
        <label className="check"><input type="checkbox" role="switch" checked={d.critical} onChange={e => set({ critical: e.target.checked })} /> <span><b>Receive last-minute critical alerts</b><small>An extra alert when a relevant opportunity is found near its deadline, or an important deadline changes.</small></span></label>
        {d.critical && (
          <div className="radios" role="radiogroup" aria-label="Urgency window">
            {[24, 48, 72].map(h => <label key={h} className="radio"><input type="radio" name="win" checked={d.window === h} onChange={() => set({ window: h })} />{h} hours</label>)}
          </div>
        )}
      </fieldset>

      {topicsOn && (
        <fieldset>
          <legend>{d.freq !== 'off' ? 'Topics' : 'Critical alert topics'}</legend>
          <label className="check"><input type="checkbox" checked={all} onChange={e => set({ topics: Object.fromEntries(CATS.map(c => [c.id, e.target.checked])) })} /> Select all</label>
          <div className="np-topics">
            {CATS.map(c => <label key={c.id} className="check"><input type="checkbox" checked={d.topics[c.id]} onChange={e => set({ topics: { ...d.topics, [c.id]: e.target.checked } })} /> {c.label}</label>)}
          </div>
        </fieldset>
      )}

      <div className="np-save"><button type="button" className="btn btn-primary" onClick={save}>Save preferences</button></div>
    </div>
  )
}
