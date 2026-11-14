import { useEffect, useState } from 'react'

// CONTENT mode (what data the screens show) is independent of AUTH mode (how you log in, see auth.js).
//   demo : the original fixtures and local interactions (the full demo experience, works without a backend)
//   live : data from the backend API; failures are shown as errors, never replaced by demo data
// Default comes from VITE_CONTENT_MODE ('demo' unless set to 'live'); the header switch overrides it for this browser.
// The key deliberately does not start with "fyyr." so logging out does not forget the choice (it is not private data).
const KEY = 'fyyr:content-mode'
const envDefault = import.meta.env?.VITE_CONTENT_MODE === 'live' ? 'live' : 'demo'

export function getContentMode() {
  try { const v = localStorage.getItem(KEY); if (v === 'demo' || v === 'live') return v } catch { /* storage blocked: use the default */ }
  return envDefault
}
export function setContentMode(mode) {
  try { localStorage.setItem(KEY, mode) } catch { /* ignore */ }
  window.dispatchEvent(new Event('fyyr:content-mode'))
}
export function useContentMode() {
  const [mode, setMode] = useState(getContentMode)
  useEffect(() => {
    const on = () => setMode(getContentMode())
    window.addEventListener('fyyr:content-mode', on); window.addEventListener('storage', on)
    return () => { window.removeEventListener('fyyr:content-mode', on); window.removeEventListener('storage', on) }
  }, [])
  return mode
}
