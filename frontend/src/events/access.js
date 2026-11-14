import { MEMBER_LOGOS } from '../logos.js'
import { getSession } from '../auth.js'
import { DEFAULT_PROFILE } from '../member/data.js'
import { CONTACTS } from './contacts.js'

// ============================================================================================
// SIMULATED ACCESS CONTROL. Runs in the browser and reads the same localStorage as everything else, so it is NOT security:
// anyone with developer tools can read or change it. It models the rules a server would enforce.
// Every decision goes through canView / canEdit / canManageAudience so a server can replace these three functions.
// ============================================================================================
export const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function companyIdOf(name) {
  const n = String(name || '').trim().toLowerCase()
  const hit = MEMBER_LOGOS.find(c => c.name.toLowerCase() === n)
  return hit ? hit.slug : slugify(name)
}

// Which company a signed-in member belongs to. In production this comes from the account on the server.
// Demo: a known contact address belongs to that contact's company; any other address uses the company in the browser profile.
export function memberCompany(email) {
  const e = String(email || '').trim().toLowerCase()
  const c = CONTACTS.find(x => x.email.toLowerCase() === e && x.id !== 'dup-demo')
  if (c) return { id: c.companyId, name: c.company }
  let name = DEFAULT_PROFILE.company
  try { name = JSON.parse(localStorage.getItem('fyyr.member.v1'))?.profile?.company || name } catch { /* default */ }
  return { id: companyIdOf(name), name }
}

export const ANON = { role: 'anon', email: '', companyId: '' }
export function viewerFromSession() {
  const s = getSession()
  if (!s) return ANON
  if (s.role === 'staff') return { role: 'staff', email: s.email || 'staff', companyId: '' }
  return { role: 'member', email: String(s.email || '').toLowerCase(), companyId: memberCompany(s.email).id }
}
export const viewerKey = v => `${v.role}|${v.email}|${v.companyId}`

export const isMemberEvent = e => e.source === 'member'
export const sameCompany = (e, v) => v.role === 'member' && !!e.owner && !!v.companyId && e.owner.companyId === v.companyId

// Individual grants are stored as lower-case email addresses.
export const hasMemberGrant = (e, v) => v.role === 'member' && !!v.email && e.access.members.some(m => m.email === v.email)
export const hasCompanyGrant = (e, v) => v.role === 'member' && e.access.companies.some(c => c.id === v.companyId)

export function canView(e, v) {
  if (!isMemberEvent(e)) return e.status === 'published' || v.role === 'staff' // staff events: drafts are staff-only
  if (sameCompany(e, v)) return true // the owner company sees its own drafts and published events
  if (e.status !== 'published') return false // other companies and staff never see member drafts
  if (e.visibility === 'public') return true
  if (!e.shareWithBsp) return false // company-only and not shared: nobody else, not even staff
  if (v.role === 'staff') return true
  return hasCompanyGrant(e, v) || hasMemberGrant(e, v)
}
export function canEdit(e, v) {
  if (!isMemberEvent(e)) return v.role === 'staff'
  return sameCompany(e, v) // staff manage the audience of shared events but never edit their content
}
export const canRegister = (e, v) => canView(e, v) && e.status === 'published'
export const canManageAudience = (e, v) => v.role === 'staff' && isMemberEvent(e) && e.status === 'published' && e.visibility === 'company' && e.shareWithBsp
export const hasGrants = e => e.access.companies.length + e.access.members.length > 0

// Badges. "Shared with Blue Science Park" is a separate management status, not an audience.
export const audienceBadge = e => (e.visibility === 'public' ? 'Public' : e.shareWithBsp && hasGrants(e) ? 'Company + invited guests' : 'Company only')
export const sharedBadge = e => (e.visibility === 'company' && e.shareWithBsp ? 'Shared with Blue Science Park' : null)
export const audienceText = (v, category) => ((!category || category === 'events') ? AUDIENCE_TEXT[v] : v === 'company' ? 'Only members of your company can view this.' : 'Anyone can view this.')
export const AUDIENCE_TEXT = {
  company: 'Only members of your company can view and register for this event.',
  public: 'Anyone can view this event and access its registration information.',
}
