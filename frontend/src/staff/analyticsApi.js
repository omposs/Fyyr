import { getSession } from '../auth.js'
import { demoEvents, DEMO_COMPANIES } from './demoEvents.js'
import { readLive } from './events.js'

// ---- Replaceable data layer ----
// Every staff screen reads analytics through this file only. Today it reads the simulated sample or the events recorded in this
// browser. To go live, replace these functions with calls to a backend endpoint.
//
// ACCESS: the staff check below runs in the browser, so it only protects this prototype. Before real member data is used,
// the same check, the small-group threshold and the export rules must be enforced on the server, because anything in
// the browser can be bypassed.
export class AccessError extends Error {}
const assertStaff = () => { if (getSession()?.role !== 'staff') throw new AccessError('Staff access required') }

export const SOURCES = [
  ['demo', 'Simulated sample', 'Generated demo data: 14 real Blue Science Park member companies with simulated activity, 180 days. No real company did any of it.'],
  ['live', 'Recorded in this browser', 'Events recorded when someone uses the member area in this browser. Demo session, one company.'],
]

export function loadEvents(source) { assertStaff(); return source === 'live' ? readLive() : demoEvents() }
// Companies that agreed (simulated consent) to let staff see their own activity summary.
export function sharedCompanies(source) { assertStaff(); return source === 'demo' ? DEMO_COMPANIES.filter(c => c.share) : [] }
export const demoCompany = id => DEMO_COMPANIES.find(c => c.id === id)
export const allDemoCompanies = () => { assertStaff(); return DEMO_COMPANIES }
