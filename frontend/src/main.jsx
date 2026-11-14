import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import InternalPage from './InternalPage.jsx'
import EventLink from './events/EventLink.jsx'
import './styles.css'

function Root() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => { setPath(location.pathname); if (!location.hash) window.scrollTo(0, 0) } // a #section keeps its own scroll target
    window.addEventListener('popstate', on)
    setPath(location.pathname) // child effects (redirects) run before this listener exists
    return () => window.removeEventListener('popstate', on)
  }, [])
  if (path === '/member' || path.startsWith('/member/')) return <InternalPage role="member" path={path} />
  if (path === '/staff' || path.startsWith('/staff/')) return <InternalPage role="staff" path={path} />
  if (path.startsWith('/events/')) return <EventLink id={decodeURIComponent(path.slice(8).replace(/\/$/, ''))} />
  return <App />
}
createRoot(document.getElementById('root')).render(<Root />)
