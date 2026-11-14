import { useId, useMemo, useState } from 'react'
import { DemoBadge } from './charts.jsx'
import { CAT_COLOR, tint, topicColor } from './colors.js'
import './perf.css'

export function Change({ c, prev, cur }) {
  if (!c?.reliable) return <small className="ti-chg" tabIndex={0} title={`Too little data to compare. Previous ${prev}, current ${cur}.`}>—<span className="sr"> too little data to compare</span></small>
  const up = c.abs > 0, down = c.abs < 0
  return (
    <small className={'ti-chg ' + (up ? 'up' : down ? 'down' : '')} tabIndex={0} title={`Previous ${prev}, current ${cur}`}>
      <span aria-hidden="true">{up ? '▲' : down ? '▼' : '–'} </span>{c.text}<span className="sr">, {up ? 'increase' : down ? 'decrease' : 'no change'}. Previous {prev}, current {cur}</span>
    </small>
  )
}

// Category summary: the same filtered rows as the chart (res.catRows); groups below the threshold are withheld.
export function CategorySummary({ res, k }) {
  return (
    <section className="mem-card st-block ti-cats" aria-labelledby="ins-cats">
      <div className="st-block-h"><h2 className="mem-side-h" id="ins-cats">Category summary<DemoBadge /></h2></div>
      <ul className="ti-catlist">
        {res.catRows.map(c => (
          <li key={c.id}>
            <span className="ti-cat-n"><i style={{ background: CAT_COLOR[c.id] }} aria-hidden="true" />{c.short || c.label}</span>
            {c.hidden ? <span className="fine">Hidden (&lt;{k} companies)</span>
              : <span className="ti-cat-v"><b>{c.engagement}</b><Change c={c.change} prev={c.prev} cur={c.engagement} /></span>}
          </li>
        ))}
      </ul>
      <p className="fine">Interactions this period, with change against the previous period.</p>
    </section>
  )
}

// One row per topic id: the union of topic activity and interest-signal rows. The three signals overlap and are never summed.
const sig = (n, k) => (n == null ? '—' : n === 0 ? 0 : n < k ? `<${k}` : n)
const VAL = { topic: r => r.topic, cur: r => r.cur, change: r => (r.change?.reliable ? (r.change.pct ?? r.change.abs) : null), companies: r => (typeof r.companies === 'number' ? r.companies : null) }

export function TopicInsights({ res, k }) {
  const uid = useId()
  const [s, setS] = useState({ k: 'cur', dir: -1 })
  const rows = useMemo(() => {
    const m = new Map()
    for (const a of res.activity) m.set(a.topic, { topic: a.topic, cur: a.cur, prev: a.prev, change: a.change, companies: a.companies })
    for (const t of res.triRows) m.set(t.topic, { ...(m.get(t.topic) || { topic: t.topic, cur: null, prev: null, change: null, companies: t.observed > 0 ? `<${k}` : null }), stated: t.stated, observed: t.observed, inferred: t.inferred })
    return [...m.values()]
  }, [res, k])
  const sorted = useMemo(() => {
    const f = VAL[s.k]
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return a.topic.localeCompare(b.topic); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * s.dir || a.topic.localeCompare(b.topic) })
  }, [rows, s])
  const max = Math.max(1, ...rows.map(r => r.cur || 0))
  const toggle = key => setS(p => (p.k === key ? { k: key, dir: -p.dir } : { k: key, dir: key === 'topic' ? 1 : -1 }))
  const Th = ({ id, children, cls }) => <span role="columnheader" className={cls} aria-sort={s.k === id ? (s.dir > 0 ? 'ascending' : 'descending') : 'none'}><button type="button" className="st-sort" onClick={() => toggle(id)}>{children}<span aria-hidden="true">{s.k === id ? (s.dir > 0 ? ' ↑' : ' ↓') : ''}</span></button></span>
  return (
    <section className="mem-card st-block" aria-labelledby={uid}>
      <div className="st-block-h"><h2 className="mem-side-h" id={uid}>Topic insights<DemoBadge /></h2></div>
      <p className="fine">Stated, observed and inferred are separate signals. They can overlap and are not added together.</p>
      <div className="ti-tbl" role="table" aria-label="Topic insights">
        <div className="ti-row ti-head" role="row">
          <Th id="topic">Topic</Th><Th id="cur" cls="ti-n">Engagement</Th><Th id="change" cls="ti-n">Change</Th><Th id="companies" cls="ti-n">Companies reached</Th>
          <span role="columnheader">Interest signals</span>
        </div>
        {sorted.map(r => (
          <div className="ti-row" role="row" key={r.topic}>
            <span role="cell" className="ti-topic"><i style={{ background: topicColor(r.topic) }} aria-hidden="true" />{r.topic}</span>
            <span role="cell" className="ti-n ti-eng" data-l="Engagement">{r.cur == null ? '—' : <><span className="ti-trk" aria-hidden="true" style={{ background: tint(topicColor(r.topic)) }}><i style={{ width: `${Math.max(3, (r.cur / max) * 100)}%`, background: topicColor(r.topic) }} /></span><b>{r.cur}</b></>}</span>
            <span role="cell" className="ti-n" data-l="Change">{r.cur == null ? '—' : <Change c={r.change} prev={r.prev} cur={r.cur} />}</span>
            <span role="cell" className="ti-n" data-l="Companies reached">{r.companies ?? '—'}</span>
            <span role="cell" className="ti-sigs" data-l="Interest signals">
              <span title="Companies that selected this interest"><small>Stated</small> <b>{sig(r.stated, k)}</b></span>
              <span title="Companies with observed activity"><small>Observed</small> <b>{sig(r.observed, k)}</b></span>
              <span title="Tentative: repeated activity without a stated interest"><small>Inferred</small> <b>{sig(r.inferred, k)}</b></span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
