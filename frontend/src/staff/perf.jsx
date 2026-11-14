import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CAT_COLOR, tint } from './colors.js'
import { Icon } from '../Icons.jsx'
import { navigate } from '../auth.js'
import { Dialog } from '../member/ui.jsx'
import { MCAT, OPP_BY_ID } from '../member/data.js'
import { getEvent, listEvents, problems, stateOf } from '../events/eventStore.js'
import { LineChart } from './charts.jsx'
import { oppDetail } from './metrics.js'
import { NOT_CONNECTED, STATUS_LABEL } from './park.js'
import './perf.css'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const fmtD = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// ---- restrained category colours (icons come from the existing category icons) ----
export { CAT_COLOR }

// ---- comparison with the previous equivalent period. A zero baseline never produces a percentage. ----
export function vsBefore(cur, prev) {
  if (!cur && !prev) return 'None in either period'
  if (!prev) return 'New: none in the previous period'
  if (cur + prev < 8 || Math.abs(cur - prev) < 3) return `${prev} before (too few to call a trend)`
  const pct = Math.round(((cur - prev) / prev) * 100)
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}% vs ${prev} before`
}

// ---- one shared, concise disclosure for the staff analytics screens ----
export const SimNote = () => <p className="pf-sim"><Icon n="layers" size={14} /><span>Real company names · simulated activity</span></p>

// ---- compact trend chart: normal-sized labels, subtle grid, thin line, restrained area, tooltip on hover and keyboard ----
const niceMax = v => { const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]; return 4 * (steps.find(s => s * 4 >= v) || Math.ceil(v / 4)) }
export function PerfChart({ title, labels, points, name, xLabel, height = 240 }) {
  const wrap = useRef(null)
  const [w, setW] = useState(620)
  const [hover, setHover] = useState(null)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const set = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)))
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const m = { l: 34, r: 10, t: 10, b: 26 }
  const n = labels.length
  const max = niceMax(Math.max(1, ...points))
  const x = i => m.l + (n < 2 ? (w - m.l - m.r) / 2 : (i * (w - m.l - m.r)) / (n - 1))
  const y = v => height - m.b - (v / max) * (height - m.t - m.b)
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - m.l) / 70))))
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  const line = points.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const area = n ? `M${x(0)},${y(0)} ${points.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(n - 1)},${y(0)} Z` : ''
  const at = e => { const r = e.currentTarget.getBoundingClientRect(); const px = e.clientX - r.left; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (w - m.l - m.r)) * (n - 1))))) }
  const key = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, Math.min(n - 1, (h ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1)))) }
    else if (e.key === 'Escape') setHover(null)
  }
  const total = points.reduce((a, b) => a + b, 0)
  return (
    <figure className="pf-chart">
      <div className="pf-plot" ref={wrap} onMouseLeave={() => setHover(null)} style={{ height }}>
        <svg width={w} height={height} role="group" tabIndex={0} aria-label={`${title}. ${name} per ${xLabel.toLowerCase()}, total ${total}. Use the left and right arrow keys to read each point.`}
          onMouseMove={at} onKeyDown={key} onBlur={() => setHover(null)}>
          {ticks.map(t => <g key={t}><line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} className="pf-grid" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="pf-tick">{Math.round(t * 10) / 10}</text></g>)}
          {labels.map((l, i) => i % every === 0 && <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="pf-tick">{l}</text>)}
          <path d={area} className="pf-area" />
          <polyline points={line} className="pf-line" />
          {hover != null && <><line x1={x(hover)} x2={x(hover)} y1={m.t} y2={height - m.b} className="pf-cross" /><circle cx={x(hover)} cy={y(points[hover])} r="4" className="pf-dot" /></>}
        </svg>
        {hover != null && <div className="pf-tip" role="status" style={{ left: Math.min(Math.max(x(hover), 70), w - 70) }}><b>{xLabel} {labels[hover]}</b><span>{name}: <b>{points[hover]}</b></span></div>}
      </div>
      <div className="sr"><table><caption>{title}</caption>
        <thead><tr><th scope="col">{xLabel}</th><th scope="col">{name}</th></tr></thead>
        <tbody>{labels.map((l, i) => <tr key={l + i}><th scope="row">{l}</th><td>{points[i]}</td></tr>)}</tbody></table></div>
    </figure>
  )
}

// ---- small pieces ----
export const CatChip = ({ id }) => MCAT[id] ? <span className="pf-cat" style={{ '--c': CAT_COLOR[id] }}><Icon n={MCAT[id].icon} size={14} />{MCAT[id].short}</span> : null
export function InBar({ value, max, color = '#2b3cff', children }) {
  return <span className="pf-inbar"><i style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: color }} aria-hidden="true" /><b>{children ?? value}</b></span>
}
export function CategoryBars({ rows }) {
  const max = Math.max(1, ...rows.map(r => r.engagement))
  return (
    <ul className="pf-catbars" aria-label="Interactions by category">
      {rows.map(r => (
        <li key={r.id}>
          <span className="pf-cb-l"><CatChip id={r.id} /></span>
          <span className="pf-cb-t" aria-hidden="true" style={{ background: tint(CAT_COLOR[r.id]) }}><i style={{ width: `${(r.engagement / max) * 100}%`, background: CAT_COLOR[r.id] }} /></span>
          <span className="pf-cb-v"><b>{r.engagement}</b><small> {plural(r.opps, 'opportunity', 'opportunities')}</small></span>
        </li>
      ))}
    </ul>
  )
}

// ---- top performers ----
export function TopOpps({ rows, onOpen, limit = 3 }) {
  const top = [...rows].filter(r => !r.hidden).map(r => ({ ...r, total: r.views + r.saves + r.clicks })).filter(r => r.total > 0).sort((a, b) => b.total - a.total || b.saves - a.saves).slice(0, limit)
  return top.length ? (
    <ol className="pf-top">
      {top.map((r, i) => (
        <li key={r.id}>
          <span className="pf-rank" aria-hidden="true">{i + 1}</span>
          <div className="pf-top-b">
            <p className="pf-top-t">{r.title}{r.demo && <span className="pill nw-demo st-pill">Demo</span>}</p>
            <p className="pf-top-m"><CatChip id={r.mcat || r.cat} /><span><b>{r.views}</b> views · <b>{r.saves}</b> saves · {plural(r.companies, 'company', 'companies')}</span></p>
          </div>
          <button type="button" className="btn btn-glass btn-sm" onClick={() => onOpen(r)} aria-label={`Details: ${r.title}`}>Details</button>
        </li>
      ))}
    </ol>
  ) : <p className="fine st-empty">No opportunity has enough activity to rank yet.</p>
}

// ---- needs attention: derived from the same records and activity as everything else; each item says which rule produced it ----
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysTo = iso => Math.round((new Date(iso + 'T12:00:00') - new Date(todayIso() + 'T12:00:00')) / 864e5)
const deadlineOf = e => {
  const x = e.x || {}, c = e.category || 'events'
  if (c === 'events') return e.regDeadline ? { iso: e.regDeadline, what: 'Registration closes' } : null
  if (c === 'funding') return x.deadlineMode !== 'rolling' && x.deadline ? { iso: x.deadline, what: 'Application deadline' } : null
  if (c === 'testing') return x.availMode === 'period' && x.availTo ? { iso: x.availTo, what: 'Access ends' } : null
  return null
}
export function attentionItems(d, limit = 4) {
  const items = []
  const mine = listEvents().filter(e => e.source !== 'member')
  // 1. a draft that has every required field is ready for a last review before publishing
  for (const e of mine.filter(e => e.status === 'draft' && Object.keys(problems(e)).length === 0 && e.title.trim())) {
    items.push({ id: 'draft:' + e.id, icon: 'check', tone: 'blue', title: `Draft ready to review: ${e.title}`, detail: 'Every required detail is filled in.', rule: 'Rule: a draft with every required detail filled in can be reviewed and published.', action: 'Review draft', run: () => navigate('/staff/events/' + e.id), weight: 50 })
  }
  // 2. a published opportunity whose deadline falls within 14 days
  for (const e of mine.filter(e => stateOf(e) === 'published')) {
    const dl = deadlineOf(e)
    const n = dl ? daysTo(dl.iso) : null
    if (n != null && n >= 0 && n <= 14) items.push({ id: 'deadline:' + e.id, icon: 'clock', tone: 'amber', title: `${e.title}`, detail: `${dl.what} ${fmtD(dl.iso)} (${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`})`, rule: 'Rule: a published opportunity with a deadline in the next 14 days.', action: 'Open record', run: () => navigate('/staff/events/' + e.id), weight: 80 - n })
  }
  // 3. views without saves: the existing finding rule (at least 8 views, fewer than 10 saves per 100 views, at least 3 companies)
  for (const f of d.res.allFindings.filter(f => f.kind === 'lowsave')) {
    const id = f.id.split(':')[1]
    if (OPP_BY_ID[id]) items.push({ id: f.id, icon: 'up', tone: 'neutral', title: f.title, detail: f.observed, rule: 'Rule: at least 8 views, fewer than 10 saves per 100 views and 3 or more companies.', action: 'See activity', run: () => navigate('/staff/performance?opp=' + encodeURIComponent(id)), weight: 60 })
  }
  return items.sort((a, b) => b.weight - a.weight).slice(0, limit)
}
export function NeedsAttention({ d }) {
  const items = useMemo(() => attentionItems(d), [d.events, d.res, d.synced]) // eslint-disable-line react-hooks/exhaustive-deps
  return items.length ? (
    <ul className="pf-attn">
      {items.map(it => (
        <li key={it.id} data-tone={it.tone}>
          <span className="pf-attn-i" title={it.rule}><Icon n={it.icon} size={16} /></span>
          <div className="pf-attn-b">
            <p className="pf-attn-t">{it.title}</p>
            {it.detail && <p className="pf-attn-d" title={it.detail}>{it.detail}</p>}
          </div>
          <button type="button" className="btn btn-glass btn-sm" onClick={it.run}>{it.action}<span className="sr">: {it.title}</span></button>
        </li>
      ))}
    </ul>
  ) : <div className="mem-empty"><strong>Nothing needs attention</strong><p>No draft is ready to review, no published deadline is close, and no opportunity is viewed often without being saved.</p></div>
}

// ---- opportunity detail: content, status, metrics, activity over time, audience, and what the numbers mean ----
export function OppDetail({ id, d, onClose }) {
  const o = OPP_BY_ID[id]
  const det = useMemo(() => (o ? oppDetail(d.events, id, d.ctx) : null), [id, d.events, d.ctx]) // eslint-disable-line react-hooks/exhaustive-deps
  const row = d.res.opps.rows.find(r => r.id === id)
  const hidden = !row && d.res.park.hiddenIds.has(id)
  const rec = getEvent(id)
  const status = rec ? STATUS_LABEL[rec.status === 'published' && stateOf(rec) === 'past' ? 'published' : rec.status] + (stateOf(rec) === 'past' ? ' (event is over)' : '') : 'Published (demo fixture)'
  const k = d.ctx.k
  if (!o) return null
  const key = `opp:${id}:${d.ctx.range.from}`
  const none = !row && !hidden
  return (
    <Dialog label={o.title} onClose={onClose} side>
      <p className="opp-top"><CatChip id={o.mcat} /><span className="pill">{status}</span>{o.demo && <span className="pill nw-demo">Demo</span>}</p>
      <h2 className="auth-h det-h">{o.title}</h2>
      <p className="sum">{o.description || o.summary}</p>
      <dl className="det">
        {o.provider && <div className="det-f"><dt>Organiser or provider</dt><dd>{o.provider}</dd></div>}
        {o.dateText && <div className="det-f"><dt>Date</dt><dd>{o.dateText}{o.where ? ` · ${o.where}` : ''}</dd></div>}
        {(o.facts || []).map(([a, b]) => <div className="det-f" key={a}><dt>{a}</dt><dd>{b}</dd></div>)}
      </dl>
      {o.demo && <p className="notice"><b>Demo opportunity, fictional.</b> It is invented for the demo. It has no real registration link, funding or company commitment, and its activity below is simulated.</p>}

      <h3 className="mem-sec">Activity · {d.ctx.range.label}</h3>
      <dl className="pf-metrics">
        <div><dt>Views</dt><dd>{hidden ? '—' : row?.views ?? 0}</dd></div>
        <div><dt>Saves</dt><dd>{hidden ? '—' : row?.saves ?? 0}</dd></div>
        <div><dt>Source clicks</dt><dd>{hidden ? '—' : row?.clicks ?? 0}</dd></div>
        <div><dt>Companies reached</dt><dd>{hidden ? '—' : row?.companies ?? 0}</dd></div>
      </dl>
      {hidden && <p className="fine">Hidden: fewer than {k} companies engaged, so figures could describe one company.</p>}
      {none && <p className="fine">No activity was recorded for this selection.</p>}
      {det && !hidden && !none && <LineChart title={`Activity for ${o.title}`} labels={det.labels} series={det.series} xLabel={det.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Count" height={190} />}
      {det && !hidden && !none && (
        <>
          <h3 className="mem-sec">Audience (aggregate)</h3>
          {det.sectors.length ? <ul className="st-plain">{det.sectors.map(s => <li key={s.sector}>{s.sector}: {plural(s.n, 'interaction', 'interactions')} from {plural(s.companies, 'company', 'companies')}</li>)}</ul> : <p className="fine">No industry group is large enough to show.</p>}
          {det.other && <p className="fine">{det.other.groups} smaller group(s) are combined and hidden (fewer than {k} companies).</p>}
        </>
      )}
      <details className="pf-meaning" open>
        <summary>What these numbers mean</summary>
        <ul className="st-plain">
          <li><b>View</b>: a company opened the opportunity’s detail. <b>Save</b>: a company pressed Save. <b>Source click</b>: a company opened the source or registration link.</li>
          <li><b>A source click is not a registration or an application.</b> Registrations and attendance are not tracked ({NOT_CONNECTED.toLowerCase()}).</li>
          <li><b>Companies reached</b> counts distinct companies with at least one view, save or click. Small groups are hidden to protect individual companies.</li>
          <li>Real company names · simulated activity: no real company did any of this.</li>
        </ul>
      </details>
      <div className="auth-row det-actions">
        {rec && <button type="button" className="btn btn-primary btn-sm" onClick={() => { onClose(); navigate('/staff/events/' + id) }}>Open in management</button>}
        {row && <button type="button" className="btn btn-glass btn-sm" disabled={d.store.has(key)} onClick={() => d.openFollow({ key, kind: 'opportunity', title: `Review: ${o.title}`, observed: `${row.views} views, ${row.saves} saves, ${row.clicks} source clicks, ${row.companies} companies (${d.ctx.range.label}).`, period: d.ctx.range.label, companies: row.companies })}>{d.store.has(key) ? 'Saved as follow-up' : 'Save as follow-up'}</button>}
      </div>
    </Dialog>
  )
}

// opens a detail from "?opp=<id>" (used by the Needs attention links) and keeps the page position
export function useOppFromUrl(setOpen) {
  useEffect(() => {
    const read = () => { const id = new URLSearchParams(location.search).get('opp'); if (id && OPP_BY_ID[id]) { setOpen(id); history.replaceState(null, '', location.pathname) } }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
export { addDays }
