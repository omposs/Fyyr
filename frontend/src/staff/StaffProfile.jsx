import { useId, useState } from 'react'
import { validEmail } from '../auth.js'
import { clearLive } from './events.js'

const ro = (label, value) => <div className="mem-ro"><dt>{label}</dt><dd>{value || <span className="mem-unk">Not specified</span>}</dd></div>

export default function StaffProfile({ sp, source }) {
  const uid = useId()
  const p = sp.profile
  const [email, setEmail] = useState(p.email)
  const [n, setN] = useState(p.notify)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [sure, setSure] = useState(false)
  const save = e => {
    e.preventDefault()
    if (!validEmail(email)) { setErr('Enter a valid email address, like name@company.com.'); document.getElementById(uid + 'email')?.focus(); return }
    setErr('')
    setMsg(sp.save({ email: email.trim(), notify: n }) ? 'Changes saved in this browser.' : 'Storage is blocked, so changes are kept for this visit only.')
  }
  return (
    <form className="mem-page mem-prof" noValidate onSubmit={save}>
      <section className="mem-card" aria-labelledby={uid + 'a'}>
        <h2 className="mem-side-h" id={uid + 'a'}>Personal details</h2>
        <dl className="mem-ro-l">{ro('Name', p.name)}{ro('Role / job title', p.title)}{ro('Account role', p.role)}</dl>
        <div className="auth-fld mem-narrow">
          <label htmlFor={uid + 'email'}>Email</label>
          <input id={uid + 'email'} type="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); setMsg(''); setErr('') }} aria-invalid={!!err} aria-describedby={err ? uid + 'e' : undefined} />
          {err && <p className="auth-err" id={uid + 'e'}>{err}</p>}
          <p className="fine">Changing your email does not change your role or what you can access.</p>
        </div>
        <p className="fine">Name, role and organisation are managed by Blue Science Park and cannot be edited here.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'b'}>
        <h2 className="mem-side-h" id={uid + 'b'}>Organisation</h2>
        <dl className="mem-ro-l mem-grid2">{ro('Organisation', p.organisation)}{ro('Office', p.office)}</dl>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'c'}>
        <h2 className="mem-side-h" id={uid + 'c'}>Notification preferences</h2>
        <p className="fine">Saved as preferences only. Nothing is delivered in this demo.</p>
        <label className="check"><input type="checkbox" role="switch" checked={n.attention} onChange={e => { setN({ ...n, attention: e.target.checked }); setMsg('') }} /> Items that need attention</label>
        <label className="check"><input type="checkbox" role="switch" checked={n.shared} onChange={e => { setN({ ...n, shared: e.target.checked }); setMsg('') }} /> Events shared by member companies</label>
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

      <div className="mem-save">
        <button type="submit" className="btn btn-primary">Save changes</button>
        <p role="status" className="mem-saved">{msg}</p>
      </div>
    </form>
  )
}
