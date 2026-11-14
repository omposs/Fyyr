import { COMPANIES as NET, PARKS } from '../network/data.js'
import { DEMO_COMPANIES } from './demoEvents.js'
import { groupTopic, UNGROUPED } from './topics.js'

// ============================================================================================
// Staff company directory: ONE list, one identity per company, so it can later be replaced by an API.
//  - Real organisations from the science-park network, kept only where the park affiliation is confirmed against the park's own pages.
//    Name, description and affiliation are verified facts (see data/verifiedNetwork.js).
//  - Fourteen of them (all Blue Science Park members) also carry SIMULATED activity for the demo: their sector grouping, interests,
//    consent to share a summary and every search, view and save are invented (staff/demoEvents.js). They are flagged `simulated`.
//    Other real companies carry no activity at all.
// Awaiting-review and network-only fictional records stay in the network page.
// ============================================================================================
const SECTOR_RULES = [
  ['Maritime & offshore', /maritime|offshore|marine|ocean|wave|vessel|ship/i],
  ['Energy', /energy|power|grid|hydrogen|wind|solar|battery|storage/i],
  ['Health & life science', /health|medtech|clinical|life science|biotech|medical|pharma/i],
  ['Software & IT', /software|cloud|cyber|security|data|ai\b|digital|it service|communication|network/i],
  ['Advanced manufacturing', /manufactur|industr|automation|material|construction|cable|sealing|robot|plastic|product/i],
]
const sectorOf = text => (SECTOR_RULES.find(([, re]) => re.test(text)) || ['Other'])[0]

const topicsOf = tags => [...new Set(tags.map(groupTopic).filter(t => t !== UNGROUPED))]

const SIM = new Map(DEMO_COMPANIES.map(c => [c.netId, c]))
const verified = () => NET.filter(c => !c.isDemo && c.affiliation.status === 'confirmed').map(c => {
  const tags = [...c.industry, ...c.tech]
  const sim = SIM.get(c.id)
  return {
    id: c.id, name: c.name, park: c.park, parkName: PARKS[c.park].name, fictional: false, simulated: !!sim,
    sector: sim ? sim.sector : sectorOf(tags.join(' ') + ' ' + c.summary),
    status: 'Verified affiliation', relation: c.affiliation.relation, summary: c.summary, website: c.website, evidence: c.affiliation.u, checked: c.affiliation.d,
    interests: sim ? sim.interests : topicsOf([...tags, c.summary]).slice(0, 3), tags: tags.slice(0, 6), eventId: sim ? sim.id : null, share: sim ? sim.share : false,
  }
})

export const listDirectory = () => verified().sort((a, b) => a.name.localeCompare(b.name, 'sv'))
export const DIRECTORY_SECTORS = ['Maritime & offshore', 'Energy', 'Software & IT', 'Advanced manufacturing', 'Health & life science', 'Other']
