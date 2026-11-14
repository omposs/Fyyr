import { useMemo, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { Dialog } from '../member/ui.jsx'
import { MCAT, OPP_BY_ID } from '../member/data.js'
import { BarList, Block, DataTable, DemoBadge, LineChart, SimpleTable } from './charts.jsx'
import { DEFINITIONS, LIMITS, companySummary, fmtDY, oppDetail, toCsv } from './metrics.js'
import { PARKS } from '../network/data.js'
import { DIRECTORY_SECTORS, listDirectory } from './directory.js'
import { navigate } from '../auth.js'
import { INVITES_TRACKED, NOT_CONNECTED, REGISTRATIONS_TRACKED, STATUS_LABEL, parkCatalogue, parkSummary } from './park.js'
import { STATUSES } from './store.js'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const hiddenNote = (k, n, what) => n > 0 && <p className="fine st-hidden"><Icon n="layers" size={14} /> {plural(n, `${what} is`, `${what}s are`)} hidden because fewer than {k} companies contributed. This protects individual companies.</p>

function Empty({ title, children }) { return <div className="mem-empty"><strong>{title}</strong><p>{children}</p></div> }

function TooSmall({ d }) {
  return (
    <Empty title="Not enough companies to show this safely">
      Only {d.res.activeCompanies} {d.res.activeCompanies === 1 ? 'company was' : 'companies were'} active in this selection, and results are withheld below {d.ctx.k}, so no single company’s activity can be read from them. Choose a longer period or fewer filters. The threshold can be changed in settings.
    </Empty>
  )
}
const guard = d => (!d.res.cur ? <NoData d={d} /> : d.res.tooSmall ? <TooSmall d={d} /> : null)

function NoData({ d }) {
  return (
    <Empty title="No activity in this selection">
      {d.ctx.source === 'live'
        ? 'Nothing has been recorded in this browser for these filters. Open the member area (log in as a member), search, open or save an opportunity, then come back. This page updates by itself.'
        : 'There is no activity for the selected period and filters. Try a longer period or clear a filter.'}
    </Empty>
  )
}

// ---------------- Overview ----------------
export function Finding({ fd, d }) {
  const [open, setOpen] = useState(false)
  const saved = d.store.has(fd.id)
  return (
    <li className={'st-find st-' + fd.kind}>
      <h3>{fd.title}</h3>
      <p>{fd.observed}</p>
      <p className="st-meta">
        <span>{fd.period}</span>
        {fd.counts.map(([l, v]) => <span key={l}><b>{v}</b> {l.toLowerCase()}</span>)}
        <span><b>{fd.companies}</b> {fd.companies === 1 ? 'company' : 'companies'}</span>
      </p>
      <p className="st-next"><b>Suggested next step (a hypothesis, not a confirmed reason)</b>{fd.next}</p>
      {open && <div className="st-evid"><p className="fine">Aggregate evidence. Small groups hidden.</p><SimpleTable head={fd.evidence.head} rows={fd.evidence.rows} caption={`Evidence for ${fd.title}`} /></div>}
      <div className="st-act">
        <button type="button" className="btn btn-glass btn-sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide evidence' : 'Inspect evidence'}</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={saved} onClick={() => d.openFollow({ key: fd.id, kind: fd.kind, title: fd.title, observed: fd.observed, period: fd.period, companies: fd.companies, evidence: fd.evidence })}>{saved ? 'Saved as follow-up' : 'Save as follow-up'}</button>
      </div>
    </li>
  )
}

// ---------------- Member insights ----------------
const pctText = c => (c.reliable ? c.text : 'Too little data to compare')
export const Stat = ({ label, value, sub }) => <div className="st-stat"><span className="st-stat-l">{label}</span><b className="st-stat-v">{value}</b>{sub && <small>{sub}</small>}</div>

export function Insights({ d }) {
  const { res } = d, k = d.ctx.k
  const g = guard(d); if (g) return g
  const lead = [...res.activity].sort((a, b) => b.companies - a.companies || b.cur - a.cur)[0]
  const fast = res.growth.activity[0]
  const grow = res.growth.activity.slice(0, 6)
  const cats = res.catRows.filter(c => !c.hidden)
  const unmet = res.unmet.rows.slice(0, 4)
  const multi = res.activity.filter(a => a.companies >= Math.max(k, 3)).sort((a, b) => b.companies - a.companies || b.cur - a.cur).slice(0, 8)
  const a = res.summary.active
  return (
    <div className="mem-page st-page">
      <section className="st-stats" aria-label="Summary">
        <Stat label="Active companies" value={a.cur} sub={`of ${a.total} · ${a.prev} in ${d.ctx.range.prevLabel}`} />
        <Stat label="Leading interest" value={lead ? lead.topic : 'None yet'} sub={lead ? `${plural(lead.companies, 'company', 'companies')} · ${plural(lead.cur, 'interaction', 'interactions')}` : undefined} />
        <Stat label="Fastest-growing topic" value={fast ? fast.topic : 'None'} sub={fast ? `${fast.prev} → ${fast.cur} companies (+${fast.abs})` : 'No topic gained companies'} />
      </section>

      <div className="ov-two">
        <Block title="Growing interests" table={<SimpleTable caption="Growing interests" head={['Topic', 'Companies now', 'Before']} rows={grow.map(r => [r.topic, r.cur, r.prev])} />}>
          {grow.length ? <BarList label="Companies active per growing topic" rows={grow.map(r => ({ label: r.topic, value: r.cur, sub: `+${r.abs} vs ${r.prev}` }))} /> : <p className="fine">No topic gained active companies in this period.</p>}
          <a href="/staff/overview" className="mem-more" onClick={e => { e.preventDefault(); navigate('/staff/overview') }}>Compare saved interests on Overview</a>
        </Block>

        <Block title="Interest by category" table={<SimpleTable caption="Interest by category" head={['Category', 'Views, saves and clicks', 'Change', 'Companies']} rows={res.catRows.map(c => c.hidden ? [c.label, 'Hidden', '—', `<${k}`] : [c.label, c.engagement, pctText(c.change), c.companies])} />}>
          <BarList label="Engagement per category" rows={cats.map(c => ({ label: c.label, value: c.engagement, sub: c.change.reliable ? c.change.text : '' }))} />
          {hiddenNote(k, res.catRows.filter(c => c.hidden).length, 'category')}
        </Block>
      </div>

      <Block title="Unmet demand" actions={<a href="/staff/search" className="mem-more" onClick={e => { e.preventDefault(); navigate('/staff/search') }}>Search trends</a>}>
        {unmet.length ? <ul className="st-rows">{unmet.map(r => <li key={r.key}><b>{r.label}</b><span>{plural(r.zero, 'search', 'searches')} with no results · {plural(r.companies, 'company', 'companies')}{r.supply != null && ` · ${plural(r.supply, 'open listing', 'open listings')}`}</span></li>)}</ul> : <p className="fine">No topic had no-result searches from at least {k} companies.</p>}
      </Block>

      <details className="mem-card st-detail">
        <summary>Supporting evidence</summary>
        <h3 className="mem-sec st-h3">Engagement over time</h3>
        <LineChart title="Observed engagement by category" labels={res.buckets.labels} series={res.catSeries.filter(c => !res.catRows.find(r => r.id === c.id).hidden)} xLabel={res.buckets.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Views, saves and clicks" />
        <h3 className="mem-sec st-h3">Topics attracting several companies</h3>
        <SimpleTable caption="Topics attracting several companies" head={['Topic', 'Companies', 'Interactions', 'Change']} rows={multi.map(x => [x.topic, x.companies, x.cur, pctText(x.change)])} />
        <h3 className="mem-sec st-h3">Stated, observed and inferred</h3>
        <SimpleTable caption="Stated, observed and inferred interests" head={['Topic', 'Stated by', 'Observed from', 'Inferred (tentative)']}
          rows={res.triRows.map(r => { const c = n => (n === 0 ? 0 : n < k ? `<${k}` : n); return [r.topic, c(r.stated), c(r.observed), c(r.inferred)] })} />
        {res.combos.length > 0 && <><h3 className="mem-sec st-h3">Common combinations</h3><ul className="st-combos">{res.combos.map(c => <li key={c.pair}><span>{c.pair}</span><b>{plural(c.companies, 'company', 'companies')}</b></li>)}</ul></>}
      </details>
    </div>
  )
}

// ---------------- Search trends ----------------
function TermsPanel({ r, d, onClose }) {
  const k = d.ctx.k
  const key = `topic:${r.topic}:${d.ctx.range.from}`
  const pct = r.withResults ? Math.round((r.follow / r.withResults) * 100) : null
  return (
    <Dialog label={r.topic} onClose={onClose} side>
      <h2 className="auth-h det-h">{r.topic}</h2>
      <p className="auth-sub">{d.ctx.range.label} · {plural(r.searches, 'search', 'searches')} from {plural(r.companies, 'company', 'companies')} · {r.withResults} returned results{pct != null && `, ${pct}% followed by a view, save or click`}.</p>
      <SimpleTable caption={`Terms grouped into ${r.topic}`} head={['Term', 'Searches', 'Companies', 'No results']}
        rows={[...r.terms.map(t => [t.term, t.n, t.companies, `${t.zero} of ${t.n}`]), ...(r.otherTerms.count ? [[`${r.otherTerms.count} other term(s), fewer than ${k} companies`, r.otherTerms.n, '—', '—']] : [])]} />
      <p className="fine">{r.supply == null ? 'Terms in this group fit no broad topic.' : `${plural(r.supply, 'open listing', 'open listings')} relate to this topic.`} Terms are grouped by keyword rules and can be wrong. Aggregate only.</p>
      <div className="auth-row det-actions">
        <button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={d.store.has(key)}
          onClick={() => d.openFollow({ key, kind: 'topic', title: `Review demand for “${r.topic}”`, observed: `${r.searches} searches, ${r.zero} with no results, ${r.companies} companies, ${r.supply ?? 'n/a'} open listings.`, period: d.ctx.range.label, companies: r.companies, evidence: { head: ['Term', 'Searches', 'Companies', 'No results'], rows: r.terms.map(t => [t.term, t.n, t.companies, `${t.zero} of ${t.n}`]) } })}>
          {d.store.has(key) ? 'Saved as follow-up' : 'Save as follow-up'}</button>
      </div>
    </Dialog>
  )
}

export function SearchTrends({ d }) {
  const { res } = d, k = d.ctx.k
  const [chip, setChip] = useState('all')
  const [open, setOpen] = useState(null)
  const g = guard(d); if (g) return g
  const rows = res.topics.rows
  const pct = r => (r.withResults ? Math.round((r.follow / r.withResults) * 100) : null)
  const flt = {
    all: () => true,
    growing: r => r.change.reliable && r.change.abs > 0,
    noresults: r => r.zero >= 3 && r.zero / r.searches >= .3,
    nofollow: r => r.withResults >= 5 && r.follow / r.withResults < .5,
  }
  const chips = [['all', 'Most searched'], ['growing', 'Growing'], ['noresults', 'No results'], ['nofollow', 'Little follow-up']]
  const shown = rows.filter(flt[chip])
  const totalSearches = rows.reduce((n, r) => n + r.searches, 0), totalZero = rows.reduce((n, r) => n + r.zero, 0), totalFollow = rows.reduce((n, r) => n + r.follow, 0), totalRes = rows.reduce((n, r) => n + r.withResults, 0)
  return (
    <div className="mem-page st-page">
      <section className="st-stats" aria-label="Summary">
        <Stat label="Searches" value={totalSearches} sub={`${d.ctx.range.label}, ${plural(rows.length, 'topic', 'topics')}`} />
        <Stat label="No results" value={totalSearches ? `${Math.round((totalZero / totalSearches) * 100)}%` : '—'} sub={plural(totalZero, 'search', 'searches')} />
        <Stat label="Followed by engagement" value={totalRes ? `${Math.round((totalFollow / totalRes) * 100)}%` : '—'} sub={`of ${totalRes} searches with results`} />
      </section>
      <div className="chips-row" role="group" aria-label="Filter topics">{chips.map(([id, l]) => <button key={id} type="button" className="fchip" aria-pressed={chip === id} onClick={() => setChip(id)}>{l}</button>)}</div>
      <section className="mem-card st-block" aria-label="Search topics">
        <DataTable caption="Search topics" rows={shown} rowKey={r => r.topic} initial={{ k: 'searches', dir: -1 }} limit={10} onRow={setOpen} empty="No topic matches this filter."
          cols={[
            { k: 'topic', label: 'Topic', sort: r => r.topic, render: r => <>{r.topic}{r.change.reliable && r.change.abs !== 0 && <small className={'st-chg ' + (r.change.abs > 0 ? 'up' : 'down')}>{r.change.text}</small>}</> },
            { k: 'searches', label: 'Searches', num: true },
            { k: 'companies', label: 'Companies', num: true },
            { k: 'avail', label: 'Results found', num: true, sort: r => (r.searches - r.zero) / r.searches, render: r => <>{r.withResults} of {r.searches}{r.zero / r.searches >= .5 && <b className="st-flag"> mostly none</b>}</> },
            { k: 'follow', label: 'Follow-up engagement', num: true, sort: r => (pct(r) ?? -1), render: r => (r.withResults ? <>{r.follow} of {r.withResults} ({pct(r)}%)</> : <span className="fine">No results</span>) },
          ]} />
        {hiddenNote(k, res.topics.hiddenCount, 'topic')}
      </section>
      {open && <TermsPanel r={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------- Opportunity performance ----------------
function OppPanel({ id, d, onClose }) {
  const det = useMemo(() => oppDetail(d.events, id, d.ctx), [id, d.events, d.ctx])
  const row = d.res.opps.rows.find(r => r.id === id)
  const o = det.o
  const key = `opp:${id}:${d.ctx.range.from}`
  return (
    <Dialog label={o.title} onClose={onClose} side>
      <p className="opp-top"><span className="ocat"><Icon n={MCAT[o.mcat].icon} size={16} />{MCAT[o.mcat].label}</span>{o.demo && <span className="pill">Demo listing</span>}</p>
      <h2 className="auth-h det-h">{o.title}</h2>
      <p className="fine">{d.ctx.range.label}. Aggregate across companies. No individual activity is shown.</p>
      <LineChart title={`Engagement with ${o.title}`} labels={det.labels} series={det.series} xLabel={det.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Events" height={200} />
      <dl className="det">
        <div className="det-f"><dt>Counts in this period</dt><dd>{row ? `${row.shown} shown in lists · ${row.views} views · ${row.saves} saves · ${row.clicks} source clicks · ${row.notRel} marked not relevant` : 'No data'}</dd></div>
        <div className="det-f"><dt>Saves per 100 views</dt><dd>{row?.savesPer100 == null ? 'Not enough views' : `${row.savesPer100} (${row.saves} saves ÷ ${row.views} views, ${row.companies} companies). Views and saves are not linked per person, so this is a ratio, not a conversion rate.`}</dd></div>
        <div className="det-f"><dt>Industries engaging</dt><dd>
          {det.sectors.length ? <ul className="st-plain">{det.sectors.map(s => <li key={s.sector}>{s.sector}: {plural(s.n, 'interaction', 'interactions')} from {plural(s.companies, 'company', 'companies')}</li>)}</ul> : 'No group is large enough to show.'}
          {det.other && <span className="fine"> {det.other.groups} smaller group(s) combined and hidden.</span>}
        </dd></div>
        <div className="det-f"><dt>Explicit feedback</dt><dd>{det.notRel} marked not relevant. Free-text feedback is not collected, so the reason is unknown.</dd></div>
        <div className="det-f"><dt>Source and date last checked</dt><dd>{o.url ? <><a href={o.url} target="_blank" rel="noopener noreferrer">{o.source}</a>, checked {det.checked}</> : 'Fictional demo listing. It has no source.'}</dd></div>
      </dl>
      <div className="auth-row det-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={d.store.has(key)} onClick={() => d.openFollow({ key, kind: 'lowsave', title: `Review recommendation: ${o.title}`, observed: row ? `${row.views} views, ${row.saves} saves, ${row.clicks} source clicks, ${row.companies} companies.` : '', period: d.ctx.range.label, companies: row?.companies || 0, evidence: { head: ['Measure', 'Count'], rows: row ? [['Shown', row.shown], ['Views', row.views], ['Saves', row.saves], ['Source clicks', row.clicks], ['Not relevant', row.notRel]] : [] } })}>{d.store.has(key) ? 'Saved as follow-up' : 'Save as follow-up'}</button>
      </div>
    </Dialog>
  )
}

// ---------------- Blue Science Park analytics (own page: /staff/ours) ----------------
const NC = <span className="st-nc" title="No tracking is connected for this metric">{NOT_CONNECTED}</span>
const Tip = ({ text }) => <span className="ov-tipk" tabIndex={0} title={text} aria-label={text}>ⓘ</span>
const TREND = [['views', 'Views'], ['saves', 'Saves'], ['clicks', 'Source clicks']]

// Everything about one opportunity that is not in the table: category, status, source clicks, registrations and its own trend.
function ParkOppPanel({ row, d, onClose }) {
  const det = useMemo(() => (OPP_BY_ID[row.id] ? oppDetail(d.events, row.id, d.ctx) : null), [row.id, d.events, d.ctx])
  return (
    <Dialog label={row.title} onClose={onClose} side>
      <p className="opp-top"><span className="ocat"><Icon n={MCAT[row.mcat].icon} size={16} />{MCAT[row.mcat].label}</span><span className="pill">{STATUS_LABEL[row.status]}</span>{row.demo && <span className="pill nw-demo">Demo</span>}</p>
      <h2 className="auth-h det-h">{row.title}</h2>
      <p className="fine">{d.ctx.range.label}</p>
      <dl className="det">
        <div className="det-f"><dt>Views</dt><dd>{row.hidden ? 'Hidden (too few companies)' : row.views}</dd></div>
        <div className="det-f"><dt>Saves</dt><dd>{row.hidden ? 'Hidden' : row.saves}</dd></div>
        <div className="det-f"><dt>Source clicks <Tip text="A click on a source or registration link. It is not a registration." /></dt><dd>{row.hidden ? 'Hidden' : row.clicks}</dd></div>
        <div className="det-f"><dt>Companies reached</dt><dd>{row.hidden ? `Fewer than ${d.ctx.k}` : row.companies}</dd></div>
        <div className="det-f"><dt>Confirmed registrations</dt><dd>{NC}</dd></div>
        <div className="det-f"><dt>Attendance</dt><dd>{NC}</dd></div>
      </dl>
      {det && !row.hidden && <LineChart title={`Engagement with ${row.title}`} labels={det.labels} series={det.series} xLabel={det.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Count" height={180} />}
      <div className="auth-row det-actions"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button></div>
    </Dialog>
  )
}

export function OurPerformance({ d }) {
  const { res } = d, k = d.ctx.k, p = res.park
  const [open, setOpen] = useState(null)
  const [metric, setMetric] = useState('views')
  const cat = useMemo(() => parkCatalogue(), [d.events, d.ctx])
  const published = cat.filter(c => c.status === 'published')
  const sum = parkSummary(cat)
  const byId = new Map(p.rows.map(r => [r.id, r]))
  // Every published opportunity is listed, including those with no engagement, so staff can see what needs attention.
  const rows = published.map(c => { const r = byId.get(c.id); return { ...c, catLabel: MCAT[c.mcat].short, hidden: p.hiddenIds.has(c.id), views: r?.views ?? 0, saves: r?.saves ?? 0, clicks: r?.clicks ?? 0, companies: r?.companies ?? 0 } })
  const sharedNames = new Map(d.shared.map(s => [s.id, s.name]))
  const named = p.byCompany.filter(c => sharedNames.has(c.id)), other = p.byCompany.filter(c => !sharedNames.has(c.id))
  const tot = other.reduce((n, c) => ({ views: n.views + c.views, saves: n.saves + c.saves, clicks: n.clicks + c.clicks }), { views: 0, saves: 0, clicks: 0 })
  const catRows = Object.keys(MCAT).map(id => { const e = p.byCat.find(c => c.id === id); return { id, label: MCAT[id].label, published: sum.byCat.find(c => c.id === id)?.n || 0, views: e?.views || 0, saves: e?.saves || 0, clicks: e?.clicks || 0, companies: e?.companies || 0 } }).filter(c => c.published || c.views || c.saves || c.clicks)
  const g = guard(d); if (g) return <div className="mem-page st-page st-ours">{g}</div>
  const unit = res.buckets.unit === 'day' ? 'Day' : 'Week starting'
  const mName = TREND.find(t => t[0] === metric)[1]
  const third = REGISTRATIONS_TRACKED ? null : { label: 'Source clicks', value: p.clicks, tip: 'Clicks on source or registration links. Confirmed registrations are not connected, and a click is not a registration.' }
  return (
    <div className="mem-page st-page st-ours">
      <section className="st-stats" aria-label="Summary">
        <Stat label="Companies reached" value={p.companies} sub={`${p.prev.companies} before`} />
        <Stat label="Saves" value={p.saves} sub={`${p.prev.saves} before`} />
        <Stat label={third.label} value={third.value} sub={<>{p.prev.clicks} before <Tip text={third.tip} /></>} />
      </section>

      <div className="st-ours-grid">
        <section className="st-plain-card" aria-labelledby="ours-trend">
          <div className="st-block-h"><h2 className="mem-side-h" id="ours-trend">Activity trend<DemoBadge /></h2>
            <label className="sort">Metric<select className="sel st-mini" value={metric} onChange={e => setMetric(e.target.value)}>{TREND.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label></div>
          <LineChart title={`Blue Science Park ${mName.toLowerCase()}`} labels={p.labels} series={[{ id: metric, name: mName, points: p.seriesBy[metric] }]} xLabel={unit} yLabel={mName} height={220} legend={false} />
        </section>

        <section className="st-plain-card" aria-labelledby="ours-res">
          <div className="st-block-h"><h2 className="mem-side-h" id="ours-res">Opportunity results<DemoBadge /> <Tip text={`Companies reached is distinct companies. Hidden means fewer than ${k} companies engaged. Zero means no engagement was recorded.`} /></h2></div>
          <DataTable caption="Blue Science Park opportunities" rows={rows} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} limit={5} moreLabel="Show all" onRow={setOpen} empty="No published Blue Science Park opportunity yet."
            cols={[
              { k: 'title', label: 'Opportunity', sort: r => r.title, render: r => <>{r.title}{r.demo && <span className="pill nw-demo st-pill">Demo</span>}</> },
              { k: 'views', label: 'Views', num: true, sort: r => (r.hidden ? -1 : r.views), render: r => (r.hidden ? <span className="fine" title="Fewer companies engaged than the minimum group size">Hidden</span> : r.views) },
              { k: 'saves', label: 'Saves', num: true, sort: r => (r.hidden ? -1 : r.saves), render: r => (r.hidden ? <span className="fine">Hidden</span> : r.saves) },
              { k: 'companies', label: 'Companies reached', num: true, sort: r => (r.hidden ? -1 : r.companies), render: r => (r.hidden ? <span className="fine">Hidden</span> : r.companies) },
            ]} />
        </section>
      </div>

      <details className="st-fold">
        <summary>Category breakdown</summary>
        <SimpleTable caption="Performance by category" head={['Category', 'Published', 'Views', 'Saves', 'Source clicks', 'Companies']} rows={catRows.map(c => [c.label, c.published, c.views, c.saves, c.clicks, c.companies])} />
      </details>
      <details className="st-fold">
        <summary>Companies, registrations and invitations</summary>
        <SimpleTable caption="Engagement by member company" head={['Company', 'Views', 'Saves', 'Source clicks']}
          rows={[...named.map(c => [sharedNames.get(c.id), c.views, c.saves, c.clicks]), ...(other.length ? [[`${plural(other.length, 'other company', 'other companies')} (not named)`, tot.views, tot.saves, tot.clicks]] : [])]} />
        <SimpleTable caption="Registrations and invitations" head={['Measure', 'Status']} rows={[['Confirmed registrations', NC], ['Attendance', NC], ['Invitations sent', INVITES_TRACKED ? 'Tracked' : NC], ['Invitations delivered', INVITES_TRACKED ? 'Tracked' : NC], ['Responses', INVITES_TRACKED ? 'Tracked' : NC]]} />
        <p className="fine">Only companies that agreed to share their activity are named. Member-created events are not included.</p>
      </details>
      {open && <ParkOppPanel row={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function Performance({ d }) {
  const { res } = d, k = d.ctx.k
  const [open, setOpen] = useState(null)
  const g = guard(d); if (g) return <div className="mem-page st-page">{g}</div>
  return (
    <div className="mem-page st-page">
      <section className="mem-card st-block" aria-label="Opportunity performance">
        <DataTable caption="Opportunity performance" rows={res.opps.rows} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} onRow={r => setOpen(r.id)} limit={12}
          empty="No opportunity reached the minimum number of companies."
          cols={[
            { k: 'title', label: 'Opportunity', sort: r => r.title, render: r => <>{r.title}{r.demoListing && <span className="pill nw-demo st-pill">Demo</span>}</> },
            { k: 'catLabel', label: 'Category', sort: r => r.catLabel || '' },
            { k: 'views', label: 'Views', num: true },
            { k: 'saves', label: 'Saves', num: true },
            { k: 'clicks', label: 'Source clicks', num: true },
            { k: 'companies', label: 'Companies', num: true },
          ]} />
        {hiddenNote(k, res.opps.hiddenCount, 'opportunity')}
        <p className="fine">A source click is not a registration or an application.</p>
      </section>
      {open && <OppPanel id={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------- Companies ----------------
const fmtLast = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function CompanyPanel({ c, d, last, onClose }) {
  const sum = useMemo(() => (c.fictional && c.share ? companySummary(d.events, c.eventId, d.ctx.range) : null), [c, d.events, d.ctx.range])
  return (
    <Dialog label={c.name} onClose={onClose} side>
      <p className="opp-top"><span className="ocat">{c.parkName}</span><span className={c.fictional ? 'pill nw-demo' : 'pill pill-blue'}>{c.fictional ? 'Demo' : c.status}</span></p>
      <h2 className="auth-h det-h">{c.name}</h2>
      <p>{c.summary}</p>
      <dl className="det">
        <div className="det-f"><dt>Science park</dt><dd>{c.relation !== 'Fictional demo company' ? `${c.relation} · ${c.parkName}` : `Placed in ${c.parkName} for this demo`}</dd></div>
        <div className="det-f"><dt>Sector</dt><dd>{c.sector}</dd></div>
        <div className="det-f"><dt>Interests</dt><dd>{c.interests.length ? <span className="mem-chips">{c.interests.map(i => <span key={i} className="pill pill-blue">{i}</span>)}</span> : 'Not specified'}</dd></div>
        {c.website && <div className="det-f"><dt>Website</dt><dd><a href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, '')}</a>{c.evidence && <> · <a href={c.evidence} target="_blank" rel="noopener noreferrer">affiliation evidence</a></>}</dd></div>}
        <div className="det-f"><dt>Engagement summary</dt><dd>
          {!c.fictional ? 'Not shown. This is a real organisation and no activity has been observed for it.'
            : sum ? `${d.ctx.range.label}: ${plural(sum.searches, 'search', 'searches')}, ${plural(sum.views, 'view', 'views')}, ${plural(sum.saves, 'save', 'saves')}${sum.topics.length ? '. Top topics: ' + sum.topics.join(', ') : ''}. Simulated.`
              : 'This company has not agreed to share its own summary, so it only counts in aggregate figures.'}
          {last && <small className="st-sub">Last simulated activity {fmtLast(last)}</small>}
        </dd></div>
      </dl>
    </Dialog>
  )
}

export function Companies({ d }) {
  const [q, setQ] = useState('')
  const [park, setPark] = useState('all')
  const [sector, setSector] = useState('all')
  const [interest, setInterest] = useState('all')
  const [open, setOpen] = useState(null)
  const all = useMemo(() => listDirectory(), [])
  const lastBy = useMemo(() => { const m = new Map(); for (const e of d.events) if (e.type !== 'interests_set' && e.ts > (m.get(e.company) || 0)) m.set(e.company, e.ts); return m }, [d.events])
  const lastOf = c => (c.fictional && c.share && d.ctx.source === 'demo' ? lastBy.get(c.eventId) || null : null)
  const interests = [...new Set(all.flatMap(c => c.interests))].sort()
  const needle = q.trim().toLowerCase()
  const rows = all.filter(c => (park === 'all' || c.park === park) && (sector === 'all' || c.sector === sector) && (interest === 'all' || c.interests.includes(interest)) && (!needle || [c.name, c.parkName, c.sector, ...c.interests].join(' ').toLowerCase().includes(needle)))
  const reset = () => { setQ(''); setPark('all'); setSector('all'); setInterest('all') }
  return (
    <div className="mem-page st-page">
      <section className="st-filters st-cf" aria-label="Company filters">
        <div className="st-cf-grid">
          <label className="st-cf-f st-cf-search">Search<input type="search" className="sel st-cf-c" placeholder="Search companies…" value={q} maxLength={60} onChange={e => setQ(e.target.value)} /></label>
          <label className="st-cf-f">Science park<select className="sel st-cf-c" value={park} onChange={e => setPark(e.target.value)}><option value="all">All parks</option>{Object.values(PARKS).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="st-cf-f">Sector<select className="sel st-cf-c" value={sector} onChange={e => setSector(e.target.value)}><option value="all">All sectors</option>{DIRECTORY_SECTORS.map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="st-cf-f">Interest<select className="sel st-cf-c" value={interest} onChange={e => setInterest(e.target.value)}><option value="all">All interests</option>{interests.map(x => <option key={x}>{x}</option>)}</select></label>
          {(q || park !== 'all' || sector !== 'all' || interest !== 'all') && <button type="button" className="link-btn st-cf-clear" onClick={reset}>Clear filters</button>}
        </div>
      </section>
      <p className="mem-result" role="status">{plural(rows.length, 'company profile', 'company profiles')}</p>
      <section className="mem-card st-block" aria-label="Companies">
        <DataTable caption="Companies" rows={rows} rowKey={r => r.id} initial={{ k: 'name', dir: 1 }} onRow={setOpen} limit={15} empty="No company matches these filters."
          cols={[
            { k: 'name', label: 'Company', sort: r => r.name, render: r => <>{r.name}{r.fictional && <span className="pill nw-demo st-pill">Demo</span>}</> },
            { k: 'parkName', label: 'Science park', sort: r => r.parkName },
            { k: 'sector', label: 'Sector', sort: r => r.sector },
            { k: 'interests', label: 'Top interests', render: r => (r.interests.length ? r.interests.slice(0, 2).join(', ') : <span className="fine">Not specified</span>) },
            { k: 'status', label: 'Profile status', sort: r => r.status },
            { k: 'last', label: 'Last activity', sort: r => lastOf(r) || 0, render: r => (lastOf(r) ? fmtLast(lastOf(r)) : <span className="fine">—</span>) },
          ]} />
      </section>
      {open && <CompanyPanel c={open} d={d} last={lastOf(open)} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------- Reports ----------------
const SECTIONS = [['interests', 'Main interest trends'], ['unmet', 'Unmet demand'], ['perf', 'Opportunity performance'], ['actions', 'Suggested follow-up actions']]
export function reportModel(d, sel) {
  const { res, ctx } = d, k = ctx.k
  const f = ctx.f, bits = [f.cat !== 'all' ? `category ${MCAT[f.cat].short}` : 'all categories', f.sector !== 'all' ? f.sector : 'all industries', f.company !== 'all' ? 'one company that shares its activity' : 'all companies']
  const sections = []
  if (sel.interests) sections.push({ id: 'interests', title: 'Main interest trends', text: 'Searches, views, saves and source clicks per topic, compared with the previous period. Observed activity only; not confirmed priorities.',
    head: ['Topic', 'Companies', 'Interactions', 'Change'], rows: res.activity.sort((a, b) => b.cur - a.cur).slice(0, 10).map(a => [a.topic, a.companies, a.cur, a.change.text]) })
  if (sel.unmet) sections.push({ id: 'unmet', title: 'Unmet demand', text: 'Topics where searches returned no results, or few listings are open.',
    head: ['Topic', 'Searches', 'No results', 'Open listings', 'Companies'], rows: res.topics.rows.filter(r => r.zero > 0).sort((a, b) => b.zero - a.zero).slice(0, 8).map(r => [r.topic, r.searches, r.zero, r.supply ?? 'n/a', r.companies]) })
  if (sel.perf) sections.push({ id: 'perf', title: 'Opportunity performance', text: 'Counts of separate actions in the period. A source click is not an application or registration.',
    head: ['Opportunity', 'Category', 'Views', 'Saves', 'Source clicks', 'Companies'], rows: [...res.opps.rows].sort((a, b) => b.views - a.views).slice(0, 10).map(r => [r.title, r.catLabel, r.views, r.saves, r.clicks, r.companies]) })
  if (sel.actions) sections.push({ id: 'actions', title: 'Suggested follow-up actions', text: 'Hypotheses from the data, followed by follow-up items staff have saved. None is a confirmed explanation of member behaviour.',
    head: ['Item', 'Basis', 'Owner / status'], rows: [...res.allFindings.slice(0, 6).map(x => [x.title, `${x.observed} (${x.companies} companies)`, 'Suggested']), ...d.store.items.map(i => [i.title, i.observed || '', `${i.owner || 'Unassigned'} / ${i.status}`])] })
  return {
    title: 'Fyyr staff report',
    meta: [['Period', ctx.range.label], ['Compared with', ctx.range.prevLabel], ['Filters', bits.join(', ')], ['Data source', ctx.source === 'demo' ? 'SIMULATED SAMPLE (not real member activity)' : 'Recorded in one browser (demo session)'], ['Small-group threshold', `Groups with fewer than ${k} companies are hidden`], ['Last event', res.coverage.last ? new Date(res.coverage.last).toLocaleString('en-GB') : 'none'], ['Generated', new Date().toLocaleString('en-GB')]],
    sections, definitions: DEFINITIONS, limits: LIMITS,
    privacy: 'Aggregate figures only. No raw searches, individual activity or company-level behaviour is included.',
  }
}
const mdTable = (head, rows) => ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |', ...rows.map(r => '| ' + r.map(c => String(c).replace(/\|/g, '/')).join(' | ') + ' |')].join('\n')
export const reportMarkdown = m => [
  `# ${m.title}`, '', ...m.meta.map(([a, b]) => `- **${a}:** ${b}`), '',
  ...m.sections.flatMap(s => [`## ${s.title}`, '', s.text, '', s.rows.length ? mdTable(s.head, s.rows) : '_No data for this selection._', '']),
  '## Metric definitions', '', ...m.definitions.map(([a, b]) => `- **${a}:** ${b}`), '', '## Data limitations', '', ...m.limits.map(l => `- ${l}`), '', '## Privacy', '', m.privacy, '',
].join('\n')
const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }

export function Reports({ d }) {
  const [sel, setSel] = useState({ interests: true, unmet: true, perf: true, actions: true })
  const m = reportModel(d, sel)
  const stamp = new Date().toISOString().slice(0, 10)
  const csv = () => download(`fyyr-report-${stamp}.csv`, [toCsv(['Report', m.title], m.meta), ...m.sections.map(s => `\n${toCsv([s.title], [])}\n${toCsv(s.head, s.rows)}`), `\n${toCsv(['Limitations'], m.limits.map(l => [l]))}`].join('\n'), 'text/csv')
  return (
    <div className="mem-page">
      <p className="mem-lead">A filtered summary for sharing. It uses the period and filters selected above, and keeps the metric definitions and data limitations with the numbers. Raw private activity is never exported.</p>
      <fieldset className="mem-checks st-secs"><legend>Include</legend>
        {SECTIONS.map(([id, l]) => <label key={id} className="check"><input type="checkbox" checked={sel[id]} onChange={() => setSel(s => ({ ...s, [id]: !s[id] }))} /> {l}</label>)}
      </fieldset>
      <div className="st-act">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => download(`fyyr-report-${stamp}.md`, reportMarkdown(m), 'text/markdown')}>Download report (.md)</button>
        <button type="button" className="btn btn-glass btn-sm" onClick={csv}>Download tables (.csv)</button>
        <button type="button" className="btn btn-glass btn-sm" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <article className="mem-card st-report" aria-label="Report preview">
        <h2>{m.title}</h2>
        <dl className="st-rmeta">{m.meta.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
        {!d.res.cur && <Empty title="No activity in this selection">Nothing to report for these filters.</Empty>}
        {m.sections.map(s => <section key={s.id}><h3>{s.title}</h3><p className="fine">{s.text}</p>{s.rows.length ? <SimpleTable head={s.head} rows={s.rows} caption={s.title} /> : <p className="fine">No data for this selection.</p>}</section>)}
        <section><h3>Metric definitions</h3><ul className="st-plain">{m.definitions.map(([a, b]) => <li key={a}><b>{a}.</b> {b}</li>)}</ul></section>
        <section><h3>Data limitations</h3><ul className="st-plain">{m.limits.map(l => <li key={l}>{l}</li>)}</ul></section>
        <p className="fine">{m.privacy}</p>
      </article>
    </div>
  )
}

export { STATUSES, fmtDY }
