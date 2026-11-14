import { useEffect } from 'react'
import MemberApp from './member/MemberApp.jsx'
import { clearSession, getSession, navigate } from './auth.js'

// Blank placeholders. The demo session only gates routing; it is not real authorization.
export default function InternalPage({ role, path = '' }) {
  const ok = getSession()?.role === role
  useEffect(() => {
    if (role === 'staff') document.title = 'Fyyr – Staff'
    if (!ok) navigate('/', true)
  }, [ok, role])
  if (!ok) return null
  if (role === 'member') return <MemberApp path={path} />
  return (
    <main className={`internal internal-${role}`} data-page={role}>
      <h1 className="sr">{role === 'staff' ? 'Staff area' : 'Member area'}</h1>
      <button type="button" className="link-btn internal-out" onClick={() => { clearSession(); navigate('/') }}>Log out</button>
    </main>
  )
}
