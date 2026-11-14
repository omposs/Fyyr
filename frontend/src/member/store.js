import { useState } from 'react'
import { DEFAULT_PROFILE, normInterest } from './data.js'

// Demo profile and saved items, stored only in this browser. Never stores passwords or codes.
const KEY = 'fyyr.member.v1'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true } catch { return false } }

// Case- and whitespace-insensitive de-duplication; keeps the first spelling.
export const dedupe = list => { const seen = new Set(); return list.map(s => s.trim().replace(/\s+/g, ' ')).filter(s => { const k = normInterest(s); if (!s || seen.has(k)) return false; seen.add(k); return true }) }

export function useMemberStore(sessionEmail) {
  const [state, setState] = useState(() => { const s = read(); return { profile: s.profile || {}, saved: Array.isArray(s.saved) ? s.saved : [] } })
  const commit = next => { setState(next); return write(next) }
  const profile = { ...DEFAULT_PROFILE, ...state.profile, email: state.profile.email ?? sessionEmail ?? '' }
  return {
    profile,
    setProfile: patch => commit({ ...state, profile: { ...state.profile, ...patch } }),
    saved: state.saved,
    toggleSaved: id => commit({ ...state, saved: state.saved.includes(id) ? state.saved.filter(x => x !== id) : [...state.saved, id] }),
  }
}
