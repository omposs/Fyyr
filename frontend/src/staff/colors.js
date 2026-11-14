// One place for analytics colours. Keyed by STABLE ids (category id, topic name), never by array position,
// so a category or topic keeps its colour after filtering or sorting.

export const PALETTE = ['#2b3cff', '#7a5af8', '#0e9f8e', '#d97706', '#d6336c']

// Opportunity categories (member/data.js MCATS ids): blue, purple, teal, amber, pink.
export const CAT_COLOR = { events: PALETTE[0], funding: PALETTE[1], testing: PALETTE[2], knowledge: PALETTE[3], people: PALETTE[4] }

// Topics (staff/topics.js TOPIC_RULES labels). A separate, more muted family so topics are never mistaken for categories
// or science parks. Reused wherever a topic is drawn.
export const TOPIC_COLOR = {
  'Testing environments': '#2c5282',
  'Funding & grants': '#946b00',
  'Cybersecurity': '#a61e4d',
  'Defence supply': '#475569',
  'AI & data': '#6b5b95',
  'Energy': '#2f9e44',
  'Maritime & offshore': '#0b7285',
  'IoT & sensors': '#7c8a1e',
  'Digital health': '#8e3b8f',
  'Events & networking': '#a0522d',
  'International growth': '#20806b',
  'Partners & expertise': '#b4532a',
}
export const topicColor = t => TOPIC_COLOR[t] || '#64748b'
export const tint = c => `color-mix(in srgb, ${c} 16%, #fff)`
