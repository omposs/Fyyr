import { useEffect, useId, useRef, useState } from 'react'
import CodeSlots from './reactbits/CodeSlots.jsx'
import { validEmail, startCooldown, useCooldown, fmtLeft, AUTH_MODE, signIn, takeNotice } from './auth.js'
import { errorText } from './api/client.js'

// AUTH_MODE=backend (default): email + password are checked by the backend and there is no code step (the backend has none).
// AUTH_MODE=demo: the original simulated flow: any valid email + any non-empty password, any 6-digit code. Nothing is sent or checked.
// The password-reset screens are always the demo (the backend has no reset).
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const EMAIL_ERR = 'Enter a valid email address, like name@company.com.'
const TITLES = {
  login: ['Welcome back', 'Log in to see opportunities matched to your company.'],
  verify: ['Check your email', null],
  forgot: ['Reset your password', 'Enter your email and we’ll send a verification code.'],
  fverify: ['Enter your code', null],
  reset: ['Choose a new password', 'Pick any new password for this demo.'],
  done: ['Password updated', null],
}

function Field({ id, label, error, ...p }) {
  return (
    <div className="auth-fld">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? id + '-e' : undefined} {...p} />
      {error && <p className="auth-err" id={id + '-e'}>{error}</p>}
    </div>
  )
}

function PwField({ id, label, show, onToggle, error, ...p }) {
  return (
    <div className="auth-fld">
      <label htmlFor={id}>{label}</label>
      <div className="auth-pw">
        <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error ? id + '-e' : undefined} {...p} />
        <button type="button" className="auth-eye" aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} onClick={onToggle}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {error && <p className="auth-err" id={id + '-e'}>{error}</p>}
    </div>
  )
}

export default function LoginModal({ onClose, onSuccess }) {
  const uid = useId()
  const [step, setStep] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [show, setShow] = useState(false)
  const [role, setRole] = useState(null)
  const [errs, setErrs] = useState({})
  const [status, setStatus] = useState('idle')
  const [slotsKey, setSlotsKey] = useState(0)
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [notice] = useState(() => (AUTH_MODE === 'backend' ? takeNotice() : null))
  const left = useCooldown()
  const card = useRef(null)
  const timers = useRef([])
  const locked = useRef(false)

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, reduced() ? Math.min(ms, 120) : ms)) }
  const cancelTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; locked.current = false; setStatus('idle') }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const close = () => { cancelTimers(); setClosing(true); later(onClose, 160) }
  const go = s => { cancelTimers(); setErrs({}); setNote(''); setSlotsKey(k => k + 1); setStep(s) }
  const focusId = k => card.current?.querySelector('#' + CSS.escape(uid + k))?.focus()

  // Scroll lock, Escape, focus trap.
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current() }
      if (e.key !== 'Tab' || !card.current) return
      const f = [...card.current.querySelectorAll('button,input,a[href]')].filter(el => !el.disabled && el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (!card.current.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); root.style.overflow = prev }
  }, [])

  useEffect(() => { card.current?.querySelector('[data-af],.slot')?.focus() }, [step])

  const pickRole = async r => {
    if (busy) return
    const e = {}
    if (!validEmail(email)) e.email = EMAIL_ERR
    if (!password) e.password = 'Enter your password.'
    setErrs(e); setFormErr('')
    if (e.email || e.password) return focusId(e.email ? 'em' : 'pw')
    if (AUTH_MODE === 'backend') {
      // The server decides: wrong credentials (401), too many attempts (429), no staff rights, offline, 5xx.
      setBusy(true)
      try { await signIn(email, password, r); setPassword(''); onSuccess(r, email.trim()) } catch (err) {
        setFormErr(err?.kind === 'auth' ? 'Invalid email or password.' : errorText(err)); setBusy(false)
      }
      return
    }
    setRole(r)
    startCooldown() // no-op while a cooldown is already running
    setPassword(''); setShow(false)
    go('verify')
  }

  const sendForgot = () => {
    if (!validEmail(email)) { setErrs({ email: EMAIL_ERR }); return }
    if (!startCooldown()) return
    go('fverify')
  }

  const resend = () => {
    if (locked.current || !startCooldown()) return
    setSlotsKey(k => k + 1)
    setNote('A new demo code was “sent”. Any 6-digit code works.')
  }

  const verified = () => {
    if (locked.current) return
    locked.current = true
    setStatus('success')
    if (step === 'verify') later(() => onSuccess(role, email.trim()), 900)
    else later(() => { locked.current = false; setStatus('idle'); setStep('reset') }, 800)
  }

  const savePw = e => {
    e.preventDefault()
    const x = {}
    if (!newPw) x.n = 'Enter a new password.'
    if (!confirmPw) x.c = 'Confirm your new password.'
    else if (newPw && newPw !== confirmPw) x.c = 'Passwords don’t match.'
    setErrs(x)
    if (x.n || x.c) return focusId(x.n ? 'np' : 'cp')
    setNewPw(''); setConfirmPw(''); setShow(false)
    go('done')
    later(() => setStep('login'), 1400)
  }

  const [title, sub] = TITLES[step]
  const cooling = left > 0
  const isCode = step === 'verify' || step === 'fverify'

  return (
    <div className="auth-ov" data-closing={closing || undefined} data-lenis-prevent onMouseDown={e => e.target === e.currentTarget && close()}>
      <div ref={card} className="auth-card" role="dialog" aria-modal="true" aria-labelledby={uid + 'h'}>
        <button type="button" className="auth-x" aria-label="Close" onClick={close}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h2 className="auth-h" id={uid + 'h'}>{title}</h2>
        {sub && <p className="auth-sub">{sub}</p>}
        {notice && step === 'login' && <p className="auth-note" role="status">{notice}</p>}
        {isCode && <p className="auth-sub">We “sent” a 6-digit code to <strong>{email.trim()}</strong>.</p>}

        {step === 'login' && (
          <form noValidate onSubmit={e => e.preventDefault()}>
            <Field id={uid + 'em'} label="Email" type="email" autoComplete="email" inputMode="email" value={email} error={errs.email} data-af
              onChange={e => { setEmail(e.target.value); setErrs(x => ({ ...x, email: '' })) }} />
            <PwField id={uid + 'pw'} label="Password" autoComplete="current-password" show={show} onToggle={() => setShow(s => !s)} value={password} error={errs.password}
              onChange={e => { setPassword(e.target.value); setErrs(x => ({ ...x, password: '' })) }} />
            <div className="auth-roles">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => pickRole('member')}>Log in as member</button>
              <button type="button" className="btn btn-dark" disabled={busy} onClick={() => pickRole('staff')}>Log in as staff</button>
            </div>
            {formErr && <p className="auth-err" role="alert">{formErr}</p>}
            <button type="button" className="auth-link" onClick={() => go('forgot')}>Forgot password?</button>
          </form>
        )}

        {step === 'forgot' && (
          <form noValidate onSubmit={e => { e.preventDefault(); sendForgot() }}>
            <Field id={uid + 'fe'} label="Email" type="email" autoComplete="email" inputMode="email" value={email} error={errs.email} data-af
              onChange={e => { setEmail(e.target.value); setErrs({}) }} />
            <p className="auth-demo">Demo mode — no email is sent. Any 6-digit code works.</p>
            <button type="submit" className="btn btn-primary auth-wide" disabled={cooling}>{cooling ? `Send code in ${fmtLeft(left)}` : 'Send verification code'}</button>
            {cooling && <button type="button" className="auth-link" onClick={() => go('fverify')}>I already have a code</button>}
            <button type="button" className="auth-link" onClick={() => go('login')}>Back to log in</button>
          </form>
        )}

        {isCode && (
          <div>
            <CodeSlots key={slotsKey} onComplete={verified} status={status} disabled={status === 'success'} />
            <p className="auth-demo">Demo mode — no email is sent. Enter any 6-digit code.</p>
            <p className="sr" role="status">{status === 'success' ? 'Code verified' : note}</p>
            {note && <p className="auth-note" aria-hidden="true">{note}</p>}
            <div className="auth-row">
              <button type="button" className="btn btn-glass btn-sm" onClick={() => go(step === 'verify' ? 'login' : 'forgot')}>Back</button>
              <button type="button" className="btn btn-glass btn-sm" disabled={cooling || status === 'success'} onClick={resend}>{cooling ? `Resend code in ${fmtLeft(left)}` : 'Resend code'}</button>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <form noValidate onSubmit={savePw}>
            <PwField id={uid + 'np'} label="New password" autoComplete="new-password" show={show} onToggle={() => setShow(s => !s)} value={newPw} error={errs.n} data-af
              onChange={e => { setNewPw(e.target.value); setErrs(x => ({ ...x, n: '' })) }} />
            <PwField id={uid + 'cp'} label="Confirm password" autoComplete="new-password" show={show} onToggle={() => setShow(s => !s)} value={confirmPw} error={errs.c}
              onChange={e => { setConfirmPw(e.target.value); setErrs(x => ({ ...x, c: '' })) }} />
            <button type="submit" className="btn btn-primary auth-wide">Update password</button>
          </form>
        )}

        {step === 'done' && <p className="auth-ok" role="status"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Back to log in with your new password…</p>}
      </div>
    </div>
  )
}
