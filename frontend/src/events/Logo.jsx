import { ROLES } from './logoLib.js'

// One logo, contained (never stretched or cropped) in a fixed-height box with a light or dark backing.
// Box width follows the logo's aspect ratio within limits, so wide and tall marks both stay legible.
export function Logo({ org, h = 36, plain }) {
  if (!org) return null
  const l = org.logo
  if (!l) return <span className="lg lg-text" style={{ '--lh': h + 'px' }}>{org.name}</span>
  const ar = l.w / l.h || 1
  const w = Math.round(Math.min(Math.max(h * ar, h * 1.1), h * 4.2)) + 16
  const inner = Math.max(40, Math.min(100, l.scale || 100))
  return (
    <span className={'lg lg-' + (plain ? 'plain' : l.bg === 'dark' ? 'dark' : 'light')} style={{ '--lh': h + 'px', width: w }} title={org.name}>
      <span className="lg-in" style={{ width: inner + '%', height: inner + '%' }}>
        <img src={l.src} alt={org.name} width={l.w} height={l.h} loading="lazy" decoding="async" draggable="false" />
      </span>
    </span>
  )
}

// Sponsors / partners in one balanced, wrapping row. Organiser is shown separately by the caller and never inside this row.
// `items` = [{ org, role, primary }]. Nothing is rendered when there are none.
export function SponsorRow({ items, size = 'md', label = true }) {
  const list = (items || []).filter(i => i.org)
  if (!list.length) return null
  const base = size === 'sm' ? 24 : 36
  const roles = [...new Set(list.map(i => i.role))]
  const heading = roles.length === 1 ? (roles[0] === 'partner' ? 'In partnership with' : 'Supported by') : 'Supported by'
  return (
    <div className={'sp-row sp-' + size} role="group" aria-label={heading + ': ' + list.map(i => i.org.name).join(', ')}>
      {label && <span className="sp-lab">{heading}</span>}
      <ul className="sp-list">
        {list.map(i => (
          <li key={i.org.id} className={i.primary ? 'sp-primary' : ''}>
            <Logo org={i.org} h={i.primary && size !== 'sm' ? Math.round(base * 1.35) : base} />
            {list.some(x => x.role !== i.role) && <span className="sp-role">{ROLES[i.role]}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Organiser is always labelled as such and never styled as a sponsor.
export const OrganiserLine = ({ org }) => (org ? <p className="org-line"><span>Organised by</span> <b>{org.name}</b></p> : null)
