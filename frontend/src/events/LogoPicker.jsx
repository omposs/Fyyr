import { useId, useRef, useState } from 'react'
import { Dialog } from '../member/ui.jsx'
import { Icon } from '../Icons.jsx'
import { Logo } from './Logo.jsx'
import { MAX_BYTES, deleteOrg, normaliseUrl, readLogoFile, saveOrg, searchOrgs, trimLogo, untrimLogo, useOrgs, validUrl } from './logoLib.js'

// Organisation + logo library dialog. Pick an existing organisation, or add / edit one (name, website, logo).
// A logo is saved once on the organisation and reused for every event and invitation.
function LogoField({ logo, setLogo, setErr, notes, setNotes }) {
  const uid = useId()
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const take = async f => {
    setBusy(true); setErr('')
    try { const r = await readLogoFile(f); setLogo(r.logo); setNotes(r.notes) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const trim = async () => {
    setErr('')
    try { const t = await trimLogo(logo); if (!t) setNotes(['Nothing to trim: this logo has no extra space around it.']); else { setLogo(t); setNotes([]) } } catch (e) { setErr(e.message) }
  }
  return (
    <div className="lgf">
      <div
        className={'lg-drop' + (over ? ' over' : '')}
        onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]) }}
      >
        {logo ? <div className="lg-stage" data-bg={logo.bg}><Logo org={{ name: 'Logo preview', logo }} h={72} plain /></div> : <p className="fine">Drop a logo here</p>}
        <p className="fine">PNG (transparent is best), JPG, WebP or SVG, up to {MAX_BYTES / 1048576} MB.</p>
        <input ref={input} id={uid} type="file" className="sr" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" tabIndex={-1} onChange={e => { take(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className="btn btn-glass btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Reading…' : logo ? 'Replace logo' : 'Choose file'}</button>
      </div>
      {logo && (
        <div className="lg-tools">
          <div className="lg-tool"><span>Backing</span>
            <div className="eseg" role="group" aria-label="Logo backing">
              {[['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => <button key={v} type="button" aria-pressed={logo.bg === v} onClick={() => setLogo({ ...logo, bg: v })}>{l}</button>)}
            </div>
          </div>
          <label className="lg-tool"><span>Size</span><input type="range" min="40" max="100" step="5" value={logo.scale} onChange={e => setLogo({ ...logo, scale: +e.target.value })} aria-label="Logo size" /><output>{logo.scale}%</output></label>
          {logo.kind !== 'svg' && (
            <div className="lg-tool"><span>Whitespace</span>
              {logo.trimmed
                ? <button type="button" className="btn btn-glass btn-sm" onClick={() => setLogo(untrimLogo(logo))}>Restore original</button>
                : <button type="button" className="btn btn-glass btn-sm" onClick={trim}>Trim extra space</button>}
            </div>
          )}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setLogo(null); setNotes([]) }}>Remove logo</button>
        </div>
      )}
      {logo?.trimmed && logo.original && (
        <div className="lg-cmp" aria-label="Trim preview">
          <figure><div className="lg-stage" data-bg={logo.bg}><img src={logo.original.src} alt="Original logo" /></div><figcaption>Original</figcaption></figure>
          <figure><div className="lg-stage" data-bg={logo.bg}><img src={logo.src} alt="Trimmed logo" /></div><figcaption>Trimmed (used)</figcaption></figure>
        </div>
      )}
      {notes.map(n => <p key={n} className="notice">{n}</p>)}
    </div>
  )
}

function OrgForm({ initial, onSaved, onCancel, saveLabel }) {
  const uid = useId()
  const [name, setName] = useState(initial?.name || '')
  const [website, setWebsite] = useState(initial?.website || '')
  const [logo, setLogo] = useState(initial?.logo || null)
  const [err, setErr] = useState('')
  const [notes, setNotes] = useState([])
  const [fld, setFld] = useState({})
  const submit = e => {
    e.preventDefault()
    const f = {}
    if (!name.trim()) f.name = 'Add the organisation name.'
    if (website.trim() && !validUrl(normaliseUrl(website))) f.website = 'Enter a valid website, like example.com'
    setFld(f)
    if (Object.keys(f).length) return
    try { onSaved(saveOrg({ id: initial?.id, name, website, logo })) } catch (e2) { setErr(e2.message) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <div className="mem-grid2">
        <div className="auth-fld"><label htmlFor={uid + 'n'}>Organisation name</label><input id={uid + 'n'} data-af value={name} maxLength={80} aria-invalid={!!fld.name} aria-describedby={fld.name ? uid + 'ne' : undefined} onChange={e => setName(e.target.value)} />{fld.name && <p id={uid + 'ne'} className="fld-err" role="alert">{fld.name}</p>}</div>
        <div className="auth-fld"><label htmlFor={uid + 'w'}>Website <span className="opt">(optional)</span></label><input id={uid + 'w'} value={website} maxLength={200} placeholder="example.com" aria-invalid={!!fld.website} aria-describedby={fld.website ? uid + 'we' : undefined} onChange={e => setWebsite(e.target.value)} />{fld.website && <p id={uid + 'we'} className="fld-err" role="alert">{fld.website}</p>}</div>
      </div>
      <p className="lg-lab">Logo <span className="opt">(optional)</span></p>
      <LogoField logo={logo} setLogo={setLogo} setErr={setErr} notes={notes} setNotes={setNotes} />
      {err && <p className="fld-err" role="alert">{err}</p>}
      <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onCancel}>Cancel</button><button type="submit" className="btn btn-primary btn-sm">{saveLabel}</button></div>
    </form>
  )
}

// onPick(org): the chosen organisation. `taken` = ids that cannot be chosen again (shown disabled).
export function OrgDialog({ title, onPick, onClose, taken = [] }) {
  const orgs = useOrgs()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null) // null = list, {} = new, org = editing
  const [sure, setSure] = useState(null)
  const list = searchOrgs(orgs, q)
  return (
    <Dialog label={title} onClose={onClose} wide>
      {edit ? (
        <>
          <h2 className="auth-h">{edit.id ? `Edit ${edit.name}` : 'Add organisation'}</h2>
          <p className="auth-sub">Saved to the shared library, so you only do this once.</p>
          <OrgForm initial={edit} saveLabel={onPick ? 'Save and use' : 'Save'} onCancel={() => setEdit(null)} onSaved={o => { setEdit(null); onPick?.(o) }} />
        </>
      ) : (
        <>
          <h2 className="auth-h">{title}</h2>
          <p className="auth-sub">Choose from the shared library, or add a new organisation with its logo.</p>
          <div className="auth-fld"><label htmlFor="org-q">Search organisations</label><input id="org-q" data-af type="search" value={q} placeholder="Name or website" onChange={e => setQ(e.target.value)} /></div>
          <ul className="org-list">
            {list.map(o => (
              <li key={o.id}>
                <button type="button" className="org-pick" disabled={taken.includes(o.id)} onClick={() => onPick?.(o)}>
                  <Logo org={o} h={34} />
                  <span className="org-txt"><b>{o.name}</b><small>{taken.includes(o.id) ? 'Already added' : o.website ? o.website.replace(/^https?:\/\//, '') : 'No website'}{!o.logo && ' · no logo'}</small></span>
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEdit(o)}>Edit / replace logo</button>
                {sure === o.id
                  ? <button type="button" className="btn btn-dark btn-sm" onClick={() => { deleteOrg(o.id); setSure(null) }}>Confirm delete</button>
                  : <button type="button" className="btn btn-quiet btn-sm" aria-label={`Delete ${o.name}`} onClick={() => setSure(o.id)}>Delete</button>}
              </li>
            ))}
          </ul>
          {!list.length && <p className="fine">{orgs.length ? `No saved organisation matches “${q}”.` : 'No organisations saved yet.'}</p>}
          <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Close</button><button type="button" className="btn btn-primary btn-sm" onClick={() => setEdit({ name: q.trim() })}><Icon n="spark" size={15} />Add organisation{q.trim() ? ` “${q.trim()}”` : ''}</button></div>
        </>
      )}
    </Dialog>
  )
}
