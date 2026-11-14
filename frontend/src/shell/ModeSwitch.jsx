import { setContentMode, useContentMode } from '../data/mode.js'

// Small, consistent content-mode indicator in the page header. Members can switch between the full demo content and live backend data
// (sign-in is separate: you can be logged in through the backend and still show the demo). `fixed` pages (staff analytics) have no
// backend source yet, so they only label themselves as demo.
export default function ModeSwitch({ fixed }) {
  const mode = useContentMode()
  if (fixed) return <span className="mode-pill" data-mode="demo" title="These screens use demo data: the backend has no company-wide analytics yet."><i aria-hidden="true" /><span>Demo data</span></span>
  const live = mode === 'live'
  const next = live ? 'demo' : 'live'
  const text = live ? 'Showing live data from the backend. Select to show the demo data instead.' : 'Showing demo data. Select to show live data from the backend.'
  return (
    <button type="button" className="mode-pill" data-mode={mode} title={text} aria-label={text} onClick={() => setContentMode(next)}>
      <i aria-hidden="true" /><span>{live ? 'Live data' : 'Demo data'}</span>
    </button>
  )
}
