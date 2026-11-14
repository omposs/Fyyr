import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InternalPage from './InternalPage.jsx'
import './styles.css'

function Root() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => { setPath(location.pathname); window.scrollTo(0, 0) }
    window.addEventListener('popstate', on)
    setPath(location.pathname) // child effects (redirects) run before this listener exists
    return () => window.removeEventListener('popstate', on)
  }, [])
  if (path === '/member' || path.startsWith('/member/')) return <InternalPage role="member" path={path} />
  if (path === '/staff') return <InternalPage role="staff" />
  return <App />
}
createRoot(document.getElementById('root')).render(<Root />)
