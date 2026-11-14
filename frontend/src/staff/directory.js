import { COMPANIES as NET, PARKS } from '../network/data.js'
import { DEMO_COMPANIES } from './demoEvents.js'
import { groupTopic, UNGROUPED } from './topics.js'

// ============================================================================================
// Staff company directory: ONE list built from two sources, so it can later be replaced by an API.
//  - verified: real organisations from the science-park network, kept only where the park affiliation is confirmed.
//    They carry NO simulated activity: their behaviour on Fyyr is unknown, so none is shown.
//  - fictional: the invented companies that the simulated analytics are generated for (staff/demoEvents.js).
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

const verified = () => NET.filter(c => !c.isDemo && c.affiliation.status === 'confirmed').map(c => {
  const tags = [...c.industry, ...c.tech]
  return {
    id: c.id, name: c.name, park: c.park, parkName: PARKS[c.park].name, sector: sectorOf(tags.join(' ') + ' ' + c.summary), fictional: false,
    status: 'Verified affiliation', relation: c.affiliation.relation, summary: c.summary, website: c.website, evidence: c.affiliation.u,
    interests: topicsOf([...tags, c.summary]).slice(0, 3), tags: tags.slice(0, 6), eventId: null,
  }
})
const fictional = () => DEMO_COMPANIES.map(c => ({
  id: c.id, name: c.name, park: c.park, parkName: PARKS[c.park].name, sector: c.sector, fictional: true,
  status: 'Fictional demo', relation: 'Fictional demo company', summary: `Invented ${c.sector.toLowerCase()} company used for the simulated analytics.`, website: '', evidence: null,
  interests: c.interests, tags: [], eventId: c.id, share: c.share,
}))

export const listDirectory = () => [...verified(), ...fictional()].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
export const DIRECTORY_SECTORS = ['Maritime & offshore', 'Energy', 'Software & IT', 'Advanced manufacturing', 'Health & life science', 'Other']
