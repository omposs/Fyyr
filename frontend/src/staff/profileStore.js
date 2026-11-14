import { useState } from 'react'

// The staff member's own profile, stored in this browser only (prototype). It is a separate record from any member profile,
// even for the same person: different key, different permissions, different owned content and preferences.
const KEY = 'fyyr.staff.profile.v1'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true } catch { return false } }

// Identity and organisation are fixed and read-only. Job title has no staff-specific value on record, so it stays "Not specified".
export const STAFF_LOCKED = {
  name: 'Erik Andersson', initials: 'EA', organisation: 'Blue Science Park', role: 'Staff', office: 'Karlskrona, Sweden', title: 'Head of Operations',
}
export const STAFF_EDITABLE = ['email', 'notify']
const DEFAULTS = { email: 'erik.andersson@bsp.se', notify: { attention: true, shared: true } }

export function useStaffProfile() {
  const [saved, setSaved] = useState(read)
  const profile = { ...DEFAULTS, ...Object.fromEntries(Object.entries(saved).filter(([k]) => STAFF_EDITABLE.includes(k))), notify: { ...DEFAULTS.notify, ...saved.notify }, ...STAFF_LOCKED }
  return {
    profile,
    // Only the editable fields are accepted here; identity and organisation cannot be changed by any caller.
    save: patch => {
      const next = { ...saved, ...Object.fromEntries(Object.entries(patch).filter(([k]) => STAFF_EDITABLE.includes(k))) }
      setSaved(next)
      return write(next)
    },
  }
}
