import { Icon } from '../Icons.jsx'
import './header.css'

// ============================================================================================
// The one page header used by every staff and member page.
//   left : exactly one page icon, then the page title
//   right: notification bell, then the account link (avatar, name, organisation)
// Page controls (period, data source, search, filters, actions) do NOT live here: they go in <Toolbar>, in the content area.
// The small menu button only exists on narrow screens, where the sidebar becomes a drawer. It is a hamburger, never a page icon.
// ============================================================================================
export function AppHeader({ icon, title, menuOpen, onMenu, children }) {
  return (
    <header className="app-hd">
      <div className="app-hd-l">
        <button type="button" className="app-hd-menu" aria-label="Menu" aria-expanded={menuOpen} onClick={onMenu}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
        <span className="app-hd-ico" aria-hidden="true"><Icon n={icon} size={20} /></span>
        <h1 className="app-hd-t">{title}</h1>
      </div>
      <div className="app-hd-r">{children}</div>
    </header>
  )
}

// Avatar + name + organisation. On small screens only the avatar is visible; the full name stays in the accessible label.
export function AccountLink({ initials, name, org, href, onGo }) {
  return (
    <a href={href} className="app-acct" onClick={e => { e.preventDefault(); onGo(href) }} aria-label={`My profile: ${name}, ${org}`}>
      <span className="app-acct-av" aria-hidden="true">{initials}</span>
      <span className="app-acct-t"><b>{name}</b><small>{org}</small></span>
    </a>
  )
}

// Controls row inside the content area. Left: filters and search. Right: page actions. Render nothing when both are empty.
export function Toolbar({ left, right }) {
  if (!left && !right) return null
  return (
    <div className="app-tb">
      {left ? <div className="app-tb-l">{left}</div> : null}
      {right ? <div className="app-tb-r">{right}</div> : null}
    </div>
  )
}
