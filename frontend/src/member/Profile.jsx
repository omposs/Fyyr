import { useId, useState } from 'react'
import { validEmail } from '../auth.js'
import { Icon } from '../Icons.jsx'
import { MCATS } from './data.js'
import '../staff/profile.css' // the staff profile's card, row and setting styles, shared unchanged


export default function Profile({ c, store, np, live }) {
  const uid = useId()
  const p = store.profile
  const [d, setD] = useState({ email: p.email })
  const [n, setN] = useState({ updates: np.prefs.freq !== 'off', freq: np.prefs.freq === 'off' ? 'weekly' : np.prefs.freq, alerts: np.prefs.critical })
  const [errs, setErrs] = useState({})
  const [msg, setMsg] = useState('')
  const set = (k, v) => { setD(x => ({ ...x, [k]: v })); setMsg(''); setErrs(x => ({ ...x, [k]: '' })) }
  // Locked details: plain readable label/value rows (same row system as the staff profile), nothing to edit.
  const ro = (label, value, href) => (
    <div className="sp-row"><dt>{label}</dt><dd>{value ? (href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value) : <span className="mem-unk">Not specified</span>}</dd></div>
  )
  const initials = (p.name || p.company || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const Setting = ({ icon, label, hint, checked, onChange }) => {
    const id = uid + label.replace(/\W/g, '')
    return (
      <div className="sp-set">
        <span className="sp-set-i" aria-hidden="true"><Icon n={icon} size={18} /></span>
        <label className="sp-set-t" htmlFor={id}><b>{label}</b><small id={id + 'h'}>{hint}</small></label>
        <input id={id} type="checkbox" role="switch" checked={checked} aria-describedby={id + 'h'} onChange={e => onChange(e.target.checked)} />
      </div>
    )
  }

  const save = e => {
    e.preventDefault()
    const x = {}
    if (!validEmail(d.email)) x.email = 'Enter a valid email address, like name@company.com.'
    setErrs(x)
    if (Object.keys(x).length) { document.getElementById(uid + Object.keys(x)[0])?.focus(); return }
    const a = live ? true : store.setProfile({ email: d.email.trim() })
    const b = np.save({ ...np.prefs, freq: n.updates ? n.freq : 'off', critical: n.alerts })
    setMsg(a && b ? 'Changes saved in this browser.' : 'Storage is blocked, so changes are kept for this visit only.')
  }

  return (
    <form className="mem-page sp" noValidate onSubmit={save}>
      <header className="sp-id">
        <span className="sp-av" aria-hidden="true">{initials}</span>
        <div className="sp-id-t">
          <h2>{p.name || p.company}</h2>
          {p.title && <p>{p.title}</p>}
          <p className="sp-id-m"><span className="pill pill-blue">Member</span><span>{p.company}</span>{p.office && <><span aria-hidden="true">·</span><span>{p.office}</span></>}</p>
        </div>
      </header>

      <section className="mem-card sp-card" aria-labelledby={uid + 'a'}>
        <h2 className="mem-side-h" id={uid + 'a'}>Account details</h2>
        <dl className="sp-dl">
          {ro('Name', p.name)}{ro('Job title', p.title)}{ro('Account role', 'Member')}{ro('Company', p.company)}
          <div className="sp-row">
            <dt><label htmlFor={uid + 'email'}>Email</label></dt>
            <dd className="sp-email">
              <input id={uid + 'email'} className="sp-input" type="email" autoComplete="email" value={d.email} readOnly={live} onChange={e => set('email', e.target.value)} aria-invalid={!!errs.email} aria-describedby={uid + (errs.email ? 'emaile' : 'emailh')} />
              {errs.email ? <span className="auth-err" id={uid + 'emaile'}>{errs.email}</span> : <small className="fine" id={uid + 'emailh'}>{live ? 'This is your login email. It is managed by your account.' : 'Changing it does not change your company or what you can access.'}</small>}
            </dd>
          </div>
        </dl>
        <p className="sp-note">Name and role are managed by your organisation and cannot be edited here.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'b'}>
        <h2 className="mem-side-h" id={uid + 'b'}>Company</h2>
        <dl className="sp-dl">
          {ro('Company name', p.company)}{ro('Website', p.website && p.website.replace(/^https?:\/\//, ''), p.website)}{ro('Sector', p.sector)}{ro('Business unit', p.unit)}{ro('Office', p.office)}{ro('Workplace location', p.workplace)}{ro('Saab registered office', p.location)}{ro('Company size (Saab group)', p.size)}
          <div className="sp-row sp-wide"><dt>Description</dt><dd>{p.about}</dd></div>
        </dl>
        <p className="sp-note">Company details are read-only. Group facts come from saab.com (read 14 Nov 2026). Sector, business unit, role and office are configured profile labels for the Karlskrona location, not official Saab divisions.</p>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'c'}>
        <h2 className="mem-side-h" id={uid + 'c'}>Interests and goals</h2>
        <p className="fine">Interests update your recommendations straight away.</p>
        {p.interests.length ? <ul className="mem-chips">{p.interests.map(i => <li key={i} className="pill pill-blue">{i}</li>)}</ul> : <p className="fine">No interests selected yet.</p>}
        <div><button type="button" className="btn btn-glass btn-sm" onClick={c.openInterests}>Edit interests</button></div>
        <dl className="sp-dl">{ro('Opportunities you want', p.wants.map(w => MCATS.find(m => m.id === w)?.label || w).join(', '))}{ro('Collaboration and growth goals', p.goals.join(', '))}</dl>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'd'}>
        <div className="sp-h"><h2 className="mem-side-h" id={uid + 'd'}>Notification preferences</h2><span className="pill nw-demo" title="Saved as preferences only. Nothing is delivered in this demo.">Demo</span></div>
        <p className="fine">Saved as preferences only. No emails or notifications are sent in this demo.</p>
        <div className="sp-sets">
          <Setting icon="bell" label="Regular updates" hint="A summary of new opportunities that fit your profile." checked={n.updates} onChange={v => { setN({ ...n, updates: v }); setMsg('') }} />
          {n.updates && (
            <div className="sp-set">
              <span className="sp-set-i" aria-hidden="true"><Icon n="clock" size={18} /></span>
              <label className="sp-set-t" htmlFor={uid + 'freq'}><b>Preferred frequency</b><small>How often the summary would arrive.</small></label>
              <select id={uid + 'freq'} className="sel" value={n.freq} onChange={e => { setN({ ...n, freq: e.target.value }); setMsg('') }}><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
            </div>
          )}
          <Setting icon="clock" label="Deadline alerts" hint="A heads-up when a relevant deadline is close." checked={n.alerts} onChange={v => { setN({ ...n, alerts: v }); setMsg('') }} />
        </div>
        <div className="sp-foot">
          <p role="status" className={'sp-status' + (msg.startsWith('Changes') ? ' ok' : msg ? ' warn' : '')}>{msg}</p>
          <button type="submit" className="btn btn-primary">Save changes</button>
        </div>
      </section>
    </form>
  )
}
