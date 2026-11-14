import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import { fmt } from '../demoData.js'
import { INTERESTS, MCAT, normInterest, strengthLabel } from './data.js'
import { dedupe } from './store.js'

// Shared modal behaviour: scroll lock, Escape, focus trap, focus restore.
export function Dialog({ label, onClose, side, children }) {
  const card = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    ;(card.current?.querySelector('[data-af]') || card.current)?.focus()
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current() }
      if (e.key !== 'Tab' || !card.current) return
      const f = [...card.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(el => !el.disabled && el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (!card.current.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); root.style.overflow = prev; if (opener?.isConnected) opener.focus() }
  }, [])
  return (
    <div className={'auth-ov' + (side ? ' dlg-side' : '')} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={card} tabIndex={-1} className="auth-card dlg-card" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" className="auth-x" aria-label="Close" onClick={onClose}><Icon n="x" size={18} /></button>
        {children}
      </div>
    </div>
  )
}

export function InterestsEditor({ current, onSave, onClose }) {
  const uid = useId()
  const [sel, setSel] = useState(current)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const has = s => sel.some(x => normInterest(x) === normInterest(s))
  const custom = sel.filter(s => !INTERESTS.some(i => normInterest(i) === normInterest(s)))
  const chips = [...INTERESTS, ...custom].filter(s => normInterest(s).includes(normInterest(q)))
  const toggle = s => setSel(x => (has(s) ? x.filter(y => normInterest(y) !== normInterest(s)) : [...x, s]))
  const add = () => {
    const v = q.trim().replace(/\s+/g, ' ')
    if (!v) return
    const known = [...INTERESTS, ...custom].find(s => normInterest(s) === normInterest(v))
    if (known) setMsg(has(known) ? `“${known}” is already selected.` : `Selected “${known}”.`)
    else setMsg(`Added “${v}”.`)
    if (known) { if (!has(known)) setSel(x => [...x, known]) } else setSel(x => dedupe([...x, v]))
    setQ('')
  }
  const canAdd = q.trim() && !chips.some(s => normInterest(s) === normInterest(q))
  return (
    <Dialog label="Edit interests" onClose={onClose}>
      <h2 className="auth-h">Your interests</h2>
      <p className="auth-sub">Your interests help us prioritise relevant opportunities.</p>
      <div className="auth-fld">
        <label htmlFor={uid}>Search or add an interest</label>
        <div className="int-add">
          <input id={uid} data-af type="text" maxLength={40} autoComplete="off" value={q} onChange={e => { setQ(e.target.value); setMsg('') }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="e.g. robotics" />
          <button type="button" className="btn btn-glass btn-sm" disabled={!q.trim()} onClick={add}>{canAdd ? 'Add' : 'Select'}</button>
        </div>
      </div>
      <p className="sr" role="status">{msg}</p>
      {msg && <p className="auth-note" aria-hidden="true">{msg}</p>}
      <div className="chips-row int-chips" role="group" aria-label="Interests">
        {chips.map(s => <button key={s} type="button" className="fchip" aria-pressed={has(s)} onClick={() => toggle(s)}>{s}</button>)}
        {!chips.length && <p className="fine">No suggestions match. {canAdd && 'Press Add to create your own.'}</p>}
      </div>
      <p className="fine int-count">{sel.length} selected</p>
      <div className="auth-row">
        <button type="button" className="btn btn-glass btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(sel)}>Save interests</button>
      </div>
    </Dialog>
  )
}

// ---- shared bits ----
export const SaveBtn = ({ o, c, label = true }) => {
  const on = c.saved.includes(o.id)
  return (
    <button type="button" className={label ? 'btn btn-glass btn-sm' : 'icon-btn sm'} aria-pressed={on} aria-label={label ? undefined : `${on ? 'Remove from saved' : 'Save'}: ${o.title}`} onClick={() => c.toggleSaved(o.id)}>
      <Icon n="bookmark" size={16} />{label && (on ? 'Saved' : 'Save')}
    </button>
  )
}

export const Strength = ({ x }) => { const l = strengthLabel(x); return l ? <span className={'match ' + (x.strength === 'strong' ? 'm-strong' : 'm-good')}>{l}</span> : null }

const DateLine = ({ x }) => {
  const soon = x.u && x.u.kind === 'deadline' && x.u.days <= 14
  const text = x.u ? x.u.label : x.o.dateText
  return text ? <span className={'when' + (soon ? ' when-soon' : '')}><Icon n="clock" size={14} />{text}</span> : null
}

// Real sources get a working external link. Fictional entries open the details instead of a fake destination.
export const Primary = ({ x, c }) => (x.o.url
  ? <a className="btn btn-primary btn-sm" href={x.o.url} target="_blank" rel="noopener noreferrer">{x.o.next}<Icon n="ext" size={15} /></a>
  : <button type="button" className="btn btn-primary btn-sm" onClick={() => c.openDetail(x.o.id)}>View details</button>)

// Compact card for Top matches.
export function TopCard({ x, c, feature }) {
  const { o } = x
  return (
    <li className={'opp mem-tcard' + (feature ? ' feature' : '')}>
      <div className="opp-top"><span className="ocat"><Icon n={MCAT[o.mcat].icon} size={16} />{MCAT[o.mcat].label}</span><Strength x={x} />{o.demo && <span className="pill">Demo</span>}</div>
      <h3 className="mem-h"><button type="button" className="mem-title" onClick={() => c.openDetail(o.id)}>{o.title}</button></h3>
      <p className="sum clamp">{o.summary}</p>
      {x.reasons[0] && <p className="why-line"><Icon n="spark" size={14} />{x.reasons[0]}</p>}
      <div className="opp-meta"><DateLine x={x} />{o.where && <span className="where">{o.where}</span>}</div>
      <div className="opp-actions"><Primary x={x} c={c} /><SaveBtn o={o} c={c} /></div>
    </li>
  )
}

// Light row for the category summary.
export function Row({ x, c }) {
  const { o } = x
  return (
    <li className="mem-row">
      <div>
        <button type="button" className="mem-title" onClick={() => c.openDetail(o.id)}>{o.title}</button>
        <div className="opp-meta"><Strength x={x} /><DateLine x={x} /></div>
      </div>
      <SaveBtn o={o} c={c} label={false} />
    </li>
  )
}

// Full card used on category, search and saved pages (extends the public .opp card).
export function OppCard({ x, c, expired }) {
  const { o } = x
  return (
    <li className="opp">
      <div className="opp-top"><span className="ocat"><Icon n={MCAT[o.mcat].icon} size={16} />{MCAT[o.mcat].label}</span>{expired ? <span className="pill">Expired</span> : <Strength x={x} />}{o.demo && <span className="pill">Demo</span>}</div>
      <h3 className="mem-h"><button type="button" className="mem-title lg" onClick={() => c.openDetail(o.id)}>{o.title}</button></h3>
      <p className="sum">{o.summary}</p>
      {!expired && x.reasons[0] && <div className="why"><b>Why this matches</b><p>{x.reasons.join('. ')}.</p></div>}
      {o.cat === 'funding' && o.amount && <p className="fine">Funding: {o.amount}</p>}
      <div className="opp-meta">{expired ? <span className="when">No longer open</span> : <DateLine x={x} />}{o.where && <span className="where">{o.where}</span>}</div>
      <div className="opp-actions">
        {!expired && <Primary x={x} c={c} />}
        <button type="button" className="btn btn-glass btn-sm" onClick={() => c.openDetail(o.id)}>Details</button>
        {expired
          ? <button type="button" className="btn btn-glass btn-sm" onClick={() => c.toggleSaved(o.id)}>Remove</button>
          : <SaveBtn o={o} c={c} />}
      </div>
    </li>
  )
}

const Field = ({ k, children }) => (children ? <div className="det-f"><dt>{k}</dt><dd>{children}</dd></div> : null)

export function Detail({ x, c, onClose }) {
  const { o } = x
  const [note, setNote] = useState('')
  const dates = []
  if (o.urg.length && (o.demo || o.cat === 'events')) dates.push(`${o.urgLabel}: ${o.urg.map(fmt).join(', ')}`)
  if (o.demo ? o.start : o.dateText) dates.push(o.demo ? `Event date: ${fmt(o.start)}` : o.dateText)
  return (
    <Dialog label={o.title} onClose={onClose} side>
      <p className="opp-top"><span className="ocat"><Icon n={MCAT[o.mcat].icon} size={16} />{MCAT[o.mcat].label}</span>{x.live ? <Strength x={x} /> : <span className="pill">Expired</span>}{o.demo && <span className="pill">Demo</span>}</p>
      <h2 className="auth-h det-h">{o.title}</h2>
      <p className="sum">{o.description || o.summary}</p>
      {x.live && x.reasons.length > 0 && <div className="why"><b>Why this matches you</b><ul>{x.reasons.map(r => <li key={r}>{r}</li>)}</ul></div>}
      {x.live && !x.reasons.length && <p className="fine">No match with your profile yet. <button type="button" className="auth-link inline" onClick={() => { onClose(); c.openInterests() }}>Add interests to personalise</button></p>}
      <dl className="det">
        <Field k="Organiser / provider">{o.provider}</Field>
        <Field k="Dates">{dates.length ? dates.map(d => <span key={d} className="det-l">{d}</span>) : null}</Field>
        <Field k="Location / format">{o.where}</Field>
        <Field k="Funding amount">{o.amount}</Field>
        <Field k="Intended audience">{o.audience}</Field>
        <Field k="Eligibility">{o.eligibility || o.note}</Field>
        <Field k="Facilities">{o.facilities}</Field>
        <Field k="Participation requirements">{o.requirements}</Field>
        <Field k="Expertise">{o.expertise}</Field>
        <Field k="Collaboration interests">{o.collab}</Field>
        <Field k="Source">{o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer">{o.source}</a> : null}</Field>
      </dl>
      {o.demo && <p className="notice">Fictional demo listing. It has no real source, and nothing is sent when you use its actions.</p>}
      {!o.demo && o.cat === 'funding' && <p className="fine">Funding matches are suggestions, not eligibility decisions. Check eligibility at the source.</p>}
      <p className="sr" role="status">{note}</p>
      {note && <p className="auth-note" aria-hidden="true">{note}</p>}
      <div className="auth-row det-actions">
        {x.live && (o.url
          ? <a className="btn btn-primary btn-sm" href={o.url} target="_blank" rel="noopener noreferrer">{o.next}<Icon n="ext" size={15} /></a>
          : <button type="button" className="btn btn-primary btn-sm" onClick={() => setNote('Demo only: this is a fictional listing, so nothing was sent.')}>{o.next}</button>)}
        {x.live ? <SaveBtn o={o} c={c} /> : <button type="button" className="btn btn-glass btn-sm" onClick={() => c.toggleSaved(o.id)}>{c.saved.includes(o.id) ? 'Remove from saved' : 'Save'}</button>}
      </div>
    </Dialog>
  )
}
