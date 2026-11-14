import { useEffect, useId, useMemo, useState } from 'react'
import { INTERESTS, MCATS } from '../member/data.js'
import { DEFAULT_INVITE, LAYOUTS, fmtShort, problems, regHref } from './eventStore.js'
import { buildInvitation, defaultIntro } from './invitation.js'
import { COMPANY_LIST, CONTACTS, maskEmail, resolveAudience, validEmail } from './contacts.js'
import { delivery, sendKey } from './delivery.js'
import { rasterLogo, useOrgs } from './logoLib.js'
import { Logo } from './Logo.jsx'

const ACCENTS = ['#2b3cff', '#0f7b6c', '#b4236b', '#c2580a', '#0f1222']
const ROLE_L = { sponsor: 'Sponsor', partner: 'Partner' }
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`

// ---------- preview ----------
function useRaster(orgIds, orgs) {
  const [map, setMap] = useState({})
  useEffect(() => {
    let live = true
    Promise.all(orgIds.map(async id => { const o = orgs[id]; try { return [id, o?.logo ? await rasterLogo(o.logo) : null] } catch { return [id, null] } }))
      .then(r => live && setMap(Object.fromEntries(r)))
    return () => { live = false }
  }, [orgIds.join(','), orgs]) // eslint-disable-line react-hooks/exhaustive-deps
  return map
}

function Preview({ ev, mail }) {
  const [view, setView] = useState('desktop')
  const [tab, setTab] = useState('html')
  return (
    <section className="inv-prev" aria-label="Invitation preview">
      <div className="inv-bar">
        <div className="eseg" role="group" aria-label="Preview type">
          <button type="button" aria-pressed={tab === 'html'} onClick={() => setTab('html')}>Email</button>
          <button type="button" aria-pressed={tab === 'text'} onClick={() => setTab('text')}>Plain text</button>
        </div>
        {tab === 'html' && (
          <div className="eseg" role="group" aria-label="Preview size">
            <button type="button" aria-pressed={view === 'desktop'} onClick={() => setView('desktop')}>Desktop</button>
            <button type="button" aria-pressed={view === 'mobile'} onClick={() => setView('mobile')}>Mobile</button>
          </div>
        )}
      </div>
      <p className="inv-subj"><span>Subject</span> {mail.subject}</p>
      {tab === 'html'
        ? <div className={'inv-frame ' + view}><iframe title={`Invitation preview, ${view}`} sandbox="" srcDoc={mail.html} /></div>
        : <pre className="inv-text" tabIndex={0}>{mail.text}</pre>}
      <p className="fine">Sponsor logos use the shared library. SVG logos are converted to PNG for email. The preview links to the real registration page; the email footer links are placeholders until delivery is connected.</p>
    </section>
  )
}

// ---------- audience ----------
function Chips({ label, items, sel, set, fmt = x => x }) {
  const toggle = v => set(sel.includes(v) ? sel.filter(x => x !== v) : [...sel, v])
  return (
    <fieldset className="aud-f"><legend>{label}</legend>
      <div className="chips-row">{items.map(i => <button key={i.id ?? i} type="button" className="fchip" aria-pressed={sel.includes(i.id ?? i)} onClick={() => toggle(i.id ?? i)}>{fmt(i)}</button>)}</div>
    </fieldset>
  )
}

function Audience({ ev, set, res }) {
  const uid = useId()
  const a = ev.audience
  const [cq, setCq] = useState('')
  const [em, setEm] = useState('')
  const [err, setErr] = useState('')
  const [show, setShow] = useState(false)
  const upd = patch => set({ audience: { ...a, ...patch } })
  const cos = COMPANY_LIST.filter(c => c.name.toLowerCase().includes(cq.trim().toLowerCase()))
  const add = e => {
    e.preventDefault()
    const v = em.trim()
    if (!validEmail(v)) return setErr('Enter a valid email address.')
    if (res.recipients.some(r => r.email.toLowerCase() === v.toLowerCase())) return setErr('This address is already in the list.')
    upd({ added: [...a.added, { email: v, name: '', company: 'Added manually' }] }); setEm(''); setErr('')
  }
  return (
    <section className="inv-card" aria-labelledby={uid + 'h'}>
      <h3 id={uid + 'h'} className="inv-h">Who receives it</h3>
      <p className="fine">Only authorised member contacts who agreed to event invitations. With nothing chosen, all of them are included. Choices combine: a contact is included if they match any company, interest or category.</p>
      <div className="aud-co">
        <label className="lbl" htmlFor={uid + 'q'}>Companies</label>
        <input id={uid + 'q'} type="search" placeholder="Search companies" value={cq} onChange={e => setCq(e.target.value)} />
        <div className="aud-list" role="group" aria-label="Companies">
          {cos.map(c => <label key={c.id} className="aud-co-i"><input type="checkbox" checked={a.companies.includes(c.id)} onChange={() => upd({ companies: a.companies.includes(c.id) ? a.companies.filter(x => x !== c.id) : [...a.companies, c.id] })} />{c.name}</label>)}
          {!cos.length && <p className="fine">No company matches.</p>}
        </div>
        {a.companies.length > 0 && <button type="button" className="link-btn" onClick={() => upd({ companies: [] })}>Clear {plural(a.companies.length, 'company', 'companies')}</button>}
      </div>
      <Chips label="Explicit interests" items={INTERESTS} sel={a.interests} set={v => upd({ interests: v })} />
      <Chips label="Opportunity categories" items={MCATS} sel={a.categories} set={v => upd({ categories: v })} fmt={c => c.label} />
      <p className="aud-count" role="status"><b>{plural(res.recipients.length, 'recipient', 'recipients')}</b>
        {res.duplicates > 0 && <> · {plural(res.duplicates, 'duplicate address', 'duplicate addresses')} removed</>}
        {res.excluded > 0 && <> · {plural(res.excluded, 'contact', 'contacts')} left out (opted out or unsubscribed)</>}</p>
      <div className="st-act">
        <button type="button" className="btn btn-glass btn-sm" aria-expanded={show} onClick={() => setShow(s => !s)}>{show ? 'Hide recipients' : 'Inspect and edit recipients'}</button>
        {a.removed.length > 0 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => upd({ removed: [] })}>Restore {a.removed.length} removed</button>}
      </div>
      {show && (
        <div>
          <p className="fine">Addresses are masked. Remove anyone who should not get this one.</p>
          <div className="st-tblwrap rec-wrap" tabIndex={0} role="region" aria-label="Recipients">
            <table className="st-tbl"><thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Address</th><th scope="col"><span className="sr">Action</span></th></tr></thead>
              <tbody>{res.recipients.slice(0, 200).map(r => (
                <tr key={r.id}><th scope="row">{r.name}</th><td>{r.company}</td><td>{maskEmail(r.email)}</td>
                  <td><button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${r.name}`} onClick={() => r.manual ? upd({ added: a.added.filter(x => 'm-' + x.email !== r.id) }) : upd({ removed: [...a.removed, r.id] })}>Remove</button></td></tr>))}</tbody></table>
          </div>
          {res.recipients.length > 200 && <p className="fine">Showing the first 200 of {res.recipients.length}.</p>}
          <form className="aud-add" onSubmit={add} noValidate>
            <label className="sr" htmlFor={uid + 'e'}>Add an email address</label>
            <input id={uid + 'e'} type="email" placeholder="Add an address" value={em} aria-invalid={!!err} onChange={e => { setEm(e.target.value); setErr('') }} />
            <button type="submit" className="btn btn-glass btn-sm">Add</button>
          </form>
          {err && <p className="fld-err" role="alert">{err}</p>}
        </div>
      )}
    </section>
  )
}

// ---------- the step ----------
export default function InvitationStep({ ev, set, goStep }) {
  const orgsList = useOrgs()
  const orgs = useMemo(() => Object.fromEntries(orgsList.map(o => [o.id, o])), [orgsList])
  const raster = useRaster(ev.sponsors.map(s => s.orgId), orgs)
  const inv = ev.invite
  const setInv = patch => set({ invite: { ...inv, ...patch } })
  const mail = useMemo(() => buildInvitation(ev, orgs, raster), [ev, orgs, raster])
  const res = useMemo(() => resolveAudience(ev.audience), [ev.audience])
  const key = useMemo(() => sendKey(ev, res.recipients), [ev, res.recipients])
  const [adv, setAdv] = useState(false)
  const [plan, setPlan] = useState({ when: 'now', at: '' })
  const missing = Object.keys(problems(ev))
  const move = (i, d) => { const s = [...ev.sponsors]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ sponsors: s }) }
  const uid = useId()
  const custom = JSON.stringify(inv) !== JSON.stringify(DEFAULT_INVITE)

  return (
    <div className="inv">
      <p className="notice"><b>Sending is unavailable.</b> {delivery.reason}</p>
      {missing.length > 0 && <p className="notice st-warn" role="status">The event is missing {plural(missing.length, 'required detail', 'required details')}, so the invitation is incomplete. <button type="button" className="auth-link inline" onClick={() => goStep(0)}>Go to event information</button></p>}
      <div className="inv-grid">
        <div className="inv-col">
          <section className="inv-card">
            <h3 className="inv-h">Invitation</h3>
            <p className="fine">Built from your event details and sponsors. You only need to adjust these if you want to.</p>
            <div className="auth-fld"><label htmlFor={uid + 'i'}>Short introduction</label><textarea id={uid + 'i'} rows={3} maxLength={300} value={inv.intro} placeholder={defaultIntro(ev)} onChange={e => setInv({ intro: e.target.value })} /><p className="fine">{inv.intro.length}/300. Leave empty to use the suggested line.</p></div>
            <fieldset className="aud-f"><legend>Accent colour</legend>
              <div className="swatches">{ACCENTS.map(c => <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Accent ${c}`} aria-pressed={inv.accent === c} onClick={() => setInv({ accent: c })} />)}
                <input type="color" aria-label="Custom accent colour" value={inv.accent} onChange={e => setInv({ accent: e.target.value })} /></div>
            </fieldset>
            <fieldset className="aud-f"><legend>Layout</legend>
              <div className="chips-row">{LAYOUTS.map(([v, l]) => <button key={v} type="button" className="fchip" aria-pressed={inv.layout === v} onClick={() => setInv({ layout: v })}>{l}</button>)}</div>
            </fieldset>
            <label className="chk"><input type="checkbox" checked={inv.cover} disabled={!ev.cover} onChange={e => setInv({ cover: e.target.checked })} />Include cover image{!ev.cover && <span className="fine"> (none added in step 1)</span>}</label>
            {ev.sponsors.length > 1 && (
              <fieldset className="aud-f"><legend>Logo order</legend>
                <ol className="ord">{ev.sponsors.map((s, i) => { const o = orgs[s.orgId]; return o && (
                  <li key={s.orgId}><Logo org={o} h={26} /><span>{o.name} <small>{ROLE_L[s.role]}{s.primary ? ' · primary' : ''}</small></span>
                    <button type="button" className="btn btn-quiet btn-sm" disabled={i === 0} aria-label={`Move ${o.name} earlier`} onClick={() => move(i, -1)}>Up</button>
                    <button type="button" className="btn btn-quiet btn-sm" disabled={i === ev.sponsors.length - 1} aria-label={`Move ${o.name} later`} onClick={() => move(i, 1)}>Down</button></li>) })}</ol>
              </fieldset>
            )}
            <button type="button" className="link-btn" aria-expanded={adv} onClick={() => setAdv(a => !a)}>{adv ? 'Hide' : 'Show'} advanced customisation</button>
            {adv && <div className="auth-fld"><label htmlFor={uid + 'b'}>Button label</label><input id={uid + 'b'} maxLength={30} value={inv.buttonLabel} onChange={e => setInv({ buttonLabel: e.target.value })} /></div>}
            {custom && <button type="button" className="btn btn-quiet btn-sm" onClick={() => set({ invite: { ...DEFAULT_INVITE } })}>Reset to default</button>}
          </section>
          <Audience ev={ev} set={set} res={res} />
        </div>
        <div className="inv-col"><Preview ev={ev} mail={mail} /></div>
      </div>

      <section className="inv-card" aria-labelledby={uid + 'f'}>
        <h3 id={uid + 'f'} className="inv-h">Final review</h3>
        <dl className="rev">
          <div><dt>Subject</dt><dd>{mail.subject}</dd></div>
          <div><dt>Audience</dt><dd>{plural(res.recipients.length, 'recipient', 'recipients')}{ev.audience.companies.length + ev.audience.interests.length + ev.audience.categories.length === 0 ? ' (all authorised contacts)' : ''}</dd></div>
          <div><dt>Event</dt><dd>{ev.date ? fmtShort(ev.date) : 'No date yet'}{ev.start ? `, ${ev.start}` : ''}</dd></div>
          <div><dt>Registration link</dt><dd>{regHref(ev) || 'Not set'}</dd></div>
          <div><dt>Respects preferences</dt><dd>Opted-out and unsubscribed contacts are excluded. Each email includes preference and unsubscribe links.</dd></div>
          <div><dt>Duplicate protection</dt><dd>Send reference <code>{key}</code>. A repeat of this exact invitation to this exact audience would be refused.</dd></div>
        </dl>
        <fieldset className="aud-f"><legend>When</legend>
          <div className="chips-row">
            <button type="button" className="fchip" aria-pressed={plan.when === 'now'} onClick={() => setPlan({ ...plan, when: 'now' })}>Send now</button>
            <button type="button" className="fchip" aria-pressed={plan.when === 'later'} onClick={() => setPlan({ ...plan, when: 'later' })}>Schedule</button>
            {plan.when === 'later' && <input type="datetime-local" aria-label="Send time" value={plan.at} onChange={e => setPlan({ ...plan, at: e.target.value })} />}
          </div>
        </fieldset>
        <div className="st-act">
          <button type="button" className="btn btn-glass btn-sm" disabled aria-describedby={uid + 'n'}>Send test email</button>
          <button type="button" className="btn btn-primary btn-sm" disabled aria-describedby={uid + 'n'}>{plan.when === 'now' ? 'Send' : 'Schedule send'} (unavailable)</button>
        </div>
        <p id={uid + 'n'} className="fine">Nothing is sent from this prototype. Your invitation and audience are saved with the draft. When delivery is connected, this page will show {delivery.tracks.map(t => t.toLowerCase()).join(', ')}. A click on the registration link is never counted as a registration.</p>
      </section>
    </div>
  )
}
export { CONTACTS }
