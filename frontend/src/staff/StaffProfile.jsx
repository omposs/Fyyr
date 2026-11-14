import { useId, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { validEmail } from '../auth.js'
import { clearLive } from './events.js'
import './profile.css'

const row = (label, value) => <div className="sp-row"><dt>{label}</dt><dd>{value || <span className="mem-unk">Not specified</span>}</dd></div>

// A setting row: icon, label, short description and a switch on the right (the existing role="switch" checkbox).
function Setting({ icon, label, hint, checked, onChange }) {
  const id = useId()
  return (
    <div className="sp-set">
      <span className="sp-set-i" aria-hidden="true"><Icon n={icon} size={18} /></span>
      <label className="sp-set-t" htmlFor={id}><b>{label}</b><small id={id + 'h'}>{hint}</small></label>
      <input id={id} type="checkbox" role="switch" checked={checked} aria-describedby={id + 'h'} onChange={e => onChange(e.target.checked)} />
    </div>
  )
}

export default function StaffProfile({ sp, source }) {
  const uid = useId()
  const p = sp.profile
  const [email, setEmail] = useState(p.email)
  const [n, setN] = useState(p.notify)
  const [err, setErr] = useState('')
  const [state, setState] = useState('idle') // idle | saved | blocked
  const [sure, setSure] = useState(false)
  const dirty = email.trim() !== p.email || n.attention !== p.notify.attention || n.shared !== p.notify.shared
  const touch = () => setState('idle')
  const save = e => {
    e.preventDefault()
    if (!validEmail(email)) { setErr('Enter a valid email address, like name@company.com.'); document.getElementById(uid + 'email')?.focus(); return }
    setErr('')
    // Success is reported only when the existing persistence (localStorage) confirms the write.
    setState(sp.save({ email: email.trim(), notify: n }) ? 'saved' : 'blocked')
  }
  const status = err ? null : state === 'saved' ? ['ok', 'Changes saved in this browser.'] : state === 'blocked' ? ['warn', 'Storage is blocked, so changes are kept for this visit only.'] : dirty ? ['', 'Unsaved changes'] : null
  return (
    <form className="mem-page sp" noValidate onSubmit={save}>
      <header className="sp-id">
        <span className="sp-av" aria-hidden="true">{p.initials}</span>
        <div className="sp-id-t">
          <h2>{p.name}</h2>
          <p>{p.title}</p>
          <p className="sp-id-m"><span className="pill pill-blue">{p.role}</span><span>{p.organisation}</span><span aria-hidden="true">·</span><span>{p.office}</span></p>
        </div>
      </header>

      <section className="mem-card sp-card" aria-labelledby={uid + 'a'}>
        <h2 className="mem-side-h" id={uid + 'a'}>Account details</h2>
        <dl className="sp-dl">
          {row('Name', p.name)}{row('Job title', p.title)}{row('Account role', p.role)}{row('Organisation', p.organisation)}{row('Office', p.office)}
          <div className="sp-row">
            <dt><label htmlFor={uid + 'email'}>Email</label></dt>
            <dd className="sp-email">
              <input id={uid + 'email'} className="sp-input" type="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); touch(); setErr('') }} aria-invalid={!!err} aria-describedby={uid + (err ? 'e' : 'eh')} />
              {err ? <span className="auth-err" id={uid + 'e'}>{err}</span> : <small className="fine" id={uid + 'eh'}>Changing it does not change your role or access.</small>}
            </dd>
          </div>
        </dl>
        <p className="sp-note">Name, role and organisation are managed by Blue Science Park and cannot be edited here.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'c'}>
        <div className="sp-h"><h2 className="mem-side-h" id={uid + 'c'}>Notification preferences</h2><span className="pill nw-demo" title="Saved as preferences only. Nothing is delivered in this demo.">Demo</span></div>
        <p className="fine">Saved as preferences only. Nothing is delivered in this demo.</p>
        <div className="sp-sets">
          <Setting icon="clock" label="Items that need attention" hint="Findings and deadlines from the overview." checked={n.attention} onChange={v => { setN({ ...n, attention: v }); touch() }} />
          <Setting icon="collab" label="Events shared by member companies" hint="When a member shares an event for staff to review." checked={n.shared} onChange={v => { setN({ ...n, shared: v }); touch() }} />
        </div>
        <div className="sp-foot">
          <p role="status" className={'sp-status' + (status?.[0] ? ' ' + status[0] : '')}>{status?.[1] || ''}</p>
          <button type="submit" className="btn btn-primary" disabled={!dirty}>Save changes</button>
        </div>
      </section>

      {source === 'live' && (
        <section className="mem-card" aria-labelledby={uid + 'd'}>
          <h2 className="mem-side-h" id={uid + 'd'}>Recorded events</h2>
          <p className="fine">Events recorded in this browser are used for the “Recorded in this browser” data source.</p>
          {sure
            ? <div className="st-act"><button type="button" className="btn btn-dark btn-sm" onClick={() => { clearLive(); setSure(false) }}>Yes, clear recorded events</button><button type="button" className="btn btn-glass btn-sm" onClick={() => setSure(false)}>Keep them</button></div>
            : <button type="button" className="btn btn-glass btn-sm" onClick={() => setSure(true)}>Clear recorded events</button>}
        </section>
      )}
    </form>
  )
}
