// ============================================================================================
// COMMITTED DEMO FIXTURES: the opportunities owned by Saab (the Anna Johansson demo account). Version-controlled baseline.
//
//   12 records: 3 drafts, 6 published, 2 past, 1 archived. Company-only and public examples across every category.
//   Owner is the stable company id "saab" (never a display name or an email), so renaming the account cannot orphan them.
//   Everything is FICTIONAL (flag demoMember: shown with a Demo label, no real link, no commitment by Saab or anyone else).
//
// How they load: events/eventStore.js merges these as the BASELINE of the event list in demo content mode, by stable id. No seed
// command, nothing is copied into browser storage, and clearing storage or logging out cannot remove them. A user's edits and status
// changes are saved as account-scoped overrides on top of them (same id, no duplicates); a deliberate delete is remembered separately.
// Live content mode never includes them.
//
// Dates are OFFSETS IN DAYS from today (`rel`), the same relative-date strategy as the rest of the demo, so published items stay upcoming
// and past items stay past however long the project sits. An edited record keeps the absolute dates the user chose.
// Statuses: draft | published | archived. "Past" is derived from an event date in the past (stateOf), never stored.
// ============================================================================================
export const SAAB_OWNER = { email: 'anna.johansson@saab.se', company: 'Saab', companyId: 'saab' }
export const FIXTURE_PREFIX = 'ev-saab-'
const CONTACT = SAAB_OWNER.email

const ev = (slug, visibility, o) => ({ category: 'events', status: 'published', visibility, type: 'Workshop', mode: 'in-person', location: 'Karlskrona', start: '09:00', end: '12:00', industries: ['Maritime & offshore'], contact: CONTACT, ...o, slug })
const fund = (slug, visibility, o) => ({ category: 'funding', status: 'published', visibility, industries: ['Maritime & offshore'], contact: CONTACT, ...o, slug })
const test = (slug, visibility, o) => ({ category: 'testing', status: 'published', visibility, industries: ['Maritime & offshore'], contact: CONTACT, ...o, slug })
const know = (slug, visibility, o) => ({ category: 'knowledge', status: 'published', visibility, industries: ['Maritime & offshore'], contact: CONTACT, ...o, slug })
const peer = (slug, visibility, o) => ({ category: 'people', status: 'published', visibility, industries: ['Maritime & offshore'], contact: CONTACT, ...o, slug })

export const SAAB_FIXTURES = [
  // ---------------- drafts (3) ----------------
  fund('internal-fund', 'company', { status: 'draft', title: 'Internal innovation fund: 2027 pre-application', tags: ['internal funding', 'pilot'],
    description: 'A fictional internal call for small pilot budgets. Still being drafted.',
    details: 'A fictional internal funding round for teams that want a small budget to run a pilot in 2027. This draft sets out scope, who can apply and how to apply before it is shared inside the company.',
    rel: { deadline: 40 }, rich: [['Scope', 'Small internal pilots lasting up to six months'], ['Application steps', 'One-page idea note · Review by the innovation board · Decision within three weeks']],
    x: { sharedAs: 'provider', provider: 'Saab innovation team (fictional)', fundingType: 'Internal budget', amountMode: 'specified', amount: '50,000 to 150,000', currency: 'SEK', purpose: 'Fictional seed budgets for internal pilots', geography: 'Saab Karlskrona', deadlineMode: 'fixed', eligibility: 'Saab teams with a named sponsor (fictional)' } }),
  fund('shared-call', 'public', { status: 'draft', title: 'Shared call: Baltic subsea pilot funding', tags: ['funding', 'subsea', 'pilot'],
    description: 'A fictional funding call that Saab wants to share with other companies. Still a draft.',
    details: 'Draft of a fictional shared call. Saab is not the funding provider; it is sharing a call it heard about so other companies can look at it. Check eligibility with the provider before applying.',
    rel: { deadline: 55 }, rich: [['Application steps', 'Read the provider page · Check eligibility · Prepare a short project description · Apply before the deadline']],
    x: { sharedAs: 'shared', provider: 'Fictional Baltic Blue Programme', fundingType: 'Grant', amountMode: 'specified', amount: '100,000 to 400,000', currency: 'SEK', purpose: 'Fictional co-funding for subsea pilots', geography: 'Baltic Sea region', deadlineMode: 'fixed', eligibility: 'Small and medium companies (fictional)' } }),
  test('open-bench', 'public', { status: 'draft', title: 'Open sensor integration bench', tags: ['sensors', 'integration', 'test bench'],
    description: 'A fictional bench that Saab plans to open to outside companies for short sensor integration tests. Still a draft.',
    details: 'A fictional open bench in Karlskrona where outside companies can connect a sensor or module to a realistic signal chain and check interfaces, timing and noise. Slots are short and booked in advance; results stay with the booking company.',
    rel: {}, rich: [['Facilities', 'Reference signal chain, power and timing sources, logging station (fictional)'], ['Access requirements', 'Booking by email; a short description of the test and safety information'], ['Example uses', 'Checking timing between two sensors · Measuring noise on a new interface']],
    x: { kind: 'Testbed', locMode: 'site', location: 'Karlskrona (fictional)', availMode: 'ongoing', capabilities: 'Reference signal chain, timing sources, logging', access: 'Booking by email; one-hour slots', applications: 'Sensor and interface tests', cost: 'Not stated' } }),

  // ---------------- published (6) ----------------
  ev('innovation-workshop', 'company', { title: 'Internal innovation workshop: autonomy use cases', type: 'Workshop', tags: ['innovation', 'autonomy', 'internal'],
    description: 'A fictional internal workshop for Saab Karlskrona teams to collect and rank ideas for autonomous systems. Purpose: agree three use cases worth a small internal pilot. Audience: Saab engineers, product owners and the innovation team. Agenda: short problem pitches, small-group ideation, a ranking round and next steps. Expected outcome: a shortlist of three use cases with an owner each. Internal only.',
    rel: { date: 12, regDeadline: 9 }, rich: [['Agenda', 'Welcome and goals · Three problem pitches · Group ideation · Ranking round · Owners and next steps'], ['Expected outcomes', 'A ranked shortlist of three autonomy use cases, each with an owner and a first step'], ['Who should attend', 'Saab engineers, product owners and the innovation team']] }),
  ev('maritime-collab', 'public', { title: 'Maritime collaboration workshop', type: 'Workshop', tags: ['maritime', 'collaboration', 'partners'], start: '10:00', end: '15:00',
    description: 'A fictional open workshop where Saab invites companies in Blekinge to find joint pilots in maritime technology. Purpose: match companies that have a problem with companies that have a solution. Audience: small and medium maritime companies, researchers and test providers. Agenda: short introductions, topic tables, and a matching round. Expected outcome: two or three concrete pilot ideas with named partners. Nothing here is a commitment by Saab or any company.',
    rel: { date: 30, regDeadline: 23 }, rich: [['Agenda', 'Introductions · Topic tables (sensing, autonomy, communication) · Matching round · Next steps'], ['Expected outcomes', 'Two or three pilot ideas with named partners; no commitments are made'], ['Who should attend', 'Small and medium maritime companies, researchers and test providers']] }),
  test('sensor-session', 'company', { title: 'Internal sensor testing session', tags: ['sensors', 'testing', 'internal'],
    description: 'A fictional booked session for Saab teams to test sensor prototypes together on the internal bench.',
    details: 'A fictional internal session for Saab teams to bring sensor prototypes to a shared bench and test them against the same scenarios. Teams book a one-hour slot, run the shared test plan and record results in one place so prototypes can be compared fairly.',
    rel: { availFrom: 3, availTo: 25 }, rich: [['Facilities', 'Shared bench with power, signal generators and a data logger (fictional)'], ['Access requirements', 'Saab employees only; book a slot with the innovation team'], ['Example uses', 'Comparing two hydrophone prototypes · Checking sensor drift after cold storage']],
    x: { kind: 'Lab', locMode: 'site', location: 'Karlskrona, Saab test hall (fictional)', availMode: 'period', capabilities: 'Shared bench, signal generators, data logger', access: 'Saab employees only. Book a one-hour slot.', applications: 'Prototype sensors and signal chains', cost: 'Internal' } }),
  know('lessons-note', 'company', { title: 'Lessons learned: sensor calibration in cold water', tags: ['calibration', 'sensors', 'internal'],
    description: 'A fictional internal note summarising how sensor calibration drifts in cold water and what the team now checks before every trial.',
    details: 'Summary: across fictional trials in cold water, calibration drifted most in the first twenty minutes after submersion. Key takeaways: let sensors equalise before logging, calibrate at trial temperature rather than in the lab, and record water temperature with every dataset. Relevance: anyone running sensor trials this season.',
    rel: { pubDate: -6 }, rich: [['Key takeaways', 'Let sensors equalise for twenty minutes · Calibrate at trial temperature · Log water temperature with every dataset'], ['Why it matters', 'Avoids re-running trials because of avoidable calibration drift']],
    x: { contentType: 'Guide', publisher: 'Saab innovation team (fictional)' } }),
  know('trends-note', 'public', { title: 'Autonomy and safety cases: a short trend note', tags: ['autonomy', 'safety', 'trend'],
    description: 'A fictional short note on how safety cases for autonomous systems are changing and what small suppliers should prepare.',
    details: 'Summary: customers increasingly ask suppliers for a short safety argument, not only test results. Key takeaways: describe the operating limits clearly, keep a log of hazards and how each is handled, and show how updates are tested. Relevance: suppliers who want to join autonomy pilots.',
    rel: { pubDate: -10 }, rich: [['Key takeaways', 'State operating limits clearly · Keep a hazard log · Show how updates are tested'], ['Why it matters', 'Helps small suppliers join autonomy pilots without surprises']],
    x: { contentType: 'Briefing', publisher: 'Saab innovation team (fictional)' } }),
  peer('pilot-partners', 'public', { title: 'Call for pilot partners: autonomous hull inspection', tags: ['pilot', 'inspection', 'autonomy'],
    description: 'A fictional call from Saab for partners to trial hull inspection with autonomous vehicles. Looking for a harbour or vessel owner and a sensor supplier.',
    details: 'Fictional call. Saab is looking for a harbour or vessel owner willing to host a short trial, and a sensor supplier who can provide imaging or sonar modules. Saab can offer vehicle time and engineering support. The intended outcome is a short joint test report. This is a suggestion for conversation, not an agreement.',
    rel: {}, rich: [['Looking for', 'A harbour or vessel owner to host a trial; a sensor supplier for imaging or sonar modules'], ['Can offer', 'Vehicle time and engineering support (fictional)'], ['Potential collaboration', 'A two-week trial in spring and a shared test report']],
    x: { listing: 'seek', project: 'Trial of autonomous hull inspection', sought: 'A harbour or vessel owner and a sensor supplier', canOffer: 'Vehicle time and engineering support (fictional)', outcome: 'A short joint test report', timeframe: 'Spring' } }),

  // ---------------- past (2) ----------------
  ev('past-demo-day', 'company', { title: 'Internal demo day: Q3 prototypes', type: 'Conference', tags: ['demo day', 'prototypes', 'internal'], start: '13:00', end: '16:00',
    description: 'A fictional internal demo day where Saab teams showed Q3 prototypes to colleagues. This event has taken place.',
    rel: { date: -14, regDeadline: -18 }, rich: [['Outcome', 'Four prototypes shown; two selected for further internal testing (fictional)']] }),
  ev('past-workshop', 'public', { title: 'Maritime sensing open workshop (held last month)', type: 'Workshop', tags: ['sensing', 'maritime', 'open'], start: '10:00', end: '14:00',
    description: 'A fictional open workshop on sensing in cold coastal water, hosted by Saab for local companies. Purpose: share practical lessons. Audience: maritime and technology companies. Agenda: three short talks and a hands-on demo. This event has taken place.',
    rel: { date: -30, regDeadline: -35 }, rich: [['Agenda', 'Three short talks · Hands-on sensor demo · Open questions'], ['Outcome', 'A shared list of sensing lessons; two follow-up meetings agreed between attendees (fictional)']] }),

  // ---------------- archived (1) ----------------
  peer('archived-offer', 'public', { status: 'archived', title: 'Offering: systems integration advice', tags: ['systems integration', 'advice'],
    description: 'A fictional listing offering short systems integration advice to hardware companies. Archived, so it no longer appears in discovery.',
    rel: {}, x: { listing: 'offer', who: 'A fictional Saab systems engineer', expertise: 'Interfaces between sensors, power and software', services: 'Short design reviews', location: 'Karlskrona', availability: 'Archived' } }),
]
export const FIXTURE_IDS = new Set(SAAB_FIXTURES.map(s => FIXTURE_PREFIX + s.slug))
