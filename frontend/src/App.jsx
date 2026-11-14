import { useEffect, useId, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import SplitText from './reactbits/SplitText.jsx'
import Grainient from './reactbits/Grainient.jsx'
import { Dashboard, useSaved, useNotifPrefs, prefsSummary } from './Dashboard.jsx'
import Logos from './Logos.jsx'
import LoginModal from './LoginModal.jsx'
import { navigate, setSession, ROUTES } from './auth.js'
import { Icon } from './Icons.jsx'
import { COMPANIES, TOPIC } from './demoData.js'

gsap.registerPlugin(ScrollTrigger)

// Verified 13 Nov 2026: Blue Science Park's official contact page (contact form "Skriv till oss", info@bluesciencepark.se).
// Membership application itself is at https://www.bluesciencepark.se/bli-medlem/ .
const CONTACT_URL = 'https://www.bluesciencepark.se/kontakt/'
const PRIVACY_URL = 'https://www.bluesciencepark.se/gdpr/'

const LINKS = [['How it works', '#how-it-works'], ['Opportunities', '#demo'], ['About', '#about']]

const STEPS = [
  ['Browse public opportunities', 'Explore upcoming events, funding and testing opportunities.'],
  ['Connect with Blue Science Park', 'Discuss your company and how to get involved.'],
  ['Make Fyyr relevant to you', 'Review your company profile and choose the topics you want to follow.'],
]

const CLEAR = [
  'Check sources and dates.',
  'Distinguish stated facts from inferred interests.',
  'Review and correct your profile.',
  'Understand the reason behind a recommendation.',
]

const LIMITS = [
  'Company information shows its source and when it was retrieved.',
  'Recommendations explain their relevance and their uncertainty.',
  'Funding matches are suggestions, not eligibility decisions.',
  'Suggested collaborations do not imply either company has agreed.',
  'Saved opportunities can suggest interests, but a single click or search is never treated as a confirmed priority. Suggestions stay inferred until you confirm them.',
  'Non-public company information and your interactions stay private.',
  'Fyyr does not monitor sources continuously yet, and does not promise complete deadline coverage.',
]

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Heading({ children, className = '' }) {
  return <SplitText tag="h2" text={children} className={`h2 ${className}`} splitType="words" textAlign="left" delay={50} duration={0.9} rootMargin="-60px" />
}

// Scroll to the dashboard and focus it. A panel (notification preferences) opens only once the dashboard is in view.
function focusDemo(panel) {
  const el = document.getElementById('demo')
  if (!el) return
  el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
  if (!panel) return
  const t0 = performance.now()
  const check = () => {
    const top = el.getBoundingClientRect().top
    if (Math.abs(top - 84) < 14 || performance.now() - t0 > 1600) window.dispatchEvent(new CustomEvent('fyyr:open-panel', { detail: panel }))
    else requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}


// Smooth disclosure: height animates via grid rows (no max-height guesses); closed content is visibility:hidden so it is not focusable.
function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={'acc' + (open ? ' open' : '')}>
      <h3 className="acc-h">
        <button type="button" className="acc-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
          <span>{title}</span>
          <svg className="acc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </h3>
      <div className="acc-panel" id={id} role="region" aria-label={title}>
        <div className="acc-inner">{children}</div>
      </div>
    </div>
  )
}

const contactBtn = (className = '') => (
  <a className={`btn btn-primary ${className}`} href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Contact Blue Science Park<Icon n="ext" size={16} /></a>
)

export default function App() {
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState(null)
  const root = useRef(null)
  const toastEl = useRef(null)
  const timer = useRef()
  const saved = useSaved()
  const np = useNotifPrefs()
  // Cursor interaction only on devices with a fine pointer; reduced motion is handled inside Grainient.
  const [fine] = useState(() => !window.matchMedia('(pointer: coarse)').matches)

  const notify = (msg, label, fn) => {
    clearTimeout(timer.current)
    setToast({ msg, label, fn })
    timer.current = setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const t = toastEl.current
    if (!t?.showPopover) return
    try { toast ? (t.matches(':popover-open') || t.showPopover()) : (t.matches(':popover-open') && t.hidePopover()) } catch { /* unsupported */ }
  }, [toast])

  useEffect(() => {
    if (reduceMotion()) return
    // Lenis only eases wheel/touch scrolling; native scroll, anchors and keyboard still work.
    const lenis = new Lenis({ anchors: { offset: -72 } })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = t => lenis.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    const ctx = gsap.context(() => {
      gsap.from('.hero-in > *', { opacity: 0, y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.09, delay: 0.1 })
      gsap.from('.hero-dash', { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out', delay: 0.35 })
      ScrollTrigger.batch('.reveal', {
        start: 'top 92%', once: true,
        onEnter: els => gsap.from(els, { opacity: 0, y: 24, duration: 0.8, ease: 'power3.out', stagger: 0.08, clearProps: 'all' }),
      })
    }, root)
    // Failsafe: anything already on screen (or above it) must be visible even if an animation never fired.
    const rescue = () => {
      root.current?.querySelectorAll('.reveal, .split-parent, .split-parent *, .hero-in > *, .hero-dash').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.top < window.innerHeight && getComputedStyle(el).opacity === '0') gsap.set(el, { clearProps: 'opacity,transform,visibility' })
      })
    }
    const t1 = setTimeout(rescue, 3500)
    const t2 = setTimeout(() => { ScrollTrigger.refresh(); rescue() }, 6500)
    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('load', onLoad); ctx.revert(); gsap.ticker.remove(tick); lenis.destroy() }
  }, [])

  useEffect(() => {
    const esc = e => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const [loginOpen, setLoginOpen] = useState(false)
  const opener = useRef(null)
  const login = e => { opener.current = e.currentTarget; setLoginOpen(true) }
  const closeLogin = () => {
    setLoginOpen(false)
    // The mobile-menu button is hidden once the menu closes, so fall back to the burger.
    const el = opener.current?.isConnected && opener.current.offsetParent ? opener.current : document.querySelector('.burger')
    setTimeout(() => el?.focus(), 0)
  }
  const loggedIn = (role, email) => { setSession(role, email); navigate(ROUTES[role]) }
  const sample = COMPANIES[0]
  const sampleInferred = sample.interests.find(i => i.s === 'inferred')
  const [regular, critical] = prefsSummary(np.prefs)

  return (
    <div ref={root} id="top">
      <a className="skip" href="#main">Skip to content</a>

      <header className="nav">
        <div className="wrap nav-in">
          <a href="#top" className="brand" aria-label="Fyyr, by Blue Science Park – back to top">
            <span className="wordmark">FYYR</span><span className="by">by Blue Science Park</span>
          </a>
          <nav aria-label="Main" className="nav-links">{LINKS.map(([l, h]) => <a key={h} href={h}>{l}</a>)}</nav>
          <div className="nav-cta">
            <button type="button" className="link-btn" onClick={login}>Log in</button>
            {contactBtn()}
          </div>
          <button type="button" className="burger" aria-expanded={menu} aria-controls="mnav" onClick={() => setMenu(m => !m)}>
            <span className="sr">{menu ? 'Close menu' : 'Open menu'}</span><i /><i />
          </button>
        </div>
        <nav id="mnav" aria-label="Mobile" className="mnav" hidden={!menu}>
          {LINKS.map(([l, h]) => <a key={h} href={h} onClick={() => setMenu(false)}>{l}</a>)}
          <button type="button" className="link-btn" onClick={e => { setMenu(false); login(e) }}>Log in</button>
          {contactBtn()}
        </nav>
      </header>

      <main id="main">
        <div className="fyyr-hero">
          <div className="fyyr-hero-background" aria-hidden="true">
            <Grainient colors={['#F4F5FF', '#E4E6FF', '#CDD3FF', '#EEF3D6']} type="linear" angle={115} bands={1} softness={1} flow={0.6} scale={1.6} speed={0.2} silk={0.08} grainAmount={0.012} grainSize={1} grainAnimated={false} contrast={1} saturation={0.9} variation={0} interactive={fine} stir={0.35} clickSwirl={false} intro={false} lightMode={false} dpr={1.5} />
          </div>
          <section className="hero wrap fyyr-hero-content">
            <div className="hero-in">
              <h1 className="h1">The right opportunities.<br />Matched to <mark>your company.</mark></h1>
              <p className="lede">Find relevant events, funding, expertise and partnerships—all brought together around your company’s interests and priorities.</p>
              <div className="btns">
                {contactBtn('btn-lg')}
                <a href="#demo" className="link-btn browse">Browse opportunities<Icon n="arrow" size={16} /></a>
              </div>
            </div>
          </section>
        </div>

        <Logos />

        <section className="sec wrap dash-sec">
          <div className="hero-dash"><Dashboard saved={saved} np={np} notify={notify} /></div>
        </section>

        <section id="how-it-works" className="sec wrap">
          <p className="eyebrow reveal">How it works</p>
          <Heading>A simple way to get started.</Heading>
          <ol className="steps">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="step reveal"><span className="num">{i + 1}</span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>
          <p className="note-line reveal">Saved opportunities and your feedback can help refine suggestions. A single click is never treated as a confirmed priority, and you can review, edit or reset what Fyyr has inferred.</p>
        </section>

        <section className="sec wrap split">
          <div>
            <p className="eyebrow reveal">Notifications</p>
            <Heading>Stay informed. Without the noise.</Heading>
            <ul className="two reveal">
              <li><strong>Regular updates</strong><p>A daily or weekly summary of the topics you select.</p></li>
              <li><strong>Optional last-minute alerts</strong><p>An extra alert when a relevant opportunity is found near its deadline.</p></li>
            </ul>
          </div>
          <div className="panel notif-cta reveal">
            <span className="upd-k"><Icon n="bell" size={14} /> Preferences preview</span>
            <strong>{regular}</strong>
            <strong>{critical}</strong>
            <p className="fine">Stored in this browser only. Notifications are not delivered yet.</p>
            <button type="button" className="btn btn-primary" onClick={() => focusDemo('notif')}>Edit preferences</button>
          </div>
        </section>

        <section id="about" className="sec wrap split">
          <div>
            <p className="eyebrow reveal">Transparency</p>
            <Heading>Clear sources. Clear reasons.</Heading>
            <p className="lede reveal">Every recommendation can be checked, and you stay in control of what Fyyr knows about your company.</p>
            <ul className="ticks">
              {CLEAR.map(t => <li key={t} className="reveal"><Icon n="check" size={18} />{t}</li>)}
            </ul>
            <div className="how reveal"><Accordion title="How recommendations work"><ul>{LIMITS.map(t => <li key={t}>{t}</li>)}</ul></Accordion></div>
          </div>
          <div className="stack reveal">
            <div className="panel fact">
              <span className="pill pill-blue">Publicly stated fact</span>
              <p>{sample.facts[0].text}</p>
              <small><a href={sample.facts[0].url} target="_blank" rel="noopener noreferrer">{sample.facts[0].url.replace(/^https?:\/\//, '')}</a> · retrieved {sample.facts[0].retrieved}</small>
            </div>
            <div className="panel fact fact-inf">
              <span className="pill pill-dash">Inferred interest</span>
              <p>{TOPIC[sampleInferred.t]}</p>
              <small>Suggested from public information about {sample.name}. Not stated by the company: whoever uses Fyyr decides whether it belongs on the profile.</small>
            </div>
          </div>
        </section>

        <section className="sec wrap">
          <div className="band">
            <h2 className="h2 band-h">Interested in joining Blue Science Park?</h2>
            <p className="lede">Tell the team about your company and explore how to get involved.</p>
            {contactBtn('btn-lg')}
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-id">
            <p><strong>Fyyr</strong> <span className="muted">is a service by Blue Science Park.</span></p>
            <p className="copy">© {new Date().getFullYear()} Fyyr</p>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">Contact</a>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy</a>
          </nav>
        </div>
        <div className="giant" aria-hidden="true">FYYR</div>
      </footer>

      {loginOpen && <LoginModal onClose={closeLogin} onSuccess={loggedIn} />}

      <div ref={toastEl} popover="manual" className="toast" role="status" aria-live="polite">
        {toast && <><span>{toast.msg}</span>{toast.label && <button type="button" onClick={() => { toast.fn(); setToast(null) }}>{toast.label}</button>}</>}
      </div>
    </div>
  )
}
