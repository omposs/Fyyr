import { useId, useMemo, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { Dialog } from '../member/ui.jsx'
import { CO, PARKS, SCOPE_LABEL, SOURCE_LABEL, fmtD, scopeOf } from '../network/data.js'
import { SaveBtn } from '../network/NetworkPage.jsx'
import { ParkBadge } from '../network/ParkBadge.jsx'
import { useSaved } from '../network/store.js'
import { navigate } from '../auth.js'
import { assess, connectionPicks } from './match.js'
import './perf.css'

const initials = name => name.replace(/[–-].*$/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const HUES = ['#5468ff', '#0e9f8e', '#7a5af8', '#c2410c', '#0369a1']
const hue = id => HUES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]
const Avatar = ({ c }) => <span className="cn-av" style={{ '--c': hue(c.id) }} aria-hidden="true">{initials(c.name)}</span>
const STRENGTH_TONE = { 'Strong potential': 'strong', 'Worth exploring': 'mid', 'Early idea': 'low' }

function Badges({ a }) {
  return (
    <p className="cn-badges">
      <span className="cn-str" data-tone={STRENGTH_TONE[a.strength]} title={`Match strength: ${a.points} of ${a.max} points`}>{a.strength}</span>
      <span className="cn-conf" title="How well the facts are sourced">Evidence: {a.confidence}</span>
      {a.demo && <span className="pill nw-demo" title="Part of this assessment rests on simulated needs">Demo assessment</span>}
    </p>
  )
}

export function MatchDialog({ s, store, onClose }) {
  const A = CO[s.a], B = CO[s.b], a = assess(s)
  const name = `${A.name} and ${B.name}`
  return (
    <Dialog label={name} onClose={onClose} side>
      <div className="cn-pair cn-pair-lg"><Avatar c={A} /><Avatar c={B} /></div>
      <h2 className="auth-h det-h">{s.theme}</h2>
      <p className="cn-parks"><span><b>{A.name}</b> <ParkBadge id={A.park} confirmed={A.affiliation.status === 'confirmed'} /></span><span><b>{B.name}</b> <ParkBadge id={B.park} confirmed={B.affiliation.status === 'confirmed'} /></span></p>
      <p className="fine">{SCOPE_LABEL[scopeOf(s)]}</p>
      <Badges a={a} />
      <p className="notice"><b>A suggestion, not an introduction.</b> Nothing is sent from Fyyr, and neither company has said it wants this. Real company names · simulated needs.</p>

      <h3 className="mem-sec">Why they may fit</h3>
      <p className="sum">{s.why}</p>
      <ul className="cn-crit">{a.criteria.map(c => <li key={c.k} data-met={c.met || undefined}><Icon n={c.met ? 'check' : 'x'} size={14} /><span><b>{c.label}</b> ({c.pts} {c.pts === 1 ? 'point' : 'points'}): {c.why}</span></li>)}</ul>
      <p className="fine">Match strength is {a.points} of {a.max} points. 3 or more is “Strong potential”, 2 is “Worth exploring”, 0 or 1 is “Early idea”. It is not a probability of success.</p>

      <h3 className="mem-sec">What each contributes</h3>
      <ul className="st-plain">{a.parts.map(p => <li key={p}>{p}</li>)}</ul>
      <dl className="det">
        <div className="det-f"><dt>Complementary</dt><dd>{s.type === 'complementary' ? s.explore : 'Not established: the sources show overlap rather than a clear gap that one fills for the other.'}</dd></div>
        <div className="det-f"><dt>Merely similar</dt><dd>{a.shared.length ? a.shared.join(', ') : s.type === 'shared' ? 'Both work in the same area.' : 'Nothing shared in the sources read.'}</dd></div>
        <div className="det-f"><dt>Possible outcome</dt><dd>{s.propose}</dd></div>
      </dl>

      <h3 className="mem-sec">Verified facts <span className="pill pill-blue">Sourced</span></h3>
      <ul className="cn-facts">
        {[A, B].map(c => <li key={c.id}><b>{c.name}</b>: {c.affiliation.relation} of {PARKS[c.park].name}. <a href={c.affiliation.u} target="_blank" rel="noopener noreferrer">Park page<Icon n="ext" size={11} /></a> · checked {fmtD(c.affiliation.d)}</li>)}
        {a.facts.map((e, i) => <li key={i}><b>{e.company.name}</b>: {e.fact.t}{e.fact.u && <> <a href={e.fact.u} target="_blank" rel="noopener noreferrer">Source<Icon n="ext" size={11} /></a></>} · {SOURCE_LABEL[e.fact.via]}, read {fmtD(e.fact.d)}</li>)}
      </ul>
      <h3 className="mem-sec">Simulated assumptions <span className="pill nw-demo">Demo</span></h3>
      {s.simNeeds?.length ? <ul className="st-plain">{s.simNeeds.map(n => <li key={n}>{n}</li>)}</ul> : <p className="fine">None. This assessment uses only the sourced descriptions above.</p>}
      {s.simNeeds?.length > 0 && <p className="fine">These needs are invented for the demo. The companies did not say them.</p>}

      <h3 className="mem-sec">Check before introducing</h3>
      <ul className="st-plain">{s.gaps.map(g => <li key={g}>{g}</li>)}<li>Whether both companies want an introduction. Ask each one first.</li></ul>
      <p className="fine"><b>Evidence: {a.confidence}.</b> {a.confWhy}</p>
      <h3 className="mem-sec">Suggested next step</h3>
      <p className="sum">{s.next}</p>
      <div className="auth-row det-actions"><SaveBtn s={s} store={store} name={name} /><button type="button" className="btn btn-glass btn-sm" onClick={() => { onClose(); navigate('/staff/network/suggestions') }}>See all suggestions</button></div>
    </Dialog>
  )
}

// "Companies worth connecting": compact cards that can be scanned quickly. Sources and caveats live in the popup.
export function ConnectCards() {
  const net = useSaved()
  const [open, setOpen] = useState(null)
  const picks = useMemo(() => connectionPicks(3), [])
  const uid = useId()
  return (
    <section className="ov-sec" aria-labelledby={uid}>
      <div className="ov-sec-h"><div><h2 id={uid}>Companies worth connecting</h2></div>
        <a href="/staff/network/suggestions" className="mem-more" onClick={e => { e.preventDefault(); navigate('/staff/network/suggestions') }}>View all</a></div>
      {picks.length ? (
        <ul className="cn-grid">
          {picks.map(({ s, a }) => {
            const A = CO[s.a], B = CO[s.b], name = `${A.name} and ${B.name}`
            return (
              <li key={s.id} className="cn-card">
                <div className="cn-pair"><Avatar c={A} /><Avatar c={B} /><span className="cn-names"><b>{A.name}</b> <span aria-hidden="true">+</span><span className="sr"> and </span> <b>{B.name}</b></span></div>
                <p className="cn-parks"><ParkBadge id={A.park} confirmed={A.affiliation.status === 'confirmed'} /><ParkBadge id={B.park} confirmed={B.affiliation.status === 'confirmed'} /></p>
                <h3 className="cn-theme">{s.theme}</h3>
                <ul className="cn-parts">{a.parts.map(p => <li key={p}>{p}</li>)}</ul>
                <p className="cn-tags">{a.tags.map(t => <span key={t} className="pill">{t}</span>)}</p>
                <p className="cn-out"><Icon n="arrow" size={14} /><span><b>Possible outcome:</b> {s.propose}</span></p>
                <Badges a={a} />
                <div className="cn-act">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(s)}>Explore match<span className="sr">: {name}</span></button>
                  <SaveBtn s={s} store={net} name={name} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : <div className="mem-empty"><strong>No supported suggestions yet</strong><p>Suggestions appear here only when public sources support a reason to connect and both park affiliations are confirmed.</p></div>}
      <p className="fine">Real company names · simulated needs. Fit is judged from each company’s own verified description; no introduction is sent.</p>
      {open && <MatchDialog s={open} store={net} onClose={() => setOpen(null)} />}
    </section>
  )
}
