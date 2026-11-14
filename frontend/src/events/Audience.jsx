import { useEffect, useId, useMemo, useState } from 'react'
import { navigate } from '../auth.js'
import { Dialog, Detail, OppCard, AudienceChips } from '../member/ui.jsx'
import { urgency, isLive } from '../demoData.js'
import { getEvent, grantAccess, revokeAccess, setSharing, useStaffEvents, fmtShort, regHref } from './eventStore.js'
import { audienceText, audienceBadge, canManageAudience, hasGrants, isMemberEvent } from './access.js'
import { COMPANY_LIST, CONTACTS, maskEmail, resolveAudience } from './contacts.js'
import { markAllRead, useNotifications } from './notify.js'
import { buildInvitation } from './invitation.js'
import { delivery } from './delivery.js'
import { toOpp } from './sync.js'
import { catOf } from './categories.js'
import { useOrgs } from './logoLib.js'

const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`
const when = ts => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const STUB = { saved: [], toggleSaved() {}, openDetail() {}, trackSource() {}, markNotRelevant() {}, openInterests() {} }
const SIM = 'Simulated in this browser: these rules are enforced by the prototype, not by a server, so they are not production security.'
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

// ============================================================================================
// Member side: audience choice, optional sharing with Blue Science Park, and what staff have granted.
// ============================================================================================
export function AudienceSection({ ev, set, ctx }) {
  const uid = useId()
  const live = useStaffEvents().find(e => e.id === ev.id)
  const published = live?.status === 'published'
  const sharing = published ? !!live.shareWithBsp : !!ev.shareWithBsp
  const [ask, setAsk] = useState(null) // 'public' | 'company' | 'unshare'
  const [err, setErr] = useState('')
  const company = ctx.actor.companyName || 'your company'
  const noun = catOf(ev).noun, isEv = !ev.category || ev.category === 'events'
  const host = hostOf(regHref(ev))

  const chooseVis = v => {
    if (v === ev.visibility) return
    if (published) return setAsk(v)
    set(v === 'public' ? { visibility: 'public', shareWithBsp: false } : { visibility: 'company' })
  }
  const toggleShare = on => {
    setErr('')
    if (!published) return set({ shareWithBsp: on })
    if (!on) return setAsk('unshare')
    try { setSharing(ev.id, true, ctx.actor) } catch (e) { setErr(e.message) }
  }
  const confirm = () => {
    try {
      if (ask === 'unshare') setSharing(ev.id, false, ctx.actor)
      else set(ask === 'public' ? { visibility: 'public', shareWithBsp: false } : { visibility: 'company' })
    } catch (e) { setErr(e.message) }
    setAsk(null)
  }
  const granted = published && sharing ? live.access : null

  return (
    <section className="inv-card" aria-labelledby={uid + 'h'}>
      <h3 id={uid + 'h'} className="inv-h">Who can see this {noun}</h3>
      <div className="aud-vis" role="radiogroup" aria-labelledby={uid + 'h'}>
        {[['company', 'Company only', 'Default'], ['public', 'Public', '']].map(([v, l, tag]) => (
          <label key={v} className={'aud-opt' + (ev.visibility === v ? ' on' : '')}>
            <input type="radio" name={uid + 'v'} checked={ev.visibility === v} onChange={() => chooseVis(v)} />
            <span><b>{l}</b>{tag && <small> · {tag}</small>}<span className="fine">{audienceText(v, ev.category)}</span></span>
          </label>
        ))}
      </div>
      <p className="fine">Preview: <AudienceChips o={{ audienceBadge: audienceBadge({ ...ev, access: live?.access || { companies: [], members: [] } }), sharedBadge: ev.visibility === 'company' && sharing ? 'Shared with Blue Science Park' : null }} /> {ev.visibility === 'public' ? (isEv ? 'Listed for all signed-in members and on the public event page.' : 'Listed for all signed-in members.') : `Listed only for members of ${company}.`}</p>

      {ev.visibility === 'company' && (
        <div className="aud-share">
          <label className="chk"><input type="checkbox" checked={sharing} onChange={e => toggleShare(e.target.checked)} />Let Blue Science Park invite others</label>
          <p className="fine">Share this {noun} with Blue Science Park staff so they can grant access to selected companies or members.</p>
          <p className="fine">It stays company-only. Staff can see the {noun} and choose who else gets access, but cannot make it public or change it. {company} always keeps access.{!published && sharing && ' Staff are notified once, when you publish.'}</p>
          {granted && (
            <div className="aud-granted" role="status">
              <b>Additional access granted by Blue Science Park</b>
              {hasGrants(live)
                ? <ul>{granted.companies.map(c => <li key={c.id}><span className="pill">Entire company</span> {c.name}</li>)}{granted.members.map(m => <li key={m.email}><span className="pill">Named person only</span> {m.name}, {m.company}</li>)}</ul>
                : <p className="fine">None yet. Staff have not granted anyone else access.</p>}
            </div>
          )}
        </div>
      )}

      {!isEv && ev.regUrl.trim() && <p className="notice">The link goes to {host}. Fyyr limits who can see this {noun}, but it cannot control who opens a link once someone has it.</p>}
      {isEv && ev.regUrl.trim() && (
        <p className="notice">
          <b>Registration happens on {host || 'your registration page'}.</b> {ev.visibility === 'company' ? 'Fyyr limits who can see this event and its registration link, but it cannot check who registers on that page. Anyone who is given the link outside Fyyr could register there. If attendance must be restricted, use the access options of that registration service (for example an invite code or approval).' : 'Fyyr cannot limit or check who registers there.'}
        </p>
      )}
      <p className="fine">{SIM}</p>
      {err && <p className="fld-err" role="alert">{err}</p>}

      {ask && (
        <Dialog label="Confirm change" onClose={() => setAsk(null)}>
          <h2 className="auth-h">{ask === 'unshare' ? 'Stop sharing with Blue Science Park?' : ask === 'public' ? `Make this ${noun} public?` : `Make this ${noun} company-only?`}</h2>
          {ask === 'unshare' && <>
            <p className="sum">Staff will lose their ability to manage who can see this {noun}. Everything they granted is removed: {plural(live.access.companies.length, 'company', 'companies')} and {plural(live.access.members.length, 'named person', 'named people')} will no longer be able to open it.</p>
            {isEv && <p className="sum">Nobody is cancelled automatically. People who already registered on your registration page stay registered there, so contact them yourself if they should not attend.</p>}
          </>}
          {ask === 'public' && <p className="sum">Anyone will be able to view this {noun}{isEv && ' and its registration information'}. Sharing with Blue Science Park and any access staff granted will be removed because they are no longer needed.</p>}
          {ask === 'company' && <p className="sum">Only members of {company} will see it from now on.{isEv && ' Nobody is cancelled automatically: people who already registered on your registration page stay registered there, so contact them yourself if needed.'}</p>}
          <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={() => setAsk(null)}>Keep as it is</button><button type="button" className="btn btn-primary btn-sm" onClick={confirm}>{ask === 'unshare' ? 'Stop sharing' : 'Change audience'}</button></div>
        </Dialog>
      )}
    </section>
  )
}

// ============================================================================================
// Staff side: "Shared by members" queue and the audience manager.
// ============================================================================================
export const sharedEvents = events => events.filter(e => isMemberEvent(e) && e.status === 'published' && e.visibility === 'company' && e.shareWithBsp)

export function SharedArea({ ctx, id }) {
  useStaffEvents()
  return id ? <AudienceManager id={id} ctx={ctx} /> : <SharedQueue />
}

function SharedQueue() {
  const events = useStaffEvents()
  const notes = useNotifications()
  const [q, setQ] = useState('')
  useEffect(() => { markAllRead() }, [])
  const list = sharedEvents(events).filter(e => !q.trim() || (e.title + ' ' + e.owner.company).toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.shareNotifiedAt || 0) - (a.shareNotifiedAt || 0))
  const fresh = new Set(notes.filter(n => !n.read).map(n => n.eventId))
  return (
    <div className="mem-page">
      <div className="ev-top"><button type="button" className="link-btn" onClick={() => navigate('/staff/events')}>← All opportunities</button></div>
      <h2 className="ev-h2">Shared by members</h2>
      <p className="fine">Company-only opportunities whose creators asked Blue Science Park to help invite others. They are not public. You can choose additional companies or named members who get access; you cannot edit the event or make it public.</p>
      <label className="sr" htmlFor="sq">Search shared events</label>
      <input id="sq" className="ev-search" type="search" placeholder="Search by event or company" value={q} onChange={e => setQ(e.target.value)} />
      {list.length ? (
        <ul className="ev-list">{list.map(e => (
          <li key={e.id} className="ev-row">
            <div className="ev-main">
              <p className="ev-meta"><span className="pill">{catOf(e).label}</span><span className="pill aud-company">{audienceBadge(e)}</span>{fresh.has(e.id) && <span className="pill ev-published">New</span>}{e.owner.company}{e.date && <> · {fmtShort(e.date)}</>}</p>
              <h3 className="mem-h"><button type="button" className="mem-title lg" onClick={() => navigate('/staff/events/shared/' + e.id)}>{e.title}</button></h3>
              <p className="fine">Shared {when(e.shareNotifiedAt || e.updated)} · {hasGrants(e) ? `${plural(e.access.companies.length, 'company', 'companies')} and ${plural(e.access.members.length, 'named person', 'named people')} added` : 'No additional access granted yet'}</p>
            </div>
            <div className="st-act"><button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/staff/events/shared/' + e.id)}>Manage audience<span className="sr">: {e.title}</span></button></div>
          </li>))}</ul>
      ) : <div className="mem-empty"><strong>{q ? 'Nothing matches' : 'Nothing shared yet'}</strong><p>{q ? 'Try another search.' : 'When a member company shares a company-only event with Blue Science Park, it appears here.'}</p></div>}
    </div>
  )
}

function Search({ label, value, onChange, placeholder }) {
  const id = useId()
  return <><label className="lbl" htmlFor={id}>{label}</label><input id={id} type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /></>
}

function AudienceManager({ id, ctx }) {
  const events = useStaffEvents()
  const orgs = useOrgs()
  const e = events.find(x => x.id === id)
  const [cq, setCq] = useState(''), [mq, setMq] = useState('')
  const [detail, setDetail] = useState(false)
  const [inv, setInv] = useState(false)
  const [err, setErr] = useState('')
  const run = f => { try { f(); setErr('') } catch (x) { setErr(x.message) } }
  const opp = useMemo(() => (e ? toOpp(e, orgs, ctx.actor) : null), [e, orgs]) // eslint-disable-line react-hooks/exhaustive-deps
  const back = <button type="button" className="link-btn" onClick={() => navigate('/staff/events/shared')}>← Shared by members</button>
  if (!e || !canManageAudience(e, ctx.actor)) {
    return <div className="mem-page"><div className="ev-top">{back}</div><div className="mem-empty"><strong>This event is not available to manage</strong><p>It may be unpublished, deleted, or its creator stopped sharing it with Blue Science Park.</p></div></div>
  }
  const x = { o: opp, live: isLive(opp), u: urgency(opp), reasons: [], strength: null, score: 0 }
  const gCo = new Set(e.access.companies.map(c => c.id)), gMem = new Set(e.access.members.map(m => m.email))
  const cos = COMPANY_LIST.filter(c => c.id !== e.owner.companyId && !gCo.has(c.id) && (!cq.trim() || c.name.toLowerCase().includes(cq.trim().toLowerCase())))
  const seen = new Set()
  const people = mq.trim().length < 2 ? [] : CONTACTS.filter(c => c.id !== 'dup-demo' && c.companyId !== e.owner.companyId && (c.name + ' ' + c.company).toLowerCase().includes(mq.trim().toLowerCase()) && !seen.has(c.email) && seen.add(c.email)).slice(0, 8)

  return (
    <div className="mem-page ev-editor">
      <div className="ev-top">{back}<p className="ev-status"><span className="pill aud-company">{audienceBadge(e)}</span><span className="pill aud-shared">Shared with Blue Science Park</span></p></div>
      <h2 className="ev-h2">{e.title} <span>· Manage audience</span></h2>
      <p className="notice">You can choose who else may view and register. You cannot edit this event or make it public. {SIM}</p>

      <section className="inv-card">
        <h3 className="inv-h">The event</h3>
        <dl className="rev">
          <div><dt>Created by</dt><dd>{e.owner.company} <span className="fine">· {maskEmail(e.owner.email || 'unknown@unknown')}</span></dd></div>
          <div><dt>Shared</dt><dd>{when(e.shareNotifiedAt || e.updated)}</dd></div>
        </dl>
        <ul className="cards ev-prevcard"><OppCard x={x} c={STUB} /></ul>
        <button type="button" className="btn btn-glass btn-sm" onClick={() => setDetail(true)}>Preview event details</button>
      </section>

      <section className="inv-card">
        <h3 className="inv-h">Who can access it now</h3>
        <ul className="aud-now">
          <li><span><b>{e.owner.company}</b> <span className="pill">Entire company</span><small className="fine"> · creator, always keeps access</small></span></li>
          {e.access.companies.map(c => <li key={c.id}><span><b>{c.name}</b> <span className="pill">Entire company</span><small className="fine"> · granted {when(c.ts)}</small></span><button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => revokeAccess(e.id, 'company', c.id, ctx.actor))}>Remove access<span className="sr">: {c.name}</span></button></li>)}
          {e.access.members.map(m => <li key={m.email}><span><b>{m.name}</b>, {m.company} <span className="pill">Named person only</span><small className="fine"> · {maskEmail(m.email)}</small></span><button type="button" className="btn btn-quiet btn-sm" onClick={() => run(() => revokeAccess(e.id, 'member', m.email, ctx.actor))}>Remove access<span className="sr">: {m.name}</span></button></li>)}
        </ul>
        {!hasGrants(e) && <p className="fine">Nobody besides the creator company has access yet.</p>}
        {err && <p className="fld-err" role="alert">{err}</p>}
      </section>

      <section className="inv-card">
        <h3 className="inv-h">Give access to a company</h3>
        <p className="fine">Everyone at the company can then view and register.</p>
        <Search label="Search companies" value={cq} onChange={setCq} placeholder="Company name" />
        <ul className="aud-pick">{cos.slice(0, 8).map(c => <li key={c.id}><span>{c.name}</span><button type="button" className="btn btn-glass btn-sm" onClick={() => run(() => grantAccess(e.id, 'company', c, ctx.actor))}>Grant access<span className="sr">: {c.name}</span></button></li>)}
          {!cos.length && <li className="fine">No company matches.</li>}</ul>
        {cos.length > 8 && <p className="fine">Showing 8 of {cos.length}. Search to narrow the list.</p>}
      </section>

      <section className="inv-card">
        <h3 className="inv-h">Give access to a named member</h3>
        <p className="fine">Only that person can view and register, not their colleagues. Only members who agreed to receive event invitations are listed. Addresses are masked.</p>
        <Search label="Search members" value={mq} onChange={setMq} placeholder="Name or company (2+ letters)" />
        <ul className="aud-pick">{people.map(c => {
          const via = gCo.has(c.companyId), has = gMem.has(c.email.toLowerCase())
          return <li key={c.id}><span>{c.name}, {c.company} <small className="fine">· {maskEmail(c.email)}</small></span>
            {via ? <small className="fine">Has access through their company</small> : has ? <small className="fine">Already has access</small>
              : <button type="button" className="btn btn-glass btn-sm" disabled={!c.invitations || c.unsubscribed} onClick={() => run(() => grantAccess(e.id, 'member', c, ctx.actor))}>{c.invitations && !c.unsubscribed ? 'Grant access' : 'Opted out'}<span className="sr">: {c.name}</span></button>}</li>
        })}{mq.trim().length >= 2 && !people.length && <li className="fine">No member matches.</li>}</ul>
      </section>

      <section className="inv-card">
        <h3 className="inv-h">Invitations</h3>
        <p className="fine"><b>Granting access does not notify anyone.</b> Inviting is a separate step: review who would receive an invitation and what it says first.</p>
        <button type="button" className="btn btn-glass btn-sm" onClick={() => setInv(true)}>Review invitation for the authorised audience</button>
      </section>

      <section className="inv-card">
        <h3 className="inv-h">Audience changes</h3>
        {e.audit.length ? (
          <div className="st-tblwrap rec-wrap" tabIndex={0} role="region" aria-label="Audience changes">
            <table className="st-tbl"><thead><tr><th scope="col">When</th><th scope="col">By</th><th scope="col">Change</th></tr></thead>
              <tbody>{[...e.audit].reverse().map((a, i) => <tr key={i}><td>{when(a.ts)}</td><td>{a.by}</td><td>{a.action}{a.name && <>: {a.name}</>}{a.target && <> <small className="fine">({a.target})</small></>}</td></tr>)}</tbody></table>
          </div>
        ) : <p className="fine">No changes yet.</p>}
      </section>

      {detail && <Detail x={x} c={STUB} onClose={() => setDetail(false)} />}
      {inv && <InviteReview e={e} orgs={orgs} onClose={() => setInv(false)} />}
    </div>
  )
}

function InviteReview({ e, orgs, onClose }) {
  const byId = useMemo(() => Object.fromEntries(orgs.map(o => [o.id, o])), [orgs])
  const named = e.access.members.map(m => ({ id: 'm-' + m.email, name: m.name, email: m.email, company: m.company }))
  const fromCos = e.access.companies.length ? resolveAudience({ companies: e.access.companies.map(c => c.id), interests: [], categories: [], added: [], removed: [] }) : { recipients: [], excluded: 0, duplicates: 0 }
  const seen = new Set(), recipients = []
  for (const r of [...fromCos.recipients, ...named]) { const k = r.email.toLowerCase(); if (!seen.has(k)) { seen.add(k); recipients.push(r) } }
  const mail = useMemo(() => buildInvitation(e, byId, {}), [e, byId])
  return (
    <Dialog label="Review invitation" onClose={onClose} xwide>
      <h2 className="auth-h">Review invitation</h2>
      <p className="notice"><b>Sending is unavailable.</b> {delivery.reason}</p>
      <p className="sum"><b>{plural(recipients.length, 'recipient', 'recipients')}</b> would be invited: only people who already have access{fromCos.excluded > 0 && <>, and {plural(fromCos.excluded, 'contact', 'contacts')} left out because they opted out</>}. {recipients.length === 0 && 'Grant access to a company or a named member first.'}</p>
      {recipients.length > 0 && <ul className="aud-pick">{recipients.slice(0, 12).map(r => <li key={r.id}><span>{r.name}, {r.company} <small className="fine">· {maskEmail(r.email)}</small></span></li>)}{recipients.length > 12 && <li className="fine">and {recipients.length - 12} more</li>}</ul>}
      <p className="inv-subj"><span>Subject</span> {mail.subject}</p>
      <div className="inv-frame desktop"><iframe title="Invitation preview" sandbox="" srcDoc={mail.html} /></div>
      <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button><button type="button" className="btn btn-primary btn-sm" disabled>Send (unavailable)</button></div>
    </Dialog>
  )
}
