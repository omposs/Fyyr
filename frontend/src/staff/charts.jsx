import { createContext, useContext, useId, useMemo, useState } from 'react'

// True while staff pages read the simulated sample, so chart headings can carry a small Demo badge.
export const DemoCtx = createContext(false)
export const DemoBadge = () => { const on = useContext(DemoCtx); return on ? <span className="pill nw-demo st-demo">Demo</span> : null }

export const PALETTE = ['#2b3cff', '#7a5af8', '#0e9f8e', '#d97706', '#d6336c']

// Axis top = four equal whole-number steps, so tick labels are never fractions.
const niceMax = v => { const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]; return 4 * (steps.find(s => s * 4 >= v) || Math.ceil(v / 4)) }

// Card with a title, optional note and an accessible "view as table" alternative.
export function Block({ title, note, children, table, actions }) {
  const id = useId()
  return (
    <section className="mem-card st-block" aria-labelledby={id}>
      <div className="st-block-h"><h2 className="mem-side-h" id={id}>{title}<DemoBadge /></h2>{actions}</div>
      {note && <p className="fine">{note}</p>}
      {children}
      {table && <details className="st-alt"><summary>View as table</summary>{table}</details>}
    </section>
  )
}

export function LineChart({ title, labels, series, xLabel, yLabel, height = 230, legend = true }) {
  const [hover, setHover] = useState(null)
  const W = 680, H = height, m = { l: 48, r: 14, t: 12, b: 44 }
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.points)))
  const n = labels.length
  const x = i => m.l + (n < 2 ? (W - m.l - m.r) / 2 : i * (W - m.l - m.r) / (n - 1))
  const y = v => H - m.b - (v / max) * (H - m.t - m.b)
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i)
  const every = Math.ceil(n / 8)
  const total = series.map(s => `${s.name} ${s.points.reduce((a, b) => a + b, 0)}`).join(', ')
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)))))
  }
  return (
    <figure className="st-chart">
      {legend && <div className="st-legend" aria-hidden="true">{series.map((s, i) => <span key={s.id}><i style={{ background: PALETTE[i % 5] }} />{s.name}</span>)}</div>}
      <div className="st-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${yLabel} by ${xLabel.toLowerCase()}. Totals: ${total}. A table version is below.`} onMouseMove={move}>
          {ticks.map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="st-grid" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="st-tick">{Math.round(t * 10) / 10}</text></g>)}
          {labels.map((l, i) => i % every === 0 && <text key={l + i} x={x(i)} y={H - m.b + 18} textAnchor="middle" className="st-tick">{l}</text>)}
          <text x={(W + m.l) / 2} y={H - 6} textAnchor="middle" className="st-axis">{xLabel}</text>
          <text transform={`translate(12 ${(H - m.b) / 2}) rotate(-90)`} textAnchor="middle" className="st-axis">{yLabel}</text>
          {series.map((s, i) => <polyline key={s.id} fill="none" stroke={PALETTE[i % 5]} strokeWidth="2.4" strokeLinejoin="round" points={s.points.map((v, j) => `${x(j)},${y(v)}`).join(' ')} />)}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} className="st-cross" />}
          {hover != null && series.map((s, i) => <circle key={s.id} cx={x(hover)} cy={y(s.points[hover])} r="4.5" fill="#fff" stroke={PALETTE[i % 5]} strokeWidth="2.4" />)}
        </svg>
        {hover != null && (
          <div className="st-tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <b>{labels[hover]}</b>
            {series.map((s, i) => <span key={s.id}><i style={{ background: PALETTE[i % 5] }} />{s.name}: <b>{s.points[hover]}</b></span>)}
          </div>
        )}
      </div>
      <details className="st-alt"><summary>View as table</summary>
        <div className="st-tblwrap"><table className="st-tbl"><caption className="sr">{title}</caption>
          <thead><tr><th scope="col">{xLabel}</th>{series.map(s => <th scope="col" key={s.id} className="st-n">{s.name}</th>)}</tr></thead>
          <tbody>{labels.map((l, i) => <tr key={l + i}><th scope="row">{l}</th>{series.map(s => <td key={s.id} className="st-n">{s.points[i]}</td>)}</tr>)}</tbody></table></div>
      </details>
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
          <span className="st-bar-t" aria-hidden="true"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="st-bar-v"><b>{r.value}</b>{r.sub && <small> {r.sub}</small>}</span>
        </li>
      ))}
    </ul>
  )
}

// Sortable table. cols: [{ k, label, num?, sort?: row => value, render?: row => node, hint? }]
export function DataTable({ caption, cols, rows, rowKey, initial, onRow, empty, foot, limit, moreLabel = 'View all' }) {
  const [s, setS] = useState(initial || null)
  const [all, setAll] = useState(false)
  const sorted = useMemo(() => {
    if (!s) return rows
    const c = cols.find(x => x.k === s.k); const f = c?.sort || (r => r[s.k])
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * s.dir })
  }, [rows, s, cols])
  const toggle = c => setS(p => (p?.k === c.k ? { k: c.k, dir: -p.dir } : { k: c.k, dir: c.num ? -1 : 1 }))
  if (!rows.length) return <p className="fine st-empty">{empty || 'Nothing to show for these filters.'}</p>
  return (
    <div className="st-tblwrap">
      <table className="st-tbl">
        <caption className="sr">{caption}</caption>
        <thead><tr>{cols.map(c => (
          <th key={c.k} scope="col" className={c.num ? 'st-n' : ''} aria-sort={s?.k === c.k ? (s.dir > 0 ? 'ascending' : 'descending') : c.sort || c.num ? 'none' : undefined}>
            {c.sort || c.num ? <button type="button" className="st-sort" onClick={() => toggle(c)}>{c.label}<span aria-hidden="true">{s?.k === c.k ? (s.dir > 0 ? ' ↑' : ' ↓') : ''}</span></button> : c.label}
          </th>))}</tr></thead>
        <tbody>{(limit && !all ? sorted.slice(0, limit) : sorted).map(r => (
          <tr key={rowKey(r)} className={onRow ? 'st-row-click' : ''}>
            {cols.map((c, i) => <td key={c.k} className={c.num ? 'st-n' : ''}>{i === 0 && onRow ? <button type="button" className="mem-title" onClick={() => onRow(r)}>{c.render ? c.render(r) : r[c.k]}</button> : c.render ? c.render(r) : r[c.k]}</td>)}
          </tr>))}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
      {limit && sorted.length > limit && <button type="button" className="link-btn st-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `${moreLabel} ${sorted.length}`}</button>}
    </div>
  )
}

export const SimpleTable = ({ head, rows, caption }) => (
  <div className="st-tblwrap"><table className="st-tbl"><caption className="sr">{caption || 'Aggregate evidence'}</caption>
    <thead><tr>{head.map((h, i) => <th key={h} scope="col" className={i ? 'st-n' : ''}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'st-n' : ''}>{c}</td>)}</tr>)}</tbody></table></div>
)
