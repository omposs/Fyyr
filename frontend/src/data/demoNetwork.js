// ============================================================================================
// DEMO science-park network content: FICTIONAL companies and suggestions, for design and testing only.
// None of these companies exists. They are never shown as park members, have no website or contact route, and are excluded from
// every contact or follow-up action that points at a real organisation. They exist only so every ecosystem has enough profiles
// to explore where verified information is not enough yet. Remove them with VITE_DEMO_NETWORK=false.
// They reference parks by id (see verifiedNetwork.js) and never define a park.
// ============================================================================================
const D = '2026-11-14'
const df = t => ({ t, u: null, d: D, via: 'demo' }) // a fictional fact: no source, by design
const aff = { status: 'demo', relation: 'Fictional demo company', note: 'Created for this demo. It is not a member of any science park and does not exist.', u: null, d: D }
const co = (id, park, name, summary, x) => ({ id: 'demo-' + id, park, name, website: '', summary, isDemo: true, affiliation: aff, markets: [], projects: [], needs: [], ...x })

export const DEMO_COMPANIES = [
  // Linköping Science Park: nothing could be verified from the park itself, so these four are fictional
  co('ostgota-secure', 'lsp', 'Östgöta Secure Comms', 'Encrypted radio and data links for utilities and municipal operators.', {
    capabilities: [df('Provides end-to-end encrypted radio and data links for utilities.')], markets: [df('Utilities and municipal operators.')],
    needs: [df('Looking for grid-monitoring partners to test its links on live networks.')], industry: ['Energy', 'Public sector'], tech: ['Encryption', 'Secure communications'] }),
  co('linden-vision', 'lsp', 'Linden Vision Systems', 'Machine vision for quality inspection on production lines.', {
    capabilities: [df('Camera-based inspection that flags surface defects in real time.')], markets: [df('Small and mid-sized manufacturers.')], industry: ['Manufacturing'], tech: ['Machine vision', 'AI'] }),
  co('nordvik-motion', 'lsp', 'Nordvik Motion Analytics', 'Analytics on vehicle motion and road-condition data.', {
    capabilities: [df('Turns connected-vehicle motion data into road-condition indicators.')], markets: [df('Road authorities and fleet operators.')], industry: ['Automotive'], tech: ['Connected vehicle data', 'Data analytics'] }),
  co('ljusnaren-medtech', 'lsp', 'Ljusnaren Medtech', 'Software that helps clinicians review medical images faster.', {
    capabilities: [df('Review software that highlights regions of interest in scans.')], markets: [df('Hospital radiology departments.')], industry: ['Health'], tech: ['AI', 'Medical imaging'] }),
  // Kalmar Science Park
  co('tidewater', 'ksp', 'Tidewater Robotics', 'Inspection drones for quays and offshore structures.', {
    capabilities: [df('Small surface drones that inspect hulls, quays and foundations.')], markets: [df('Ports, offshore operators and marine contractors.')],
    needs: [df('Looking for offshore asset owners to run joint inspection demos.')], industry: ['Maritime', 'Offshore'], tech: ['Autonomous vehicles', 'Inspection'] }),
  co('datafabric', 'ksp', 'Kalmar Data Fabric', 'A managed data platform for small manufacturers.', {
    capabilities: [df('Managed platform that collects and stores machine data for small factories.')], markets: [df('Manufacturers with 10 to 250 employees.')],
    needs: [df('Seeking a regional, compliance-focused cloud provider to host customer data.')], industry: ['Manufacturing'], tech: ['Cloud', 'Data platforms'] }),
  // Chalmers Ventures
  co('wavedyn', 'cv', 'Wave Dynamics Lab', 'Simulation of wave loads on floating structures.', {
    capabilities: [df('Simulation software for wave loads and motion of floating structures.')], markets: [df('Wave-energy and offshore developers.')],
    needs: [df('Wants real prototype data from wave-energy developers to validate its models.')], industry: ['Energy', 'Offshore'], tech: ['Wave energy', 'Simulation'] }),
  co('vagbryt', 'cv', 'Vågbryt Sensors', 'Wave and motion sensors for buoys and test rigs.', {
    capabilities: [df('Low-power wave and motion sensors for buoys and test rigs.')], markets: [df('Research groups and marine technology developers.')], industry: ['Marine'], tech: ['Sensors', 'IoT'] }),
  // Science Park Jönköping
  co('gjuteri', 'jsp', 'Gjuteri Automation', 'Control and monitoring systems for foundries.', {
    capabilities: [df('Control and remote-monitoring systems for foundry production lines.')], markets: [df('Foundries and metal producers.')],
    needs: [df('Wants an independent security review of its remote-maintenance access.')], industry: ['Manufacturing'], tech: ['Industrial automation', 'OT networks'] }),
]

const note = 'Fictional example: the companies named as demo do not exist, so there is nothing to verify or contact.'
const sug = (id, a, b, type, theme, topics, why, explore, propose, parts, ev, gaps) => ({ id, a, b, type, theme, topics, why, explore, propose, parts, ev, gaps: [note, ...gaps], next: 'Demo only. Use it to see how a suggestion reads. Do not contact anyone about it.' })
export const DEMO_SUGGESTIONS = [
  sug('s-demo-addsecure-secure', 'addsecure', 'demo-ostgota-secure', 'complementary', 'Secure links for grid monitoring', ['Cybersecurity', 'Energy'],
    'AddSecure monitors power grids; Östgöta Secure Comms (demo) offers encrypted links and wants grid-monitoring partners.',
    'Whether encrypted links could protect grid-monitoring communication.', 'Test whether encrypted links could protect grid-monitoring traffic on a live utility network.',
    'AddSecure: grid-monitoring communication. Östgöta Secure Comms (demo): encrypted links.', [['addsecure', 'capabilities', 0], ['demo-ostgota-secure', 'capabilities', 0], ['demo-ostgota-secure', 'needs', 0]], ['AddSecure’s own security needs are not described on the page read.']),
  sug('s-demo-oht-tidewater', 'oht', 'demo-tidewater', 'complementary', 'Inspecting offshore energy devices', ['Maritime technology', 'Energy'],
    'Ocean Harvesting runs offshore wave-energy prototypes; Tidewater Robotics (demo) inspects offshore structures and seeks asset owners for demos.',
    'Whether surface drones could inspect wave-energy prototypes at sea.', 'Run a joint inspection demo on a wave-energy prototype.',
    'Ocean Harvesting: offshore devices. Tidewater Robotics (demo): inspection drones.', [['oht', 'capabilities', 0], ['oht', 'projects', 0], ['demo-tidewater', 'capabilities', 0], ['demo-tidewater', 'needs', 0]], ['Ocean Harvesting’s inspection needs are not stated.']),
  sug('s-demo-cleura-datafabric', 'cleura', 'demo-datafabric', 'shared', 'Compliant regional cloud for factory data', ['Cloud'],
    'Both work with cloud: Cleura sells compliant cloud and Kalmar Data Fabric (demo) is looking for a regional compliant host.',
    'Whether Cleura could host a data platform for small manufacturers.', 'Explore Cleura as the hosting provider for Kalmar Data Fabric’s customer data.',
    'Cleura: compliant cloud. Kalmar Data Fabric (demo): factory data platform.', [['cleura', 'capabilities', 1], ['demo-datafabric', 'capabilities', 0], ['demo-datafabric', 'needs', 0]], ['Cleura’s fit for manufacturing data is not described on the page read.']),
  sug('s-demo-oht-wavedyn', 'oht', 'demo-wavedyn', 'shared', 'Validating wave-load models with prototype data', ['Energy'],
    'Both work on wave energy: Ocean Harvesting builds converters; Wave Dynamics Lab (demo) needs prototype data to validate its models.',
    'Whether prototype data could help validate wave-load simulation.', 'Share anonymised prototype data to validate Wave Dynamics Lab’s simulations.',
    'Ocean Harvesting: wave-energy prototypes. Wave Dynamics Lab (demo): wave-load simulation.', [['oht', 'capabilities', 0], ['oht', 'projects', 0], ['demo-wavedyn', 'capabilities', 0], ['demo-wavedyn', 'needs', 0]], ['Data-sharing terms are not addressed.']),
  sug('s-demo-dnvcyber-gjuteri', 'dnvcyber', 'demo-gjuteri', 'complementary', 'OT security review for a control-systems supplier', ['Cybersecurity'],
    'DNV Cyber offers OT security services; Gjuteri Automation (demo) wants an independent security review of its remote-maintenance access.',
    'Whether an OT security review fits a control-systems supplier’s remote access.', 'Scope an independent OT security review of remote-maintenance access.',
    'DNV Cyber: OT security. Gjuteri Automation (demo): foundry control systems.', [['dnvcyber', 'capabilities', 0], ['demo-gjuteri', 'capabilities', 0], ['demo-gjuteri', 'needs', 0]], ['DNV Cyber’s experience with foundries is not described on the page read.']),
]
