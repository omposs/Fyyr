import { useMemo, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { Dialog } from '../member/ui.jsx'
import { MCAT, OPP_BY_ID } from '../member/data.js'
import { BarList, Block, DataTable, DemoBadge, LineChart, SimpleTable } from './charts.jsx'
import { DEFINITIONS, LIMITS, companySummary, fmtDY, oppDetail, toCsv } from './metrics.js'
import { PARKS } from '../network/data.js'
import { DIRECTORY_SECTORS, listDirectory } from './directory.js'
import { navigate } from '../auth.js'
import { STATUS_LABEL, parkCatalogue, parkSummary } from './park.js'
import { STATUSES } from './store.js'
import { ParkBadge, parkTone } from '../network/ParkBadge.jsx'
import { CAT_COLOR as CC, topicColor } from './colors.js'
import { CategorySummary, TopicInsights } from './topics.jsx'
import { CAT_COLOR, CatChip, CategoryBars, InBar, OppDetail, PerfChart, TopOpps, useOppFromUrl, vsBefore } from './perf.jsx'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const initialsOf = name => name.replace(/\(.*?\)/g, '').split(/[\s&–-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
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
  const a = res.summary.active
  return (
    <div className="mem-page st-page">
      <section className="st-stats" aria-label="Summary">
        <Stat label="Active companies" value={a.cur} sub={`of ${a.total} · ${a.prev} in ${d.ctx.range.prevLabel}`} />
        <Stat label="Leading interest" value={lead ? lead.topic : 'None yet'} sub={lead ? `${plural(lead.companies, 'company', 'companies')} · ${plural(lead.cur, 'interaction', 'interactions')}` : undefined} />
        <Stat label="Fastest-growing topic" value={fast ? fast.topic : 'None'} sub={fast ? `${fast.prev} → ${fast.cur} companies (+${fast.abs})` : 'No topic gained companies'} />
      </section>

      <div className="ov-two">
        <Block title="Growing interests">
          {grow.length ? <BarList label="Companies active per growing topic" rows={grow.map(r => ({ label: r.topic, value: r.cur, color: topicColor(r.topic), sub: `+${r.abs} vs ${r.prev}` }))} /> : <p className="fine">No topic gained active companies in this period.</p>}
        </Block>

        <Block title="Interest by category">
          <BarList label="Engagement per category" rows={cats.map(c => ({ label: c.label, value: c.engagement, color: CC[c.id], sub: c.change.reliable ? c.change.text : '' }))} />
          {hiddenNote(k, res.catRows.filter(c => c.hidden).length, 'category')}
        </Block>
      </div>

      <Block title="Unmet demand" actions={<a href="/staff/search" className="mem-more" onClick={e => { e.preventDefault(); navigate('/staff/search') }}>Search trends</a>}>
        {unmet.length ? <ul className="st-rows">{unmet.map(r => <li key={r.key}><b>{r.label}</b><span>{plural(r.zero, 'search', 'searches')} with no results · {plural(r.companies, 'company', 'companies')}{r.supply != null && ` · ${plural(r.supply, 'open listing', 'open listings')}`}</span></li>)}</ul> : <p className="fine">No topic had no-result searches from at least {k} companies.</p>}
      </Block>

      <div className="ti-split">
        <section className="mem-card st-block" aria-labelledby="ins-trend">
          <div className="st-block-h"><h2 className="mem-side-h" id="ins-trend">Engagement over time<DemoBadge /></h2></div>
          <LineChart title="Observed engagement by category" labels={res.buckets.labels} series={res.catSeries.filter(c => !res.catRows.find(r => r.id === c.id).hidden)} xLabel={res.buckets.unit === 'day' ? 'Day' : 'Week starting'} yLabel="Interactions (views, saves and source clicks)" height={230} />
        </section>
        <CategorySummary res={res} k={k} />
      </div>

      <TopicInsights res={res} k={k} />
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
        <DataTable caption="Search topics" rows={shown} rowKey={r => r.topic} initial={{ k: 'searches', dir: -1 }} onRow={setOpen} empty="No topic matches this filter."
          cols={[
            { k: 'topic', label: 'Topic', sort: r => r.topic, render: r => <>{r.topic}{r.change.reliable && r.change.abs !== 0 && <small className={'st-chg ' + (r.change.abs > 0 ? 'up' : 'down')}>{r.change.text}</small>}</> },
            { k: 'searches', label: 'Searches', num: true },
            { k: 'companies', label: 'Companies', num: true },
            { k: 'avail', label: 'Results found', num: true, sort: r => (r.searches - r.zero) / r.searches, render: r => <>{r.withResults} of {r.searches}</> },
            { k: 'follow', label: 'Follow-up engagement', num: true, sort: r => (pct(r) ?? -1), render: r => (r.withResults ? <>{r.follow} of {r.withResults} ({pct(r)}%)</> : <span className="fine">No results</span>) },
          ]} />
        {hiddenNote(k, res.topics.hiddenCount, 'topic')}
      </section>
      {open && <TermsPanel r={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------- Opportunity performance ----------------
// The opportunity detail popup is shared by every staff screen (staff/perf.jsx).
const OppPanel = ({ id, d, onClose }) => <OppDetail id={id} d={d} onClose={onClose} />

// ---------------- Blue Science Park analytics (own page: /staff/ours) ----------------
const Tip = ({ text }) => <span className="ov-tipk" tabIndex={0} title={text} aria-label={text}>ⓘ</span>
const TREND = [['views', 'Views'], ['saves', 'Saves'], ['clicks', 'Source clicks']]

// Everything about one opportunity that is not in the table: category, status, source clicks, registrations and its own trend.
const ParkOppPanel = ({ row, d, onClose }) => <OppDetail id={row.id} d={d} onClose={onClose} />

export function OurPerformance({ d }) {
  const { res } = d, k = d.ctx.k, p = res.park
  const [open, setOpen] = useState(null) // an opportunity id
  useOppFromUrl(setOpen)
  const [metric, setMetric] = useState('all')
  const cat = useMemo(() => parkCatalogue(), [d.events, d.ctx, d.synced])
  const parkOfDemo = useMemo(() => new Map(listDirectory().filter(c => c.eventId).map(c => [c.eventId, c.park])), [])
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
  const METRICS = [['all', 'Interactions'], ['views', 'Views'], ['saves', 'Saves'], ['clicks', 'Source clicks']]
  const mName = METRICS.find(t => t[0] === metric)[1]
  const points = metric === 'all' ? p.series : p.seriesBy[metric]
  const maxV = Math.max(1, ...rows.map(r => r.views)), maxS = Math.max(1, ...rows.map(r => r.saves)), maxC = Math.max(1, ...rows.map(r => r.companies))
  return (
    <div className="mem-page st-page st-ours">
      <section className="st-stats" aria-label="Summary">
        <Stat label="Interactions" value={p.engagement} sub={<>{vsBefore(p.engagement, p.prev.engagement)} <Tip text="Interactions are views, saves and source clicks on Blue Science Park opportunities." /></>} />
        <Stat label="Companies reached" value={p.companies} sub={vsBefore(p.companies, p.prev.companies)} />
        <Stat label="Saves" value={p.saves} sub={vsBefore(p.saves, p.prev.saves)} />
        <Stat label="Source clicks" value={p.clicks} sub={<>{vsBefore(p.clicks, p.prev.clicks)} <Tip text="Clicks on source or registration links. Confirmed registrations are not connected, and a click is not a registration." /></>} />
      </section>

      <div className="pf-split">
        <section className="pf-card" aria-labelledby="ours-trend">
          <div className="st-block-h"><h2 id="ours-trend">Activity trend<DemoBadge /></h2>
            <label className="sort">Metric<select className="sel st-mini" value={metric} onChange={e => setMetric(e.target.value)}>{METRICS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></label></div>
          <p className="fine">{res.range.label}, compared with {res.range.prevLabel}.</p>
          <PerfChart title={`Blue Science Park ${mName.toLowerCase()}`} labels={p.labels} points={points} name={mName} xLabel={unit} height={250} />
        </section>
        <section className="pf-card" aria-labelledby="ours-top">
          <div className="st-block-h"><h2 id="ours-top">Top-performing opportunities<DemoBadge /></h2></div>
          <p className="fine">Ranked by interactions, {res.range.label}.</p>
          <TopOpps rows={rows} onOpen={r => setOpen(r.id)} />
        </section>
      </div>

      <section className="pf-card" aria-labelledby="ours-res">
        <div className="st-block-h"><h2 id="ours-res">Opportunity results<DemoBadge /> <Tip text={`Companies reached is distinct companies. Hidden means fewer than ${k} companies engaged. Zero means no engagement was recorded.`} /></h2></div>
        <DataTable caption="Blue Science Park opportunities" rows={rows} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} onRow={r => setOpen(r.id)} empty="No published Blue Science Park opportunity yet."
          cols={[
            { k: 'title', label: 'Opportunity', sort: r => r.title, render: r => <>{r.title}{r.demo && <span className="pill nw-demo st-pill">Demo</span>}</> },
            { k: 'catLabel', label: 'Category', sort: r => r.catLabel || '', render: r => <CatChip id={r.mcat} /> },
            { k: 'views', label: 'Views', num: true, sort: r => (r.hidden ? -1 : r.views), render: r => (r.hidden ? <span className="fine" title="Fewer companies engaged than the minimum group size">Hidden</span> : <InBar value={r.views} max={maxV} color={CC[r.mcat || r.cat] || "#5468ff"} />) },
            { k: 'saves', label: 'Saves', num: true, sort: r => (r.hidden ? -1 : r.saves), render: r => (r.hidden ? <span className="fine">Hidden</span> : <InBar value={r.saves} max={maxS} color={CC[r.mcat || r.cat] || "#0e9f8e"} />) },
            { k: 'companies', label: 'Companies reached', num: true, sort: r => (r.hidden ? -1 : r.companies), render: r => (r.hidden ? <span className="fine">Hidden</span> : <InBar value={r.companies} max={maxC} color={CC[r.mcat || r.cat] || "#7a5af8"} />) },
          ]} />
      </section>

      <p className="fine pf-note">Views count openings, saves count bookmarks, and source clicks count visits to the original link. A source click is not a registration or an application.</p>

      <section className="pf-card" aria-labelledby="ours-cat">
        <div className="st-block-h"><h2 id="ours-cat">Category breakdown<DemoBadge /></h2></div>
        <DataTable caption="Performance by category" rows={catRows} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} tableClass="pf-tbl"
          cols={[
            { k: 'label', label: 'Category', sort: r => r.label, render: r => <CatChip id={r.id} /> },
            { k: 'published', label: 'Published opportunities', num: true },
            { k: 'views', label: 'Views', num: true, render: r => <InBar value={r.views} max={Math.max(1, ...catRows.map(x => x.views))} color={CAT_COLOR[r.id]}>{r.views.toLocaleString('en-GB')}</InBar> },
            { k: 'saves', label: 'Saves', num: true },
            { k: 'clicks', label: 'Source clicks', num: true },
            { k: 'companies', label: 'Companies reached', num: true },
          ]} />
        <p className="fine">Companies reached counts distinct companies within each category. A company active in several categories is counted in each, so the column cannot be summed.</p>
      </section>

      <section className="pf-card" aria-labelledby="ours-co">
        <div className="st-block-h"><h2 id="ours-co">Company activity<DemoBadge /> <span className="pill nw-demo st-pill">Simulated activity</span></h2></div>
        <DataTable caption="Engagement by member company" rows={named.map(c => ({ ...c, name: sharedNames.get(c.id), park: parkOfDemo.get(c.id) }))} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} tableClass="pf-tbl"
          empty="No company that shares its activity was active in this selection."
          cols={[
            { k: 'name', label: 'Company', sort: r => r.name, render: r => <span className="pf-co"><span className="co-av park-v" data-tone={parkTone(r.park)} aria-hidden="true">{initialsOf(r.name)}</span><span className="pf-co-n">{r.name}</span>{r.park && <ParkBadge id={r.park} />}</span> },
            { k: 'views', label: 'Views', num: true, render: r => <InBar value={r.views} max={Math.max(1, ...named.map(x => x.views))} color="#5468ff" /> },
            { k: 'saves', label: 'Saves', num: true },
            { k: 'clicks', label: 'Source clicks', num: true },
          ]}
          foot={other.length ? <tr><th scope="row">{plural(other.length, 'other company', 'other companies')} (not named)</th><td className="st-n">{tot.views}</td><td className="st-n">{tot.saves}</td><td className="st-n">{tot.clicks}</td></tr> : null} />
        <p className="fine">Only companies that agreed to share their activity are named (simulated consent). Member-created events are not included.</p>
      </section>
      {open && <OppDetail id={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function Performance({ d }) {
  const { res } = d, k = d.ctx.k
  const [open, setOpen] = useState(null)
  useOppFromUrl(setOpen)
  const g = guard(d); if (g) return <div className="mem-page st-page">{g}</div>
  const rows = res.opps.rows
  const top = key => [...rows].sort((a, b) => b[key] - a[key])[0]
  const mv = top('views'), ms = top('saves')
  const maxV = Math.max(1, ...rows.map(r => r.views)), maxS = Math.max(1, ...rows.map(r => r.saves)), maxC = Math.max(1, ...rows.map(r => r.clicks)), maxP = Math.max(1, ...rows.map(r => r.companies))
  return (
    <div className="mem-page st-page">
      <div className="pf-perf-top">
        <div className="pf-sum" aria-label="Summary">
          <div className="pf-sumcard"><small>Most viewed</small>{mv && mv.views > 0 ? <><p>{mv.title}</p><span><CatChip id={mv.cat} /> · {mv.views} views</span></> : <span>No views in this selection</span>}</div>
          <div className="pf-sumcard"><small>Most saved</small>{ms && ms.saves > 0 ? <><p>{ms.title}</p><span><CatChip id={ms.cat} /> · {ms.saves} saves</span></> : <span>No saves in this selection</span>}</div>
          <div className="pf-sumcard"><small>Companies reached</small>{res.opps.reached != null ? <><b>{res.opps.reached}</b><span>distinct, across {plural(rows.length, 'opportunity', 'opportunities')}</span></> : <span>Hidden: fewer than {k} companies</span>}</div>
        </div>
        <section className="pf-card" aria-labelledby="perf-cat">
          <div className="st-block-h"><h2 id="perf-cat">Interactions by category<DemoBadge /></h2></div>
          {res.opps.byCat.length ? <CategoryBars rows={res.opps.byCat} /> : <p className="fine st-empty">Nothing to compare for these filters.</p>}
          <p className="fine">Interactions are views, saves and source clicks.</p>
        </section>
      </div>
      <section className="mem-card st-block" aria-label="Opportunity performance">
        <DataTable caption="Opportunity performance" rows={rows} rowKey={r => r.id} initial={{ k: 'views', dir: -1 }} onRow={r => setOpen(r.id)}
          empty="No opportunity reached the minimum number of companies."
          cols={[
            { k: 'title', label: 'Opportunity', sort: r => r.title, render: r => <>{r.title}{r.demoListing && <span className="pill nw-demo st-pill">Demo</span>}</> },
            { k: 'catLabel', label: 'Category', sort: r => r.catLabel || '', render: r => <CatChip id={r.cat} /> },
            { k: 'views', label: 'Views', num: true, render: r => <InBar value={r.views} max={maxV} color={CC[r.mcat || r.cat] || "#5468ff"} /> },
            { k: 'saves', label: 'Saves', num: true, render: r => <InBar value={r.saves} max={maxS} color={CC[r.mcat || r.cat] || "#0e9f8e"} /> },
            { k: 'clicks', label: 'Source clicks', num: true, render: r => <InBar value={r.clicks} max={maxC} color={CC[r.mcat || r.cat] || "#d97706"} /> },
            { k: 'companies', label: 'Companies', num: true, render: r => <InBar value={r.companies} max={maxP} color={CC[r.mcat || r.cat] || "#7a5af8"} /> },
          ]} />
        {hiddenNote(k, res.opps.hiddenCount, 'opportunity')}
        <p className="fine">A source click is not a registration or an application.</p>
      </section>
      {open && <OppDetail id={open} d={d} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------- Companies ----------------
const fmtLast = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function CompanyPanel({ c, d, last, onClose }) {
  const sum = useMemo(() => (c.simulated && c.share ? companySummary(d.events, c.eventId, d.ctx.range) : null), [c, d.events, d.ctx.range])
  return (
    <Dialog label={c.name} onClose={onClose} side>
      <p className="opp-top"><ParkBadge id={c.park} /><span className="pill pill-blue">{c.status}</span>{c.simulated && <span className="pill nw-demo">Simulated activity</span>}</p>
      <h2 className="auth-h det-h">{c.name}</h2>
      <p>{c.summary}</p>
      <dl className="det">
        <div className="det-f"><dt>Science park</dt><dd>{`${c.relation} · ${c.parkName}`}{c.checked && <small className="st-sub">Checked against the park’s own pages on {fmtDY(new Date(c.checked + 'T12:00:00').getTime())}. Real company name and description.</small>}</dd></div>
        <div className="det-f"><dt>{c.simulated ? 'Sector grouping (simulated)' : 'Sector'}</dt><dd>{c.sector}</dd></div>
        <div className="det-f"><dt>{c.simulated ? 'Interests (simulated)' : 'Interests'}</dt><dd>{c.interests.length ? <span className="mem-chips">{c.interests.map(i => <span key={i} className="pill pill-blue">{i}</span>)}</span> : 'Not specified'}</dd></div>
        {c.website && <div className="det-f"><dt>Website</dt><dd><a href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, '')}</a>{c.evidence && <> · <a href={c.evidence} target="_blank" rel="noopener noreferrer">affiliation evidence</a></>}</dd></div>}
        <div className="det-f"><dt>Engagement summary</dt><dd>
          {!c.simulated ? 'Not shown. This is a real organisation and no activity has been observed for it.'
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
  const lastOf = c => (c.simulated && c.share && d.ctx.source === 'demo' ? lastBy.get(c.eventId) || null : null)
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
      <section className="mem-card st-block st-co" aria-label="Companies">
        <DataTable caption="Companies" rows={rows} rowKey={r => r.id} initial={{ k: 'name', dir: 1 }} onRow={setOpen} empty="No company matches these filters."
          cols={[
            { k: 'name', label: 'Company', sort: r => r.name, render: r => <span className="co-nm"><span className="co-av park-v" data-tone={parkTone(r.park)} aria-hidden="true">{r.name.replace(/\(.*?\)/g, '').split(/[\s&–-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span><span>{r.name}{r.simulated && <span className="pill nw-demo st-pill" title="Real company. Its interests and activity are simulated.">Simulated</span>}</span></span> },
            { k: 'parkName', label: 'Science park', sort: r => r.parkName, render: r => <ParkBadge id={r.park} /> },
            { k: 'sector', label: 'Sector', sort: r => r.sector, render: r => <span className="co-tag">{r.sector}</span> },
            { k: 'interests', label: 'Top interests', render: r => (r.interests.length ? <span className="co-tags">{r.interests.slice(0, 2).map(i => <span key={i} className="co-tag int">{i}</span>)}{r.interests.length > 2 && <span className="co-tag more" title={r.interests.slice(2).join(', ')}>+{r.interests.length - 2}</span>}</span> : <span className="fine">Not specified</span>) },
            { k: 'status', label: 'Profile status', sort: r => r.status, render: r => <span className="co-status">{r.status}</span> },
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
