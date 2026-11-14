import { useEffect, useState } from 'react'
import MemberApp from './member/MemberApp.jsx'
import StaffApp from './staff/StaffApp.jsx'
import { AUTH_MODE, ROUTES, getSession, navigate, rememberDestination, verifyStaff } from './auth.js'
import { errorText, onSessionEnded } from './api/client.js'
import * as api from './api/api.js'

// Role-gated routing. The session check ALWAYS ends in one of four states:
//   ok       the server confirmed the session (and, for /staff, admin rights): the app is shown
//   login    no session, or the server rejected it (401): the login dialog opens and returns here afterwards
//   denied   signed in but not allowed here (staff area without admin rights): a message with a way back, nobody is logged out
//   error    the server could not be reached or failed: a clear message with a working Retry button
// The role gate only chooses which screens to show; the backend enforces permissions on every request.
// AUTH_MODE=demo keeps the original gate exactly: the simulated session only gates the UI (see staff/analyticsApi.js).
function DemoGate({ role, path = '' }) {
  const ok = getSession()?.role === role
  useEffect(() => { if (!ok) navigate('/', true) }, [ok])
  if (!ok) return null
  return role === 'member' ? <MemberApp path={path} /> : <StaffApp path={path} />
}

export default function InternalPage(props) { return AUTH_MODE === 'demo' ? <DemoGate {...props} /> : <BackendGate {...props} /> }

function BackendGate({ role, path = '' }) {
  const s = getSession()
  const [state, setState] = useState({ phase: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { if (!s) { rememberDestination(location.pathname + location.search); navigate('/', true) } }, [s?.memberId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onSessionEnded(() => { rememberDestination(location.pathname + location.search, 'Your session has ended. Please log in again.'); navigate('/', true) }), [])

  useEffect(() => {
    const cur = getSession()
    if (!cur) return
    if (role === 'member' && cur.role === 'staff') { navigate('/staff', true); return } // a staff session lives in the staff area
    const c = new AbortController()
    setState({ phase: 'checking' })
    ;(async () => {
      try {
        await api.me(c.signal, 10000)
        const admin = role === 'staff' ? await verifyStaff(c.signal) : true
        setState({ phase: admin ? 'ok' : 'denied' })
      } catch (e) {
        if (e?.name === 'AbortError' || e?.kind === 'auth') return // 401: request() already ended the session and the listener above opens the login dialog
        setState({ phase: 'error', error: e })
      }
    })()
    return () => c.abort()
  }, [s?.memberId, role, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null
  const box = children => <main className="mem-content"><div className="mem-empty">{children}</div></main>
  if (state.phase === 'checking') return <p className="fine" role="status" style={{ padding: 32 }}>Checking your session…</p>
  if (state.phase === 'error') return box(<>
    <strong>Could not reach the server</strong>
    <p role="alert">{errorText(state.error)}</p>
    <p><button type="button" className="btn btn-primary btn-sm" onClick={() => setAttempt(a => a + 1)}>Retry</button> <button type="button" className="btn btn-glass btn-sm" onClick={() => navigate('/')}>Back to home</button></p>
  </>)
  if (state.phase === 'denied') return box(<>
    <strong>Staff access required</strong>
    <p>Your account is signed in, but it does not have staff permissions. Nothing was changed.</p>
    <p><button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/member')}>Back to the member area</button></p>
  </>)
  return role === 'member' ? <MemberApp key={s.memberId} path={path} /> : <StaffApp key={s.memberId} path={path} />
}
