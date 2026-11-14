// Data configuration. Set VITE_DEMO_OPPORTUNITIES=false (for example in .env.production) to switch off all seeded demo content
// once real API data is connected. Real records are never affected by this switch.
export const DEMO_ENABLED = import.meta.env?.VITE_DEMO_OPPORTUNITIES !== 'false'

// The one reference date every demo offset is measured from. Default: today, so examples never go stale.
// To freeze the demo (for screenshots or tests) set VITE_DEMO_REFERENCE_DATE=YYYY-MM-DD.
const fixed = import.meta.env?.VITE_DEMO_REFERENCE_DATE
export const demoReference = () => (/^\d{4}-\d{2}-\d{2}$/.test(fixed || '') ? new Date(fixed + 'T12:00:00') : new Date())

// Fictional science-park companies and demo suggestions. Set VITE_DEMO_NETWORK=false to hide them when real network data is connected.
export const DEMO_NETWORK_ENABLED = import.meta.env?.VITE_DEMO_NETWORK !== 'false'
