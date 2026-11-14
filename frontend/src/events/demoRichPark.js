// Fuller (fictional) content for the Blue Science Park demo opportunities in events/demoWorkflow.js, keyed by slug.
//   description  events: the full text shown in the detail popup (the card shows its first sentences)
//   details      other categories: the full text shown in the detail popup
//   rich         extra rows in the popup: [label, text]
// Everything is invented for the demo. Nothing here is a commitment by Blue Science Park or by any company.
const ORG = 'Blue Science Park is the fictional organiser. It brings members together and does not sell anything at these sessions.'

export const PARK_RICH = {
  'autonomy-day': {
    description: 'A day of live demonstrations of uncrewed vessels and subsea vehicles, with short talks on safety cases, sensing and regulation. Purpose: let members see what is possible today and meet the teams behind it. Audience: maritime and technology companies, test providers and researchers. Agenda: morning demonstrations at the quay, lunch, afternoon talks and an open Q&A. Expected outcomes: a clearer view of what autonomy could do for your operations and a list of people to follow up with.',
    rich: [['Agenda', 'Quayside demonstrations · Lunch and networking · Talks on safety cases and sensing · Open Q&A'], ['Expected outcomes', 'A clearer view of autonomy options and contacts to follow up with'], ['Organiser context', ORG], ['What members can gain', 'See working systems first-hand and meet suppliers and test providers in one place']],
  },
  'cyber-workshop': {
    description: 'A hands-on workshop on securing connected equipment in industrial settings: asset inventories, secure updates and incident response. Purpose: leave with a practical plan you can start on the next day. Audience: operations leads, engineers and IT staff at member companies. Agenda: build an asset list, plan updates, rehearse an incident call. Expected outcomes: a one-page security plan and a named owner for each step.',
    rich: [['Agenda', 'Asset inventory exercise · Secure update planning · Incident response rehearsal'], ['Expected outcomes', 'A one-page plan and a named owner for each step'], ['Organiser context', ORG], ['What members can gain', 'A concrete starting point and peers to compare notes with']],
  },
  'ai-workshop': {
    description: 'A practical online session on choosing a first AI project, estimating effort and avoiding common traps. Purpose: help small and medium companies pick one realistic first use. Audience: owners, product leads and operations managers. Agenda: example use cases, a simple scoring exercise and a Q&A. Expected outcomes: a ranked list of candidate projects and the data you would need for each.',
    rich: [['Agenda', 'Use-case examples · Scoring exercise · Data checklist · Q&A'], ['Expected outcomes', 'A ranked list of candidate AI projects and the data needed for each'], ['Organiser context', ORG], ['What members can gain', 'A realistic first project and a checklist you can reuse']],
  },
  'networking': {
    description: 'An evening of structured introductions between companies from different sectors, built around short problem pitches. Purpose: help members meet people they would not otherwise meet. Audience: founders and business developers. Agenda: three-minute pitches, themed tables and open networking. Expected outcomes: two or three follow-up conversations per attendee.',
    rich: [['Agenda', 'Three-minute problem pitches · Themed tables · Open networking'], ['Expected outcomes', 'Two or three useful follow-up conversations per attendee'], ['Organiser context', ORG], ['What members can gain', 'Introductions across sectors without a sales pitch']],
  },
  'iot-meetup': {
    description: 'Five-minute talks on IoT deployments that worked, and ones that did not, followed by an open discussion. Purpose: share practical lessons between members. Audience: engineers and product owners working with connected devices. Agenda: five short talks and an open discussion. Expected outcomes: a shared list of do and do-not lessons.',
    rich: [['Agenda', 'Five five-minute talks · Open discussion'], ['Expected outcomes', 'A shared list of lessons from real deployments'], ['Organiser context', ORG]],
  },
  'energy-webinar': {
    description: 'A webinar on resilience in local energy systems: what fails, how grids recover and what small companies can do. Purpose: give members a shared picture of the risks. Audience: energy, facility and operations teams. Agenda: two short talks and questions. Expected outcomes: a checklist for energy resilience in your own site.',
    rich: [['Agenda', 'Two short talks · Questions from the audience'], ['Expected outcomes', 'A checklist for energy resilience at your own site'], ['Organiser context', ORG]],
  },
  'past-infoday': {
    description: 'An information day about funding routes for marine and maritime technology companies, with time for one-to-one questions. Purpose: help members understand which routes fit them. Audience: companies preparing an application. Agenda: overview talks and one-to-one sessions. Expected outcomes: a shortlist of routes to look at. This event has taken place.',
    rich: [['Agenda', 'Overview of funding routes · One-to-one question sessions'], ['Organiser context', ORG], ['What members gained', 'A shortlist of funding routes worth a closer look']],
  },
  'past-meetup': {
    description: 'An informal meetup with short presentations from member companies and time to talk. Purpose: keep members in touch. Audience: all members. Agenda: short presentations and open time. This event has taken place.',
    rich: [['Agenda', 'Short member presentations · Open time to talk'], ['Organiser context', ORG]],
  },
  'marine-call': {
    details: 'A fictional funding call used to demonstrate how Fyyr lists funding. Scope: pilots that reduce the environmental impact of marine operations, for example cleaner hull maintenance or lower-energy vessels. It does not exist and no money is offered. Eligibility: small and medium companies in the Baltic region (fictional). Demo amount: 50,000 to 250,000 SEK per project. How to apply: a short project description, a budget and one partner letter.',
    rich: [['Scope', 'Pilots that cut the environmental impact of marine operations'], ['Application steps', 'Short project description · Budget · One partner letter · Submit before the deadline'], ['Organiser context', ORG + ' It does not provide the funding.'], ['What members can gain', 'Practice reading a call and checking eligibility before applying to a real one']],
  },
  'digital-voucher': {
    details: 'A fictional voucher draft for small suppliers that want help with a first digitalisation step. Scope: advice from an approved consultant for up to ten days. Eligibility: small suppliers (fictional). How to apply: a one-page need description. Still a draft.',
    rich: [['Scope', 'Up to ten consultant days for a first digitalisation step'], ['Application steps', 'One-page need description · Short review']],
  },
  'sensor-programme': {
    details: 'A fictional programme that lets member companies test sensors on a shared rig. Facilities: a water tank, a signal rig and a logging station. Capabilities: repeatable test runs and side-by-side comparison. Access requirements: a short test description and safety information. Example uses: comparing two prototypes, checking drift after cold storage.',
    rich: [['Facilities', 'Water tank, signal rig and logging station (fictional)'], ['Access requirements', 'A short test description and safety information'], ['Example uses', 'Comparing two prototypes · Checking drift after cold storage'], ['Organiser context', ORG], ['What members can gain', 'A fair, repeatable way to test without building your own rig']],
  },
  'pilot-site': {
    details: 'A fictional coastal site where members can run short field pilots. Facilities: a quay, power and a small workshop. Capabilities: outdoor testing in real weather and water. Access requirements: a pilot plan, insurance and a named contact. Example uses: a week-long trial of a coastal sensor or a small vehicle.',
    rich: [['Facilities', 'Quay, power supply and a small workshop (fictional)'], ['Access requirements', 'A pilot plan, insurance and a named contact'], ['Example uses', 'A week-long trial of a coastal sensor or a small vehicle'], ['Organiser context', ORG], ['What members can gain', 'Real-world conditions without arranging your own site']],
  },
  'autonomy-briefing': {
    details: 'Summary: a short briefing on where autonomy is already used in marine operations and what is still hard. Key takeaways: inspection and survey are mature, crewed-vessel interaction is not; safety cases decide how fast projects move; small suppliers win by being clear about limits. Relevance: members considering autonomy pilots or selling into them.',
    rich: [['Key takeaways', 'Inspection and survey are mature · Interaction with crewed vessels is not · Clear limits help small suppliers'], ['Why it matters', 'Helps members decide where an autonomy pilot is realistic'], ['Organiser context', ORG]],
  },
  'nis2-guide': {
    details: 'Summary: a plain-language guide to what NIS2 means for small companies. Archived. Key takeaways: check whether you are in scope, list your critical systems, agree who reports incidents.',
    rich: [['Key takeaways', 'Check scope · List critical systems · Agree who reports incidents']],
  },
  'seek-subsea': {
    details: 'A fictional listing from a company looking for a partner to trial subsea communication equipment. Expertise sought: test waters and measurement skills. Offered: prototype units and engineering time (fictional). Location: Blekinge. Potential collaboration: a short joint trial and a shared test report.',
    rich: [['Looking for', 'A partner with access to test waters and measurement expertise'], ['Can offer', 'Prototype units and engineering time (fictional)'], ['Potential collaboration', 'A short joint trial and a shared test report'], ['Organiser context', ORG + ' It only publishes the listing; it does not vouch for either company.']],
  },
  'offer-embedded': {
    details: 'A fictional listing from a consultant offering embedded software support to hardware companies. Expertise: real-time software, sensor interfaces and low-power design. Offers: design reviews and short sprints. Location: Karlskrona. Seeks: hardware companies with a concrete interface problem. Potential collaboration: a two-day review of a sensor interface.',
    rich: [['What they offer', 'Design reviews and short development sprints (fictional)'], ['What they seek', 'Hardware companies with a concrete interface problem'], ['Potential collaboration', 'A two-day review of a sensor interface'], ['Organiser context', ORG + ' It only publishes the listing.']],
  },
}
