import { PARKS } from './data.js'
import './park.css'

// One accent per science park, keyed by the stable park id. These are interface accents, not official brand colours.
export const PARK_TONE = { bsp: 'blue', cv: 'purple', ksp: 'teal', jsp: 'amber', lsp: 'rose' }
export const parkTone = id => PARK_TONE[id] || 'neutral'

// Always carries the park name, so colour is never the only cue. Unknown parks and unconfirmed affiliations stay neutral.
export function ParkBadge({ id, confirmed = true, children }) {
  const p = PARKS[id]
  const tone = confirmed && p ? parkTone(id) : 'neutral'
  return <span className="park-b" data-tone={tone}><i aria-hidden="true" />{children || (p ? p.name : 'Unknown park')}</span>
}
