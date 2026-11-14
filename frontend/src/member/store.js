import { useState } from 'react'
import { DEFAULT_PROFILE, EDITABLE_PROFILE_KEYS, LOCKED_PROFILE, normInterest } from './data.js'
import { track } from '../staff/events.js'
import { UNGROUPED, groupTopic } from '../staff/topics.js'

// Demo profile and saved items, stored only in this browser. Never stores passwords or codes.
const KEY = 'fyyr.member.v1'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true } catch { return false } }

// Case- and whitespace-insensitive de-duplication; keeps the first spelling.
export const dedupe = list => { const seen = new Set(); return list.map(s => s.trim().replace(/\s+/g, ' ')).filter(s => { const k = normInterest(s); if (!s || seen.has(k)) return false; seen.add(k); return true }) }

export function useMemberStore(sessionEmail) {
  const [state, setState] = useState(() => { const s = read(); return { profile: s.profile || {}, saved: Array.isArray(s.saved) ? s.saved : [] } })
  const commit = next => { setState(next); return write(next) }
  // Locked details always win over anything stored earlier (older saves may hold a previous name or company).
  const profile = { ...DEFAULT_PROFILE, ...state.profile, ...LOCKED_PROFILE, email: state.profile.email ?? sessionEmail ?? '' }
  return {
    profile,
    setProfile: input => {
      // Enforced here, not only in the form: only email and interests can change. Company and account details cannot.
      const patch = Object.fromEntries(Object.entries(input).filter(([k]) => EDITABLE_PROFILE_KEYS.includes(k)))
      // Keep everything already saved (including wanted types and goals) except the locked company details.
      const own = Object.fromEntries(Object.entries(state.profile).filter(([k]) => !(k in LOCKED_PROFILE)))
      // Selected interests and wanted types are STATED interests. Only topic labels are recorded, not the raw text.
      if (patch.interests || patch.wants) track('interests_set', { interests: [...new Set((patch.interests || profile.interests).map(groupTopic).filter(t => t !== UNGROUPED))], wants: patch.wants || profile.wants })
      return commit({ ...state, profile: { ...own, ...patch } })
    },
    saved: state.saved,
    toggleSaved: id => commit({ ...state, saved: state.saved.includes(id) ? state.saved.filter(x => x !== id) : [...state.saved, id] }),
  }
}

// Initial saves for a demo account, applied ONCE per account (marker below). Items the user later unsaves are never restored.
const SEED_KEY = 'fyyr.member.savedseed.v1'
export function seedSavedOnce(who, ids) {
  if (!who) return
  let marks = {}
  try { marks = JSON.parse(localStorage.getItem(SEED_KEY)) || {} } catch { marks = {} }
  if (marks[who]) return
  const cur = read()
  const saved = Array.isArray(cur.saved) ? cur.saved : []
  if (!write({ ...cur, saved: [...new Set([...saved, ...ids])] })) return
  try { localStorage.setItem(SEED_KEY, JSON.stringify({ ...marks, [who]: Date.now() })) } catch { /* storage blocked: nothing was saved either */ }
}
