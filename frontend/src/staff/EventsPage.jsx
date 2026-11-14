import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { navigate } from '../auth.js'
import { INTERESTS, SECTORS } from '../member/data.js'
import { OppCard, Detail, Dialog } from '../member/ui.jsx'
import { urgency, isLive } from '../demoData.js'
import { EVENT_TYPES, MODES, TIMEZONES, blankEvent, deleteEvent, saveEvent as persist, duplicateEvent, fmtShort, getEvent, isEmpty, problems, saveEvent, stateOf, useStaffEvents } from '../events/eventStore.js'
import { toOpp } from '../events/sync.js'
import { ROLES, useOrgs, loadImg } from '../events/logoLib.js'
import { Logo, SponsorRow } from '../events/Logo.jsx'
import { OrgDialog } from '../events/LogoPicker.jsx'
import InvitationStep from '../events/InvitationStep.jsx'
import { CATEGORIES, CAT_IDS, MY_OPPS, catOf, visibleFields } from '../events/categories.js'
import { audienceText, canEdit, viewerFromSession, memberCompany, audienceBadge, sharedBadge, hasGrants } from '../events/access.js'
import { AudienceSection, SharedArea } from '../events/Audience.jsx'
import { useNotifications } from '../events/notify.js'
import '../events/events.css'

const STEPS = ['Event information', 'Organisers & sponsors', 'Preview & publish', 'Prepare invitations']
const STEPS_MEMBER = ['Event information', 'Organisers & sponsors', 'Audience & publish']
export const staffCtx = (category = 'all') => ({ mode: 'staff', base: '/staff/events', category, actor: viewerFromSession() })
export const memberCtx = (category = 'all') => { const actor = viewerFromSession(); return { mode: 'member', base: '/member/' + MY_OPPS, category, actor: { ...actor, companyName: memberCompany(actor.email).name } } }
const STATE_L = { draft: 'Draft', published: 'Published', past: 'Past', archived: 'Archived' }
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`

// ---------- list ----------
// The date that matters for each category. Nothing is invented: items without a date say so.
function relevantDate(e) {
  const x = e.x || {}
  switch (e.category) {
    case 'funding': return x.deadlineMode === 'rolling' ? 'Rolling applications' : x.deadline ? 'Deadline ' + fmtShort(x.deadline) : 'No deadline set'
    case 'testing': return x.availMode === 'period' ? (x.availTo ? 'Available until ' + fmtShort(x.availTo) : 'No end date set') : 'Ongoing access'
    case 'knowledge': return x.pubDate ? 'Published ' + fmtShort(x.pubDate) : 'No date set'
    case 'people': return x.listing === 'seek' ? (x.timeframe ? 'Timeframe: ' + x.timeframe : 'No timeframe set') : (x.availability ? 'Availability: ' + x.availability : 'No date')
    default: return e.date ? fmtShort(e.date) : 'No date yet'
  }
}

function EventRow({ e, orgs, onOpen, onDup, onDel, onArchive, onPreview }) {
  const mem = e.source === 'member'
  const st = stateOf(e)
  const c = catOf(e)
  const label = e.title || 'untitled ' + c.noun
  const spons = e.sponsors.map(s => orgs[s.orgId]).filter(Boolean)
  const [sure, setSure] = useState(false)
  const kind = c.id === 'events' ? e.type : c.id === 'people' ? (e.x?.listing === 'seek' ? 'Find a collaborator' : 'Offer expertise') : null
  return (
    <li className="ev-row">
      <div className="ev-main">
        <p className="ev-meta"><span className="pill ev-cat">{c.label}</span><span className={'pill ev-' + st}>{STATE_L[st]}</span><span className={'pill aud-' + audienceBadge(e).split(' ')[0].toLowerCase()}>{audienceBadge(e)}</span>{mem && sharedBadge(e) && <span className="pill aud-shared">{sharedBadge(e)}</span>}{kind}{kind && ' · '}{relevantDate(e)}</p>
        <h3 className="mem-h"><button type="button" className="mem-title lg" onClick={onOpen}>{e.title || 'Untitled ' + c.noun}</button></h3>
        <p className="fine">{spons.length ? `${plural(spons.length, 'sponsor or partner', 'sponsors and partners')}: ${spons.map(s => s.name).join(', ')}` : 'No sponsors'} · Edited {new Date(e.updated).toLocaleDateString('en-GB')}{mem && e.shareWithBsp && hasGrants(e) && <> · Also open to {plural(e.access.companies.length, 'company', 'companies')}{e.access.members.length > 0 && <> and {plural(e.access.members.length, 'named person', 'named people')}</>}</>}</p>
      </div>
      <div className="st-act">
        <button type="button" className="btn btn-glass btn-sm" onClick={onOpen}>{st === 'draft' ? 'Continue' : st === 'archived' ? 'Open' : 'Edit'}<span className="sr">: {label}</span></button>
        <button type="button" className="btn btn-glass btn-sm" onClick={onPreview}>Preview<span className="sr">: {label}</span></button>
        <button type="button" className="btn btn-glass btn-sm" onClick={onDup}>Duplicate<span className="sr">: {label}</span></button>
        <button type="button" className="btn btn-glass btn-sm" onClick={onArchive}>{st === 'archived' ? 'Restore as draft' : 'Archive'}<span className="sr">: {label}</span></button>
        {sure
          ? <button type="button" className="btn btn-dark btn-sm" onClick={onDel}>Confirm delete</button>
          : <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSure(true)}>Delete<span className="sr">: {label}</span></button>}
      </div>
    </li>
  )
}

export function EventList({ ctx, setCategory }) {
  const all = useStaffEvents(), orgsL = useOrgs()
  const notes = useNotifications()
  const unread = notes.filter(n => !n.read).length
  const [cat, setCat] = useState(ctx.category || 'all')
  const pick = id => { setCat(id); setTab('draft'); setCategory?.(id) }
  const mine = e => (ctx.mode === 'member' ? e.source === 'member' && canEdit(e, ctx.actor) : e.source !== 'member')
  // One list of records, so an item can only ever appear once. Records without a category are events.
  const events = all.filter(e => mine(e) && (cat === 'all' || (e.category || 'events') === cat))
  const sharedN = all.filter(e => e.source === 'member' && e.status === 'published' && e.visibility === 'company' && e.shareWithBsp).length
  const orgs = useMemo(() => Object.fromEntries(orgsL.map(o => [o.id, o])), [orgsL])
  const tabs = cat === 'all' || cat === 'events' ? ['draft', 'published', 'past', 'archived'] : ['draft', 'published', 'archived']
  const [tab, setTab] = useState('draft')
  const [prev, setPrev] = useState(null)
  const by = s => events.filter(e => stateOf(e) === s)
  const shown = by(tab)
  const dup = id => { const d = duplicateEvent(id, ctx.actor); if (d) navigate(ctx.base + '/' + d.id) }
  const archive = e => { try { persist({ ...e, status: e.status === 'archived' ? 'draft' : 'archived' }, ctx.actor) } catch { /* not permitted */ } }
  const newPath = id => ctx.base + '/new' + (ctx.mode === 'staff' || ctx.mode === 'member' ? '/' + id : '')
  const noun = cat === 'all' ? 'opportunities' : CATEGORIES[cat].nouns
  const none = { draft: ['No drafts', 'Start with one of the buttons above. Your work saves automatically as a draft and stays private.'], published: [`No published ${noun}`, 'Published items appear here and in the member area.'], past: ['No past events', 'Events move here after their date.'], archived: [`No archived ${noun}`, 'Archived items are hidden from everyone else. You can restore them as drafts.'] }[tab]
  const focus = cat === 'all' ? 'events' : cat
  const preview = e => { const o = toOpp(e, orgsL, ctx.actor); setPrev({ o, live: isLive(o), u: urgency(o), reasons: [], strength: null, score: 0 }) }
  return (
    <div className="mem-page">
      <div className="eseg ev-cats" role="group" aria-label="Category">
        {['all', ...CAT_IDS].map(id => <button key={id} type="button" aria-pressed={cat === id} onClick={() => pick(id)}>{id === 'all' ? 'All categories' : CATEGORIES[id].label}</button>)}
      </div>
      <div className="ev-head">
        <p className="fine">{ctx.mode === 'member' ? 'Everything your company has created, in every category. Company-only items are visible to your company; public items are visible to everyone.' : 'Create and manage opportunities in every category. Published items appear for all members in their opportunities.'}</p>
        <div className="st-act">{CAT_IDS.map(id => <button key={id} type="button" className={'btn btn-sm ' + (id === focus ? 'btn-primary' : 'btn-glass')} onClick={() => navigate(newPath(id))}>{id === focus && <Icon n={CATEGORIES[id].icon} size={16} />}{CATEGORIES[id].add}</button>)}</div>
      </div>
      {ctx.mode === 'staff' && (
        <p className="notice"><b>Shared by members:</b> {plural(sharedN, 'opportunity', 'opportunities')} where a member company asked Blue Science Park to help invite others{unread > 0 && <> ({unread} new)</>}. <button type="button" className="auth-link inline" onClick={() => navigate('/staff/events/shared')}>Open the shared queue</button></p>
      )}
      <div className="eseg ev-tabs" role="group" aria-label="Status">
        {tabs.map(t => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{STATE_L[t]} <b>{by(t).length}</b></button>)}
      </div>
      {shown.length
        ? <ul className="ev-list">{shown.map(e => <EventRow key={e.id} e={e} orgs={orgs} onOpen={() => navigate(ctx.base + '/' + e.id)} onPreview={() => preview(e)} onDup={() => dup(e.id)} onArchive={() => archive(e)} onDel={() => { try { deleteEvent(e.id, ctx.actor) } catch { /* not permitted */ } }} />)}</ul>
        : <div className="mem-empty"><strong>{none[0]}</strong><p>{none[1]}</p></div>}
      {prev && <Detail x={prev} c={STUB} onClose={() => setPrev(null)} />}
    </div>
  )
}

// ---------- draft with autosave ----------
function useDraft(initial, ctx) {
  const [ev, setEv] = useState(initial)
  const [saved, setSaved] = useState(initial.title || initial.updated !== initial.created ? initial.updated : null)
  const [err, setErr] = useState('')
  const first = useRef(true)
  const t = useRef(0)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    clearTimeout(t.current)
    t.current = setTimeout(() => {
      if (isEmpty(ev)) return
      try { const r = saveEvent(ev, ctx.actor); setSaved(r.updated); setErr(''); if (/\/new(\/\w+)?$/.test(location.pathname)) history.replaceState(null, '', ctx.base + '/' + ev.id) } catch (e) { setErr(e.message) }
    }, 450)
    return () => clearTimeout(t.current)
  }, [ev])
  const set = patch => setEv(x => ({ ...x, ...patch }))
  return { ev, set, saved, err }
}

const Err = ({ id, m }) => (m ? <p id={id} className="fld-err" role="alert">{m}</p> : null)
function F({ id, label, hint, err, children, opt }) {
  return <div className="auth-fld ev-fld"><label htmlFor={id}>{label}{opt && <span className="opt"> (optional)</span>}</label>{children}<div className="fld-slot">{err ? <Err id={id + 'e'} m={err} /> : hint ? <p className="fine">{hint}</p> : null}</div></div>
}

async function readCover(file) {
  if (!file) return ''
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Cover images must be PNG, JPG or WebP.')
  if (file.size > 4 * 1048576) throw new Error('This cover image is over 4 MB. Choose a smaller one.')
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('The file could not be read.')); r.readAsDataURL(file) })
  const img = await loadImg(url)
  const k = Math.min(1, 1200 / img.width)
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

// ---------- step 1 ----------
function StepInfo({ ev, set, show }) {
  const uid = useId()
  const p = show ? problems(ev) : {}
  const [cerr, setCerr] = useState('')
  const cover = useRef(null)
  const has = t => ev.tags.includes(t)
  return (
    <div className="ev-form">
      <F id={uid + 't'} label="Title" err={p.title}><input id={uid + 't'} data-af value={ev.title} maxLength={120} aria-invalid={!!p.title} aria-describedby={p.title ? uid + 'te' : undefined} onChange={e => set({ title: e.target.value })} /></F>
      <F id={uid + 'd'} label="Description" err={p.description} hint={`${ev.description.length}/1200`}><textarea id={uid + 'd'} rows={5} maxLength={1200} value={ev.description} aria-invalid={!!p.description} onChange={e => set({ description: e.target.value })} /></F>
      <div className="mem-grid2">
        <F id={uid + 'c'} label="Category"><select id={uid + 'c'} value={ev.type} onChange={e => set({ type: e.target.value })}>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></F>
        <F id={uid + 'm'} label="Format"><select id={uid + 'm'} value={ev.mode} onChange={e => set({ mode: e.target.value })}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>
      </div>
      <div className="ev-3">
        <F id={uid + 'dt'} label="Date" err={p.date}><input id={uid + 'dt'} type="date" value={ev.date} aria-invalid={!!p.date} onChange={e => set({ date: e.target.value })} /></F>
        <F id={uid + 's'} label="Start" err={p.start}><input id={uid + 's'} type="time" value={ev.start} aria-invalid={!!p.start} onChange={e => set({ start: e.target.value })} /></F>
        <F id={uid + 'e'} label="End" opt err={p.end}><input id={uid + 'e'} type="time" value={ev.end} aria-invalid={!!p.end} onChange={e => set({ end: e.target.value })} /></F>
      </div>
      <F id={uid + 'z'} label="Time zone"><select id={uid + 'z'} value={ev.tz} onChange={e => set({ tz: e.target.value })}>{TIMEZONES.map(t => <option key={t}>{t}</option>)}</select></F>
      {ev.mode !== 'online' && <F id={uid + 'l'} label="Location" err={p.location}><input id={uid + 'l'} value={ev.location} maxLength={140} aria-invalid={!!p.location} placeholder="Venue and city" onChange={e => set({ location: e.target.value })} /></F>}
      {ev.mode !== 'in-person' && <F id={uid + 'k'} label="Online link" err={p.link}><input id={uid + 'k'} type="url" value={ev.link} aria-invalid={!!p.link} placeholder="https://" onChange={e => set({ link: e.target.value })} /></F>}
      <div className="mem-grid2">
        <F id={uid + 'rd'} label="Registration deadline" opt err={p.regDeadline}><input id={uid + 'rd'} type="date" value={ev.regDeadline} max={ev.date || undefined} aria-invalid={!!p.regDeadline} onChange={e => set({ regDeadline: e.target.value })} /></F>
                <F id={uid + 'ru'} label="Registration link" err={p.regUrl}><input id={uid + 'ru'} type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={ev.regUrl} aria-invalid={!!p.regUrl} aria-describedby={p.regUrl ? uid + 'rue' : undefined} placeholder="example.com/register" onChange={e => set({ regUrl: e.target.value })} /></F>
      </div>
      <fieldset className="aud-f"><legend>Topics <span className="opt">(helps match members' interests)</span></legend>
        <div className="chips-row">{INTERESTS.map(t => <button key={t} type="button" className="fchip" aria-pressed={has(t)} onClick={() => set({ tags: has(t) ? ev.tags.filter(x => x !== t) : [...ev.tags, t] })}>{t}</button>)}</div>
      </fieldset>
      <div className="auth-fld"><span className="lbl">Cover image <span className="opt">(optional)</span></span>
        {ev.cover && <img className="ev-cover" src={ev.cover} alt="Cover preview" />}
        <div className="st-act">
          <input ref={cover} type="file" className="sr" tabIndex={-1} accept="image/png,image/jpeg,image/webp" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; setCerr(''); try { const c = await readCover(f); if (c) set({ cover: c }) } catch (x) { setCerr(x.message) } }} />
          <button type="button" className="btn btn-glass btn-sm" onClick={() => cover.current?.click()}>{ev.cover ? 'Replace cover' : 'Add cover'}</button>
          {ev.cover && <button type="button" className="btn btn-quiet btn-sm" onClick={() => set({ cover: '' })}>Remove</button>}
        </div>
        <Err m={cerr} /><p className="fine">Without a cover, the event is shown without an image. Covers may be cropped to fit; logos never are.</p>
      </div>
    </div>
  )
}

// ---------- step 1 for every other category: common fields plus the category's own ----------
function Cover({ ev, set }) {
  const [cerr, setCerr] = useState('')
  const cover = useRef(null)
  return (
    <div className="auth-fld"><span className="lbl">Image <span className="opt">(optional)</span></span>
      {ev.cover && <img className="ev-cover" src={ev.cover} alt="Image preview" />}
      <div className="st-act">
        <input ref={cover} type="file" className="sr" tabIndex={-1} accept="image/png,image/jpeg,image/webp" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; setCerr(''); try { const c = await readCover(f); if (c) set({ cover: c }) } catch (x) { setCerr(x.message) } }} />
        <button type="button" className="btn btn-glass btn-sm" onClick={() => cover.current?.click()}>{ev.cover ? 'Replace image' : 'Add image'}</button>
        {ev.cover && <button type="button" className="btn btn-quiet btn-sm" onClick={() => set({ cover: '' })}>Remove</button>}
      </div>
      <Err m={cerr} />
    </div>
  )
}

function CatField({ f, uid, x, setX, p }) {
  const id = uid + f.k, v = x[f.k] ?? f.def ?? '', err = p['x.' + f.k]
  if (f.type === 'radio') {
    return (
      <fieldset className="aud-f"><legend>{f.label}</legend>
        <div className="aud-vis" role="radiogroup" aria-label={f.label}>
          {f.opts.map(([val, l]) => (
            <label key={val} className={'aud-opt' + (v === val ? ' on' : '')}><input type="radio" name={id} checked={v === val} onChange={() => setX({ [f.k]: val })} /><span><b>{l}</b></span></label>
          ))}
        </div>
      </fieldset>
    )
  }
  const common = { id, value: v, 'aria-invalid': !!err, onChange: e => setX({ [f.k]: e.target.value }) }
  return (
    <F id={id} label={f.label} opt={f.opt} err={err} hint={f.hint || (f.type === 'textarea' && f.max ? `${String(v).length}/${f.max}` : undefined)}>
      {f.type === 'select' ? <select {...common}>{f.opts.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select>
        : f.type === 'textarea' ? <textarea {...common} rows={f.rows || 3} maxLength={f.max} />
        : f.type === 'date' ? <input {...common} type="date" />
        : <input {...common} type="text" maxLength={f.max} placeholder={f.placeholder} />}
    </F>
  )
}

function StepInfoOther({ ev, set, show }) {
  const uid = useId()
  const c = catOf(ev)
  const p = show ? problems(ev) : {}
  const x = ev.x || {}
  const setX = patch => set({ x: { ...x, ...patch } })
  const fields = visibleFields(ev.category, x)
  const lead = fields.filter(f => f.type === 'radio'), rest = fields.filter(f => f.type !== 'radio')
  const rows = []
  for (const f of rest) {
    const last = rows[rows.length - 1]
    if (f.half && last && last.half && last.items.length < 2) last.items.push(f)
    else rows.push({ half: !!f.half, items: [f] })
  }
  const has = (k, t) => (ev[k] || []).includes(t)
  const toggle = (k, t) => set({ [k]: has(k, t) ? ev[k].filter(y => y !== t) : [...(ev[k] || []), t] })
  const cp = { uid, x, setX, p }
  return (
    <div className="ev-form">
      {lead.map(f => <CatField key={f.k} f={f} {...cp} />)}
      <F id={uid + 't'} label={c.titleLabel || 'Title'} err={p.title}><input id={uid + 't'} data-af value={ev.title} maxLength={120} aria-invalid={!!p.title} onChange={e => set({ title: e.target.value })} /></F>
      <F id={uid + 'd'} label="Short description" err={p.description} hint={`${ev.description.length}/300. Shown on the card.`}><textarea id={uid + 'd'} rows={3} maxLength={300} value={ev.description} aria-invalid={!!p.description} onChange={e => set({ description: e.target.value })} /></F>
      {rows.map((r, i) => r.half ? <div key={i} className="mem-grid2">{r.items.map(f => <CatField key={f.k} f={f} {...cp} />)}</div> : <CatField key={i} f={r.items[0]} {...cp} />)}
      <F id={uid + 'fd'} label="Full details" opt hint={`${(ev.details || '').length}/3000. Shown in the details panel.`}><textarea id={uid + 'fd'} rows={6} maxLength={3000} value={ev.details || ''} onChange={e => set({ details: e.target.value })} /></F>
      <fieldset className="aud-f"><legend>Topics <span className="opt">(helps match members' interests)</span></legend>
        <div className="chips-row">{INTERESTS.map(t => <button key={t} type="button" className="fchip" aria-pressed={has('tags', t)} onClick={() => toggle('tags', t)}>{t}</button>)}</div>
      </fieldset>
      <fieldset className="aud-f"><legend>Industries <span className="opt">(optional)</span></legend>
        <div className="chips-row">{SECTORS.map(t => <button key={t} type="button" className="fchip" aria-pressed={has('industries', t)} onClick={() => toggle('industries', t)}>{t}</button>)}</div>
      </fieldset>
      <div className="mem-grid2">
        <F id={uid + 'ru'} label={c.linkLabel} opt={c.link === 'opt'} err={p.regUrl} hint={c.link === 'either' ? 'Add this or a contact route.' : c.linkHint}><input id={uid + 'ru'} type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={ev.regUrl} aria-invalid={!!p.regUrl} placeholder="example.com/page" onChange={e => set({ regUrl: e.target.value })} /></F>
        <F id={uid + 'ct'} label={c.contactLabel || 'Contact route'} opt={c.contact === 'opt'} err={p.contact} hint={c.contact === 'either' ? 'Add this or a link.' : 'An email address, a website or a short instruction.'}><input id={uid + 'ct'} type="text" autoComplete="off" spellCheck={false} maxLength={160} value={ev.contact || ''} aria-invalid={!!p.contact} placeholder="name@company.com" onChange={e => set({ contact: e.target.value })} /></F>
      </div>
      <Cover ev={ev} set={set} />
    </div>
  )
}
const StepInfoRouter = props => (props.ev.category && props.ev.category !== 'events' ? <StepInfoOther {...props} /> : <StepInfo {...props} />)

// ---------- step 2 ----------
function OrgSlot({ org, onChange, onRemove, label }) {
  return org
    ? <div className="ev-slot"><Logo org={org} h={40} /><div className="ev-slot-t"><b>{org.name}</b><small>{org.logo ? 'Logo saved' : 'No logo, name shown instead'}</small></div><button type="button" className="btn btn-glass btn-sm" onClick={onChange}>Change</button><button type="button" className="btn btn-quiet btn-sm" onClick={onRemove}>Remove<span className="sr"> {label}</span></button></div>
    : <button type="button" className="btn btn-glass btn-sm" onClick={onChange}><Icon n="spark" size={15} />Choose {label}</button>
}

function StepOrgs({ ev, set }) {
  const orgsL = useOrgs()
  const orgs = useMemo(() => Object.fromEntries(orgsL.map(o => [o.id, o])), [orgsL])
  const [dlg, setDlg] = useState(null) // 'organiser' | 'sponsor'
  const sp = ev.sponsors
  const c = catOf(ev), isEv = c.id === 'events'
  const move = (i, d) => { const s = [...sp]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; set({ sponsors: s }) }
  const upd = (i, patch) => set({ sponsors: sp.map((s, k) => (k === i ? { ...s, ...patch } : patch.primary ? { ...s, primary: false } : s)) })
  return (
    <div className="ev-form">
      <section className="inv-card">
        <h3 className="inv-h">{c.orgLabel} <span className="opt">(optional)</span></h3>
        <p className="fine">{c.orgHint}</p>
        <OrgSlot label={isEv ? 'organiser' : 'organisation'} org={ev.organiser ? orgs[ev.organiser] : null} onChange={() => setDlg('organiser')} onRemove={() => set({ organiser: null })} />
      </section>
      <section className="inv-card">
        <h3 className="inv-h">Sponsors and partners <span className="opt">(optional)</span></h3>
        <p className="fine">Only add organisations that actually support this {c.noun}. Nothing is added automatically. Choose a saved logo or upload one once; it is reused everywhere.</p>
        {sp.length > 0 && (
          <ol className="sp-edit">{sp.map((s, i) => { const o = orgs[s.orgId]; return o && (
            <li key={s.orgId}>
              <Logo org={o} h={40} />
              <span className="ev-slot-t"><b>{o.name}</b>{!o.logo && <small>No logo, name shown instead</small>}</span>
              <label className="sel-l"><span className="sr">Role for {o.name}</span><select value={s.role} onChange={e => upd(i, { role: e.target.value })}>{['sponsor', 'partner'].map(r => <option key={r} value={r}>{ROLES[r]}</option>)}</select></label>
              <label className="chk"><input type="checkbox" checked={!!s.primary} onChange={e => upd(i, { primary: e.target.checked })} />Primary</label>
              <span className="st-act"><button type="button" className="btn btn-quiet btn-sm" disabled={i === 0} aria-label={`Move ${o.name} earlier`} onClick={() => move(i, -1)}>Up</button><button type="button" className="btn btn-quiet btn-sm" disabled={i === sp.length - 1} aria-label={`Move ${o.name} later`} onClick={() => move(i, 1)}>Down</button><button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove ${o.name}`} onClick={() => set({ sponsors: sp.filter((_, k) => k !== i) })}>Remove</button></span>
            </li>) })}</ol>
        )}
        <button type="button" className="btn btn-glass btn-sm" onClick={() => setDlg('sponsor')}><Icon n="spark" size={15} />Add sponsor or partner</button>
        {sp.length > 0 && <div className="sp-preview"><span className="fine">How it appears</span><SponsorRow items={sp.map(s => ({ ...s, org: orgs[s.orgId] }))} /></div>}
      </section>
      {dlg && <OrgDialog title={dlg === 'organiser' ? (isEv ? 'Choose organiser' : 'Choose organisation') : 'Add sponsor or partner'} taken={dlg === 'sponsor' ? sp.map(s => s.orgId) : []} onClose={() => setDlg(null)}
        onPick={o => { if (dlg === 'organiser') set({ organiser: o.id }); else set({ sponsors: [...sp, { orgId: o.id, role: 'sponsor', primary: false }] }); setDlg(null) }} />}
    </div>
  )
}

// ---------- step 3 ----------
export const STUB = { saved: [], toggleSaved() {}, openDetail() {}, trackSource() {}, markNotRelevant() {}, openInterests() {} }
function StepPublish({ ev, set, goStep, ctx }) {
  const member = ctx.mode === 'member'
  const noun = catOf(ev).noun, isEv = catOf(ev).id === 'events'
  const [confirm, setConfirm] = useState(false)
  const orgsL = useOrgs()
  const [detail, setDetail] = useState(false)
  const probs = problems(ev)
  const keys = Object.keys(probs)
  const ready = keys.length === 0
  const opp = useMemo(() => (ev.date || !isEv ? toOpp(member ? { ...ev, source: 'member', owner: { company: ctx.actor.companyName || '', companyId: ctx.actor.companyId } } : ev, orgsL, ctx.actor) : null), [ev, orgsL]) // eslint-disable-line react-hooks/exhaustive-deps
  const x = opp && { o: opp, live: isLive(opp), u: urgency(opp), reasons: [], strength: null, score: 0 }
  const st = stateOf(ev)
  return (
    <div className="ev-form">
      <section className="inv-card">
        <h3 className="inv-h">Before publishing</h3>
        {ready ? <p className="chk-ok"><Icon n="check" size={16} />All required details are filled in.</p> : (
          <ul className="probs">{keys.map(k => <li key={k}>{probs[k]}</li>)}</ul>
        )}
        {!ready && <button type="button" className="btn btn-glass btn-sm" onClick={() => goStep(0)}>Fix in the {noun} information</button>}
      </section>
      <section className="inv-card">
        <h3 className="inv-h">{member ? 'What your audience will see' : 'What members will see'}</h3>
        {x ? (
          <>
            <ul className="cards ev-prevcard"><OppCard x={x} c={STUB} /></ul>
            <button type="button" className="btn btn-glass btn-sm" onClick={() => setDetail(true)}>Preview {noun} details</button>
          </>
        ) : <p className="fine">Add a date in step 1 to preview the card.</p>}
        <p className="fine">{member ? 'People who can view this ' + noun + ' see the card in their opportunities and a details panel with sponsors at the top.' : 'Members see the card in their opportunities and a details panel with sponsors at the top.'}{isEv ? ' Registration goes to your registration link.' : ' It is labelled as submitted by ' + (member ? 'your company' : 'Blue Science Park staff') + ' and not independently verified.'}</p>
      </section>
      {member && <AudienceSection ev={ev} set={set} ctx={ctx} />}
      <section className="inv-card">
        <h3 className="inv-h">Status</h3>
        <p><span className={'pill ev-' + st}>{STATE_L[st]}</span>{ev.publishedAt && <> Published {new Date(ev.publishedAt).toLocaleDateString('en-GB')}</>}</p>
        {ev.status === 'archived'
          ? <div className="st-act"><button type="button" className="btn btn-glass btn-sm" onClick={() => set({ status: 'draft' })}>Restore as draft</button><p className="fine">Archived items are hidden from everyone else. Restoring makes it a private draft again; publish it when you are ready.</p></div>
          : ev.status === 'published'
          ? <div className="st-act"><button type="button" className="btn btn-glass btn-sm" onClick={() => set({ status: 'draft' })}>Unpublish (back to draft)</button><button type="button" className="btn btn-glass btn-sm" onClick={() => set({ status: 'archived' })}>Archive</button><p className="fine">{member ? 'Changes are visible to your audience straight away.' : 'Changes you make are visible to members straight away.'}{isEv && member ? ' Unpublishing hides the event in Fyyr but does not cancel anyone who already registered on your registration page.' : ''}</p></div>
          : <div className="st-act"><button type="button" className="btn btn-primary" disabled={!ready} onClick={() => (member ? setConfirm(true) : set({ status: 'published', publishedAt: Date.now() }))}>Publish {noun}</button>{!ready && <p className="fine">Fix the items above to publish. Your draft stays saved.</p>}</div>}
      </section>
      {detail && x && <Detail x={x} c={STUB} onClose={() => setDetail(false)} />}
      {confirm && ev.status !== 'published' && (
        <Dialog label={'Publish ' + noun} onClose={() => setConfirm(false)}>
          <h2 className="auth-h">Publish this {noun}?</h2>
          <p className="sum"><b>Audience: {ev.visibility === 'public' ? 'Public' : 'Company only'}.</b> {audienceText(ev.visibility, ev.category)}</p>
          {ev.visibility === 'company' && ev.shareWithBsp && <p className="sum">Blue Science Park staff will be told once that you shared it, and can then choose additional companies or individual members to give access. Nothing becomes public.</p>}
          <div className="auth-row"><button type="button" className="btn btn-glass btn-sm" onClick={() => setConfirm(false)}>Not yet</button><button type="button" className="btn btn-primary btn-sm" onClick={() => { set({ status: 'published', publishedAt: Date.now() }); setConfirm(false) }}>Publish</button></div>
        </Dialog>
      )}
    </div>
  )
}

// ---------- editor shell ----------
export function Editor({ initial, ctx }) {
  const { ev, set, saved, err } = useDraft(initial, ctx)
  const member = ctx.mode === 'member'
  const c = catOf(ev), isEv = c.id === 'events'
  const STEP_L = member ? STEPS_MEMBER.map((t, i) => (i === 0 && !isEv ? c.label + ' information' : t)) : isEv ? STEPS : STEPS.slice(0, 3).map((t, i) => (i === 0 ? c.label + ' information' : t))
  const last = STEP_L.length - 1
  const [step, setStep] = useState(Math.min(initial.step || 0, last))
  const [show, setShow] = useState(false)
  const head = useRef(null)
  useEffect(() => { document.getElementById('st-main')?.scrollTo?.(0, 0) }, [step])
  const go = n => { setStep(n); set({ step: n }); setTimeout(() => head.current?.focus(), 0) }
  const next = () => { if (step === 0) setShow(true); go(step + 1) }
  const st = stateOf(ev)
  return (
    <div className="mem-page ev-editor">
      <div className="ev-top">
        <button type="button" className="link-btn" onClick={() => navigate(ctx.base)}>← {member ? 'My opportunities' : 'All opportunities'}</button>
        <p className="ev-status" role="status"><span className={'pill ev-' + st}>{STATE_L[st]}</span> {err ? <span className="fld-err">{err}</span> : saved ? `Saved ${new Date(saved).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet. Saves automatically once you start.'}</p>
      </div>
      <nav aria-label="Steps"><ol className="ev-steps">{STEP_L.map((s, i) => <li key={s}><button type="button" aria-current={step === i ? 'step' : undefined} onClick={() => { if (step === 0) setShow(true); go(i) }}><b>{i + 1}</b>{s}</button></li>)}</ol></nav>
      <h2 className="ev-h2" ref={head} tabIndex={-1}>{ev.title.trim() || 'New ' + c.noun} <span>· {STEP_L[step]}</span></h2>
      {ev.status === 'archived' && <p className="notice">This {c.noun} is archived and hidden from everyone else. Restore it from the last step to edit and publish again.</p>}
      {ev.status === 'published' && step < 2 && <p className="notice">This {c.noun} is published. Edits are visible to {member ? 'everyone who can view it' : 'members'} straight away.</p>}
      {step === 0 && <StepInfoRouter ev={ev} set={set} show={show} />}
      {step === 1 && <StepOrgs ev={ev} set={set} />}
      {step === 2 && <StepPublish ev={ev} set={set} ctx={ctx} goStep={n => { setShow(true); go(n) }} />}
      {step === 3 && !member && isEv && <InvitationStep ev={ev} set={set} goStep={n => { setShow(true); go(n) }} />}
      <div className="ev-nav">
        <button type="button" className="btn btn-glass" disabled={step === 0} onClick={() => go(step - 1)}>Back</button>
        {step < last ? <button type="button" className="btn btn-primary" onClick={next}>Continue</button> : <button type="button" className="btn btn-primary" onClick={() => navigate(ctx.base)}>Done</button>}
      </div>
    </div>
  )
}

// Event editor/list shared by staff and members. `sub` is the path after /events (staff) or /my-events (member).
export function EventsRouter({ ctx, sub, setCategory }) {
  useStaffEvents()
  if (!sub) return <EventList ctx={ctx} setCategory={setCategory} />
  const nw = sub.match(/^new(?:\/(\w+))?$/)
  if (nw) {
    const category = CATEGORIES[nw[1]] ? nw[1] : CATEGORIES[ctx.category] ? ctx.category : 'events'
    return <Editor key={'new-' + category} ctx={{ ...ctx, category }} initial={blankEvent({ category, ...(ctx.mode === 'member' ? { source: 'member', visibility: 'company' } : {}) })} />
  }
  const e = getEvent(sub)
  const back = <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(ctx.base)}>Back to the list</button>
  if (!e) return <div className="mem-empty"><strong>Not found</strong><p>It may have been deleted.</p>{back}</div>
  if (!canEdit(e, ctx.actor)) return <div className="mem-empty"><strong>You can't edit this</strong><p>{e.source === 'member' && ctx.mode === 'staff' ? 'Member events can only be edited by the company that created them. Staff can manage who has access from the shared queue.' : 'Only the company that created it can edit this event.'}</p>{back}</div>
  return <Editor key={e.id} ctx={{ ...ctx, category: e.category || 'events' }} initial={e} />
}

export default function EventsPage({ sub }) {
  const [category, setCategory] = useState('all')
  const ctx = staffCtx(category)
  if (sub === 'shared' || sub?.startsWith('shared/')) return <SharedArea ctx={ctx} id={sub.slice(7)} />
  return <EventsRouter ctx={ctx} sub={sub} setCategory={setCategory} />
}
