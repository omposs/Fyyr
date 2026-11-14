import { createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

// True while staff pages read the simulated sample, so chart headings can carry a small Demo badge.
export const DemoCtx = createContext(false)
export const DemoBadge = () => { const on = useContext(DemoCtx); return on ? <span className="pill nw-demo st-demo">Demo</span> : null }

import { CAT_COLOR, PALETTE, tint } from './colors.js'
export { CAT_COLOR, PALETTE }
// A series keeps its own colour (category id) wherever it is drawn; only unkeyed series fall back to position.
const col = (s, i) => s.color || CAT_COLOR[s.id] || PALETTE[i % 5]

// Axis top = four equal whole-number steps, so tick labels are never fractions.
const niceMax = v => { const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]; return 4 * (steps.find(s => s * 4 >= v) || Math.ceil(v / 4)) }

// Card with a title, optional note and an accessible "view as table" alternative.
export function Block({ title, note, children, actions }) {
  const id = useId()
  return (
    <section className="mem-card st-block" aria-labelledby={id}>
      <div className="st-block-h"><h2 className="mem-side-h" id={id}>{title}<DemoBadge /></h2>{actions}</div>
      {note && <p className="fine">{note}</p>}
      {children}
    </section>
  )
}

export function LineChart({ title, labels, series, xLabel, yLabel, height = 230, legend = true }) {
  const [hover, setHover] = useState(null)
  const wrap = useRef(null)
  const [W, setW] = useState(640)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const set = () => setW(Math.max(260, Math.round(el.getBoundingClientRect().width)))
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height, m = { l: 36, r: 12, t: 10, b: 32 }
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.points)))
  const n = labels.length
  const x = i => m.l + (n < 2 ? (W - m.l - m.r) / 2 : i * (W - m.l - m.r) / (n - 1))
  const y = v => H - m.b - (v / max) * (H - m.t - m.b)
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - m.l) / 70))))
  const total = series.map(s => `${s.name} ${s.points.reduce((a, b) => a + b, 0)}`).join(', ')
  const at = e => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - m.l) / (W - m.l - m.r)) * (n - 1))))) }
  const key = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, Math.min(n - 1, (h ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1)))) }
    else if (e.key === 'Escape') setHover(null)
  }
  return (
    <figure className="st-chart">
      <div className="st-chart-top">
        <span className="st-ylab">{yLabel}</span>
        {legend && <div className="st-legend" aria-hidden="true">{series.map((s, i) => <span key={s.id}><i style={{ background: col(s, i) }} />{s.name}</span>)}</div>}
      </div>
      <div className="st-plot" ref={wrap} style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <svg width={W} height={H} role="group" tabIndex={0} aria-label={`${title}. ${yLabel} per ${xLabel.toLowerCase()}. Totals: ${total}. Use the left and right arrow keys to read each point.`} onMouseMove={at} onKeyDown={key} onBlur={() => setHover(null)}>
          {ticks.map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="st-grid" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="st-tick">{Math.round(t * 10) / 10}</text></g>)}
          {labels.map((l, i) => i % every === 0 && <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" className="st-tick">{l}</text>)}
          {series.map((s, i) => <polyline key={s.id} fill="none" stroke={col(s, i)} strokeWidth="1.75" strokeLinejoin="round" points={s.points.map((v, j) => `${x(j)},${y(v)}`).join(' ')} />)}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} className="st-cross" />}
          {hover != null && series.map((s, i) => <circle key={s.id} cx={x(hover)} cy={y(s.points[hover])} r="4" fill="#fff" stroke={col(s, i)} strokeWidth="2" />)}
        </svg>
        {hover != null && (
          <div className="st-tip" style={{ left: Math.min(Math.max(x(hover), 80), W - 80) }} role="status">
            <b>{xLabel} {labels[hover]}</b>
            {series.map((s, i) => <span key={s.id}><i style={{ background: col(s, i) }} />{s.name}: <b>{s.points[hover]}</b></span>)}
          </div>
        )}
      </div>
      <div className="sr"><table><caption>{title}</caption>
        <thead><tr><th scope="col">{xLabel}</th>{series.map(s => <th scope="col" key={s.id}>{s.name}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr key={l + i}><th scope="row">{l}</th>{series.map(s => <td key={s.id}>{s.points[i]}</td>)}</tr>)}</tbody></table></div>
    </figure>
  )
}

// Horizontal bars with the numbers printed next to them (not colour alone).
export function BarList({ rows, label }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ul className="st-bars" aria-label={label}>
      {rows.map(r => (
        <li key={r.label}>
          <span className="st-bar-l">{r.label}</span>
          <span className="st-bar-t" aria-hidden="true" style={r.color ? { background: tint(r.color) } : undefined}><i style={{ width: `${(r.value / max) * 100}%`, ...(r.color ? { background: r.color } : null) }} /></span>
          <span className="st-bar-v"><b>{r.value}</b>{r.sub && <small> {r.sub}</small>}</span>
        </li>
      ))}
    </ul>
  )
}

// Sortable table. cols: [{ k, label, num?, sort?: row => value, render?: row => node, hint? }]
export function DataTable({ caption, cols, rows, rowKey, initial, onRow, empty, foot, tableClass = '' }) {
  const [s, setS] = useState(initial || null)
  const sorted = useMemo(() => {
    if (!s) return rows
    const c = cols.find(x => x.k === s.k); const f = c?.sort || (r => r[s.k])
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * s.dir })
  }, [rows, s, cols])
  const toggle = c => setS(p => (p?.k === c.k ? { k: c.k, dir: -p.dir } : { k: c.k, dir: c.num ? -1 : 1 }))
  if (!rows.length) return <p className="fine st-empty">{empty || 'Nothing to show for these filters.'}</p>
  return (
    <div className="st-tblwrap">
      <table className={'st-tbl ' + tableClass}>
        <caption className="sr">{caption}</caption>
        <thead><tr>{cols.map(c => (
          <th key={c.k} scope="col" className={c.num ? 'st-n' : ''} aria-sort={s?.k === c.k ? (s.dir > 0 ? 'ascending' : 'descending') : c.sort || c.num ? 'none' : undefined}>
            {c.sort || c.num ? <button type="button" className="st-sort" onClick={() => toggle(c)}>{c.label}<span aria-hidden="true">{s?.k === c.k ? (s.dir > 0 ? ' ↑' : ' ↓') : ''}</span></button> : c.label}
          </th>))}</tr></thead>
        <tbody>{sorted.map(r => (
          <tr key={rowKey(r)} className={onRow ? 'st-row-click' : ''}>
            {cols.map((c, i) => <td key={c.k} className={c.num ? 'st-n' : ''}>{i === 0 && onRow ? <button type="button" className="mem-title" onClick={() => onRow(r)}>{c.render ? c.render(r) : r[c.k]}</button> : c.render ? c.render(r) : r[c.k]}</td>)}
          </tr>))}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  )
}

export const SimpleTable = ({ head, rows, caption }) => (
  <div className="st-tblwrap"><table className="st-tbl"><caption className="sr">{caption || 'Aggregate evidence'}</caption>
    <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={i ? 'st-n' : ''}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'st-n' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
)
