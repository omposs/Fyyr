import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../Icons.jsx'
import './notif.css'

// Bell + dropdown for signed-in areas. Looks like the public notification panel (.np in styles.css): same width, radius, shadow,
// padding, heading and separators. It lists real items only: no timestamps, unread states or delivery are invented.
//   items: [{ id, icon, title, detail, time, timeFull, unread, run }]   unread: real unread count   footer: { label, run }
//   onMarkAll: marks every item read for the signed-in account. Clicking an item is expected to mark it read inside its own run().
const PREVIEW = 5
export default function NotifMenu({ items, unread = 0, onMarkAll, empty, footer, help = 'Preview only: nothing is delivered in this demo.' }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [top, setTop] = useState(64)
  const wrap = useRef(null), panel = useRef(null), btn = useRef(null)
  const id = useId()
  const close = restore => { setOpen(false); setAll(false); if (restore) setTimeout(() => btn.current?.focus(), 0) }

  useLayoutEffect(() => { if (open && btn.current) setTop(Math.round(btn.current.getBoundingClientRect().bottom + 8)) }, [open])
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector('h3')?.focus({ preventScroll: true })
    const key = e => e.key === 'Escape' && close(true)
    const down = e => !wrap.current?.contains(e.target) && close(false)
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', down)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down) }
  }, [open])

  const move = e => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const rows = [...panel.current.querySelectorAll('[data-nm-row]')]
    if (!rows.length) return
    e.preventDefault()
    const i = rows.indexOf(document.activeElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : e.key === 'ArrowDown' ? (i + 1) % rows.length : (i <= 0 ? rows.length - 1 : i - 1)
    rows[next].focus()
  }
  const shown = all ? items : items.slice(0, PREVIEW)
  const go = fn => { close(false); fn() }
  return (
    <div className="bell-wrap" ref={wrap}>
      <button ref={btn} type="button" className="icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} aria-controls={id} onClick={() => (open ? close(false) : setOpen(true))}><Icon n="bell" />{unread > 0 && <b className="nm-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</b>}</button>
      {open && (
        <div ref={panel} id={id} className="nm" role="region" aria-label="Notifications" style={{ '--nm-top': top + 'px' }} onKeyDown={move} data-lenis-prevent>
          <div className="nm-head">
            <h3 tabIndex={-1}>Notifications{unread > 0 && <small className="nm-sub">{unread} unread</small>}</h3>
            <span className="nm-demo" tabIndex={0} title={help} aria-describedby={id + 'h'}>Demo</span>
            <span className="sr" id={id + 'h'}>{help}</span>
            <button type="button" className="icon-btn" aria-label="Close notifications" onClick={() => close(true)}><Icon n="x" /></button>
          </div>
          {shown.length ? (
            <ul className="nm-list">
              {shown.map(it => (
                <li key={it.id}>
                  <button type="button" className="nm-row" data-nm-row data-unread={it.unread || undefined} onClick={() => go(it.run)}>
                    <span className="nm-ico" aria-hidden="true"><Icon n={it.icon} size={16} /></span>
                    <span className="nm-txt"><b>{it.unread && <span className="sr">Unread: </span>}{it.title}</b>{it.detail && <small>{it.detail}</small>}{it.time && <time className="nm-time" title={it.timeFull}>{it.time}</time>}</span>
                    {it.unread && <i className="nm-new" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="nm-empty">{empty}</p>}
          <div className="nm-foot">
            {unread > 0 && onMarkAll && <button type="button" className="nm-link" onClick={onMarkAll}>Mark all as read</button>}
            {items.length > PREVIEW && <button type="button" className="nm-link" onClick={() => setAll(a => !a)} aria-expanded={all}>{all ? 'Show fewer' : `View all ${items.length}`}</button>}
            {footer && <button type="button" className="nm-link" onClick={() => go(footer.run)}>{footer.label}</button>}
          </div>
        </div>
      )}
    </div>
  )
}
