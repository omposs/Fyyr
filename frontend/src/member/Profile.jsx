import { useId, useState } from 'react'
import { validEmail } from '../auth.js'
import { MCATS } from './data.js'


export default function Profile({ c, store, np }) {
  const uid = useId()
  const p = store.profile
  const [d, setD] = useState({ email: p.email })
  const [n, setN] = useState({ updates: np.prefs.freq !== 'off', freq: np.prefs.freq === 'off' ? 'weekly' : np.prefs.freq, alerts: np.prefs.critical })
  const [errs, setErrs] = useState({})
  const [msg, setMsg] = useState('')
  const set = (k, v) => { setD(x => ({ ...x, [k]: v })); setMsg(''); setErrs(x => ({ ...x, [k]: '' })) }
  // Locked details: plain readable text, no input, no arrow, nothing to edit.
  const ro = (label, value, href) => (
    <div className="mem-ro"><dt>{label}</dt><dd>{value ? (href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value) : <span className="mem-unk">Not specified</span>}</dd></div>
  )

  const save = e => {
    e.preventDefault()
    const x = {}
    if (!validEmail(d.email)) x.email = 'Enter a valid email address, like name@company.com.'
    setErrs(x)
    if (Object.keys(x).length) { document.getElementById(uid + Object.keys(x)[0])?.focus(); return }
    const a = store.setProfile({ email: d.email.trim() })
    const b = np.save({ ...np.prefs, freq: n.updates ? n.freq : 'off', critical: n.alerts })
    setMsg(a && b ? 'Changes saved in this browser.' : 'Storage is blocked, so changes are kept for this visit only.')
  }

  return (
    <form className="mem-page mem-prof" noValidate onSubmit={save}>
      <section className="mem-card" aria-labelledby={uid + 'a'}>
        <h2 className="mem-side-h" id={uid + 'a'}>Personal details</h2>
        <dl className="mem-ro-l">{ro('Name', p.name)}{ro('Role / job title', p.title)}</dl>
        <div className="auth-fld mem-narrow">
          <label htmlFor={uid + 'email'}>Email</label>
          <input id={uid + 'email'} type="email" autoComplete="email" value={d.email} onChange={e => set('email', e.target.value)} aria-invalid={!!errs.email} aria-describedby={errs.email ? uid + 'emaile' : undefined} />
          {errs.email && <p className="auth-err" id={uid + 'emaile'}>{errs.email}</p>}
          <p className="fine">Changing your email does not change your company or what you can access.</p>
        </div>
        <p className="fine">Name and role are managed by your organisation and cannot be edited here.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'b'}>
        <h2 className="mem-side-h" id={uid + 'b'}>Company</h2>
        <dl className="mem-ro-l mem-grid2">
          {ro('Company name', p.company)}{ro('Website', p.website && p.website.replace(/^https?:\/\//, ''), p.website)}{ro('Sector', p.sector)}{ro('Business unit', p.unit)}{ro('Office', p.office)}{ro('Workplace location', p.workplace)}{ro('Saab registered office', p.location)}{ro('Company size (Saab group)', p.size)}
        </dl>
        <div className="mem-ro"><dl style={{ margin: 0 }}><dt>Description</dt><dd>{p.about}</dd></dl></div>
        <p className="fine">Company details are read-only. Group facts come from saab.com (read 14 Nov 2026). Sector, business unit, role and office are configured profile labels for the Karlskrona location, not official Saab divisions.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'c'}>
        <h2 className="mem-side-h" id={uid + 'c'}>Interests and goals</h2>
        <p className="fine">Interests update your recommendations straight away.</p>
        {p.interests.length ? <ul className="mem-chips">{p.interests.map(i => <li key={i} className="pill pill-blue">{i}</li>)}</ul> : <p className="fine">No interests selected yet.</p>}
        <button type="button" className="btn btn-glass btn-sm" onClick={c.openInterests}>Edit interests</button>
        <dl className="mem-ro-l">{ro('Opportunities you want', p.wants.map(w => MCATS.find(m => m.id === w)?.label || w).join(', '))}{ro('Collaboration and growth goals', p.goals.join(', '))}</dl>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'd'}>
        <h2 className="mem-side-h" id={uid + 'd'}>Notification preferences</h2>
        <p className="fine">Saved as preferences only. No emails or notifications are sent in this demo.</p>
        <label className="check"><input type="checkbox" role="switch" checked={n.updates} onChange={e => { setN({ ...n, updates: e.target.checked }); setMsg('') }} /> Regular updates</label>
        {n.updates && (
          <div className="auth-fld mem-narrow">
            <label htmlFor={uid + 'freq'}>Preferred frequency</label>
            <select id={uid + 'freq'} value={n.freq} onChange={e => { setN({ ...n, freq: e.target.value }); setMsg('') }}><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
          </div>
        )}
        <label className="check"><input type="checkbox" role="switch" checked={n.alerts} onChange={e => { setN({ ...n, alerts: e.target.checked }); setMsg('') }} /> Deadline alerts</label>
      </section>

      <div className="mem-save">
        <button type="submit" className="btn btn-primary">Save changes</button>
        <p role="status" className="mem-saved">{msg}</p>
      </div>
    </form>
  )
}
