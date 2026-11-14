import { useId, useMemo, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { navigate } from '../auth.js'
import { Dialog } from '../member/ui.jsx'
import { DemoBadge, LineChart, SimpleTable } from './charts.jsx'
import { NOT_CONNECTED, parkCatalogue, parkSummary } from './park.js'
import { demoCompany } from './analyticsApi.js'
import { fmtDY, growthDetail } from './metrics.js'
import { STATUSES } from './store.js'
import { Finding } from './pages.jsx'
import { CO, SCOPE_LABEL, overviewPicks, scopeOf, suggestionStatus } from '../network/data.js'
import { CompareDialog, SaveBtn } from '../network/NetworkPage.jsx'
import { useSaved } from '../network/store.js'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const dayFmt = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function Section({ id, title, sub, children, more, real }) {
  return (
    <section className="ov-sec" aria-labelledby={id}>
      <div className="ov-sec-h"><div><h2 id={id}>{title}{!real && <DemoBadge />}</h2>{sub && <details className="ov-info"><summary>About this</summary><p className="fine">{sub}</p></details>}</div>{more}</div>
      {children}
    </section>
  )
}
const ViewAll = ({ to, children }) => <a href={to} className="mem-more" onClick={e => { e.preventDefault(); navigate(to) }}>{children}</a>

// Names only for companies that agreed to be identified (simulated consent). Everyone else is counted, not named.
function who(ids, d) {
  const shared = new Set(d.shared.map(s => s.id))
  const named = ids.filter(i => shared.has(i)).map(i => demoCompany(i)?.name).filter(Boolean).sort()
  return { named, other: ids.length - named.length }
}
const Who = ({ ids, d, label = 'Companies' }) => {
  const w = who(ids, d)
  return (
    <p className="ov-who"><b>{label}.</b> {w.named.length ? w.named.join(', ') : 'None can be named.'}{w.other > 0 && <> {w.named.length ? '+ ' : ''}{plural(w.other, 'company', 'companies')} not identified (no consent to be named{d.source === 'live' ? '; recorded activity is not linked to a named company' : ''}).</>}</p>
  )
}

// ---------- 1. growing interests ----------
function GrowDialog({ row, src, d, onClose }) {
  const det = useMemo(() => growthDetail(d.events, row.topic, src, d.ctx), [d.events, row.topic, src, d.ctx])
  const all = src === 'stated' ? row.ids : det.contributors.map(c => c.id)
  const added = src === 'stated' ? row.ids.filter(i => !row.prevIds.includes(i)) : []
  return (
    <Dialog label={`Growing interest: ${row.topic}`} onClose={onClose} side>
      <h2 className="auth-h det-h">{row.topic}</h2>
      <p className="auth-sub">{src === 'stated' ? 'Companies that selected this topic as an interest' : 'Companies with searches, views, saves or source clicks on this topic'}: {row.prev} → <b>{row.cur}</b> ({row.abs > 0 ? '+' : ''}{row.abs}) compared with {d.ctx.range.prevLabel}.</p>
      {row.abs < 3 && <p className="notice">A change of {row.abs} {row.abs === 1 ? 'company' : 'companies'} is small. It is shown for transparency and is not evidence of a trend.</p>}
      {src === 'stated' ? <Who ids={row.ids} d={d} label="Companies stating this interest" /> : <Who ids={all} d={d} label="Contributing companies" />}
      {src === 'stated' && <p className="ov-who"><b>New in this period.</b> {added.length ? (() => { const w = who(added, d); return `${w.named.join(', ')}${w.named.length && w.other ? ' + ' : ''}${w.other ? plural(w.other, 'company', 'companies') + ' not identified' : ''}` })() : 'None.'}</p>}
      <h3 className="mem-sec st-h3">Supporting signals{src === 'stated' ? ' (activity on this topic, for context)' : ''}</h3>
      <SimpleTable caption="Signals on this topic" head={['Signal', 'This period', 'Previous period']} rows={det.signals} />
      <p className="fine">Aggregate counts only. No individual search history is shown.</p>
      <h3 className="mem-sec st-h3">Over time</h3>
      <LineChart title={`Companies active on ${row.topic}`} labels={det.labels} series={[det.series[0]]} xLabel={det.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Companies" height={190} />
      <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button><button type="button" className="btn btn-primary btn-sm" onClick={() => { onClose(); navigate('/staff/insights') }}>Open Member insights</button></div>
    </Dialog>
  )
}

function Growing({ d }) {
  const [src, setSrc] = useState('stated')
  const [open, setOpen] = useState(null)
  const rows = d.res.growth[src].slice(0, 5)
  const max = Math.max(1, ...rows.map(r => Math.max(r.cur, r.prev)))
  const uid = useId()
  return (
    <Section id={uid} title="What interests are growing?" sub={`Topics with the largest rise in distinct companies. Each company counts once per topic. ${src === 'stated' ? 'Saved interests are what companies selected in their profile.' : 'Activity is searches, views, saves and source clicks: behaviour, not a stated priority.'} The two sources are never combined.`}
      more={<div className="eseg ov-src" role="group" aria-label="Source of interest">
        <button type="button" aria-pressed={src === 'stated'} onClick={() => setSrc('stated')}>Saved interests</button>
        <button type="button" aria-pressed={src === 'activity'} onClick={() => setSrc('activity')}>Activity</button>
      </div>}>
      {rows.length ? (
        <ul className="ov-bars" aria-label="Largest increases in interested companies">
          {rows.map(r => (
            <li key={r.topic}>
              <div className="ov-bar-b">
                <button type="button" className="ov-bar-t" onClick={() => setOpen(r)} aria-label={`${r.topic}: ${plural(r.cur, 'company', 'companies')}, up ${r.abs} from ${r.prev}. Open details.`}>
                  <b>{r.topic}</b> · {plural(r.cur, 'company', 'companies')} · <b className="ov-up">+{r.abs}</b>
                </button>
                <span className="ov-track">
                  <i tabIndex={0} aria-label={`Current: ${plural(r.cur, 'company', 'companies')}, ${d.ctx.range.label}`} style={{ width: `${(r.cur / max) * 100}%` }}><span className="ov-tip" role="tooltip">{r.cur} · {d.ctx.range.label}</span></i>
                  <u tabIndex={0} aria-label={`Previous: ${plural(r.prev, 'company', 'companies')}, ${d.ctx.range.prevLabel}`} style={{ left: `${(r.prev / max) * 100}%` }}><span className="ov-tip" role="tooltip">{r.prev} · {d.ctx.range.prevLabel}</span></u>
                </span>
                {r.abs < 3 && <span className="ov-bar-s">Small change, not a trend</span>}
              </div>
            </li>
          ))}
        </ul>
      ) : <div className="mem-empty"><strong>No topic gained interested companies</strong><p>{src === 'stated' ? `No topic was added to the saved interests of at least ${d.ctx.k} companies in this period.` : `No topic gained activity from more companies, or fewer than ${d.ctx.k} companies were involved.`} Try another source or a longer period.</p></div>}
      <p className="fine ov-leg"><span><span className="ov-key" aria-hidden="true" /> Current</span><span><span className="ov-key-t" aria-hidden="true" /> Previous</span></p>
      <div className="ov-foot"><ViewAll to="/staff/insights">View all topics<span className="sr"> in Member insights</span></ViewAll></div>
      {open && <GrowDialog row={open} src={src} d={d} onClose={() => setOpen(null)} />}
    </Section>
  )
}

// ---------- 2. searches with no results ----------
const ACTIONS = ['Find an expert', 'Source an opportunity', 'Plan a workshop']
function DemandDialog({ row, d, onClose }) {
  const uid = useId()
  const [action, setAction] = useState(ACTIONS[1])
  const [owner, setOwner] = useState(d.store.defaultOwner)
  const [status, setStatus] = useState('New')
  const key = `unmet:${row.key}:${d.ctx.range.from}`
  const saved = d.store.has(key)
  const ev = { head: ['Term', 'Searches', 'Companies'], rows: [...row.terms.map(t => [t.term, t.n, t.companies]), ...(row.otherTerms ? [[`Other terms with fewer than ${d.ctx.k} companies`, row.otherTerms, '—']] : [])] }
  const create = e => {
    e.preventDefault()
    d.store.add({ key, kind: 'unmet', title: `${action}: ${row.label}`, observed: `${row.zero} searches on “${row.label}” returned no results in Fyyr, from ${plural(row.companies, 'company', 'companies')}. Most recent: ${dayFmt(row.last)}.`, period: d.ctx.range.label, companies: row.companies, evidence: ev, owner: owner.trim(), status })
    onClose()
  }
  return (
    <Dialog label={`Review demand: ${row.label}`} onClose={onClose} side>
      <h2 className="auth-h det-h">{row.label}</h2>
      <p className="auth-sub"><b>No results in Fyyr.</b> {row.zero} searches from {plural(row.companies, 'company', 'companies')}, most recent {dayFmt(row.last)}. This does not prove that nothing exists elsewhere, only that Fyyr had nothing to show.</p>
      <SimpleTable caption="No-result search terms behind this topic" head={ev.head} rows={ev.rows} />
      <p className="fine">{row.supply != null ? `${plural(row.supply, 'open listing', 'open listings')} in Fyyr currently relate to this topic.` : 'These terms fit no broad topic, so they are kept apart and not merged with others.'} {row.total > row.zero && row.supply != null ? `${row.total - row.zero} other searches on the topic did return results.` : ''}</p>
      <form onSubmit={create} noValidate>
        <h3 className="mem-sec st-h3">Create a follow-up</h3>
        <fieldset className="aud-f"><legend>What could help</legend>
          <div className="chips-row">{ACTIONS.map(a => <button key={a} type="button" className="fchip" aria-pressed={action === a} onClick={() => setAction(a)}>{a}</button>)}</div>
        </fieldset>
        <div className="mem-grid2">
          <div className="auth-fld"><label htmlFor={uid + 'o'}>Owner</label><input id={uid + 'o'} value={owner} maxLength={80} placeholder="Name or team" onChange={e => setOwner(e.target.value)} /></div>
          <div className="auth-fld"><label htmlFor={uid + 's'}>Status</label><select id={uid + 's'} value={status} onChange={e => setStatus(e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button>{saved ? <span className="pill pill-blue">Already saved as a follow-up</span> : <button type="submit" className="btn btn-primary btn-sm">Create follow-up</button>}</div>
      </form>
    </Dialog>
  )
}

function Unmet({ d }) {
  const [open, setOpen] = useState(null)
  const u = d.res.unmet, rows = u.rows.slice(0, 5)
  const uid = useId()
  return (
    <Section id={uid} title="Searches with no results" sub="Searches that returned no results in Fyyr, grouped by topic. Not proof that nothing exists elsewhere. Counts exclude empty searches and technical failures. Similar terms are grouped; terms that fit no topic stay separate.">
      {rows.length ? (
        <ol className="ov-un" aria-label="Most common searches with no results">
          {rows.map((r, i) => (
            <li key={r.key}>
              <span className="ov-rank" aria-hidden="true">{i + 1}</span>
              <div className="ov-un-t"><b>{r.label}</b><small>{plural(r.zero, 'search', 'searches')} with no results · {plural(r.companies, 'company', 'companies')} · latest {dayFmt(r.last)}</small></div>
              <button type="button" className="btn btn-glass btn-sm" onClick={() => setOpen(r)}>Review demand<span className="sr">: {r.label}</span></button>
            </li>
          ))}
        </ol>
      ) : <div className="mem-empty"><strong>No unmet searches</strong><p>No topic had no-result searches from at least {d.ctx.k} companies in this period.</p></div>}
      {u.hiddenCount > 0 && <p className="fine st-hidden"><Icon n="layers" size={14} /> {plural(u.hiddenCount, 'topic is', 'topics are')} hidden because fewer than {d.ctx.k} companies searched for {u.hiddenCount === 1 ? 'it' : 'them'}.</p>}
      <div className="ov-foot"><ViewAll to="/staff/search">View all search trends</ViewAll></div>
      {open && <DemandDialog row={open} d={d} onClose={() => setOpen(null)} />}
    </Section>
  )
}

// ---------- 3. companies worth connecting ----------
function Connect({ d }) {
  const net = useSaved()
  const [cmp, setCmp] = useState(null)
  // A few pairs: one inside Blue Science Park, others across ecosystems; never padded. Internal and cross-park suggestions are both eligible.
  const top = useMemo(() => overviewPicks(3), [])
  const uid = useId()
  return (
    <Section real id={uid} title="Companies worth connecting" more={<ViewAll to="/staff/network">View all</ViewAll>}>
      {top.length ? (
        <ul className="ov-conn">
          {top.map(s => {
            const a = CO[s.a], b = CO[s.b], name = `${a.name} and ${b.name}`
            return (
              <li key={s.id} className="ov-cn">
                <div className="ov-cn-main">
                  <p className="ov-cn-t"><b>{a.name}</b> <span aria-hidden="true">↔</span><span className="sr"> and </span> <b>{b.name}</b></p>
                  <p className="ov-cn-s"><span>{SCOPE_LABEL[scopeOf(s)]}</span><span className={s.isDemo ? "pill nw-demo" : "nw-verify"}>{suggestionStatus(s)}</span></p>
                  <p className="ov-cn-r">{s.why}</p>
                </div>
                <div className="ov-cn-a">
                  <button type="button" className="btn btn-glass btn-sm" onClick={() => setCmp(s)}>View details<span className="sr">: {name}</span></button>
                  <SaveBtn s={s} store={net} name={name} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : <div className="mem-empty"><strong>No supported suggestions yet</strong><p>Suggestions appear here only when public sources support a reason to connect and both park affiliations are confirmed.</p></div>}
      <p className="fine">Inferred from public pages read 13–14 Nov 2026, so the date range above does not change these. A small sample, not the whole network.</p>
      {cmp && <CompareDialog s={cmp} store={net} onClose={() => setCmp(null)} />}
    </Section>
  )
}

// ---------- Blue Science Park's own performance: a summary of the Our performance page, same figures ----------
function ParkPerformance({ d }) {
  const p = d.res.park
  const uid = useId()
  const sum = useMemo(() => parkSummary(parkCatalogue()), [d.events, d.res])
  const hide = d.res.tooSmall
  const tip = `Views ${p.views} · Saves ${p.saves} · Source clicks ${p.clicks}`
  return (
    <Section id={uid} title="Blue Science Park performance" more={<ViewAll to="/staff/ours">View all statistics</ViewAll>}>
      <div className="ov-park">
        <dl className="ov-kpis">
          <div><dt>Published opportunities</dt><dd>{sum.published}</dd></div>
          <div><dt>Engagement <span className="ov-tipk" tabIndex={0} title={tip} aria-label={`Engagement is views, saves and source clicks. ${tip}`}>ⓘ</span></dt><dd>{hide ? '—' : p.engagement}</dd></div>
          <div><dt>Confirmed registrations</dt><dd className="st-nc">{NOT_CONNECTED}</dd></div>
        </dl>
        {!hide && <LineChart title="Blue Science Park engagement" labels={p.labels} series={[{ id: 'a', name: 'Engagement', points: p.series }]} xLabel={d.res.buckets.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Events" height={190} />}
      </div>
    </Section>
  )
}

// ---------- page ----------
function Notice({ d }) {
  const r = d.res
  return !r.cur
    ? <div className="mem-empty ov-span"><strong>No activity in this period</strong><p>{d.source === 'live' ? 'Nothing has been recorded in this browser yet. Use the member area, then come back; this page updates by itself.' : 'There is no activity for the selected period. Try 30 or 90 days.'}</p></div>
    : r.tooSmall ? <div className="mem-empty ov-span"><strong>Not enough companies to show this safely</strong><p>Only {r.activeCompanies} {r.activeCompanies === 1 ? 'company was' : 'companies were'} active, and results are withheld below {d.ctx.k}. Choose a longer period. The threshold can be changed in settings.</p></div> : null
}

export function Overview({ d }) {
  const c = d.res.coverage
  const note = Notice({ d })
  const other = d.res.allFindings
  return (
    <div className="mem-page ov">
      <ParkPerformance d={d} />
      <h2 className="ov-grp">Member &amp; network insights</h2>
      <div className="ov-two">{note || <><Growing d={d} /><Unmet d={d} /></>}</div>
      <Connect d={d} />
      {other.length > 0 && !note && (
        <details className="ov-more">
          <summary>Other findings ({other.length})</summary>
          <ul className="st-finds">{other.map(fd => <Finding key={fd.id} fd={fd} d={d} />)}</ul>
        </details>
      )}
      <p className="fine">Definitions and what is not tracked: <a href="/staff/reports" onClick={e => { e.preventDefault(); navigate('/staff/reports') }}>Reports</a> and Data and privacy.</p>
    </div>
  )
}
void fmtDY
