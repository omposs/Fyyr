import { useMemo } from 'react'
import { navigate } from '../auth.js'
import { fmtDate, fmtTime, placeOf, regHref, tzLabel, useStaffEvents } from './eventStore.js'
import { audienceBadge, canRegister, canView, isMemberEvent, viewerFromSession } from './access.js'
import { useOrgs } from './logoLib.js'
import { SponsorRow, OrganiserLine } from './Logo.jsx'
import './events.css'

// Address of a single event, e.g. /events/ev-abc123. A forwarded link never grants access:
// the same canView check as every list applies, so private events need a signed-in person with permission.
// Without permission the page does not reveal whether the event exists or what it is called.
export default function EventLink({ id }) {
  const events = useStaffEvents(), orgsL = useOrgs()
  const viewer = viewerFromSession()
  const e = events.find(x => x.id === id)
  const orgs = useMemo(() => Object.fromEntries(orgsL.map(o => [o.id, o])), [orgsL])
  const ok = e && e.status === 'published' && canView(e, viewer)
  const home = viewer.role === 'member' ? '/member' : viewer.role === 'staff' ? '/staff' : '/'
  return (
    <main className="evl" id="main">
      <p className="evl-brand"><a href="/" onClick={ev => { ev.preventDefault(); navigate('/') }}>FYYR</a> <span>by Blue Science Park</span></p>
      {!ok ? (
        <section className="evl-card" aria-labelledby="evl-h">
          <h1 id="evl-h">This event isn't available to you</h1>
          <p>{viewer.role === 'anon' ? 'If you were sent this link, log in with the account that was invited. Some events are only open to selected companies or people.' : 'Your account does not have access to this event, or it is no longer published. Ask the organiser or Blue Science Park if you think you should have access.'}</p>
          <p className="fine">Forwarding a link does not give anyone access. Simulated in this browser: not production security.</p>
          <a className="btn btn-primary btn-sm" href={home} onClick={ev => { ev.preventDefault(); navigate(home) }}>{viewer.role === 'anon' ? 'Go to the start page to log in' : 'Back to Fyyr'}</a>
        </section>
      ) : (
        <article className="evl-card" aria-labelledby="evl-h">
          {isMemberEvent(e) && <p><span className={'pill aud-' + audienceBadge(e).split(' ')[0].toLowerCase()}>{audienceBadge(e)}</span></p>}
          <SponsorRow items={e.sponsors.map(s => ({ org: orgs[s.orgId], role: s.role, primary: s.primary }))} />
          {e.cover && <img className="det-cover" src={e.cover} alt="" />}
          <h1 id="evl-h">{e.title}</h1>
          <OrganiserLine org={e.organiser ? orgs[e.organiser] : null} />
          <p>{e.description}</p>
          <dl className="det">
            <div className="det-f"><dt>Organised by</dt><dd>{(e.organiser && orgs[e.organiser]?.name) || e.owner?.company || 'Blue Science Park'}</dd></div>
            <div className="det-f"><dt>When</dt><dd>{fmtDate(e.date)}{fmtTime(e) && ', ' + fmtTime(e)} <small>({tzLabel(e.tz)})</small></dd></div>
            {placeOf(e) && <div className="det-f"><dt>Where</dt><dd>{placeOf(e)}</dd></div>}
          </dl>
          {canRegister(e, viewer) && regHref(e) && <a className="btn btn-primary" href={regHref(e)} target="_blank" rel="noopener noreferrer">Register</a>}
          {e.visibility === 'public' && isMemberEvent(e) && <p className="fine">Registration happens on the organiser's own page, which Fyyr does not control.</p>}
        </article>
      )}
    </main>
  )
}
