import { useEffect, useId, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { getSession } from '../auth.js'
import { Dialog } from '../member/ui.jsx'
import { ALL_TOPICS, BSP_CONTACT, COMPANIES, CONNECTIONS, CO, PARKS, SCOPE_LABEL, SOURCE_LABEL, STATUSES, SUGGESTIONS, TYPE_LABEL, evidenceOf, fmtD, isReviewed, parkCounts, reviewIssues, routesOf, scopeOf, stale, suggestionStatus, unique, verifyNote } from './data.js'
import { useSaved } from './store.js'
import { ParkBadge, parkTone } from './ParkBadge.jsx'
import '../events/events.css'
import './network.css'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const GROUPS = [['capabilities', 'Publicly stated capabilities'], ['markets', 'Application areas and markets'], ['projects', 'Public projects and research'], ['needs', 'Stated partnership interests or needs']]
const AFF = {
  confirmed: ['aff-ok', 'Affiliation confirmed'],
  unconfirmed: ['aff-warn', 'Affiliation not confirmed'],
  conflicting: ['aff-bad', 'Conflicting affiliation information'],
  demo: ['aff-demo', 'Demo'],
}

// ---------- evidence bits ----------
function Src({ fact }) {
  return (
    <span className="nw-src">
      {fact.via === 'demo' ? null : fact.u ? <a href={fact.u} target="_blank" rel="noopener noreferrer">Source<Icon n="ext" size={12} /></a> : <span>No source URL identified</span>}
      <span className={'nw-via via-' + fact.via}>{SOURCE_LABEL[fact.via]}</span>
      {fact.via !== 'demo' && <span>{fmtD(fact.d)}</span>}
      {fact.via !== 'demo' && stale(fact.d) && <span className="pill nw-stale">May be out of date</span>}
    </span>
  )
}
function Facts({ facts, empty }) {
  if (!facts.length) return <p className="nw-unk">{empty}</p>
  return (
    <ul className="nw-facts">{facts.map((x, i) => (
      <li key={i}><span>{x.t}</span>{x.q && <q className="nw-q">{x.q}</q>}<Src fact={x} /></li>
    ))}</ul>
  )
}
// Only a confirmed affiliation is shown as a relationship. Anything else is shown as unconfirmed, never as fact.
const affText = c => (c.affiliation.status === 'confirmed' ? `${c.affiliation.relation} · ${PARKS[c.park].name}` : c.affiliation.status === 'demo' ? `Fictional demo · placed in ${PARKS[c.park].name}` : `${PARKS[c.park].name} not confirmed`)
const relOf = c => (c.affiliation.status === 'confirmed' ? c.affiliation.relation : c.affiliation.status === 'demo' ? 'Fictional demo' : 'Affiliation not confirmed')
const ParkOf = ({ c }) => <span className="nw-co-line"><ParkBadge id={c.park} confirmed={['confirmed', 'demo'].includes(c.affiliation.status)} /><small>{relOf(c)}</small></span>
const AffBadge = ({ c }) => { const [cls, l] = AFF[c.affiliation.status]; return <span className={'nw-aff ' + cls}>{c.affiliation.status === 'confirmed' ? c.affiliation.relation : l}</span> }
const Initials = ({ name, cls = '' }) => <span className={'nw-mark ' + cls} aria-hidden="true">{name.replace(/\(.*?\)/g, '').split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>
// Official logos are not stored (none was verified for reuse), so every park shows the same initials mark.
const ParkMark = ({ p }) => (p.logo ? <img className="nw-mark" src={p.logo} alt="" /> : <span className="nw-mark" data-tone={parkTone(p.id)} aria-hidden="true">{p.short}</span>)

// ---------- company profile column (inside the details panel) ----------
function Profile({ c }) {
  const a = c.affiliation
  return (
    <section className="nw-prof" aria-label={c.name}>
      <h4 className="nw-cn">{c.name}</h4>
      <p className="nw-park"><ParkOf c={c} /></p>
      <p>{c.summary}</p>
      {c.website ? <p className="fine"><a href={c.website} target="_blank" rel="noopener noreferrer">Official website<Icon n="ext" size={12} /></a></p> : <p className="fine">No website: this company is fictional.</p>}
      <div className="nw-affbox">
        <AffBadge c={c} />
        <p className="fine">{a.note}</p>
        {a.u && <p className="fine"><a href={a.u} target="_blank" rel="noopener noreferrer">Evidence</a> · read {fmtD(a.d)}</p>}
      </div>
      <details className="nw-full">
        <summary>Full public profile</summary>
        {GROUPS.map(([k, l]) => (
          <div key={k}><h5 className="nw-h4">{l}</h5><Facts facts={c[k]} empty={k === 'needs' ? (c.needsNote || 'None stated in the pages reviewed.') : 'None found in the pages reviewed.'} /></div>
        ))}
      </details>
    </section>
  )
}

// ---------- details panel: comparison, usefulness, verification, sources, follow-up ----------
export function CompareDialog({ s, onClose, store }) {
  const a = CO[s.a], b = CO[s.b]
  const ev = evidenceOf(s)
  const saved = store.saved[s.id]
  const issues = reviewIssues(s)
  const uid = useId()
  return (
    <Dialog label={`Details: ${a.name} and ${b.name}`} onClose={onClose} xwide>
      <h2 className="auth-h det-h">{a.name} <span aria-hidden="true">↔</span><span className="sr"> and </span> {b.name}</h2>
      <p className="nw-meta"><span className={'nw-label type-' + s.type}>{TYPE_LABEL[s.type]}</span> <span>{SCOPE_LABEL[scopeOf(s)]}</span> <span className="nw-status">{suggestionStatus(s)}{s.isDemo ? ' · involves a fictional company' : ' · not confirmed by either company'}</span></p>

      <section className="nw-sec" aria-labelledby={uid + '1'}>
        <h3 className="nw-h3" id={uid + '1'}>1. Company comparison</h3>
        <div className="nw-two"><Profile c={a} /><Profile c={b} /></div>
      </section>

      <section className="nw-sec" aria-labelledby={uid + '2'}>
        <h3 className="nw-h3" id={uid + '2'}>2. Why the connection may be useful</h3>
        <p><b>Proposed collaboration.</b> {s.propose}</p>
        <p>{s.idea || s.why}</p>
        {s.value && <p className="fine">{s.value}</p>}
      </section>

      <section className="nw-sec" aria-labelledby={uid + '3'}>
        <h3 className="nw-h3" id={uid + '3'}>3. What needs verification</h3>
        {issues.length > 0 && <div className="nw-unc"><b>Affiliation is not settled</b><ul className="nw-gaps">{issues.map(x => <li key={x}>{x}</li>)}</ul><p className="fine">This suggestion is kept out of the default lists until staff review it.</p></div>}
        <ul className="nw-gaps">{s.gaps.map(g => <li key={g}>{g}</li>)}</ul>
      </section>

      <section className="nw-sec" aria-labelledby={uid + '4'}>
        <h3 className="nw-h3" id={uid + '4'}>4. Sources</h3>
        <ol className="nw-ev">{ev.map((e, i) => (
          <li key={i}><b>{e.company.name}</b>: {e.fact.t}{e.fact.q && <q className="nw-q">{e.fact.q}</q>}<Src fact={e.fact} /></li>
        ))}</ol>
        <p className="fine">Affiliation evidence is linked under each company above. The suggestion is a reasoned inference from these facts, not a documented relationship.{s.isDemo && ' Facts marked as fictional demo content have no source.'}</p>
      </section>

      <section className="nw-sec" aria-labelledby={uid + '5'}>
        <h3 className="nw-h3" id={uid + '5'}>5. Follow-up actions</h3>
        <p><b>Suggested next step.</b> {s.next}</p>
        <Contacts a={a} b={b} />
        {saved ? <SavedControls id={s.id} saved={saved} store={store} /> : <div><button type="button" className="btn btn-primary btn-sm" onClick={() => store.save(s.id, getSession()?.email)}><Icon n="bookmark" size={15} />Save for follow-up</button></div>}
        <p className="notice">Nobody is contacted from Fyyr, and neither company has agreed to anything.{s.isDemo && ' Demo suggestions never lead to contact or invitations.'}</p>
      </section>
      <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button></div>
    </Dialog>
  )
}

// Public routes we have read, and authorised member contacts (none are connected in this prototype). Fyyr never sends anything.
export function Contacts({ a, b }) {
  return (
    <div className="nw-contacts">
      {[a, b].map(c => {
        const r = routesOf(c.id)
        return (
          <div key={c.id}><b>{c.name}</b>
            {c.isDemo ? <p className="fine">Fictional demo company: there is no contact route, and nothing can be sent to it.</p> : r.length ? <ul>{r.map(x => <li key={x.u}><a href={x.u} target="_blank" rel="noopener noreferrer">{x.label}<Icon n="ext" size={12} /></a> <span className="fine">Read {fmtD(x.d)}. {x.note}</span></li>)}</ul>
              : <p className="fine">No contact page was read. Use <a href={c.website} target="_blank" rel="noopener noreferrer">the official website</a>{c.park === 'bsp' ? ', or the existing member relationship' : ''}.</p>}
          </div>
        )
      })}
      <p className="fine">Authorised member contacts: none are connected in this prototype. For Blue Science Park members, staff would use the existing relationship; <a href={BSP_CONTACT.u} target="_blank" rel="noopener noreferrer">{BSP_CONTACT.label}</a>.</p>
    </div>
  )
}

// ---------- compact save action (shared with the overview) ----------
export function SaveBtn({ s, store, name }) {
  const saved = store.saved[s.id]
  return (
    <button type="button" className={'nw-save' + (saved ? ' on' : '')} aria-pressed={!!saved} disabled={!!saved}
      aria-label={saved ? `${name}: saved for follow-up (${saved.status})` : `Save for follow-up: ${name}`} title={saved ? `Saved · ${saved.status}` : 'Save for follow-up'}
      onClick={() => store.save(s.id, getSession()?.email)}><Icon n={saved ? 'check' : 'bookmark'} size={17} /></button>
  )
}

// ---------- one compact suggestion card ----------
function Card({ s, store, onOpen }) {
  const a = CO[s.a], b = CO[s.b]
  const saved = store.saved[s.id]
  const vn = verifyNote(s)
  const name = `${a.name} and ${b.name}`
  const brings = (s.parts || '').split(/(?<=\.)\s+/).filter(Boolean)
  const tags = (s.topics || []).slice(0, 3)
  return (
    <li className={'nw-card nw-conn' + (saved?.status === 'Dismissed' ? ' dim' : '')}>
      <div className="nw-top">
        <span className={'nw-label type-' + s.type}>{TYPE_LABEL[s.type]}</span>
        {s.isDemo ? <span className="pill nw-demo">Demo</span> : vn.length > 0 && <span className="nw-verify">Needs verification</span>}
        {saved && <span className="nw-status">Saved: {saved.status}</span>}
      </div>
      <h3 className="nw-names">
        <span><b>{a.name}</b><ParkOf c={a} /></span>
        <span className="nw-x" aria-hidden="true">↔</span><span className="sr"> and </span>
        <span><b>{b.name}</b><ParkOf c={b} /></span>
      </h3>
      {s.theme && <p className="nw-theme">{s.theme}</p>}
      <p className="nw-expl">{s.why || s.explore}</p>
      <dl className="nw-det">
        {brings.length > 0 && <div><dt>Each brings</dt><dd>{brings.map(x => <span key={x}>{x}</span>)}</dd></div>}
        {s.propose && <div><dt>Potential collaboration</dt><dd>{s.propose}</dd></div>}
        {tags.length > 0 && <div><dt>Shared focus</dt><dd className="nw-tags">{tags.map(t => <span key={t} className="pill">{t}</span>)}</dd></div>}
      </dl>
      <div className="nw-act">
        <button type="button" className="btn btn-glass btn-sm" onClick={() => onOpen(s)}>Explore connection<span className="sr">: {name}</span></button>
        <SaveBtn s={s} store={store} name={name} />
      </div>
    </li>
  )
}

function SavedControls({ id, saved, store }) {
  const uid = useId()
  return (
    <div className="nw-saved">
      <div className="mem-grid2">
        <div className="auth-fld"><label htmlFor={uid + 's'}>Status</label><select id={uid + 's'} value={saved.status} onChange={e => store.update(id, { status: e.target.value })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="auth-fld"><label htmlFor={uid + 'n'}>Internal note</label><textarea id={uid + 'n'} rows={2} maxLength={500} value={saved.note} placeholder="Visible to staff only" onChange={e => store.update(id, { note: e.target.value })} /></div>
      </div>
      <p className="fine">Saved {new Date(saved.savedAt).toLocaleDateString('en-GB')}{saved.by ? ` by ${saved.by}` : ''}. Internal only; the companies are not contacted.</p>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => store.remove(id)}>Remove from saved</button>
    </div>
  )
}

// ---------- sample coverage ----------
function Coverage() {
  return (
    <div className="notice nw-cov">
      <b>Sample coverage, not a complete network.</b> Company profiles in this demo, per ecosystem:
      <ul className="nw-covl">{Object.values(PARKS).map(p => { const n = parkCounts(p.id); return <li key={p.id}><b>{p.name}</b> {n.verified} verified{n.review > 0 && <span className="fine"> (+{n.review} awaiting review)</span>}{n.demo > 0 && <span className="fine"> · {n.demo} fictional demo</span>}</li> })}</ul>
      <span className="fine">Verified profiles were collected by hand from public pages on 13–14 Nov 2026. Fictional demo profiles are labelled and never count as members. None of these numbers is a park’s membership. Linköping Science Park’s own site refused access, so none of its real companies could be verified yet.</span>
    </div>
  )
}

// ---------- tab: partner discovery ----------
function Discover({ store, openId, clearOpen }) {
  const reviewed = SUGGESTIONS.filter(isReviewed)
  const held = SUGGESTIONS.filter(s => !isReviewed(s))
  const [f, setF] = useState({ scope: 'all', co: 'all', park: 'all', topic: 'all', type: 'all' })
  const [open, setOpen] = useState(openId ? SUGGESTIONS.find(x => x.id === openId) || null : null)
  useEffect(() => { if (openId) clearOpen() }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => setF(x => ({ ...x, ...patch }))
  const bsp = unique(reviewed.flatMap(s => [s.a, s.b]).filter(id => CO[id].park === 'bsp')).sort((x, y) => CO[x].name.localeCompare(CO[y].name))
  const parks = Object.keys(PARKS).filter(id => id !== 'bsp' && reviewed.some(s => CO[s.a].park === id || CO[s.b].park === id))
  const shown = reviewed.filter(s => (f.scope === 'all' || scopeOf(s) === f.scope) && (f.co === 'all' || s.a === f.co || s.b === f.co) && (f.park === 'all' || CO[s.a].park === f.park || CO[s.b].park === f.park) && (f.topic === 'all' || s.topics.includes(f.topic)) && (f.type === 'all' || s.type === f.type))
  const dirty = Object.values(f).some(v => v !== 'all')
  const reset = () => setF({ scope: 'all', co: 'all', park: 'all', topic: 'all', type: 'all' })
  return (
    <div className="nw-stack">
      <div className="eseg nw-scope" role="group" aria-label="Connection type">
        {[['all', 'All connections'], ['internal', SCOPE_LABEL.internal], ['external', SCOPE_LABEL.external]].map(([id, l]) => <button key={id} type="button" aria-pressed={f.scope === id} onClick={() => set({ scope: id, park: id === 'internal' ? 'all' : f.park })}>{l}</button>)}
      </div>
      <section className="nw-ctl" aria-label="Filters">
        <div className="auth-fld ev-fld"><label htmlFor="nw-co">Blue Science Park company</label>
          <select id="nw-co" value={f.co} onChange={e => set({ co: e.target.value })}><option value="all">Any</option>{bsp.map(id => <option key={id} value={id}>{CO[id].name}</option>)}</select></div>
        <div className="auth-fld ev-fld"><label htmlFor="nw-pk">External park</label>
          <select id="nw-pk" value={f.park} disabled={f.scope === 'internal'} onChange={e => set({ park: e.target.value })}><option value="all">Any</option>{parks.map(id => <option key={id} value={id}>{PARKS[id].name}</option>)}</select></div>
        <div className="auth-fld ev-fld"><label htmlFor="nw-ft">Topic</label>
          <select id="nw-ft" value={f.topic} onChange={e => set({ topic: e.target.value })}><option value="all">Any</option>{ALL_TOPICS.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="auth-fld ev-fld"><label htmlFor="nw-fy">Label</label>
          <select id="nw-fy" value={f.type} onChange={e => set({ type: e.target.value })}><option value="all">All</option><option value="shared">{TYPE_LABEL.shared}</option><option value="complementary">{TYPE_LABEL.complementary}</option></select></div>
      </section>

      <section aria-labelledby="nw-pot-h">
        <h2 className="mem-sec" id="nw-pot-h">Suggested connections</h2>
        <p className="mem-result" role="status">{plural(shown.length, 'suggestion', 'suggestions')}{dirty && ` of ${reviewed.length} after filters`}.</p>
        {dirty && <button type="button" className="link-btn" onClick={reset}>Reset filters</button>}
        {CONNECTIONS.length > 0 && <ul className="nw-docs">{CONNECTIONS.map(x => <li key={x.a + x.b}><b>{CO[x.a].name} and {CO[x.b].name}</b>: {x.kind}. {x.t} <a href={x.u} target="_blank" rel="noopener noreferrer">Source</a> · {fmtD(x.d)}</li>)}</ul>}
        {shown.length ? <ul className="nw-list nw-conn-list">{shown.map(s => <Card key={s.id} s={s} store={store} onOpen={setOpen} />)}</ul>
          : <div className="mem-empty"><strong>No supported suggestion{dirty ? ' with these filters' : ''}</strong><p>{dirty ? 'Try removing a filter.' : 'The reviewed pages give no practical reason to connect these companies. The sample is small.'}</p></div>}
      </section>

      {(held.length > 0 || COMPANIES.some(c => !['confirmed', 'demo'].includes(c.affiliation.status))) && (
        <details className="nw-review">
          <summary>Staff review: unresolved records ({COMPANIES.filter(c => !['confirmed', 'demo'].includes(c.affiliation.status)).length} companies, {held.length} suggestions)</summary>
          <p className="fine">These are kept out of the lists above and the overview until the park affiliation is confirmed from an official directory or the company’s own site.</p>
          <ul className="nw-rv">{COMPANIES.filter(c => !['confirmed', 'demo'].includes(c.affiliation.status)).map(c => (
            <li key={c.id}><b>{c.name}</b> <AffBadge c={c} /> <span className="fine">{PARKS[c.park].name}: {c.affiliation.note} <a href={c.affiliation.u} target="_blank" rel="noopener noreferrer">Evidence</a></span></li>
          ))}</ul>
          {held.length > 0 && <ul className="nw-rv">{held.map(s => <li key={s.id}>{CO[s.a].name} ↔ {CO[s.b].name} <button type="button" className="link-btn" onClick={() => setOpen(s)}>View details<span className="sr">: {CO[s.a].name} and {CO[s.b].name}</span></button></li>)}</ul>}
        </details>
      )}
      {open && <CompareDialog s={open} store={store} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------- tab: science park directory ----------
function ParksTab({ onCompanies, onCompare }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const list = Object.values(PARKS).filter(p => !needle || [p.name, p.city, p.region, p.blurb, ...(p.focusTags || [])].join(' ').toLowerCase().includes(needle))
  return (
    <div className="nw-stack">
      <p className="notice nw-cov"><b>Not a partner list.</b> These organisations are listed from public pages. None is a confirmed Fyyr partner, and they do not all work the same way: each one relates to its companies differently, as described on its card.</p>
      <div className="auth-fld ev-fld nw-find"><label htmlFor="nw-pq">Search science parks</label><input id="nw-pq" type="search" value={q} placeholder="Name, city or focus area" onChange={e => setQ(e.target.value)} /></div>
      <p className="mem-result" role="status">{plural(list.length, 'organisation', 'organisations')}{needle && ' match'}</p>
      {list.length ? (
        <ul className="nw-list">{list.map(p => {
          const n = parkCounts(p.id)
          return (
            <li key={p.id} className="nw-card nw-park-card">
              <div className="nw-park-h"><ParkMark p={p} /><div><h3 className="nw-pn">{p.name}</h3><p className="fine">{p.city}{p.region && ' · ' + p.region}{p.legal && p.legal !== p.name && ' · ' + p.legal}</p></div></div>
              <p className="nw-expl">{p.blurb}</p>
              <div><div className="chips-row nw-chips">{(p.focusTags || []).map(t => <span key={t} className="pill">{t}</span>)}</div>{p.focusSource && <p className="fine">{p.focusSource}.</p>}</div>
              <p className="fine"><b>How companies relate:</b> {p.model}</p>
              <p className="fine"><a href={p.website} target="_blank" rel="noopener noreferrer">{p.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}<Icon n="ext" size={12} /></a> · official website</p>
              <p className="nw-counts"><b>{n.verified}</b> verified {n.verified === 1 ? 'profile' : 'profiles'}{n.review > 0 && <> · {n.review} awaiting review</>}{n.demo > 0 && <> · {n.demo} fictional demo</>} <span className="fine">in this demo, not the park’s membership</span></p>
              <div className="nw-act">
                <button type="button" className="btn btn-glass btn-sm" onClick={() => onCompanies(p.id)}>View companies<span className="sr">: {p.name}</span></button>
                <button type="button" className="btn btn-glass btn-sm" onClick={() => onCompare(p.id)}>Compare<span className="sr">: {p.name}</span></button>
              </div>
            </li>
          )
        })}</ul>
      ) : <div className="mem-empty"><strong>No match</strong><p>Try another name, city or focus area.</p></div>}
    </div>
  )
}

// ---------- tab: company directory ----------
function CompanyDialog({ c, onClose, onSuggestion }) {
  const rel = SUGGESTIONS.filter(s => isReviewed(s) && (s.a === c.id || s.b === c.id))
  return (
    <Dialog label={c.name} onClose={onClose} wide>
      <Profile c={c} />
      <section className="nw-sec">
        <h3 className="nw-h3">Suggested connections</h3>
        {rel.length ? <ul className="nw-rv">{rel.map(s => <li key={s.id}>{CO[s.a].name} ↔ {CO[s.b].name} <span className="fine">{suggestionStatus(s)}</span> <button type="button" className="link-btn" onClick={() => { onClose(); onSuggestion(s) }}>View details</button></li>)}</ul> : <p className="fine">None yet in this sample.</p>}
      </section>
      <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button></div>
    </Dialog>
  )
}

function CompaniesTab({ park, setPark, onSuggestion }) {
  const [q, setQ] = useState('')
  const [show, setShow] = useState('all')
  const [open, setOpen] = useState(null)
  const needle = q.trim().toLowerCase()
  const kind = c => (c.isDemo ? 'demo' : c.affiliation.status === 'confirmed' ? 'verified' : 'review')
  const list = COMPANIES.filter(c => (park === 'all' || c.park === park) && (show === 'all' || kind(c) === show) && (!needle || [c.name, c.summary, ...c.industry, ...c.tech, PARKS[c.park].name].join(' ').toLowerCase().includes(needle)))
  const groups = [['verified', 'Verified affiliation', 'Each has evidence for its relationship to the park.'], ['review', 'Awaiting review', 'The park affiliation is not confirmed, so these stay out of suggestions.'], ['demo', 'Fictional demo companies', 'Invented for this demo. Not members of any park, and never contacted.']]
  return (
    <div className="nw-stack">
      <section className="nw-ctl" aria-label="Company filters">
        <div className="auth-fld ev-fld"><label htmlFor="nc-q">Search companies</label><input id="nc-q" type="search" value={q} placeholder="Name, industry or technology" onChange={e => setQ(e.target.value)} /></div>
        <div className="auth-fld ev-fld"><label htmlFor="nc-p">Science park</label><select id="nc-p" value={park} onChange={e => setPark(e.target.value)}><option value="all">All ecosystems</option>{Object.values(PARKS).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="auth-fld ev-fld"><label htmlFor="nc-s">Show</label><select id="nc-s" value={show} onChange={e => setShow(e.target.value)}><option value="all">All profiles</option><option value="verified">Verified only</option><option value="review">Awaiting review</option><option value="demo">Fictional demo only</option></select></div>
      </section>
      <Coverage />
      <p className="mem-result" role="status">{plural(list.length, 'company profile', 'company profiles')}{park !== 'all' && <> in {PARKS[park].name}</>}</p>
      {groups.map(([k, title, hint]) => { const items = list.filter(c => kind(c) === k); return items.length > 0 && (
        <section key={k} aria-labelledby={'ncg-' + k}>
          <h2 className="mem-sec" id={'ncg-' + k}>{title} <span className="fine">({items.length})</span></h2>
          <p className="fine">{hint}</p>
          <ul className="nw-list">{items.map(c => (
            <li key={c.id} className="nw-card nw-co-card">
              <div className="nw-park-h"><Initials name={c.name} cls={c.isDemo ? 'demo' : ''} /><div><h3 className="nw-pn">{c.name}</h3><p className="fine">{affText(c)}</p></div>{c.isDemo && <span className="pill nw-demo">Demo</span>}</div>
              <p className="nw-expl">{c.summary}</p>
              <div className="chips-row nw-chips">{[...c.industry, ...c.tech].slice(0, 6).map(t => <span key={t} className="pill">{t}</span>)}</div>
              <div className="nw-act"><button type="button" className="btn btn-glass btn-sm" onClick={() => setOpen(c)}>View profile<span className="sr">: {c.name}</span></button>{c.website && <a className="btn btn-quiet btn-sm" href={c.website} target="_blank" rel="noopener noreferrer">Website<Icon n="ext" size={13} /><span className="sr"> of {c.name}</span></a>}</div>
            </li>))}</ul>
        </section>) })}
      {!list.length && <div className="mem-empty"><strong>No company matches</strong><p>Try another search, or show all ecosystems.</p></div>}
      {open && <CompanyDialog c={open} onClose={() => setOpen(null)} onSuggestion={onSuggestion} />}
    </div>
  )
}

// ---------- tab: compare parks ----------
function ParkCol({ p, children }) { return <div className="nw-pc"><p className="nw-park">{p.name}</p>{children}</div> }

function Compare({ init }) {
  const ids = Object.keys(PARKS)
  const [a, setA] = useState(init?.a || 'bsp'), [b, setB] = useState(init?.b || 'ksp')
  const A = PARKS[a], B = PARKS[b]
  const sample = id => COMPANIES.filter(c => c.park === id)
  const tags = id => unique(sample(id).filter(c => !c.isDemo).flatMap(c => [...c.industry, ...c.tech])) // themes come from verified profiles only
  const shared = tags(a).filter(t => tags(b).includes(t))
  const comp = SUGGESTIONS.filter(s => isReviewed(s) && !s.isDemo && s.type === 'complementary' && ((CO[s.a].park === a && CO[s.b].park === b) || (CO[s.a].park === b && CO[s.b].park === a)))
  const row = (label, render, note) => (
    <section className="nw-row"><h3 className="nw-h3">{label}</h3>{note && <p className="fine">{note}</p>}<div className="nw-cols"><ParkCol p={A}>{render(A)}</ParkCol><ParkCol p={B}>{render(B)}</ParkCol></div></section>
  )
  return (
    <div className="nw-stack">
      <section className="nw-ctl" aria-label="Choose science parks">
        <div className="auth-fld ev-fld"><label htmlFor="nw-a">First ecosystem</label><select id="nw-a" value={a} onChange={e => { setA(e.target.value); if (e.target.value === b) setB(ids.find(i => i !== e.target.value)) }}>{ids.map(i => <option key={i} value={i}>{PARKS[i].name}</option>)}</select></div>
        <div className="auth-fld ev-fld"><label htmlFor="nw-b">Second ecosystem</label><select id="nw-b" value={b} onChange={e => { setB(e.target.value); if (e.target.value === a) setA(ids.find(i => i !== e.target.value)) }}>{ids.map(i => <option key={i} value={i}>{PARKS[i].name}</option>)}</select></div>
      </section>
      <Coverage />

      <section className="nw-sum" aria-label="Summary">
        <h2 className="mem-sec">Summary</h2>
        <ul className="nw-plain">
          <li><b>Shared themes in the sampled companies:</b> {shared.length ? shared.join(', ') : 'none found in the sample'}. Based only on the few companies reviewed.</li>
          <li><b>Possible complementary capabilities:</b> {comp.length ? `${plural(comp.length, 'inferred pairing', 'inferred pairings')} (see Find partners). None confirmed.` : 'none found in the sample.'}</li>
        </ul>
      </section>

      {row('Publicly stated focus areas', P => (
        <>
          <Facts facts={P.focus} empty={P.focusNote || 'Unknown.'} />
          {P.secondaryFocus?.length > 0 && <><p className="nw-lead">Leads from search summaries (pages not read):</p><Facts facts={P.secondaryFocus} empty="" /></>}
        </>))}
      {row('Industries and technologies represented', P => (
        <>
          <p>{P.industries}</p>
          <p className="fine">In the sampled companies:</p>
          <div className="chips-row nw-chips">{tags(P.id).map(t => <span key={t} className={'pill' + (shared.includes(t) ? ' pill-blue' : '')}>{t}</span>)}</div>
        </>), 'Sample only. This is not a count of the ecosystem’s industries.')}
      {row('Sampled companies and how they are connected', P => (
        <>
          <ul className="nw-names-l">{sample(P.id).map(c => <li key={c.id}>{c.name} <AffBadge c={c} /></li>)}</ul>
          {sample(P.id).length === 0 && <p className="nw-unk">No verified company profile yet.</p>}
          <p className="fine"><b>Sample of {sample(P.id).length}.</b> {P.members.listed}</p>
          {P.members.stated && <p className="fine">The organisation states: {P.members.stated.q ? <q>{P.members.stated.q}</q> : P.members.stated.t} <Src fact={P.members.stated} /></p>}
          {P.members.conflict && <p className="nw-conf">{P.members.conflict}</p>}
        </>), 'Do not read the sample as a membership count.')}
      {row('Testing facilities, programmes and collaboration initiatives', P => (
        <>
          <Facts facts={P.facilities} empty="None confirmed from the organisation’s own pages." />
          {P.secondaryFacilities?.length > 0 && <><p className="nw-lead">Leads from search summaries (not confirmed):</p><Facts facts={P.secondaryFacilities} empty="" /></>}
        </>))}
      {row('Sources and retrieval', P => (
        <>
          <p><a href={P.website} target="_blank" rel="noopener noreferrer">{P.website.replace(/^https?:\/\//, '')}<Icon n="ext" size={12} /></a></p>
          <p className="fine">{P.read}</p>
          <p className="fine">Collected by hand on 13–14 Nov 2026. It is not monitored continuously and will not update by itself.</p>
        </>))}
    </div>
  )
}

// ---------- tab: saved (includes earlier saved items, even ones now held for review) ----------
function SavedTab({ store, go }) {
  const [open, setOpen] = useState(null)
  const items = SUGGESTIONS.filter(s => store.saved[s.id])
  if (!items.length) return <div className="mem-empty"><strong>No saved suggestions</strong><p>Save a suggested connection to keep it here with a status and an internal note.</p><button type="button" className="btn btn-primary btn-sm" onClick={() => go('discover')}>Find partners</button></div>
  return (
    <div className="nw-stack">
      <p className="fine">Internal to staff, saved in this browser (prototype). Saving does not contact anyone.</p>
      <ul className="nw-list nw-conn-list">{items.map(s => <Card key={s.id} s={s} store={store} onOpen={setOpen} />)}</ul>
      {open && <CompareDialog s={open} store={store} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------- page ----------
export default function NetworkPage() {
  const store = useSaved()
  const [tab, setTab] = useState('discover')
  const [park, setPark] = useState('all')
  const [pair, setPair] = useState({ a: 'bsp', b: 'ksp' })
  const [openId, setOpenId] = useState(null)
  const n = SUGGESTIONS.filter(s => store.saved[s.id]).length
  const toCompanies = id => { setPark(id); setTab('companies') }
  const toCompare = id => { setPair(id === 'bsp' ? { a: 'bsp', b: 'ksp' } : { a: 'bsp', b: id }); setTab('compare') }
  const toSuggestion = s => { setOpenId(s.id); setTab('discover') }
  return (
    <div className="mem-page">
      <p className="fine nw-intro">Suggested connections inside Blue Science Park and with companies in four other ecosystems, drawn from public sources. Collaboration ideas are suggestions, not existing partnerships.</p>
      <div className="eseg nw-tabs" role="group" aria-label="Network views">
        {[['discover', 'Find partners'], ['parks', 'Science parks'], ['companies', 'Companies'], ['compare', 'Compare ecosystems'], ['saved', 'Saved suggestions' + (n ? ` (${n})` : '')]].map(([id, l]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {tab === 'discover' && <Discover store={store} openId={openId} clearOpen={() => setOpenId(null)} />}
      {tab === 'parks' && <ParksTab onCompanies={toCompanies} onCompare={toCompare} />}
      {tab === 'companies' && <CompaniesTab park={park} setPark={setPark} onSuggestion={toSuggestion} />}
      {tab === 'compare' && <Compare key={pair.a + pair.b} init={pair} />}
      {tab === 'saved' && <SavedTab store={store} go={setTab} />}
    </div>
  )
}
