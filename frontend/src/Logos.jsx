import { useEffect, useMemo, useState } from 'react'
import LogoLoop from './reactbits/LogoLoop.jsx'
import { MEMBER_LOGOS, memberUrl } from './logos.js'

// Similar perceived size, not identical width: target a common area, then cap height and width.
const AREA = 4600
const size = ({ w, h }) => {
  const ar = w / h
  let dh = Math.sqrt(AREA / ar)
  dh = Math.min(54, Math.max(22, dh))
  let dw = dh * ar
  if (dw > 160) { dw = 160; dh = dw / ar }
  return { dw: Math.round(dw), dh: Math.round(dh) }
}

const useReduced = () => {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setR(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return r
}

const Img = ({ l, ...rest }) => (
  // Decorative: the surrounding link carries the accessible name. multiply drops the white background of JPG/opaque logos.
  <img src={l.src} alt="" width={l.dw} height={l.dh} loading="eager" decoding="async" draggable={false} style={{ width: l.dw, height: l.dh, mixBlendMode: 'multiply' }} {...rest} />
)

export default function Logos() {
  const reduced = useReduced()
  const logos = useMemo(() => MEMBER_LOGOS.map(l => ({ ...l, ...size(l) })), [])
  const items = useMemo(() => logos.map(l => ({ ...l, alt: `${l.name}, Blue Science Park member page`, href: memberUrl(l.slug) })), [logos])

  return (
    <section className="logos" aria-labelledby="logos-h">
      <div className="wrap">
        <div className="logos-head">
          <div>
            <h2 id="logos-h" className="logos-h">Part of the Blue Science Park network.</h2>
            <p className="muted">Meet companies across the innovation community.</p>
          </div>
        </div>
      </div>
      {reduced ? (
        <ul className="logo-grid wrap" aria-label="Blue Science Park member companies">
          {logos.map(l => (
            <li key={l.slug}><a href={memberUrl(l.slug)} target="_blank" rel="noopener noreferrer" aria-label={`${l.name}, Blue Science Park member page`}><Img l={l} /></a></li>
          ))}
        </ul>
      ) : (
        <LogoLoop
          logos={items}
          speed={36}
          gap={64}
          logoHeight={54}
          fadeOut
          fadeOutWidth={0.1}
          draggable={false}
          intro={false}
          scaleOnHover={false}
          ariaLabel="Blue Science Park member companies"
          renderItem={(item, key) => <Img key={key} l={item} />}
          className="logos-loop"
        />
      )}
      <div className="wrap"><p className="fine logos-note">Logos show membership in the Blue Science Park network, as listed on its member directory. They are not Fyyr customers and do not imply endorsement of Fyyr.</p></div>
    </section>
  )
}
