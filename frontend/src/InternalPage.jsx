import { useEffect } from 'react'
import MemberApp from './member/MemberApp.jsx'
import StaffApp from './staff/StaffApp.jsx'
import { getSession, navigate } from './auth.js'

// Role-gated routing. The demo session only gates the UI here; it is not real authorization (see staff/analyticsApi.js).
// Staff pages are never linked from the member area, and a member session opening /staff is sent home.
export default function InternalPage({ role, path = '' }) {
  const ok = getSession()?.role === role
  useEffect(() => { if (!ok) navigate('/', true) }, [ok])
  if (!ok) return null
  return role === 'member' ? <MemberApp path={path} /> : <StaffApp path={path} />
}
