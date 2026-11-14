import { useId } from 'react'
import { Icon } from '../Icons.jsx'
import './extras.css'

// One search component for every member page. Plain text search never depends on AI: "Ask AI" appears only when the caller passes
// onAsk (live mode, where the assistant exists). `scope` names the collection being searched when it is narrower than everything.
export default function SearchBar({ value, onChange, onSubmit, scope, onAsk, label = 'Search opportunities' }) {
  const uid = useId()
  return (
    <form className="msb" role="search" onSubmit={e => { e.preventDefault(); onSubmit?.(value.trim()) }}>
      <div className="msb-box">
        <svg className="msb-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input id={uid} type="search" aria-label={label} aria-describedby={scope ? uid + 's' : undefined} placeholder="Search events, funding, experts and more…" value={value} maxLength={80} autoComplete="off" enterKeyHint="search"
          onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') } }} />
        {value && <button type="button" className="msb-clear" aria-label="Clear search" onClick={() => { onChange(''); document.getElementById(uid)?.focus() }}><Icon n="x" size={16} /></button>}
        <button type="submit" className="btn btn-primary btn-sm msb-go">Search</button>
        {onAsk && <button type="button" className="btn btn-glass btn-sm msb-ask" onClick={onAsk}>Ask AI</button>}
      </div>
      {scope && <p className="msb-scope" id={uid + 's'}>Searching within <b>{scope}</b> only.</p>}
    </form>
  )
}
