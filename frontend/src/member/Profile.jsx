import { useId, useState } from 'react'
import { validEmail } from '../auth.js'
import { GOALS, MCATS, SECTORS, SIZES } from './data.js'

const urlOk = v => { if (!v.trim()) return true; try { return !!new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : 'https://' + v.trim()).hostname.includes('.') } catch { return false } }
const toggle = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export default function Profile({ c, store, np }) {
  const uid = useId()
  const p = store.profile
  const [d, setD] = useState({ name: p.name, email: p.email, title: p.title, company: p.company, sector: p.sector, about: p.about, website: p.website, location: p.location, size: p.size, wants: p.wants, goals: p.goals })
  const [n, setN] = useState({ updates: np.prefs.freq !== 'off', freq: np.prefs.freq === 'off' ? 'weekly' : np.prefs.freq, alerts: np.prefs.critical })
  const [errs, setErrs] = useState({})
  const [msg, setMsg] = useState('')
  const set = (k, v) => { setD(x => ({ ...x, [k]: v })); setMsg(''); setErrs(x => ({ ...x, [k]: '' })) }
  const f = (k, label, extra = {}) => (
    <div className="auth-fld">
      <label htmlFor={uid + k}>{label}</label>
      <input id={uid + k} value={d[k]} onChange={e => set(k, e.target.value)} aria-invalid={!!errs[k]} aria-describedby={errs[k] ? uid + k + 'e' : undefined} {...extra} />
      {errs[k] && <p className="auth-err" id={uid + k + 'e'}>{errs[k]}</p>}
    </div>
  )
  const sel = (k, label, opts, blank) => (
    <div className="auth-fld">
      <label htmlFor={uid + k}>{label}</label>
      <select id={uid + k} value={d[k]} onChange={e => set(k, e.target.value)}>{blank && <option value="">{blank}</option>}{opts.map(o => <option key={o}>{o}</option>)}</select>
    </div>
  )

  const save = e => {
    e.preventDefault()
    const x = {}
    if (!d.name.trim()) x.name = 'Enter your name.'
    if (!validEmail(d.email)) x.email = 'Enter a valid email address, like name@company.com.'
    if (!urlOk(d.website)) x.website = 'Enter a valid website, like example.com.'
    setErrs(x)
    if (Object.keys(x).length) { document.getElementById(uid + Object.keys(x)[0])?.focus(); return }
    const a = store.setProfile({ ...d, name: d.name.trim(), email: d.email.trim() })
    const b = np.save({ ...np.prefs, freq: n.updates ? n.freq : 'off', critical: n.alerts })
    setMsg(a && b ? 'Changes saved in this browser.' : 'Storage is blocked, so changes are kept for this visit only.')
  }

  return (
    <form className="mem-page mem-prof" noValidate onSubmit={save}>
      <p className="mem-lead">Company details are fictional demo data. Only your email comes from the demo login. Everything is stored in this browser only.</p>

      <section className="mem-card" aria-labelledby={uid + 'a'}>
        <h2 className="mem-side-h" id={uid + 'a'}>Personal details</h2>
        <div className="mem-grid2">{f('name', 'Name', { autoComplete: 'name' })}{f('email', 'Email', { type: 'email', autoComplete: 'email' })}{f('title', 'Role / job title', { autoComplete: 'organization-title' })}</div>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'b'}>
        <h2 className="mem-side-h" id={uid + 'b'}>Company</h2>
        <div className="mem-grid2">
          {f('company', 'Company name', { autoComplete: 'organization' })}
          {sel('sector', 'Sector', SECTORS, 'Not specified')}
          {f('website', 'Website', { type: 'text', inputMode: 'url', autoComplete: 'url' })}
          {f('location', 'Location')}
          {sel('size', 'Company size', SIZES)}
        </div>
        <div className="auth-fld">
          <label htmlFor={uid + 'about'}>Short description</label>
          <textarea id={uid + 'about'} rows={3} maxLength={300} value={d.about} onChange={e => set('about', e.target.value)} />
        </div>
      </section>

      <section className="mem-card" aria-labelledby={uid + 'c'}>
        <h2 className="mem-side-h" id={uid + 'c'}>Interests and goals</h2>
        <p className="fine">Interests update your recommendations straight away.</p>
        {p.interests.length ? <ul className="mem-chips">{p.interests.map(i => <li key={i} className="pill pill-blue">{i}</li>)}</ul> : <p className="fine">No interests selected yet.</p>}
        <button type="button" className="btn btn-glass btn-sm" onClick={c.openInterests}>Edit interests</button>
        <fieldset className="mem-checks"><legend>Opportunities you want</legend>
          {MCATS.map(m => <label key={m.id} className="check"><input type="checkbox" checked={d.wants.includes(m.id)} onChange={() => set('wants', toggle(d.wants, m.id))} /> {m.label}</label>)}
        </fieldset>
        <fieldset className="mem-checks"><legend>Collaboration and growth goals</legend>
          {GOALS.map(g => <label key={g} className="check"><input type="checkbox" checked={d.goals.includes(g)} onChange={() => set('goals', toggle(d.goals, g))} /> {g}</label>)}
        </fieldset>
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
